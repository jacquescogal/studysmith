## 1. Reproduce and Pin Down Sidebar Directory Behavior

- [x] 1.1 Add or update `buildConceptDirectoryRows` tests for root-level rows, selected Concept rows, child Concept rows, up/back rows, and fallback to root when the selected Concept is missing.
- [x] 1.2 Add or update `ContextSidebar` tests so the Concepts tab renders directory rows with visual child indicators and does not mark the up/back row active.
- [x] 1.3 Add or update navigation/state tests proving root-level up navigation returns to the module page while preserving Concepts sidebar mode.

## 2. Fix Directory Row Data Flow

- [x] 2.1 Normalize Concept identifiers and parent identifiers in the sidebar option mapping, including `parent_concept_id` and legacy `parent_topic_id`.
- [x] 2.2 Ensure the Concepts sidebar receives directory-projected rows when Concept search is empty and flat filtered rows only while search is active.
- [x] 2.3 Ensure clearing Concept search restores the directory level for the current selected Concept.

## 3. Fix Sidebar Navigation State

- [x] 3.1 Ensure selecting a Concept row navigates to that Concept and enters its directory level.
- [x] 3.2 Ensure selecting the up/back row from a child Concept navigates to the parent Concept.
- [x] 3.3 Ensure selecting the up/back row from a root Concept navigates to the module page with `sidebarScope` preserved as Concepts.
- [x] 3.4 Ensure route restore and module navigation do not silently switch the sidebar back to Note Groups when the user is in Concepts mode.

## 4. Verification

- [x] 4.1 Run focused frontend tests for Concept directory rows, sidebar rendering, sidebar scope, and route/navigation behavior.
- [x] 4.2 Run frontend build.
- [x] 4.3 Manually inspect remaining user-facing sidebar copy to ensure it uses Concept terminology.
