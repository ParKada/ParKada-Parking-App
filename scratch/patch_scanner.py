import re

with open(r'c:\Users\iamga\Desktop\ParKada_Thesis\apps\ai-node\occupancy_scanner.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix send_admin_notifications
admin_search = 'url = f"{VITE_SUPABASE_URL}/rest/v1/admin_profiles?assigned_lot_id=eq.{lot_id}&select=id"'
admin_replace = 'url = f"{VITE_SUPABASE_URL}/rest/v1/admin_profiles?or=(assigned_lot_id.eq.{lot_id},role.eq.super_admin)&select=id"'
content = content.replace(admin_search, admin_replace)

# 2. Fix the OCR logic
ocr_search = """        results = plate_model(vehicle_crop, verbose=False)
        for result in results:
            for box in result.boxes:
                px1, py1, px2, py2 = map(int, box.xyxy[0])
                plate_crop = vehicle_crop[py1:py2, px1:px2]
                
                if plate_crop.size > 0:
                    ocr_results = reader.readtext(plate_crop)
                    for (c_bbox, text, prob) in ocr_results:
                        clean_text = ''.join(e for e in text if e.isalnum()).upper()
                        if len(clean_text) >= 3:
                            
                            with recently_scanned_lock:"""

ocr_replace = """        crops_to_try = []
        results = plate_model(vehicle_crop, conf=0.10, verbose=False)
        for result in results:
            for box in result.boxes:
                px1, py1, px2, py2 = map(int, box.xyxy[0])
                crops_to_try.append(vehicle_crop[py1:py2, px1:px2])
        
        # Secondary fallback: try the lower bumper explicitly
        h, w = vehicle_crop.shape[:2]
        crops_to_try.append(vehicle_crop[int(h*0.6):h, int(w*0.1):int(w*0.9)])
        
        for plate_crop in crops_to_try:
            if plate_found:
                break
            if plate_crop.size > 0:
                ocr_results = reader.readtext(
                    plate_crop,
                    allowlist='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ ',
                    mag_ratio=2.0,
                    contrast_ths=0.1,
                    adjust_contrast=0.5
                )
                for (c_bbox, text, prob) in ocr_results:
                    clean_text = ''.join(e for e in text if e.isalnum()).upper()
                    if len(clean_text) >= 3:
                            plate_found = True
                            
                            with recently_scanned_lock:"""
                            
if ocr_search in content:
    content = content.replace(ocr_search, ocr_replace)
    print("OCR replacement successful.")
else:
    print("WARNING: OCR search string not found!")

with open(r'c:\Users\iamga\Desktop\ParKada_Thesis\apps\ai-node\occupancy_scanner.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done repairing occupancy_scanner.py")
