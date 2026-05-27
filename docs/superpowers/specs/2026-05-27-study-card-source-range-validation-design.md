# Study Card Source Range Validation Design

## Context

Study Card highlighting depends on `Source Range / Evidence Range` rows. A Source Range is a character span in `Cleaned Text` that supports a generated Study Card. The existing generation path already asks the AI for `evidence_snippets`, then the backend computes ranges by exact substring matching against `cleaned_text_markdown`.

The current failure mode is silent: if the AI omits `evidence_snippets`, returns a non-list value, or returns snippets that do not exactly match `cleaned_text_markdown`, the backend can still create Study Cards with no Source Ranges. Those cards render without source highlights.

## Goal

AI-generated note group Study Cards must not be promoted without valid Source Ranges. The system should improve the Study Card prompt, validate evidence in the backend, retry invalid AI responses up to three times, and fail the Study Cards stage clearly if provenance cannot be produced.

Manual Study Card creation is out of scope for this change.

## Design

### Prompt Contract

The Study Card generation prompt will continue to receive:

- Subject title, goal, and scope when present.
- Module title, description, goal, and scope when present.
- Note group title.
- Additional generation instructions when present.
- `Cleaned markdown source text`.

The prompt should be tightened so each generated Study Card must include `evidence_snippets`, where each snippet is copied exactly from the `Cleaned markdown source text`. It should also state that the model must not emit a Study Card unless it can provide exact source evidence for it.

The expected response remains JSON:

```json
{
  "study_cards": [
    {
      "title": "...",
      "content": "...",
      "evidence_snippets": ["..."]
    }
  ]
}
```

### Backend Validation

The `JOB_STAGE_STUDY_CARDS` flow will validate generated card provenance before accepting an attempt:

- Every accepted Study Card must have non-empty `content`.
- Every accepted Study Card must include `evidence_snippets` as a list.
- Every accepted Study Card must produce at least one Source Range from exact snippet matching against `cleaned_text_markdown`.
- Unmatched snippets may be ignored only when the same card has at least one matched snippet.
- If any generated card with non-empty `content` has no valid Source Range, the whole generation attempt is invalid.

Validation should happen before committing draft Study Cards as the accepted result. Failed attempts should not leave draft cards, draft source ranges, embeddings, formatted sections, question cards, Concept links, or Knowledge Node links that can leak into later stages.

### Retry Behavior

Study Card generation should retry invalid provenance responses up to three attempts inside the existing Study Cards stage:

1. Attempt 1 uses the normal improved prompt.
2. Attempts 2 and 3 add repair context explaining that the prior response had missing or unmatched `evidence_snippets`, and that snippets must be exact substrings of `Cleaned markdown source text`.
3. If attempt 3 is invalid, the job fails at `JOB_STAGE_STUDY_CARDS`.

The final failure message should be clear, for example:

```text
Generated Study Cards did not include matchable Source Ranges after 3 attempts.
```

### Data Flow

1. Generate `cleaned_text_markdown`.
2. Call Study Card generation with the cleaned markdown and context.
3. For each generated Study Card, compute Source Ranges from `evidence_snippets`.
4. Accept the attempt only if every generated card with non-empty `content` has at least one Source Range.
5. Store accepted draft Study Cards and `DraftStudyCardSourceRange` rows.
6. Continue to embeddings, Formatted Text, question generation, Concept generation, and promotion.
7. Promotion continues copying draft ranges into `study_card_source_ranges`.

### Error Handling

Invalid provenance is a Study Cards stage failure, not a later display concern. The job should report failure at `JOB_STAGE_STUDY_CARDS` after all retries are exhausted. This makes missing highlights visible during generation instead of silently creating incomplete cards.

If a later stage fails after a successful Study Cards attempt, the existing draft behavior should remain unchanged: valid draft Study Cards and draft Source Ranges can remain available for retry or cleanup according to the current workflow.

### Testing

Add or update backend tests for:

- A first invalid AI response followed by a valid retry creates draft Study Cards and draft Source Ranges.
- Two invalid responses followed by a valid third response promotes live Study Cards with `study_card_source_ranges`.
- Three invalid responses fail the job at `JOB_STAGE_STUDY_CARDS` with a clear error.
- A Study Card with non-empty content but missing, non-list, or unmatched `evidence_snippets` is rejected.
- Existing exact substring and overlapping Source Range behavior remains unchanged.

No frontend test is required unless implementation changes visible error presentation.

## Non-Goals

- Do not add fuzzy matching or inferred evidence ranges.
- Do not compute ranges against Formatted Text.
- Do not require source ranges for manually created Study Cards.
- Do not redesign the reading UI or highlighting CSS.
