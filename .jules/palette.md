## 2024-05-02 - Icon-Only Button Accessibility in Modals
**Learning:** In React Native, `TouchableOpacity` components used solely for iconography (like "X" buttons to close modals) are opaque to screen readers by default. This makes critical modal actions inaccessible.
**Action:** Always ensure that icon-only `TouchableOpacity` instances receive `accessibilityRole="button"` and a descriptive `accessibilityLabel` (e.g., "Cerrar modal") to guarantee full usability for visually impaired users.
