import cv2
import numpy as np
import os
import time
import threading
from ultralytics import YOLO
import easyocr
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv
import urllib.request
import json

# IMPORTS FOR WEB STREAMING
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

# Force HTTP/1.1 to prevent 'Server disconnected' errors on unstable WiFi
# HTTP/2 multiplexing causes connection drops with the supabase-py client
try:
    supabase: Client = create_client(
        VITE_SUPABASE_URL,
        VITE_SUPABASE_SERVICE_KEY,
        options=ClientOptions(postgrest_client_timeout=10, storage_client_timeout=10)
    )
except Exception:
    # Fallback for older supabase-py versions
    supabase: Client = create_client(VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_KEY)

print("Supabase client ready.")

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
TARGET_LOT_ID = "f064a8de-058e-408a-8dd3-a2fcfbfefe88"

CAMERAS = [
    {
        "label":      "Camera 1 (Right)",
        "rtsp_url":   "rtsp://admincamnew:admincamnew@192.168.8.154:554/stream1",
        "camera_id":  "cam1_f064a8de-058e-408a-8dd3-a2fcfbfefe88",
    },
    # Camera 2 is currently OFFLINE — re-enable when camera is back online
    {
         "label":      "Camera 2 (Left)",
         "rtsp_url":   "rtsp://admincam:admincam@192.168.8.159:554/stream1",
         "camera_id":  "cam2_f064a8de-058e-408a-8dd3-a2fcfbfefe88",
    },
]

# =============================================================
# 3. SHARED AI MODEL (loaded once, used by all cameras)
# =============================================================
# Using YOLOv8s (Small) pretrained on COCO — more accurate than nano.
# Vehicle class IDs in COCO: 2=car, 3=motorcycle, 5=bus, 7=truck
VEHICLE_CLASSES = {2, 3, 5, 7}

print("Loading YOLOv8s vehicle detection model...")
model = YOLO("yolov8s.pt")  # Downloads automatically on first run (~22MB)
model_lock = threading.Lock()  # YOLO is not thread-safe, so we lock it

print("Loading Plate OCR models...")
try:
    plate_model = YOLO('models/plate_model.pt')
    reader = easyocr.Reader(['en'], gpu=True)
except Exception as e:
    print(f"WARNING: Could not load OCR models. Error: {e}")
    plate_model = None
    reader = None

print("Warming up AI model (please wait a few seconds)...")
dummy = np.zeros((640, 640, 3), dtype=np.uint8)
with model_lock:
    model.predict(dummy, verbose=False, conf=0.15, imgsz=640, device="cpu")
    if plate_model:
        plate_model(dummy, verbose=False)
print("Warmup complete!")

# =============================================================
# 4. OCR VALIDATION LOGIC
# =============================================================
SCAN_COOLDOWN = 60
recently_scanned = {}
recently_scanned_lock = threading.Lock()

