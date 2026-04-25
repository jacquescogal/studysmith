from typing import Iterable


def _merge_ranges(ranges: list[tuple[int, int]]) -> list[tuple[int, int]]:
    if not ranges:
        return []
    sorted_ranges = sorted(ranges, key=lambda item: (item[0], item[1]))
    merged: list[tuple[int, int]] = []
    for start, end in sorted_ranges:
        if start < 0 or end <= start:
            continue
        if not merged:
            merged.append((start, end))
            continue
        previous_start, previous_end = merged[-1]
        if start <= previous_end:
            merged[-1] = (previous_start, max(previous_end, end))
        else:
            merged.append((start, end))
    return merged


def find_evidence_ranges(text: str, snippets: Iterable[str]) -> list[tuple[int, int]]:
    ranges: list[tuple[int, int]] = []
    if not text:
        return ranges

    for snippet in snippets:
        if not isinstance(snippet, str):
            continue
        cleaned = snippet.strip()
        if not cleaned:
            continue
        start = text.find(cleaned)
        while start != -1:
            end = start + len(cleaned)
            ranges.append((start, end))
            start = text.find(cleaned, start + 1)

    return _merge_ranges(ranges)
