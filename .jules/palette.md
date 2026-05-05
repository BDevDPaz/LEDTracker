## 2024-05-02 - Icon-Only Button Accessibility in Modals
**Learning:** In React Native, `TouchableOpacity` components used solely for iconography (like "X" buttons to close modals) are opaque to screen readers by default. This makes critical modal actions inaccessible.
**Action:** Always ensure that icon-only `TouchableOpacity` instances receive `accessibilityRole="button"` and a descriptive `accessibilityLabel` (e.g., "Cerrar modal") to guarantee full usability for visually impaired users.
## 2024-05-02 - List Item Interactive Area Accessibility
**Learning:** In React Native lists (like FlatList), wrapper `TouchableOpacity` components used for entire rows often lack semantic meaning for screen readers. Users rely on double-tapping the item, but without `accessibilityRole`, `accessibilityLabel`, and `accessibilityHint`, the screen reader won't announce the content correctly or inform the user about secondary actions (like long-press).
**Action:** Always ensure that interactive list items receive `accessibilityRole="button"`, a descriptive `accessibilityLabel` that summarizes the row's content, and an `accessibilityHint` if there are secondary actions like long-press.
