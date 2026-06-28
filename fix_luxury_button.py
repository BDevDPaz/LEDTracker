import os

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

        # Add style={{ marginBottom: 16 }} to LuxuryButton calls that don't have a style prop
        # This is a bit tricky with regex, so we'll do a simple replacement for the most common pattern
        new_content = content.replace('<LuxuryButton', '<LuxuryButton style={{ marginBottom: 16 }}')

        # If the file already had some style prop, we might have doubled it or made it invalid
        # But looking at the grep, none of them seemed to have it.

        with open(file_path, 'w') as f:
            f.write(new_content)
        print(f"Updated {file_path}")
