import os
import re

def fix_modals(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find all <Modal visible={VAR} ...>
    # We want to replace `<Modal visible={VAR} ...>` with `{VAR && <Modal visible={true} ...>`
    # And then the next `</Modal>` with `</Modal>}`
    
    pattern = re.compile(r'<Modal\s+visible={([^}]+)}([^>]*)>')
    
    matches = list(pattern.finditer(content))
    if not matches:
        return
    
    # We must do this backwards to not mess up indices
    for match in reversed(matches):
        var_name = match.group(1).strip()
        if var_name == "true": # already conditional or always visible
            continue
            
        start_idx = match.start()
        
        # Find closing tag
        close_idx = content.find('</Modal>', start_idx)
        if close_idx == -1:
            continue
            
        # Replace closing tag first
        content = content[:close_idx] + '</Modal>}' + content[close_idx+8:]
        
        # Replace opening tag
        replacement = f'{{{var_name} && (<Modal visible={{true}}{match.group(2)}>'
        
        # Also need a closing parenthesis before the brace
        # Wait, if we use `{var_name && (<Modal ...>` then we need `</Modal>)}`
        # Let's just use `{var_name ? <Modal visible={true}... : null}`
        
        content = content[:close_idx] + '</Modal> : null}' + content[close_idx+8:close_idx+8] + content[close_idx+8:]
        # Actually that's confusing to string slice backwards with length changes.
        
fix_modals("apps/mobile/app/(app)/profile.tsx")
