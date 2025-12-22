import json
import re
from typing import List, Optional

from openai import OpenAI

from app.config import settings

SYSTEM_PROMPT = (
    "Convert raw study text into atomic study cards for effective learning and retrieval. "
    "Do not invent facts. Split by concept; each card must be coherent alone. "
    "Ensure collective coverage of key information."
)

STUDY_CARD_CONTEXT_PROMPT = (
    "Convert raw study text into atomic study cards for effective learning and retrieval. "
    "Do not invent facts. Split by concept; each card must be coherent alone. "
    "Ensure collective coverage of key information. "
    "Assign zero or more topic chips to each study card using only the provided chip list."
)

QUESTION_SYSTEM_PROMPT = (
    "Generate assessment questions answerable using the provided Study Cards only. "
    "Every question must reference which Study Cards support the answer. "
    "Create MCQ or multi-answer questions. Avoid ambiguity; test understanding. "
    "Prefer scenario-based questions when appropriate. "
    "Return JSON only. Each question must include: type ('mcq' or 'multi'), "
    "prompt, options (4 short strings), correct_option_indices (array of integers), "
    "and study_card_refs (array of studyCardId strings)."
)

CHAT_SYSTEM_PROMPT = (
    "You are a study assistant. Answer the user's question using only the provided "
    "study card context. If the answer is not in the context, say you do not know. "
    "Be concise and factual."
)

TITLE_SYSTEM_PROMPT = (
    "Generate concise, descriptive chapter-style titles reflecting the input content."
)

TOPIC_CHIP_SYSTEM_PROMPT = (
    "Assign relevant topic chips from the module pool. "
    "Propose new chips only when an important concept is missing. "
    "Chips should be short noun phrases."
)

FORMATTED_TEXT_SYSTEM_PROMPT = (
    "Format the raw study text into clean, readable markdown. "
    "Use the study card list to define sections. "
    "Each section must map to exactly one study_card_id. "
    "Do not invent facts or add new content. "
    "Return JSON only."
)


client = OpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None


def _require_client() -> OpenAI:
    if not client:
        raise RuntimeError("OPENAI_API_KEY is not set in backend/.env")
    return client


def _parse_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def generate_study_cards(module_title: str, module_description: Optional[str], raw_text: str) -> List[dict]:
    client_instance = _require_client()
    module_context = f"Module context: {module_title}"
    if module_description:
        module_context += f" ({module_description})"

    user_prompt = (
        f"{module_context}\n"
        f"Raw text: {raw_text}\n"
        "Output: list of Study Cards with { title?, content, key_terms? } in JSON."
    )

    response = client_instance.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
        response_format={"type": "json_object"},
    )

    payload = _parse_json(response.choices[0].message.content)
    study_cards = payload.get("study_cards", [])
    if not isinstance(study_cards, list):
        raise ValueError("OpenAI response did not include study_cards list")
    return study_cards


def generate_study_cards_with_context(
    module_title: str,
    module_description: Optional[str],
    note_group_title: str,
    raw_text: str,
    chip_labels: List[str],
) -> List[dict]:
    client_instance = _require_client()
    module_context = f"Module context: {module_title}"
    if module_description:
        module_context += f" ({module_description})"

    user_prompt = (
        f"{module_context}\n"
        f"Note group title: {note_group_title}\n"
        f"Topic chips: {chip_labels}\n"
        f"Raw text: {raw_text}\n"
        "Output JSON as { \"study_cards\": [ { \"title\": \"...\", \"content\": \"...\", "
        "\"topic_chips\": [\"...\"] } ] }."
    )

    response = client_instance.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": STUDY_CARD_CONTEXT_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
        response_format={"type": "json_object"},
    )

    payload = _parse_json(response.choices[0].message.content)
    study_cards = payload.get("study_cards", [])
    if not isinstance(study_cards, list):
        raise ValueError("OpenAI response did not include study_cards list")
    return study_cards


def embed_texts(texts: List[str]) -> List[List[float]]:
    client_instance = _require_client()
    response = client_instance.embeddings.create(
        model=settings.openai_embedding_model,
        input=texts,
    )
    return [item.embedding for item in response.data]


