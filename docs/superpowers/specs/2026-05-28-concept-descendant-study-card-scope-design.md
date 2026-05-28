# Concept Descendant Study Card Scope Design

## Context

Concepts are reusable module-owned scopes. The Concept Tree is single-parent, and Study Cards attach primarily to the deepest relevant Concept. Today, Concept Study Card and review surfaces use only Study Cards directly attached to the selected Concept. That makes parent Concepts under-represent their actual learning scope when most Study Cards live under descendant Concepts.

Mind Map nodes already expose `study_card_count`, but the count represents direct cards for the node in the current graph, not the aggregate Concept scope. Concept Mind Maps also render direct Study Card nodes for the selected Concept.

## Goal

Make parent Concepts aggregate Study Cards from descendant Concepts while preserving a clear distinction between direct and descendant cards.

## Requirements

- A Concept has three Study Card counts:
  - direct: unique Study Cards attached to that Concept.
  - descendant: unique Study Cards attached to any descendant Concept.
  - total: unique union of direct and descendant Study Cards, deduplicated by Study Card ID.
- Parent Concepts act as aggregate scopes for read/review flows.
- Module and Note Group Mind Map Concept nodes show direct, descendant, and total Study Card count chips.
- Concept Mind Maps render direct Study Card nodes for the current Concept.
- Concept Mind Maps do not render descendant Study Card nodes; descendant coverage is shown by counts.
- Concept pages include descendant Study Cards in review by default.
- Concept View Cards include descendant Study Cards by default.
- Concept review and Concept View Cards each provide a toggle to switch between included descendants and direct-only.
- The toggle default is on: descendants included.
- Existing user-facing terminology must stay aligned with `project-lexicon.md`: use `Concept`, `Concept Tree`, and `Study Card`.

## Non-Goals

- Do not change the Concept Tree from single-parent to DAG.
- Do not move Study Cards from descendant Concepts to parent Concepts.
- Do not duplicate Study Cards in API responses when a Study Card is attached to both a parent and descendant Concept.
- Do not render descendant Study Card nodes in Concept Mind Maps.
- Do not change Note Group ownership or provenance for Study Cards.

## Backend Design

Add shared Concept Tree utilities that compute descendant Concept IDs for a given Concept within the same module. The helper should walk `TopicChip.parent_topic_id`, guard against cycles, and return descendants in stable Concept Tree order.

Add a shared Study Card scope helper for Concepts:

- Inputs: `concept_id`, `include_descendants`.
- Output:
  - ordered unique Study Card IDs.
  - direct Study Card IDs.
  - descendant Study Card IDs.
  - direct, descendant, and total counts.
- Deduplication key: `StudyCard.id`.
- Ordering: preserve the current Study Card ordering by `StudyCard.created_at ASC, StudyCard.id ASC`.

Use the helper in:

- `GET /concepts/{concept_id}/study-cards`
- `GET /concepts/{concept_id}/question-cards`
- `GET /concepts/{concept_id}/question-cards/timeline`
- `GET /concepts/{concept_id}/question-cards/review`
- Concept Mind Map response building.

Add an optional query parameter to Concept card/review endpoints:

- `include_descendants=true` by default.
- `include_descendants=false` returns direct-only behavior.

Question Card endpoints should continue to derive cards from referenced Study Cards. The allowed Study Card set changes according to `include_descendants`; the Question Card response remains deduplicated.

## Mind Map Design

Extend `MindMapNodeOut` for Concept nodes with count fields:

- `direct_study_card_count`
- `descendant_study_card_count`
- `total_study_card_count`

Keep existing `study_card_count` as a compatibility alias for total count on Concept nodes once aggregate counts are available.

For Module and Note Group Mind Maps:

- Concept chips show direct, descendant, and total counts when values are non-zero.
- The total chip should make the aggregate scope obvious.
- Counts are scoped to the graph context. A Note Group Mind Map only counts Study Cards supported by that Note Group.

For Concept Mind Maps:

- The current Concept node exposes direct, descendant, and total counts.
- Direct Study Cards still render as Study Card nodes.
- Descendant Study Cards do not render as nodes.
- Child Concept nodes show their own direct, descendant, and total counts.

## Frontend Design

Add `includeDescendantStudyCards` state for Concept pages. Default: `true`.

Use that state when loading Concept data:

- Concept View Cards calls `listConceptStudyCards(conceptId, { includeDescendants })`.
- Concept Question Cards and review-related calls use the same include/exclude choice where relevant.
- Starting Concept review passes the current include-descendants value to `listConceptReviewQuestionCards`.

Concept page controls:

- Add a compact toggle labelled `Include descendant Study Cards`.
- Default checked.
- Place it where it scopes the current Concept card surface:
  - On View Cards, near the Concept fixed-filter context and card count.
  - On review controls, near the review actions/count controls.
- When off, visible cards and review queue are direct-only.

Mind Map rendering:

- Update badge generation so Concept nodes can show `direct`, `descendant`, and `total` Study Card counts.
- Preserve existing Knowledge Node and Study Card node rendering.
- Do not add descendant Study Card nodes to Concept Mind Maps.

## Data Flow

1. User opens a Concept page.
2. Frontend defaults `includeDescendantStudyCards` to `true`.
3. Frontend requests Concept cards and questions with `include_descendants=true`.
4. Backend computes direct and descendant Concept IDs, queries linked Study Cards, deduplicates by `StudyCard.id`, and returns the aggregate result.
5. User toggles descendants off.
6. Frontend reloads Concept card/question data with `include_descendants=false`.
7. Review starts with the same setting so the review queue matches the visible Concept scope.

## Testing

Backend tests:

- Direct-only Concept Study Card endpoint returns only cards attached to the selected Concept.
- Descendant-included Concept Study Card endpoint includes child and deeper descendant cards.
- Duplicate parent/descendant links produce one Study Card in total scope.
- Concept Question Card and review endpoints use the same scoped allowed Study Card set.
- Concept Mind Map response renders direct Study Card nodes but not descendant Study Card nodes.
- Mind Map Concept nodes include direct, descendant, and total counts.

Frontend tests:

- Concept View Cards defaults to include descendant Study Cards.
- Toggling descendants off reloads Concept cards direct-only.
- Concept review uses the current include-descendants setting.
- Mind Map badges render direct, descendant, and total Study Card counts.
- Concept Mind Map renders direct Study Card nodes and descendant counts without descendant Study Card nodes.

## Open Decisions Resolved

- Direct Study Cards should still render in Concept Mind Maps.
- Descendant Study Cards should not render in Concept Mind Maps.
- Total counts deduplicate Study Cards by Study Card ID.
