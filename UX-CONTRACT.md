# Vortex One PropFlow — UX Contract

## Global navigation
- Navigation is grouped by user intent.
- Overview/Command Center is the operational home.
- Property and Owner intelligence are first-class destinations.
- Search is global and contextual.
- Settings remains the canonical home for account, workspace, security, appearance, and integrations.

## Command/search
- Search responds after a 300ms debounce.
- Clear is always available once a query exists.
- Search results must use semantic interactive elements.
- Current-object actions may be surfaced in the command layer.
- Stale searches must not overwrite newer results.

## Feedback
- Save actions preserve button geometry while busy.
- Success feedback is visible near the action and announced through accessible status text.
- Errors remain visible until corrected or intentionally dismissed.
- Product UI never uses browser alert/confirm/prompt.

## Tables
- Use bounded, paginated datasets for administrative/search tables.
- Preserve filter/sort/page state in the URL unless the state is sensitive or explicitly transient.
- Always provide loading, empty, no-results, partial-error, and range states.

## Destructive actions
- Use app-owned dialogs.
- Name the object and consequence.
- Separate destructive actions visually from routine actions.

## Mobile
- Navigation closes after selection.
- Prioritize search, active work, contacts, properties, and tasks.
- Avoid forcing desktop information density onto narrow screens.

## Design evolution
The shell, command layer, object headers, relationship views, source/provenance indicators, and state patterns are canonical shared primitives. Extend them rather than duplicating them.
