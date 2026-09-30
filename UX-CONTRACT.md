# Vortex One PropFlow — UX Contract

## Global navigation
- Sidebar navigation is grouped by user intent, not implementation detail.
- Dashboard is the command center.
- Settings is the canonical home for personal, workspace, security, appearance, and integration configuration.
- Navigation changes close the mobile drawer and preserve the active state.

## Feedback
- Save actions use a stable button size with a busy state.
- Success feedback is visible near the action and announced through accessible status text.
- Errors remain visible until corrected or dismissed.
- No browser alert/confirm/prompt for product UI.

## Settings
- Profile and business data remain editable without losing entered values.
- Settings sections are navigable without leaving the settings workspace.
- Sensitive/destructive actions remain visually separated.
- File upload controls must not claim success when storage is not configured.

## Motion
- Motion is progressive enhancement.
- Reduced-motion users receive equivalent state changes without animation.
- Hover is never the only discovery mechanism.

## Dashboard
- Keep existing role-specific portal functionality.
- Improve the surrounding shell and hierarchy before changing business data behavior.
- Preserve existing integrations and role guards.
