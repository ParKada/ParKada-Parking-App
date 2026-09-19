import re

with open(r'c:\Users\iamga\Desktop\ParKada_Thesis\apps\ai-node\occupancy_scanner.py', 'r', encoding='utf-8') as f:
    content = f.read()

search = """                            if is_reservable:
                                slot_label = slot_id[:8]
                                try:
                                    l_url = f"{VITE_SUPABASE_URL}/rest/v1/parking_slots?id=eq.{slot_id}&select=label"
                                    l_req = urllib.request.Request(l_url)
                                    l_req.add_header('apikey', VITE_SUPABASE_SERVICE_KEY)
                                    l_req.add_header('Authorization', f'Bearer {VITE_SUPABASE_SERVICE_KEY}')
                                    with urllib.request.urlopen(l_req, timeout=5) as l_res:
                                        l_data = json.loads(l_res.read().decode())
                                        if len(l_data) > 0 and l_data[0].get('label'):
                                            slot_label = l_data[0]['label']
                                except Exception:
                                    pass

                                url = f"{VITE_SUPABASE_URL}/rest/v1/reservations?slot_id=eq.{slot_id}&status=eq.active&select=*,vehicles(plate_number)"
                                req = urllib.request.Request(url)
                                req.add_header('apikey', VITE_SUPABASE_SERVICE_KEY)
                                req.add_header('Authorization', f'Bearer {VITE_SUPABASE_SERVICE_KEY}')
                                
                                has_valid_reservation = False
                                
                                try:
                                    with urllib.request.urlopen(req, timeout=10) as response:
                                        active_reservations = json.loads(response.read().decode())
                                        if len(active_reservations) > 0:
                                            res = active_reservations[0]
                                            vehicle = res.get('vehicles', {})
                                            res_plate = ''.join(e for e in vehicle.get('plate_number', '') if e.isalnum()).upper() if vehicle else ''
                                            if clean_text == res_plate:
                                                msg = f"Reservation Record: {clean_text} have arrived at reserved slot {slot_label}"
                                                print(f"[OCR] ✅ SUCCESS: {msg}")
                                                send_admin_notifications(TARGET_LOT_ID, "Reservation Validated", msg)
                                                has_valid_reservation = True
                                            else:
                                                msg = f"{clean_text} have incorrectly parked at a reserved/reservable slot {slot_label}"
                                                print(f"[OCR] ❌ MISMATCH: {msg} (Expected {res_plate})")
                                                send_admin_notifications(TARGET_LOT_ID, "Reservation Mismatch", msg)
                                        else:
                                            if is_reservable:
                                                msg = f"{clean_text} parked at a reservable slot {slot_label} without reservation."
                                                print(f"[OCR] ❌ MISMATCH: {msg}")
                                                send_admin_notifications(TARGET_LOT_ID, "Reservation Mismatch", msg)
                                                
                                                # Asynchronously PATCH the log to mismatched (delay slightly to let INSERT trigger finish)
                                                def patch_mismatch():
                                                    try:
                                                        patch_url = f"{VITE_SUPABASE_URL}/rest/v1/plate_validation_logs?detected_plate=eq.{clean_text}&order=created_at.desc&limit=1"
                                                        patch_req = urllib.request.Request(patch_url, data=json.dumps({"validation_status": "mismatched"}).encode("utf-8"), method="PATCH")
                                                        patch_req.add_header("apikey", VITE_SUPABASE_SERVICE_KEY)
                                                        patch_req.add_header("Authorization", f"Bearer {VITE_SUPABASE_SERVICE_KEY}")
                                                        patch_req.add_header("Content-Type", "application/json")
                                                        patch_req.add_header("Prefer", "return=minimal")
                                                        urllib.request.urlopen(patch_req, timeout=5)
                                                    except Exception as e:
                                                        print(f"[OCR] [FAIL] Could not patch mismatch status: {e}")
                                                
                                                threading.Timer(2.0, patch_mismatch).start()
                                except Exception as e:
                                    print(f"[OCR] DB Error checking reservation: {e}")
                                    
                                if not has_valid_reservation:
                                    # Create walk-in record for any unreserved vehicle
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
                                            msg = f"Walk-in record started for {clean_text} at {slot_label}."
                                            print(f"[OCR] ✅ {msg}")
                                            # We no longer spam notifications for standard walk-ins to avoid noise,
                                            # only the "Walk-In on Reservable Slot" above will send an alert.
                                    except Exception as e:
                                        print(f"[OCR] Error logging to walk_in_records: {e}")
                            return"""

