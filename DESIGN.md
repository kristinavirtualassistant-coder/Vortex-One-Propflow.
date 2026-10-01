# Vortex One PropFlow — Design System

## Product character
Property intelligence and operations infrastructure. Vortex One should feel precise, calm, fast, and information-dense without looking like a generic SaaS template.

## Design thesis
**Follow the relationship, not the module.** Property, parcel, owner, entity, contact, activity, campaign, and workflow are connected intelligence objects. The interface should expose those relationships progressively.

## Visual direction
- Workspace: warm-neutral light canvas with white operational surfaces.
- Navigation: graphite/near-black rail for persistent orientation.
- Primary accent: electric violet for Vortex actions and identity.
- Secondary intelligence signal: restrained teal/cyan for connected-data states.
- Semantic: emerald success, amber warning, rose/red danger.
- Avoid stacked cards; prefer one primary surface with clear sub-regions, rules, and whitespace.
- Primary surface radius: 16px.
- Controls: 10–12px radius.
- Shadows: soft and directional, never heavy floating-card stacks.

## Typography
- Product/display: strong semibold/black sans.
- Interface: system sans / Inter-compatible stack.
- Data: monospace for APNs, IDs, coordinates, timestamps, and provenance values.
- Use sentence case for product labels. Reserve uppercase tracking for tiny utility eyebrows.

## Signature interaction
The **Vortex Command Layer** is available throughout authenticated product surfaces:
- Search
- Ask about the current object
- Jump to related objects
- Trigger a workflow
- Enrich a record

The command layer is contextual rather than a separate chatbot destination.

## Core object language
Property <-> Parcel <-> Owner <-> Entity <-> Portfolio <-> Contact <-> Activity <-> Campaign <-> Workflow

## Application shell
- Persistent dark sidebar.
- Top command/search bar.
- Single document surface in the main workspace.
- Responsive drawer on mobile.
- Active navigation uses a left signal and restrained surface tint.

## Responsive model
- Desktop: navigation + full intelligence workspace.
- Tablet: compact navigation and two-column detail views where space allows.
- Mobile: task-first experience; prioritize Search, Calls/Activity, Contacts, Properties, Tasks, Notifications.

## Motion
- 160–260ms interaction transitions.
- 300–420ms page/route reveals where useful.
- Motion communicates hierarchy and state, never decoration.
- Respect prefers-reduced-motion.

## Accessibility
Target WCAG 2.2 AA. Use semantic HTML, visible focus, keyboard-accessible actions, accessible names, stable layouts, and non-motion equivalents.

## Durable rule
Extend shared primitives. Do not create screen-local interaction or token systems when a reusable pattern already exists.
