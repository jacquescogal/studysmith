## Context

The Module workspace currently renders a right-side `SectionNav` card titled "On this page" through the app shell. Module, Note Group, and Concept pages also render several primary actions inside overview cards or shortcut sections: Mind Map, View Cards, source/study reading, Review, and Tutor Chat. This scatters high-frequency actions across the page and makes the right rail less useful than the page content it competes with.

The route model already distinguishes Module, Note Group, and Concept contexts, and the existing APIs already provide Mind Map data, View Cards table data, Cleaned Text / Formatted Text content, Review counts, and Tutor Chat context. This change should be a frontend composition change, not a backend contract change.

## Goals / Non-Goals

**Goals:**

- Replace the right-side "On this page" section navigation on Module, Note Group, and Concept pages with a scope-aware interaction dock.
- Keep dock actions predictable across scopes: Mind Map, View Cards, Review, and Note Group-only Study.
- Use the dock for in-page or route-content navigation, not as a generic settings or destructive action menu.
- Move duplicated shortcut cards and overview action rows into the dock where practical.
- Render Note Group Study content inline on the page instead of in a modal.
- Move Tutor Chat access to a floating bottom-right bubble that opens the existing Tutor Chat modal while preserving Module, Note Group, and Concept chat context.
- Preserve route deep links for Mind Map, View Cards, Study Cards, and Question Cards where they already exist.
- Preserve canonical labels: Module, Note Group, Concept, Mind Map, View Cards, Study, Review, Tutor Chat, with Study page mode labels `Source Text` and `Derived Study Cards`.

**Non-Goals:**

- Redesigning the left Context Sidebar or Module workspace shell.
- Changing backend APIs, Review scheduling behavior, card table data shape, or Tutor Chat retrieval semantics.
- Adding Study as a dock action for Module or Concept in this change.
- Replacing the Review dialog itself, unless existing Review behavior naturally needs a new entry point.
- Replacing the Tutor Chat modal itself; only the trigger moves to a floating bubble.
- Removing route pages that still have valid deep links.

## Decisions

### 1. Introduce a reusable scope interaction dock

Create a reusable dock component for the right rail, replacing `SectionNav` only for Module, Note Group, and Concept workspace pages. The dock should accept a normalized action model rather than hardcoding route-specific logic in the layout component.

The action model should include:

- `id`
- label
- icon
- optional count
- active/current state
- disabled state and reason
- primary click handler or route target
- optional secondary controls where needed, such as `Review Due` and a Review-count slider

Alternative considered: modify `SectionNav` to show buttons instead of links. That keeps a misleading component name and mixes section-navigation semantics with scope actions.

### 2. Keep the dock right-side on desktop and inline/sticky on narrow viewports

On desktop, the dock should occupy the existing right-side app-shell region. On narrow viewports, it should collapse into a compact horizontal or stacked action strip near the top of the route content so it remains usable without covering content. It must not overlap the floating Tutor Chat bubble.

Alternative considered: bottom mobile dock. This risks competing with the floating Tutor Chat bubble and browser safe areas. A content-adjacent mobile dock is simpler and less likely to hide page controls.

### 3. Treat dock buttons as route/content navigation, not page management

The dock should contain high-frequency learning actions:

- Mind Map: navigate by route to the current scope's Mind Map page.
- View Cards: navigate to the current scope's View Cards table.
- Study: Note Group only, reveal inline study content for the selected Note Group.
- Review: show due-now count, provide a `Review Due` action, and provide a 1-to-card-count slider that controls the configured Review count.

Settings, deletion, metadata editing, generation repair, and Knowledge Node regeneration should remain in the relevant overview/management areas unless a later change designs them as dock actions.

Alternative considered: move all buttons into the dock. That would make the dock noisy and blur its purpose as in-page navigation and learning workflow entry.

### 4. Use existing View Cards table as the card viewing destination

The dock's View Cards action should route to the existing View Cards table experience:

- Module: all cards belonging to the current Module.
- Note Group: cards for the current Note Group.
- Concept: cards directly associated with the current Concept.

Note Group and Concept already have View Cards route behavior. Module should add a module-scoped View Cards route/page that reuses the table component with module-scoped rows.

Alternative considered: show a small card summary in the dock. The user asked for the existing View Cards table, so the dock should navigate to the full table rather than duplicate it.

### 5. Convert Note Group Study from modal to route content

The Study dock action for Note Group should render the existing source/study reading content inline as page content. The current modal content should be reused where practical, but modal-specific shell behavior should be removed from this path. If both Cleaned Text and Formatted Text are available, the page should preserve both reading modes while using friendlier labels: `Source Text` for source-preserving content and `Derived Study Cards` for study-card-derived formatted content. Internal code can continue using the existing lexicon terms where they describe data shape.

Alternative considered: leave Study as a modal opened by the dock. That contradicts the requested interaction model and keeps study reading outside the route content.

### 6. Make Tutor Chat a floating scoped bubble

Tutor Chat should become a bottom-right floating bubble available on Module, Note Group, and Concept pages when protected actions are allowed and the current scope can be resolved. Opening it should display the existing Tutor Chat modal behavior, while the trigger moves out of page cards and overview action rows.

Context behavior must remain:

- Module page: Module context, all Module cards.
- Note Group page: Module plus Note Group context, Note Group cards.
- Concept page: Module plus Concept context, directly associated Concept cards.

The UI must say Concept, not Topic, even if legacy route/action helpers still use topic-named internals.

Alternative considered: keep chat in the dock. Chat is persistent help rather than route navigation, so a floating bubble keeps the dock focused on in-page actions.

### 7. Remove duplicate shortcut cards after dock migration

Cards or sections whose only purpose is to expose Mind Map, View Cards, Study/source reading, or Review shortcuts should be removed or reduced once the dock owns those entry points. Overview cards may still show stats, status, filters, management controls, progress, and descriptive content.

Alternative considered: keep old cards and add the dock. That would create duplicate controls and make it unclear which surface is primary.

## Risks / Trade-offs

- Dock becomes overcrowded -> Keep only the requested learning/navigation actions and leave management actions in their existing areas.
- Module View Cards scope is not currently first-class enough -> Add the smallest route/page model needed to reuse the existing View Cards table with Module-scoped data.
- Study content loses behavior during modal-to-page conversion -> Reuse existing reading content derivation and add tests for `Source Text` and `Derived Study Cards` labels and availability.
- Floating Tutor Chat overlaps route controls -> Reserve spacing and verify desktop/mobile layouts, especially with mobile dock behavior.
- Legacy topic-named internals leak to UI -> Tests should assert Concept labels in the dock and chat scope text.
- Review counts drift from overview stats -> Source dock counts from the same route page model data used by overview metrics.
