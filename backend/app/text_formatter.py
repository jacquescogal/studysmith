import re
from typing import Dict, List


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "section"


def build_formatted_sections(raw_sections: List[dict], study_cards: List[dict]) -> List[dict]:
    card_by_id: Dict[str, dict] = {card["id"]: card for card in study_cards}
    section_by_card_id: Dict[str, dict] = {}

    for section in raw_sections or []:
        card_id = section.get("study_card_id") or section.get("studyCardId")
        if not card_id or card_id not in card_by_id:
            continue
        if card_id in section_by_card_id:
            continue
        title = (section.get("title") or section.get("heading") or "").strip()
        content = (section.get("content") or section.get("body") or "").strip()
        section_by_card_id[card_id] = {"title": title, "content": content}

    formatted_sections: List[dict] = []
    for index, card in enumerate(study_cards, start=1):
        card_id = card["id"]
        card_title = (card.get("title") or "").strip() or f"Section {index}"
        base_section = section_by_card_id.get(card_id, {})
        title = base_section.get("title") or card_title
        content = base_section.get("content") or (card.get("content") or "").strip()
        anchor = f"{_slugify(title)}-{card_id[:8]}"
        formatted_sections.append(
            {
                "study_card_id": card_id,
                "title": title,
                "content": content,
                "anchor": anchor,
            }
        )

    return formatted_sections


def sections_to_markdown(sections: List[dict]) -> str:
    blocks: List[str] = []
    for section in sections:
        title = section.get("title") or "Section"
        content = (section.get("content") or "").strip()
        if content:
            blocks.append(f"## {title}\n{content}")
        else:
            blocks.append(f"## {title}")
    return "\n\n".join(blocks).strip()
