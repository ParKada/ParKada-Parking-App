import cv2
import time
import threading
import os
from ultralytics import YOLO
import easyocr
from supabase import create_client, Client
from dotenv import load_dotenv

# ---------------------------------------------------------
# 1. SETUP SECURE CONNECTIONS & MODELS
# ---------------------------------------------------------
# Look for .env in the root directory
dotenv_path = os.path.join(os.path.dirname(__file__), '../../.env')
load_dotenv(dotenv_path)

VITE_SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
VITE_SUPABASE_SERVICE_KEY = os.getenv("VITE_SUPABASE_SERVICE_KEY")

if not VITE_SUPABASE_URL or not VITE_SUPABASE_SERVICE_KEY:
    print("ERROR: Could not find Supabase keys in root .env file!")
    exit()

supabase: Client = create_client(VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_KEY)

# Initialize Models
try:
    plate_model = YOLO('models/plate_model.pt') # Place your separate best.pt here
    reader = easyocr.Reader(['en'], gpu=True) # Set gpu=False if you don't have CUDA/NVIDIA
except Exception as e:
    print(f"WARNING: Could not load OCR models. Error: {e}")
    print("Ensure models/plate_model.pt exists and EasyOCR is installed (pip install easyocr).")
    exit()

TARGET_LOT_ID = "6928d8dc-1562-43cd-bad1-14c8bb412895" # Thesis Demo ID
CAMERA_ID = "ENTRANCE_CAM_1"

# Cooldown logic so we don't spam the database with 30 reads of the same plate per second
recently_scanned = {}
SCAN_COOLDOWN = 60 # wait 60 seconds before scanning the exact same plate again

# ---------------------------------------------------------
# 2. SUPABASE NETWORK CALL
# ---------------------------------------------------------
def send_to_supabase(plate_text, confidence, image_url=None):
    def api_call():
        try:
            data = {
                "lot_id": TARGET_LOT_ID,
                "camera_id": CAMERA_ID,
                "detected_plate": plate_text,
                "confidence_score": round(confidence * 100, 2),
                "image_url": image_url
            }
            supabase.table('plate_validation_logs').insert(data).execute()
            print(f"✅ Sent to Supabase: {plate_text} ({confidence*100:.1f}%)")
        except Exception as e:
            print(f"❌ Supabase error: {e}")
            
    threading.Thread(target=api_call).start()

# ---------------------------------------------------------
# 3. CAMERA & OCR LOOP
# ---------------------------------------------------------
print("Starting OCR Camera Stream...")
cap = cv2.VideoCapture(0) # 0 is default webcam, replace with RTSP URL for IP cameras

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        print("Failed to grab frame.")
        break
        
    # Run YOLO detection for license plates
    results = plate_model(frame, verbose=False)
    
    for result in results:
        boxes = result.boxes
        for box in boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            
            # Crop the exact region where the plate is
            plate_crop = frame[y1:y2, x1:x2]
            
            if plate_crop.size > 0:
                # Run EasyOCR specifically on the cropped image (much faster than scanning full frame)
                ocr_results = reader.readtext(plate_crop)
                
                for (bbox, text, prob) in ocr_results:
                    # Clean the text (remove spaces, hyphens, non-alphanumeric)
                    clean_text = ''.join(e for e in text if e.isalnum()).upper()
                    
                    # Plate should be at least 3 characters
                    if len(clean_text) >= 3:
                        current_time = time.time()
                        
                        # Cooldown check
                        if clean_text not in recently_scanned or (current_time - recently_scanned[clean_text]) > SCAN_COOLDOWN:
                            recently_scanned[clean_text] = current_time
                            
                            send_to_supabase(clean_text, prob)
                            
                        # Draw visual bounding box and text
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                        cv2.putText(frame, f"{clean_text} ({prob*100:.0f}%)", (x1, y1 - 10), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

    cv2.imshow('ParKada OCR Scanner', frame)
    
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
