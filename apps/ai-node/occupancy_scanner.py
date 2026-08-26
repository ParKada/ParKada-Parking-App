import cv2
import numpy as np
import os
import time
import threading
from ultralytics import YOLO
from supabase import create_client, Client
from dotenv import load_dotenv

#IMPORTS FOR WEB STREAMING
# pyrefly: ignore [missing-import]
from flask import Flask, Response
from flask_cors import CORS

# =============================================================
# 1. SECURE DATABASE SETUP
# =============================================================
load_dotenv()

VITE_SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
VITE_SUPABASE_SERVICE_KEY = os.getenv("VITE_SUPABASE_SERVICE_KEY")

if not VITE_SUPABASE_URL or not VITE_SUPABASE_SERVICE_KEY:
    print("ERROR: Could not find Supabase keys. Make sure your .env file is set up correctly!")
    exit()

supabase: Client = create_client(VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_KEY)

# =============================================================
# 2. MULTI-CAMERA CONFIGURATION
# 
# Add or remove cameras from this list.
# Each camera needs:
#   - "rtsp_url": The RTSP stream URL for your IP camera
#   - "camera_id": The UUID of this camera in Supabase (from the cameras table)
#   - "label": A friendly name shown in the terminal
#
# HOW TO FIND YOUR camera_id:
#   Open your Admin Dashboard -> Parking Slots -> the camera name.
#   The camera_id is stored in your browser localStorage. Check the
#   browser console: localStorage.getItem('cameras_<lot_id>')
# =============================================================
TARGET_LOT_ID = "b2a68b16-a627-4dd0-8ea2-217634de4e18"

CAMERAS = [
    {
        "label":      "Camera 1 (Right)",
        "rtsp_url":   "rtsp://admincamnew:admincamnew@192.168.8.154:554/stream1",
        "camera_id":  "cam1_b2a68b16-a627-4dd0-8ea2-217634de4e18",  # <-- Paste the camera_id from your dashboard
    },
    {
        "label":      "Camera 2 (Left)",
        "rtsp_url":   "rtsp://admincam:admincam@192.168.8.159:554/stream1",  # <-- e.g. rtsp://admin:pass@192.168.8.155:554/stream1
        "camera_id":  "cam2_b2a68b16-a627-4dd0-8ea2-217634de4e18",  # <-- Paste the camera_id from your dashboard
    },
]

# =============================================================
# 3. SHARED AI MODEL (loaded once, used by all cameras)
# =============================================================
print("Loading custom AI brain (models/occupancy_model.pt)...")
model = YOLO("models/occupancy_model.pt")
model_lock = threading.Lock()  # YOLO is not thread-safe, so we lock it

print("Warming up AI model (please wait a few seconds)...")
dummy = np.zeros((416, 416, 3), dtype=np.uint8)
with model_lock:
    model.predict(dummy, verbose=False, conf=0.4, imgsz=416, device="cpu")
print("Warmup complete!")

# =============================================================
# 4. RTSP STREAM READER (auto-reconnects on failure)
# =============================================================
class RTSPStream:
    def __init__(self, src):
        self.src = src
        self.cap = cv2.VideoCapture(src)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        self.frame = None
        self.ret = False
        self.lock = threading.Lock()
        self.running = True
        threading.Thread(target=self._reader, daemon=True).start()

    def _reader(self):
        while self.running:
            ret, frame = self.cap.read()
            if not ret:
                print(f"[RTSP] Stream lost for {self.src}. Reconnecting in 5s...")
                self.cap.release()
                time.sleep(5)
                self.cap = cv2.VideoCapture(self.src)
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                continue
            with self.lock:
                self.ret = ret
                self.frame = frame

    def read(self):
        with self.lock:
            if self.frame is None:
                return False, None
            return self.ret, self.frame.copy()

    def release(self):
        self.running = False
        self.cap.release()

# =============================================================
# 5. FLASK WEB STREAMING SETUP
# =============================================================
app = Flask(__name__)
CORS(app)

# Each camera gets its own shared frame dict entry keyed by camera_id
shared_frames = {}  # { camera_id: frame_or_None }
shared_frames_lock = threading.Lock()

def generate_frames(camera_id):
    """Generator that yields the latest frame for a specific camera."""
    while True:
        with shared_frames_lock:
            frame = shared_frames.get(camera_id)

        if frame is not None:
            stream_frame = cv2.resize(frame, (1024, 576))
            ret, buffer = cv2.imencode('.jpg', stream_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 28])
            if ret:
                frame_bytes = buffer.tobytes()
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        time.sleep(0.1)  # ~10 fps

