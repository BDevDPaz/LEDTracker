import subprocess

files = [
    'src/database/db.ts',
    'src/services/LocationManager.ts',
    'src/components/LuxuryUI.tsx',
    'app/(tabs)/index.tsx',
    'app/(tabs)/history.tsx'
]

for f in files:
    print(f"--- {f} ---")
    print(open(f).read())
    print("\n" + "="*50 + "\n")
