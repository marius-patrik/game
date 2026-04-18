/**
 * Shared glass-surface class stack. Every HUD panel (Card, Dialog, toast,
 * tooltip, popover) should layer one of these on. Definitions live in
 * `src/styles/tokens.css`.
 */
export const GLASS = {
  /** Default panel — used on inventory cards, stat panels, settings. */
  panel: "polish-glass polish-glow-ring",
  /** Strong variant — used on centered modals / dialogs where contrast
   * against a bright scene matters most. */
  strong: "polish-glass-strong polish-glow-ring",
  /** Faint variant — used on subtle floating widgets (compass ring,
   * interaction prompt) that shouldn't dominate the HUD. */
  faint: "polish-glass-faint",
  /** Gold rim — used on level-up / quest-ready celebrations. */
  gold: "polish-glass-strong polish-glow-gold",
} as const;