def run_ocr_validation(slot_id, is_reservable, camera_id, raw_frame, bbox, display_shape):
    def _task():
        if not plate_model or not reader:
            return
            
        bx1, by1, bx2, by2 = bbox
        dh, dw = display_shape
        rh, rw = raw_frame.shape[:2]
        
        scale_x = rw / dw
        scale_y = rh / dh
        
        rx1 = max(0, int(bx1 * scale_x))
        ry1 = max(0, int(by1 * scale_y))
        rx2 = min(rw, int(bx2 * scale_x))
        ry2 = min(rh, int(by2 * scale_y))
        
        vehicle_crop = raw_frame[ry1:ry2, rx1:rx2]
        if vehicle_crop.size == 0:
            return
            
        results = plate_model(vehicle_crop, verbose=False)
        for result in results:
            for box in result.boxes:
                px1, py1, px2, py2 = map(int, box.xyxy[0])
                plate_crop = vehicle_crop[py1:py2, px1:px2]
                
                if plate_crop.size > 0:
                    ocr_results = reader.readtext(plate_crop)
                    for (c_bbox, text, prob) in ocr_results:
                        clean_text = ''.join(e for e in text if e.isalnum()).upper()
                        if len(clean_text) >= 3:
                            
                            with recently_scanned_lock:
                                current_time = time.time()
                                if clean_text in recently_scanned and (current_time - recently_scanned[clean_text]) <= SCAN_COOLDOWN:
                                    return
                                recently_scanned[clean_text] = current_time

                            print(f"[OCR] Plate Detected: {clean_text} ({prob*100:.1f}%) in slot {slot_id[:8]}")
                            
                            if is_reservable:
                                url = f"{VITE_SUPABASE_URL}/rest/v1/reservations?slot_id=eq.{slot_id}&status=eq.active&select=*,vehicles(plate_number)"
                                req = urllib.request.Request(url)
                                req.add_header('apikey', VITE_SUPABASE_SERVICE_KEY)
                                req.add_header('Authorization', f'Bearer {VITE_SUPABASE_SERVICE_KEY}')
                                
                                try:
                                    with urllib.request.urlopen(req, timeout=10) as response:
                                        active_reservations = json.loads(response.read().decode())
                                        if len(active_reservations) > 0:
                                            res = active_reservations[0]
                                            vehicle = res.get('vehicles', {})
                                            res_plate = ''.join(e for e in vehicle.get('plate_number', '') if e.isalnum()).upper() if vehicle else ''
                                            if clean_text == res_plate:
                                                msg = f"Plate {clean_text} correctly parked in reserved slot."
                                                print(f"[OCR] ✅ SUCCESS: {msg}")
                                                send_admin_notifications(TARGET_LOT_ID, "Reservation Validated", msg)
                                            else:
                                                msg = f"Vehicle with plate {clean_text} parked in a reserved slot, but reservation is for {res_plate}!"
                                                print(f"[OCR] ❌ MISMATCH: {msg}")
                                                send_admin_notifications(TARGET_LOT_ID, "Reservation Mismatch", msg)
                                        else:
                                            msg = f"Vehicle {clean_text} parked in a reserved slot, but NO active reservation found!"
                                            print(f"[OCR] ⚠️ {msg}")
                                            send_admin_notifications(TARGET_LOT_ID, "Unauthorized Parking", msg)
                                except Exception as e:
                                    print(f"[OCR] DB Error checking reservation: {e}")
                                    
                            else:
                                log_data = {
                                    "lot_id": TARGET_LOT_ID,
                                    "slot_id": slot_id,
                                    "plate_number": clean_text
                                }
                                url = f"{VITE_SUPABASE_URL}/rest/v1/walk_in_records"
                                req = urllib.request.Request(url, data=json.dumps(log_data).encode('utf-8'), method='POST')
                                req.add_header('apikey', VITE_SUPABASE_SERVICE_KEY)
                                req.add_header('Authorization', f'Bearer {VITE_SUPABASE_SERVICE_KEY}')
                                req.add_header('Content-Type', 'application/json')
                                req.add_header('Prefer', 'return=minimal')
                                try:
                                    with urllib.request.urlopen(req, timeout=10):
                                        msg = f"Automated walk-in record created for plate {clean_text}."
                                        print(f"[OCR] ✅ {msg}")
                                        send_admin_notifications(TARGET_LOT_ID, "New Walk-In Arrival", msg)
                                except Exception as e:
                                    print(f"[OCR] Error logging to walk_in_records: {e}")
                            return 
    threading.Thread(target=_task, daemon=True).start()

