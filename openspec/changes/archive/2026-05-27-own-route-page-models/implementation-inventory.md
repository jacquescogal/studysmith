## LegacyApp Responsibility Inventory

### App Shell
- Auth session UI state, sign-in/sign-out handlers, current user profile loading.
- Global confirmation dialog, toast host, shell layout, breadcrumbs, page header, context sidebar.
- Admin panel and subject management panel visibility.

### Subject
- Subject list loading, subject selection, subject creation, subject wizard, subject metadata edit, subject deletion.
- Subject index route content and subject modules route content.

### Module
- Module list loading, Module selection, Module wizard, Module metadata state/actions, Module deletion.
- Module overview data, Module Mind Map, Concept filters, Note Group ordering, Module Review controls.
- Auto Workflow state for active Module and generated Note Group jobs.

### Note Group
- Note Group route resolution, Note Group source duplicate checking, Auto Workflow creation.
- Note Group details, Study Cards, Question Cards, Cleaned Text, Formatted Text, progress, card table, and Mind Map state.
- Note Group metadata, deletion, Study Card editing, Question Card editing, Question Card generation, Reading state.

### Concept
- Concept route resolution, Concept list loading, Concept details, Concept Study Cards, Concept Question Cards, Concept Mind Map state.
- Concept metadata editing, deletion, Knowledge Node regeneration, Concept Review controls.

### Review
- Review queue/session state, answer submission, keyboard handling, summary/finalization, deletion flow, Review Tutor Chat.

### Tutor Chat
- Tutor Chat modal open state and chat hook wiring for active Module, Note Group, or Concept context.

### Reading
- Reading dialog open state, source navigation, formatted section anchors, Cleaned Text fallback rendering.

### Shared Utility
- Button/class constants, generation workflow labels, route navigation helpers, timeline formatting, question focus helpers.
