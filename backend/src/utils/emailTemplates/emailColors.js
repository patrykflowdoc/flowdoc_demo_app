/**
 * Email palette: hex values aligned with catering/src/index.css design system.
 * Email clients do not support CSS variables or reliable HSL, so we use hex here.
 * Source: :root in catering/src/index.css (primary 152 60% 42%, foreground 160 10% 15%, etc.)
 */
export const emailColors = {
  primary: '#2d9d6b',       // hsl(152, 60%, 42%) – green accent, borders
  foreground: '#232b29',    // hsl(160, 10%, 15%) – main text
  mutedForeground: '#6b726f', // hsl(160, 5%, 45%) – labels, secondary text
  border: '#e2e8e6',       // hsl(160, 15%, 90%) – light borders/dividers
  borderLight: '#e6e6e6',  // table row dividers
  accentBg: '#e8f5ef',     // hsl(152, 45%, 92%) – light green box background
  tableHeaderBg: '#e8f5ef', // same as accentBg for table thead
  background: '#ffffff',    // hsl(0, 0%, 100%)
};
