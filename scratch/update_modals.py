import os

def replace_modal_imports(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if not file.endswith('.tsx'):
                continue
                
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                
            if '<Modal' not in content:
                continue
                
            # Count directory depth to components folder
            # apps/mobile/app/(app)/profile.tsx -> depth from app is 2 -> ../../components/SafeModal
            # apps/mobile/app/(auth)/register.tsx -> depth from app is 2 -> ../../components/SafeModal
            # apps/mobile/app/(app)/lot/[id].tsx -> depth from app is 3 -> ../../../components/SafeModal
            
            rel_path = os.path.relpath(filepath, 'apps/mobile')
            parts = rel_path.split(os.sep)
            depth = len(parts) - 1
            import_path = '../' * depth + 'components/SafeModal'
            
            # Remove Modal from react-native import
            if 'import { Modal,' in content:
                new_content = content.replace('import { Modal,', 'import {')
            elif ', Modal }' in content:
                new_content = content.replace(', Modal }', ' }')
            elif ', Modal,' in content:
                new_content = content.replace(', Modal,', ',')
            elif 'Modal } from "react-native"' in content:
                new_content = content.replace('Modal } from "react-native"', '} from "react-native"')
            elif 'Modal } from \'react-native\'' in content:
                new_content = content.replace('Modal } from \'react-native\'', '} from \'react-native\'')
            else:
                # Might already be changed or imported differently
                continue
                
            # Add SafeModal import
            new_content = f"import {{ Modal }} from '{import_path}';\n" + new_content
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
                print(f"Updated Modal imports in {filepath}")

replace_modal_imports('apps/mobile/app')
replace_modal_imports('apps/mobile/components')
