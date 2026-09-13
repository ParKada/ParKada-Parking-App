import os
import re

replacements = [
    (r'<SafeAreaView([^>]*)\bclassName="([^"]+)"([^>]*)>', lambda m: '<SafeAreaView' + m.group(1) + 'style={{ flex: 1, backgroundColor: "#f8fafc" }}' + m.group(3) + '> if "flex-1" in m.group(2) else m.group(0)'),
]

for root, dirs, files in os.walk('apps/mobile'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.jsx'):
            full_path = os.path.join(root, file).replace('\\', '/')
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = content
            # Quick and dirty replace for common SafeAreaView classes
            new_content = re.sub(r'<SafeAreaView([^>]*)\bclassName="([^"]+)"([^>]*)>', 
                lambda m: '<SafeAreaView' + m.group(1) + 'style={{ flex: 1, backgroundColor: "#f8fafc" }}' + m.group(3) + '>' if 'flex-1' in m.group(2) else m.group(0),
                new_content)
            
            if new_content != content:
                with open(full_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Updated {full_path}")