@app.route('/')
def index():
    links = "".join(
        f'<li><a href="/video_feed/{c["camera_id"]}">{c["label"]}</a></li>'
        for c in CAMERAS
    )
    return f'<h1>Feldgrau AI Node is Running!</h1><p>Live camera feeds:</p><ul>{links}</ul>'

@app.route('/video_feed/<camera_id>')
def video_feed(camera_id):
    return Response(generate_frames(camera_id), mimetype='multipart/x-mixed-replace; boundary=frame')

def run_flask():
    print("Starting Flask web server...")
    for cam in CAMERAS:
        print(f"  -> Stream: http://127.0.0.1:5000/video_feed/{cam['camera_id']}")
    app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)

flask_thread = threading.Thread(target=run_flask, daemon=True)
flask_thread.start()

# =============================================================
# 6. SUPABASE HELPER FUNCTIONS
# =============================================================
def update_supabase_bg(target_id, physical_state, main_status=None):
    def api_call():
        try:
            data_to_update = {'physical_status': physical_state}
            if main_status is not None:
                data_to_update['status'] = main_status
            supabase.table('parking_slots').update(data_to_update).eq('id', target_id).execute()
        except Exception as e:
            print(f"Background Supabase update failed: {e}")
    threading.Thread(target=api_call).start()