replace = """                            slot_label = slot_id[:8]
                            try:
                                l_url = f"{VITE_SUPABASE_URL}/rest/v1/parking_slots?id=eq.{slot_id}&select=label"
                                l_req = urllib.request.Request(l_url)
                                l_req.add_header('apikey', VITE_SUPABASE_SERVICE_KEY)
                                l_req.add_header('Authorization', f'Bearer {VITE_SUPABASE_SERVICE_KEY}')
                                with urllib.request.urlopen(l_req, timeout=5) as l_res:
                                    l_data = json.loads(l_res.read().decode())
                                    if len(l_data) > 0 and l_data[0].get('label'):
                                        slot_label = l_data[0]['label']
                            except Exception:
                                pass

                            has_valid_reservation = False
                            
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
                                                msg = f"Reservation Record: {clean_text} have arrived at reserved slot {slot_label}"
                                                print(f"[OCR] ✅ SUCCESS: {msg}")
                                                send_admin_notifications(TARGET_LOT_ID, "Reservation Validated", msg)
                                                has_valid_reservation = True
                                            else:
                                                msg = f"{clean_text} have incorrectly parked at a reserved/reservable slot {slot_label}"
                                                print(f"[OCR] ❌ MISMATCH: {msg} (Expected {res_plate})")
                                                send_admin_notifications(TARGET_LOT_ID, "Reservation Mismatch", msg)
                                        else:
                                            msg = f"{clean_text} parked at a reservable slot {slot_label} without reservation."
                                            print(f"[OCR] ❌ MISMATCH: {msg}")
                                            send_admin_notifications(TARGET_LOT_ID, "Reservation Mismatch", msg)
                                            
                                except Exception as e:
                                    print(f"[OCR] DB Error checking reservation: {e}")
                            else:
                                # For non-reservable slots, the DB trigger erroneously sets 'mismatched' since it finds no reservation.
                                # Patch it to 'detected'.
                                def patch_detected():
                                    try:
                                        patch_url = f"{VITE_SUPABASE_URL}/rest/v1/plate_validation_logs?detected_plate=eq.{clean_text}&order=created_at.desc&limit=1"
                                        patch_req = urllib.request.Request(patch_url, data=json.dumps({"validation_status": "detected"}).encode("utf-8"), method="PATCH")
                                        patch_req.add_header("apikey", VITE_SUPABASE_SERVICE_KEY)
                                        patch_req.add_header("Authorization", f"Bearer {VITE_SUPABASE_SERVICE_KEY}")
                                        patch_req.add_header("Content-Type", "application/json")
                                        patch_req.add_header("Prefer", "return=minimal")
                                        urllib.request.urlopen(patch_req, timeout=5)
                                    except Exception as e:
                                        print(f"[OCR] [FAIL] Could not patch detected status: {e}")
                                
                                threading.Timer(2.0, patch_detected).start()
                                    
                            if not has_valid_reservation:
                                # Create walk-in record for any unreserved vehicle (reservable mismatched OR standard slot)
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
                                        msg = f"Walk-in record started for {clean_text} at {slot_label}."
                                        print(f"[OCR] ✅ {msg}")
                                except Exception as e:
                                    print(f"[OCR] Error logging to walk_in_records: {e}")
                            return"""

if search in content:
    content = content.replace(search, replace)
    print("Replaced successfully!")
else:
    print("Search string not found!")

with open(r'c:\Users\iamga\Desktop\ParKada_Thesis\apps\ai-node\occupancy_scanner.py', 'w', encoding='utf-8') as f:
    f.write(content)
