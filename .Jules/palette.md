## 2024-05-01 - [Keyboard Accessibility Insight]
**Learning:** React Native `TouchableOpacity` missing explicit `accessibilityRole` and `accessibilityLabel` properties in custom UI components. Icon-only buttons lack ARIA-equivalent labels.
**Action:** Need to add `accessibilityRole="button"` and `accessibilityLabel` to custom interactive components, particularly those without text like icon buttons.
