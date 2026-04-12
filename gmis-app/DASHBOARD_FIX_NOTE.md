// Fix for dashboard.tsx — only the classRow style needs changing.
// Replace the classRow in StyleSheet.create() with this:

// BEFORE (invalid — RN doesn't support CSS shorthand):
// classRow: {
//   borderLeftWidth: 3,
//   borderRadius: "0 8px 8px 0" as any,   ← THIS IS THE ERROR
//   ...
// }

// AFTER (correct — use individual radius properties):
// classRow: {
//   borderLeftWidth:          3,
//   borderTopRightRadius:     radius.md,
//   borderBottomRightRadius:  radius.md,
//   ...
// }
