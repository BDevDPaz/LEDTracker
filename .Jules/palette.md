## 2026-07-17 - Group Empty State Content for Screen Readers
**Learning:** Empty states with decorative icons and text are announced poorly by screen readers if not grouped, forcing users to traverse elements individually.
**Action:** Always add `accessible={true}`, `accessibilityRole="text"`, and a descriptive `accessibilityLabel` to the top-level container of empty state components to group their contents into a single, cohesive announcement.