# =============================================================
# 5. RTSP STREAM READER (auto-reconnects on failure)
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
            ret, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 28])
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
    print(f"[FLASK] Incoming request for video stream: {camera_id}")
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
def send_admin_notifications(lot_id, title, message):
    """Sends a notification to all admins/staff assigned to this lot."""
    def api_call():
        try:
            # 1. Fetch admins for this lot
            url = f"{VITE_SUPABASE_URL}/rest/v1/admin_profiles?assigned_lot_id=eq.{lot_id}&select=id"
            req = urllib.request.Request(url)
            req.add_header('apikey', VITE_SUPABASE_SERVICE_KEY)
            req.add_header('Authorization', f'Bearer {VITE_SUPABASE_SERVICE_KEY}')
            
            with urllib.request.urlopen(req, timeout=10) as response:
                admins = json.loads(response.read().decode())
                
            if not admins:
                return

            # 2. Insert notifications
            notifications = [{
                "user_id": admin["id"],
                "title": title,
                "message": message
            } for admin in admins]
            
            insert_url = f"{VITE_SUPABASE_URL}/rest/v1/notifications"
            insert_req = urllib.request.Request(insert_url, data=json.dumps(notifications).encode('utf-8'), method='POST')
            insert_req.add_header('apikey', VITE_SUPABASE_SERVICE_KEY)
            insert_req.add_header('Authorization', f'Bearer {VITE_SUPABASE_SERVICE_KEY}')
            insert_req.add_header('Content-Type', 'application/json')
            insert_req.add_header('Prefer', 'return=minimal')
            
            with urllib.request.urlopen(insert_req, timeout=10):
                print(f"[DB] Sent notifications to {len(admins)} staff/admins.")
        except Exception as e:
            print(f"[DB] Error sending notifications: {e}")
            
    threading.Thread(target=api_call, daemon=True).start()

