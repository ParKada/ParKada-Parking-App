import sys; sys.stdout.reconfigure(encoding='utf-8')
with open(r'c:\Users\iamga\Desktop\ParKada_Thesis\apps\ai-node\occupancy_scanner.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()
    
start_idx = 0
for i, line in enumerate(lines):
    if 'print(f"[OCR] Plate Detected:' in line and i > 200:
        start_idx = i
        break

end_idx = start_idx
while end_idx < len(lines):
    if 'if not plate_found and is_reservable:' in lines[end_idx]:
        break
    end_idx += 1

# Dedent by 4 spaces
for i in range(start_idx, end_idx):
    if lines[i].startswith('    '):
        lines[i] = lines[i][4:]
        
with open(r'c:\Users\iamga\Desktop\ParKada_Thesis\apps\ai-node\occupancy_scanner.py', 'w', encoding='utf-8') as f:
    f.writelines(lines)
