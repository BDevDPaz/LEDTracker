## 2024-05-01 - [Keyboard Accessibility Insight]
**Learning:** React Native `TouchableOpacity` missing explicit `accessibilityRole` and `accessibilityLabel` properties in custom UI components. Icon-only buttons lack ARIA-equivalent labels.
**Action:** Need to add `accessibilityRole="button"` and `accessibilityLabel` to custom interactive components, particularly those without text like icon buttons.
## 2024-05-04 - [Button Accessibility Labels]
**Learning:** In React Native, `TouchableOpacity` components used as icon-only buttons or interactive cards must have `accessibilityRole="button"`, `accessibilityLabel`, and optionally `accessibilityHint` explicitly defined so screen readers can interpret them correctly.
**Action:** Always verify that interactive elements without plain text children have descriptive accessibility labels matching the app's primary language (Spanish).