def update_supabase_bg(target_id, physical_state, main_status=None):
    """Update slot status in Supabase with retry logic."""
    def api_call():
        data_to_update = {'physical_status': physical_state}
        if main_status is not None:
            data_to_update['status'] = main_status
            
        url = f"{VITE_SUPABASE_URL}/rest/v1/parking_slots?id=eq.{target_id}"
        req = urllib.request.Request(url, data=json.dumps(data_to_update).encode('utf-8'), method='PATCH')
        req.add_header('apikey', VITE_SUPABASE_SERVICE_KEY)
        req.add_header('Authorization', f'Bearer {VITE_SUPABASE_SERVICE_KEY}')
        req.add_header('Content-Type', 'application/json')
        req.add_header('Prefer', 'return=minimal')

        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=10) as response:
                    pass
                status_log = f"status={main_status} " if main_status else ""
                print(f"[DB] ✓ Slot {target_id[:8]}... → {status_log}physical={physical_state}")
                return
            except Exception as e:
                print(f"[DB] ✗ Update failed (attempt {attempt+1}/3): {e}")
                time.sleep(2)
        print(f"[DB] ✗✗ All 3 attempts failed for slot {target_id[:8]}...")
    threading.Thread(target=api_call, daemon=True).start()

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
        url = f"{VITE_SUPABASE_URL}/rest/v1/parking_slots?lot_id=eq.{TARGET_LOT_ID}&camera_id=eq.{self.camera_id}&select=*"
        req = urllib.request.Request(url)
        req.add_header('apikey', VITE_SUPABASE_SERVICE_KEY)
        req.add_header('Authorization', f'Bearer {VITE_SUPABASE_SERVICE_KEY}')

        while True:
            try:
                with urllib.request.urlopen(req, timeout=10) as response:
                    db_slots = json.loads(response.read().decode())
                mapped_db_ids = []

                with self.data_lock:
                    for row in db_slots:
                        db_id   = row['id']
                        coords  = row.get('coordinates')
                        label   = row.get('label', 'Unknown')
                        db_status = row.get('status')
                        is_reservable = row.get('is_reservable', False)

                        if coords:
                            mapped_db_ids.append(db_id)
                            if db_id not in self.slot_ids:
                                print(f"[{self.label}] Loaded slot: {label} | coords: {coords}")
                                self.slot_ids.append(db_id)
                                self.slot_labels.append(label)
                                self.all_slots.append(np.array(coords, np.int32).reshape(-1, 2))
                                self.slot_data.append({
                                    "status": "FREE", "time_in": 0,
                                    "db_status": db_status,
                                    "is_reservable": is_reservable,
                                    "pending_full_start": None,
                                    "pending_free_start": None,
                                    "last_occupied_time": 0,
                                    "last_empty_time": 0
                                })
                            else:
                                idx = self.slot_ids.index(db_id)
                                self.slot_data[idx]["db_status"] = db_status
                                self.slot_data[idx]["is_reservable"] = is_reservable
                                self.all_slots[idx] = np.array(coords, np.int32).reshape(-1, 2)

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

            display_frame = cv2.resize(frame.copy(), (1024, 576))
            frame_counter += 1

            # Run AI every 10 frames
            if frame_counter % 10 == 0 or not last_results:
                with model_lock:
                    last_results = model.predict(
                        display_frame,
                        verbose=False,
                        conf=0.10,          # Dropped even lower
                        imgsz=1024,         # Increased from 640 to 1024 to preserve detail of large foreground cars!
                        device="cpu"
                    )

            results = last_results
            vehicle_boxes = []   # store (cx, cy, x1, y1, x2, y2) for each detection
            for r in results:
                for box in r.boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    
                    x1, y1, x2, y2 = [int(v) for v in box.xyxy[0]]
                    cx = int((x1 + x2) / 2)
                    cy = int((y1 + y2) / 2)

                    # Draw EVERY detection in magenta for debugging
                    cv2.rectangle(display_frame, (x1, y1), (x2, y2), (255, 0, 255), 1)
                    cv2.putText(display_frame, f"c:{cls_id} {conf:.2f}", (x1, y1-5), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 0, 255), 1)

                    if cls_id not in VEHICLE_CLASSES:
                        continue  # Skip non-vehicles for occupancy logic
                        
                    vehicle_boxes.append((cx, cy, x1, y1, x2, y2))
                    # Draw detected vehicle bounding box (cyan)
                    cv2.rectangle(display_frame, (x1, y1), (x2, y2), (255, 255, 0), 2)
                    cv2.circle(display_frame, (cx, cy), 4, (0, 0, 255), -1)

            def box_overlaps_polygon(poly_pts, bx1, by1, bx2, by2, threshold=0.10):
                """
                Returns True if the bounding box overlaps the polygon by at least
                `threshold` fraction of the box area. More robust than point-in-polygon
                for large/angled vehicles.
                """
                # Sample a grid of points inside the bounding box
                w = max(bx2 - bx1, 1)
                h = max(by2 - by1, 1)
                step_x = max(w // 6, 1)
                step_y = max(h // 6, 1)
                inside = 0
                total  = 0
                for sx in range(bx1, bx2, step_x):
                    for sy in range(by1, by2, step_y):
                        total += 1
                        if cv2.pointPolygonTest(poly_pts, (float(sx), float(sy)), False) >= 0:
                            inside += 1
                if total == 0:
                    return False
                return (inside / total) >= threshold

            # Slot logic
            with self.data_lock:
                for i, slot_raw in enumerate(self.all_slots):
                    slot_label = self.slot_labels[i]

                    # FIX: Ensure correct shape (N,1,2) required by pointPolygonTest
                    slot = slot_raw.reshape((-1, 1, 2))

                    # Pre-calculate slot center
                    px_min, py_min = np.min(slot[:, 0, 0]), np.min(slot[:, 0, 1])
                    px_max, py_max = np.max(slot[:, 0, 0]), np.max(slot[:, 0, 1])
                    slot_cx, slot_cy = (px_min + px_max) / 2, (py_min + py_max) / 2

                    is_occupied = False
                    occupying_box = None
                    for (cx, cy, bx1, by1, bx2, by2) in vehicle_boxes:
                        # Check 1: center point of vehicle inside polygon
                        if cv2.pointPolygonTest(slot, (float(cx), float(cy)), False) >= 0:
                            is_occupied = True
                            occupying_box = (bx1, by1, bx2, by2)
                            break
                        # Check 2: center point of slot inside vehicle bounding box (very reliable)
                        if bx1 <= slot_cx <= bx2 and by1 <= slot_cy <= by2:
                            is_occupied = True
                            occupying_box = (bx1, by1, bx2, by2)
                            break
                        # Check 3: significant bounding-box overlap with polygon
                        if box_overlaps_polygon(slot, bx1, by1, bx2, by2, threshold=0.10):
                            is_occupied = True
                            occupying_box = (bx1, by1, bx2, by2)
                            break

                    if is_occupied:
                        self.slot_data[i]["last_occupied_time"] = time.time()
                    else:
                        self.slot_data[i]["last_empty_time"] = time.time()

                    now = time.time()
                    CONFIRM_DELAY = 7.0  # seconds required to confirm state change
                    TOLERANCE = 3.0      # seconds we allow detection to flicker before resetting the timer

                    current_status = self.slot_data[i]["status"]

                    if current_status == "FREE":
                        if is_occupied:
                            if self.slot_data[i]["pending_full_start"] is None:
                                self.slot_data[i]["pending_full_start"] = now
                            
                            # Check if it has been pending long enough
                            if now - self.slot_data[i]["pending_full_start"] >= CONFIRM_DELAY:
                                self.slot_data[i]["status"] = "FULL"
                                self.slot_data[i]["time_in"] = now
                                self.slot_data[i]["pending_full_start"] = None
                                
                                # Trigger OCR validation since slot is now officially FULL
                                if occupying_box:
                                    run_ocr_validation(
                                        self.slot_ids[i],
                                        self.slot_data[i].get("is_reservable", False),
                                        self.camera_id,
                                        frame,
                                        occupying_box,
                                        display_frame.shape[:2]
                                    )

                                if self.slot_data[i].get("db_status") != "reserved":
                                    update_supabase_bg(self.slot_ids[i], "occupied", "occupied")
                                else:
                                    update_supabase_bg(self.slot_ids[i], "occupied", None)
                        else:
                            if self.slot_data[i]["pending_full_start"] is not None:
                                # Has it been empty for longer than TOLERANCE?
                                if now - self.slot_data[i]["last_occupied_time"] > TOLERANCE:
                                    self.slot_data[i]["pending_full_start"] = None

                        elapsed = int(now - self.slot_data[i]["time_in"])
                        mins, secs = divmod(elapsed, 60)
                        if self.slot_data[i]["pending_full_start"] is not None:
                            color = (0, 255, 255)  # Yellow = detecting
                            pending_secs = int(CONFIRM_DELAY - (now - self.slot_data[i]["pending_full_start"]))
                            text = f"{slot_label}: DETECTING ({max(0, pending_secs)}s)"
                        else:
                            color = (0, 255, 0)  # Green = free
                            text = f"{slot_label}: FREE"

                    else: # current_status == "FULL"
                        if not is_occupied:
                            if self.slot_data[i]["pending_free_start"] is None:
                                self.slot_data[i]["pending_free_start"] = now
                            
                            if now - self.slot_data[i]["pending_free_start"] >= CONFIRM_DELAY:
                                self.slot_data[i]["status"] = "FREE"
                                self.slot_data[i]["time_in"] = 0
                                self.slot_data[i]["pending_free_start"] = None
                                if self.slot_data[i].get("db_status") != "reserved":
                                    update_supabase_bg(self.slot_ids[i], "empty", "available")
                                else:
                                    update_supabase_bg(self.slot_ids[i], "empty", None)
                        else:
                            if self.slot_data[i]["pending_free_start"] is not None:
                                if now - self.slot_data[i]["last_empty_time"] > TOLERANCE:
                                    self.slot_data[i]["pending_free_start"] = None

                        elapsed = int(now - self.slot_data[i]["time_in"])
                        mins, secs = divmod(elapsed, 60)
                        if self.slot_data[i]["pending_free_start"] is not None:
                            color = (0, 165, 255)  # Orange = clearing
                            pending_secs = int(CONFIRM_DELAY - (now - self.slot_data[i]["pending_free_start"]))
                            text = f"{slot_label}: CLEARING ({max(0, pending_secs)}s)"
                        else:
                            color = (0, 0, 255)  # Red = occupied
                            text = f"{slot_label}: OCCUPIED ({mins}m {secs}s)"

                    # Always draw slot polygon
                    cv2.polylines(display_frame, [slot_raw.reshape((-1, 1, 2))], True, color, 2)
                    cv2.putText(display_frame, text,
                                (slot_raw[0][0], slot_raw[0][1] - 8),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

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