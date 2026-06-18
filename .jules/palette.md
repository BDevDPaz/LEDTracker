## 2026-06-18 - [Accessibility on Complex Interactions]
**Learning:** Found that custom `TouchableOpacity` implementations handling complex gestures (like long-press to delete or icon-only buttons for actions like PDF generation) within lists were not announcing correctly for screen readers.
**Action:** Always ensure that touch targets have `accessibilityRole="button"`, a descriptive `accessibilityLabel` in Spanish, and an `accessibilityHint` to clarify secondary interactions (like long pressing). Ensure Spanish is used for all accessibility strings to match the locale of the app.
