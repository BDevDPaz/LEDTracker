import sys

with open('src/database/db.ts', 'r') as f:
    lines = f.readlines()

new_lines = []
skip = 0
for i, line in enumerate(lines):
    if skip > 0:
        skip -= 1
        continue

    if 'export const insertWorkSession = async (session: WorkSession) => {' in line:
        new_lines.append(line)
        new_lines.append('  const error = validateSession(session.start_time, session.end_time || null, session.lunch_start, session.lunch_end);\n')
        new_lines.append('  if (error) throw new Error(error);\n')
        continue

    if 'export const updateWorkSessionManual = async (' in line:
        new_lines.append(line)
        # Assuming next lines are parameters
        j = i + 1
        while '=> {' not in lines[j]:
            new_lines.append(lines[j])
            j += 1
        new_lines.append(lines[j])
        new_lines.append('  const error = validateSession(startTime, endTime, null, null); // Lunch validation could be added if passed\n')
        new_lines.append('  if (error) throw new Error(error);\n')
        skip = j - i
        continue

    new_lines.append(line)

with open('src/database/db.ts', 'w') as f:
    f.writelines(new_lines)
