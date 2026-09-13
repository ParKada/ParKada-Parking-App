import os
import re

replacements = [
    (r'apps/mobile/components/ActiveReservationTimer\.tsx', r'<ChevronRight([^>]+)className="ml-0\.5"([^>]*)>', r'<ChevronRight\1style={{ marginLeft: 2 }}\2>'),
    (r'apps/mobile/app/\(app\)/lot/\[id\]\.tsx', r'<ChevronRight([^>]+)className="ml-2"([^>]*)>', r'<ChevronRight\1style={{ marginLeft: 8 }}\2>'),
    (r'apps/mobile/app/\(app\)/payment/extension\.tsx', r'<CheckCircle2([^>]+)className="absolute right-3"([^>]*)>', r'<CheckCircle2\1style={{ position: "absolute", right: 12 }}\2>'),
    (r'apps/mobile/app/\(app\)/payment/index\.tsx', r'<Info([^>]+)className="mt-0\.5"([^>]*)>', r'<Info\1style={{ marginTop: 2 }}\2>'),
    (r'apps/mobile/app/\(app\)/reserve/\[id\]\.tsx', r'<Accessibility([^>]+)className="opacity-80"([^>]*)>', r'<Accessibility\1style={{ opacity: 0.8 }}\2>'),
    (r'apps/mobile/app/\(app\)/vehicles\.tsx', r'<Car([^>]+)className="mb-4"([^>]*)>', r'<Car\1style={{ marginBottom: 16 }}\2>'),
    (r'apps/mobile/app/\(app\)/vehicles\.tsx', r'<CheckCircle2([^>]+)className="mt-0\.5"([^>]*)>', r'<CheckCircle2\1style={{ marginTop: 2 }}\2>')
]

for filepath_regex, pattern, replacement in replacements:
    # Find files matching filepath_regex
    for root, dirs, files in os.walk('apps/mobile'):
        for file in files:
            full_path = os.path.join(root, file).replace('\\', '/')
            if re.search(filepath_regex, full_path):
                with open(full_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                new_content = re.sub(pattern, replacement, content)
                if new_content != content:
                    with open(full_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Updated {full_path}")
