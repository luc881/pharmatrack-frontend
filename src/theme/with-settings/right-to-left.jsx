// RTL mode is used solely to move the sidebar to the right side.
// We intentionally skip the stylis-plugin-rtl CSS transformer so that
// all component layouts (flex directions, text alignment, padding, etc.)
// stay in LTR. The sidebar and toggle button are repositioned manually
// via theme.direction checks in their own style definitions.

export function Rtl({ children }) {
  return <>{children}</>;
}
