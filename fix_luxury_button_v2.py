import os
import re

files = [
    "app/(tabs)/index.tsx",
    "app/(tabs)/report.tsx",
    "app/(tabs)/history.tsx",
    "src/components/DailySetupModal.tsx",
    "src/components/LunchModal.tsx"
]

for file_path in files:
    if os.path.exists(file_path):
        with open(file_path, 'r') as f:
            content = f.read()

        # First, revert the damage from v1 if it exists
        content = content.replace('<LuxuryButton style={{ marginBottom: 16 }}', '<LuxuryButton')

        # Now use regex to find LuxuryButton tags and see if they have a style prop
        # If they don't, add it. If they do, merge it or leave it if it's already there.

        def replace_func(match):
            tag_content = match.group(1)
            if 'style=' in tag_content:
                # If style is already there, we might want to ensure marginBottom: 16 is part of it
                # but for simplicity and because I'll refactor these modals anyway,
                # let's just make sure we don't break syntax.
                return f'<LuxuryButton{tag_content}'
            else:
                return f'<LuxuryButton style={{{{ marginBottom: 16 }}}}{tag_content}'

        new_content = re.sub(r'<LuxuryButton([^>]*?)', replace_func, content)

        with open(file_path, 'w') as f:
            f.write(new_content)
        print(f"Fixed {file_path}")