def generate_question_cards(
    study_cards: List[dict],
    existing_questions: List[str],
    count: int,
    difficulty: str,
) -> List[dict]:
    client_instance = _require_client()
    user_prompt = (
        "Study cards:\n"
        f"{study_cards}\n\n"
        "Existing questions (avoid repeating these):\n"
        f"{existing_questions}\n\n"
        "Rules:\n"
        "- Use only the provided studyCardId values in study_card_refs.\n"
        "- Provide exactly 4 options per question.\n"
        "- correct_option_indices must be 0-based indices into options.\n"
        "- For multi-answer, include all correct indices.\n\n"
        f"Desired count (suggestion): {count}\n"
        f"Difficulty: {difficulty}\n\n"
        "If no new non-duplicative questions remain, return an empty list.\n"
        "Output JSON as { \"question_cards\": [ ... ] }."
    )

    response = client_instance.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": QUESTION_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
        response_format={"type": "json_object"},
    )

    payload = _parse_json(response.choices[0].message.content)
    question_cards = payload.get("question_cards", [])
    if not isinstance(question_cards, list):
        raise ValueError("OpenAI response did not include question_cards list")
    return question_cards


def generate_chat_response(
    question: str,
    context_blocks: List[str],
    history: Optional[List[dict]] = None,
) -> str:
    client_instance = _require_client()
    context = "\n\n".join(context_blocks)
    user_prompt = (
        f"Question: {question}\n\n"
        "Context:\n"
        f"{context}\n\n"
        "Answer:"
    )
    messages = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": user_prompt})
    response = client_instance.chat.completions.create(
        model=settings.openai_model,
        messages=messages,
        temperature=0.2,
    )
    return response.choices[0].message.content.strip()


def generate_note_group_title_suggestions(module_title: str, raw_text: str) -> List[str]:
    client_instance = _require_client()
    user_prompt = (
        f"Module: {module_title}\n"
        f"Raw text: {raw_text}\n"
        "Return exactly three title suggestions. Output JSON as { \"titles\": [\"...\", \"...\", \"...\"] }."
    )
    response = client_instance.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": TITLE_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
        response_format={"type": "json_object"},
    )
    payload = _parse_json(response.choices[0].message.content)
    titles = payload.get("titles")
    if not isinstance(titles, list):
        raise ValueError("OpenAI response did not include titles")
    cleaned = [title.strip() for title in titles if isinstance(title, str) and title.strip()]
    if len(cleaned) < 3:
        raise ValueError("OpenAI response did not include three titles")
    return cleaned[:3]


def suggest_topic_chips(module_chip_pool: List[dict], content: str) -> dict:
    client_instance = _require_client()
    user_prompt = (
        f"Module chip pool: {module_chip_pool}\n"
        f"Content: {content}\n"
        "Output JSON as { \"attach_chip_ids\": [\"...\"], \"new_chips\": [\"...\"] }."
    )
    response = client_instance.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": TOPIC_CHIP_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
        response_format={"type": "json_object"},
    )
    payload = _parse_json(response.choices[0].message.content)
    attach_chip_ids = payload.get("attach_chip_ids", [])
    new_chips = payload.get("new_chips", [])
    if not isinstance(attach_chip_ids, list):
        attach_chip_ids = []
    if not isinstance(new_chips, list):
        new_chips = []
    return {"attach_chip_ids": attach_chip_ids, "new_chips": new_chips}


def generate_formatted_sections(raw_text: str, study_cards: List[dict]) -> List[dict]:
    client_instance = _require_client()
    user_prompt = (
        "Raw text:\n"
        f"{raw_text}\n\n"
        "Study cards (use these to define sections and map study_card_id values):\n"
        f"{study_cards}\n\n"
        "Output JSON as { \"sections\": [ { \"study_card_id\": \"...\", \"title\": \"...\", "
        "\"content\": \"...\" } ] }."
    )

    response = client_instance.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": FORMATTED_TEXT_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
        response_format={"type": "json_object"},
    )

    payload = _parse_json(response.choices[0].message.content)
    sections = payload.get("sections", [])
    if not isinstance(sections, list):
        raise ValueError("OpenAI response did not include sections list")
    return sections
