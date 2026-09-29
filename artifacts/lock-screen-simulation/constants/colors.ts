/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#0a0a0a',
    tint: '#55d7f5',

    // Core surfaces
    background: '#121c24',
    foreground: '#f8fbfc',

    // Cards / elevated surfaces
    card: '#1d2b34',
    cardForeground: '#f8fbfc',

    // Primary action color (buttons, links, active states)
    primary: '#55d7f5',
    primaryForeground: '#ffffff',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#263944',
    secondaryForeground: '#f8fbfc',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#263944',
    mutedForeground: '#aebdc4',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#18343c',
    accentForeground: '#c5f6ff',

    // Destructive actions (delete, error states)
    destructive: '#ff7b86',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#3a4e58',
    input: '#3a4e58',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 8,
};

export default colors;
