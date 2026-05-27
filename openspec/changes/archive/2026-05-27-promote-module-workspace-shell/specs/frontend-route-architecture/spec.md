## ADDED Requirements

### Requirement: Module workspace shell persists across child routes
The frontend SHALL mount Module workspace chrome at the Module route boundary so the left Context Sidebar and shared Module workspace overlays remain stable while navigating among child routes inside the same Module.

#### Scenario: Sidebar remains mounted across Module child navigation
- **WHEN** a user navigates from a Module overview route to a Note Group or Concept route within the same Module
- **THEN** the Context Sidebar remains mounted and only the route content region changes

#### Scenario: Sidebar local state persists within a Module
- **WHEN** a user changes sidebar-local state such as search text, selected Browse tab, or scroll position and then navigates to another child route in the same Module
- **THEN** the sidebar preserves that local state unless the user changes the active Module

#### Scenario: Module change resets Module workspace chrome
- **WHEN** a user navigates to a different Module
- **THEN** the Module workspace shell refreshes its Module-scoped data and may reset sidebar-local state for the new Module

#### Scenario: Right-side route content owns page changes
- **WHEN** a user navigates among Module overview, Note Group, Concept, Study Card, Question Card, Mind Map, and create Note Group routes inside the same Module
- **THEN** the route content region renders the new page without remounting the Module workspace sidebar

#### Scenario: Deep links render persistent workspace shell
- **WHEN** a user opens a deep link to a Note Group or Concept child route
- **THEN** the frontend renders the Module workspace shell once for the resolved Module and renders the child route content beneath it