# =============================================================
# 7. CAMERA WORKER CLASS
# Each instance handles one camera independently:
#   - Reads RTSP stream
#   - Runs AI inference
#   - Syncs slots from Supabase (filtered by camera_id)
#   - Pushes frames to shared_frames dict for Flask
# =============================================================
class CameraWorker:
    def __init__(self, config: dict):
        self.label      = config["label"]
        self.rtsp_url   = config["rtsp_url"]
        self.camera_id  = config["camera_id"]

        # Per-camera slot state
        self.data_lock  = threading.Lock()
        self.slot_ids   = []
        self.all_slots  = []
        self.slot_data  = []
        self.slot_labels= []

        # Initialize this camera's frame slot
        with shared_frames_lock:
            shared_frames[self.camera_id] = None

    def sync_db_loop(self):
        """Polls Supabase every 2s to load/sync slots for this specific camera."""
        while True:
            try:
                res = supabase.table('parking_slots')\
                    .select('*')\
                    .eq('lot_id', TARGET_LOT_ID)\
                    .eq('camera_id', self.camera_id)\
                    .order('created_at', desc=False)\
                    .execute()
                db_slots = res.data
                mapped_db_ids = []

                with self.data_lock:
                    for row in db_slots:
                        db_id   = row['id']
                        coords  = row.get('coordinates')
                        label   = row.get('label', 'Unknown')
                        db_status = row.get('status')

                        if coords:
                            mapped_db_ids.append(db_id)
                            if db_id not in self.slot_ids:
                                print(f"[{self.label}] Loaded slot: {label}")
                                self.slot_ids.append(db_id)
                                self.slot_labels.append(label)
                                self.all_slots.append(np.array(coords, np.int32))
                                self.slot_data.append({
                                    "status": "FREE", "time_in": 0,
                                    "db_status": db_status,
                                    "pending_state": None, "pending_start": 0
                                })
                            else:
                                idx = self.slot_ids.index(db_id)
                                self.slot_data[idx]["db_status"] = db_status

                    # Handle deletions
                    for i in range(len(self.slot_ids) - 1, -1, -1):
                        if self.slot_ids[i] not in mapped_db_ids:
                            print(f"[{self.label}] Slot '{self.slot_labels[i]}' removed. Deleting locally.")
                            self.all_slots.pop(i)
                            self.slot_data.pop(i)
                            self.slot_labels.pop(i)
                            self.slot_ids.pop(i)

            except Exception as e:
                print(f"[{self.label}] [SYNC ERROR]: {e}")
            time.sleep(2)

    def ai_loop(self):
        """Main AI detection loop for this camera."""
        cap = RTSPStream(self.rtsp_url)
        print(f"[{self.label}] RTSP stream reader started...")
        time.sleep(2)  # Let stream stabilize

        frame_counter   = 0
        last_results    = []
        empty_strikes   = 0

        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                empty_strikes += 1
                if empty_strikes % 30 == 0:
                    print(f"[{self.label}] Waiting for camera feed (strike {empty_strikes})...")
                time.sleep(0.1)
                continue
            else:
                if empty_strikes > 0:
                    print(f"[{self.label}] Camera feed restored!")
                empty_strikes = 0

            display_frame = frame.copy()
            frame_counter += 1

            # Run AI every 15 frames to save CPU
            if frame_counter % 15 == 0 or not last_results:
                with model_lock:
                    last_results = model.predict(display_frame, verbose=False, conf=0.4, imgsz=416, device="cpu")

            results = last_results
            vehicle_centers = []
            for r in results:
                for box in r.boxes:
                    x1, y1, x2, y2 = box.xyxy[0]
                    cx = int((x1 + x2) / 2)
                    cy = int(y2)
                    vehicle_centers.append((cx, cy))
                    cv2.circle(display_frame, (cx, cy), 5, (255, 0, 0), -1)
                    cv2.rectangle(display_frame, (int(x1), int(y1)), (int(x2), int(y2)), (255, 165, 0), 2)

            # Slot logic
            with self.data_lock:
                for i, slot in enumerate(self.all_slots):
                    is_occupied = any(
                        cv2.pointPolygonTest(slot, center, False) >= 0
                        for center in vehicle_centers
                    )
                    slot_label = self.slot_labels[i]

                    if is_occupied:
                        if self.slot_data[i]["status"] == "FREE":
                            if self.slot_data[i].get("pending_state") != "FULL":
                                self.slot_data[i]["pending_state"] = "FULL"
                                self.slot_data[i]["pending_start"] = time.time()
                            elif time.time() - self.slot_data[i]["pending_start"] >= 7.0:
                                self.slot_data[i]["status"] = "FULL"
                                self.slot_data[i]["time_in"] = time.time()
                                self.slot_data[i]["pending_state"] = None
                                if self.slot_data[i].get("db_status") != "reserved":
                                    update_supabase_bg(self.slot_ids[i], "occupied", "occupied")
                                else:
                                    update_supabase_bg(self.slot_ids[i], "occupied", None)
                        else:
                            self.slot_data[i]["pending_state"] = None

                        elapsed = int(time.time() - self.slot_data[i]["time_in"])
                        mins, secs = divmod(elapsed, 60)
                        if self.slot_data[i]["status"] == "FREE" and self.slot_data[i].get("pending_state") == "FULL":
                            color = (0, 255, 255)
                            pending_secs = int(7 - (time.time() - self.slot_data[i]["pending_start"]))
                            text = f"{slot_label}: DETECTING ({pending_secs}s)"
                        else:
                            color = (0, 0, 255)
                            text = f"{slot_label}: FULL ({mins}m {secs}s)"
                    else:
                        if self.slot_data[i]["status"] == "FULL":
                            if self.slot_data[i].get("pending_state") != "FREE":
                                self.slot_data[i]["pending_state"] = "FREE"
                                self.slot_data[i]["pending_start"] = time.time()
                            elif time.time() - self.slot_data[i]["pending_start"] >= 7.0:
                                self.slot_data[i]["status"] = "FREE"
                                self.slot_data[i]["time_in"] = 0
                                self.slot_data[i]["pending_state"] = None
                                if self.slot_data[i].get("db_status") != "reserved":
                                    update_supabase_bg(self.slot_ids[i], "empty", "available")
                                else:
                                    update_supabase_bg(self.slot_ids[i], "empty", None)
                        else:
                            self.slot_data[i]["pending_state"] = None

                        if self.slot_data[i]["status"] == "FULL" and self.slot_data[i].get("pending_state") == "FREE":
                            color = (0, 165, 255)
                            pending_secs = int(7 - (time.time() - self.slot_data[i]["pending_start"]))
                            text = f"{slot_label}: CLEARING ({pending_secs}s)"
                        else:
                            color = (0, 255, 0)
                            text = f"{slot_label}: FREE"

                    cv2.polylines(display_frame, [slot], True, color, 3)
                    cv2.putText(display_frame, text, (slot[0][0], slot[0][1] - 15),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

            # Push annotated frame for web streaming
            with shared_frames_lock:
                shared_frames[self.camera_id] = display_frame.copy()

    def start(self):
        """Start both the DB sync and AI loop in background threads."""
        threading.Thread(target=self.sync_db_loop, daemon=True).start()
        threading.Thread(target=self.ai_loop, daemon=True).start()
        print(f"[{self.label}] Worker started. Stream: /video_feed/{self.camera_id}")

# =============================================================
# 8. LAUNCH ALL CAMERA WORKERS
# =============================================================
print(f"\nStarting {len(CAMERAS)} camera worker(s)...\n")
for cam_config in CAMERAS:
    worker = CameraWorker(cam_config)
    worker.start()
    time.sleep(1)  # Stagger startup slightly

print("\nAll cameras running. Press CTRL+C to stop.\n")

# Keep main thread alive
try:
    while True:
        time.sleep(60)
except KeyboardInterrupt:
    print("\nShutting down. Goodbye!")