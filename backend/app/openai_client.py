import json
import re
from typing import List, Optional

from openai import OpenAI

from app.config import settings

SYSTEM_PROMPT = (
    "Convert raw study text into atomic study cards for effective learning and retrieval. "
    "Do not invent facts. Split by concept; each card must be coherent alone. "
    "Focus on content relevant to the module's learning goal and scope when provided."
)

STUDY_CARD_CONTEXT_PROMPT = (
    "Convert raw study text into atomic study cards for effective learning and retrieval. "
    "Do not invent facts. Split by concept; each card must be coherent alone. "
    "Focus only on content relevant to the module's learning goal and scope — skip the rest. "
    "Assign zero or more topic chips to each study card using only the provided chip list."
)

QUESTION_SYSTEM_PROMPT = (
    "Generate assessment questions answerable using the provided Study Cards only. "
    "Every question must reference which Study Cards support the answer. "
    "Create MCQ or multi-answer questions. Avoid ambiguity; test understanding. "
    "Prefer scenario-based questions when appropriate. "
    "Focus questions on the module's learning goal and scope. "
    "If more than one option is correct, set type to 'multi'. "
    "Return JSON only. Each question must include: type ('mcq' or 'multi'), "
    "prompt, options (4 short strings), correct_option_indices (array of integers), "
    "option_explanations (array of 4 short strings aligned with options), "
    "and study_card_refs (array of studyCardId strings)."
)

CHAT_SYSTEM_PROMPT = (
    "You are a study assistant. Answer the user's question using only the provided "
    "study card context. If the answer is not in the context, say you do not know. "
    "Be concise and factual. Return JSON only with keys: answer, used_ref_ids."
)

TITLE_SYSTEM_PROMPT = (
    "Generate concise, descriptive chapter-style titles reflecting the input content."
)

TOPIC_CHIP_SYSTEM_PROMPT = (
    "Assign relevant topic chips from the module pool. "
    "Propose new chips only when an important concept is missing AND it fits the module's learning goal and scope. "
    "Each chip label must be 1-2 words and at most 20 characters. "
    "Prefer broad, reusable terms over specific or verbose ones. "
    "Do not create chips for content outside the module scope."
)

SUBJECT_INTENT_SYSTEM_PROMPT = (
    "You are helping a student define a study subject. "
    "Through friendly conversation, extract: "
    "- title: a concise name for the subject area (e.g. 'AZ-305 Solutions Architect', 'Organic Chemistry') "
    "- goal: what the student wants to achieve (e.g. 'Pass the AZ-305 certification exam', 'Understand reaction mechanisms for finals') "
    "- scope: the boundaries of what this subject covers (e.g. 'All AZ-305 exam topic areas', 'Chapters 1-8 of the course textbook') "
    "Keep responses brief and conversational. "
    "Always respond in JSON with keys: reply (string), title (string or null), goal (string or null), scope (string or null). "
    "Only set title/goal/scope when you have enough information — do not guess."
)

MODULE_INTENT_SYSTEM_PROMPT = (
    "You are a learning design assistant helping a user define the intent of a study module. "
    "Extract three structured fields from the conversation: "
    "title (short module name, e.g. 'AZ-305 Exam Prep'), "
    "goal (outcome statement — what success looks like, 1-2 sentences), "
    "scope (topics, domains, and boundaries of study — what is in and what is out). "
    "If any field cannot be confidently determined from what the user has said, ask exactly one clarifying question. "
    "Always return JSON: {\"assistant_message\": \"...\", \"title\": \"...\", \"goal\": \"...\", \"scope\": \"...\"}. "
    "Use null for fields you cannot yet fill. "
    "Preserve existing field values unless the user's message clearly updates them."
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


def generate_study_cards(
    module_title: str,
    module_description: Optional[str],
    raw_text: str,
    additional_instructions: Optional[str] = None,
    module_goal: Optional[str] = None,
    module_scope: Optional[str] = None,
    subject_title: Optional[str] = None,
    subject_goal: Optional[str] = None,
    subject_scope: Optional[str] = None,
) -> List[dict]:
    client_instance = _require_client()
    intent_block = ""
    if subject_goal or subject_scope or module_goal or module_scope:
        parts = []
        if subject_title:
            parts.append(f"Subject: {subject_title}")
        if subject_goal:
            parts.append(f"Subject goal: {subject_goal}")
        if subject_scope:
            parts.append(f"Subject scope: {subject_scope}")
        if module_goal:
            parts.append(f"Module goal: {module_goal}")
        if module_scope:
            parts.append(f"Module scope: {module_scope}")
        else:
            parts.append("Module scope: not restricted (knowledge may span modules)")
        intent_block = "\n".join(parts) + "\n"
    module_context = f"Module context: {module_title}"
    if module_description:
        module_context += f" ({module_description})"
    instruction_block = ""
    if additional_instructions:
        instruction_block = (
            f"Additional generation instructions: {additional_instructions}\n"
        )
    user_prompt = (
        f"{intent_block}"
        f"{module_context}\n"
        f"{instruction_block}"
        f"Raw text: {raw_text}\n"
        "Output: list of Study Cards with { title?, content, key_terms? } in JSON."
    )

    response = client_instance.chat.completions.create(
        model=settings.openai_generation_model,
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
    additional_instructions: Optional[str] = None,
    module_goal: Optional[str] = None,
    module_scope: Optional[str] = None,
    subject_title: Optional[str] = None,
    subject_goal: Optional[str] = None,
    subject_scope: Optional[str] = None,
) -> List[dict]:
    client_instance = _require_client()
    intent_block = ""
    if subject_goal or subject_scope or module_goal or module_scope:
        parts = []
        if subject_title:
            parts.append(f"Subject: {subject_title}")
        if subject_goal:
            parts.append(f"Subject goal: {subject_goal}")
        if subject_scope:
            parts.append(f"Subject scope: {subject_scope}")
        if module_goal:
            parts.append(f"Module goal: {module_goal}")
        if module_scope:
            parts.append(f"Module scope: {module_scope}")
        else:
            parts.append("Module scope: not restricted (knowledge may span modules)")
        intent_block = "\n".join(parts) + "\n"
    module_context = f"Module context: {module_title}"
    if module_description:
        module_context += f" ({module_description})"
    instruction_block = ""
    if additional_instructions:
        instruction_block = (
            f"Additional generation instructions: {additional_instructions}\n"
        )
    user_prompt = (
        f"{intent_block}"
        f"{module_context}\n"
        f"Note group title: {note_group_title}\n"
        f"Topic chips: {chip_labels}\n"
        f"{instruction_block}"
        f"Raw text: {raw_text}\n"
        "Output JSON as { \"study_cards\": [ { \"title\": \"...\", \"content\": \"...\", "
        "\"topic_chips\": [\"...\"] } ] }."
    )

    response = client_instance.chat.completions.create(
        model=settings.openai_generation_model,
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
    additional_instructions: Optional[str] = None,
    module_goal: Optional[str] = None,
    module_scope: Optional[str] = None,
    subject_title: Optional[str] = None,
    subject_goal: Optional[str] = None,
    subject_scope: Optional[str] = None,
) -> List[dict]:
    client_instance = _require_client()
    intent_block = ""
    if subject_goal or subject_scope or module_goal or module_scope:
        parts = []
        if subject_title:
            parts.append(f"Subject: {subject_title}")
        if subject_goal:
            parts.append(f"Subject goal: {subject_goal}")
        if subject_scope:
            parts.append(f"Subject scope: {subject_scope}")
        if module_goal:
            parts.append(f"Module goal: {module_goal}")
        if module_scope:
            parts.append(f"Module scope: {module_scope}")
        else:
            parts.append("Module scope: not restricted (knowledge may span modules)")
        intent_block = "\n".join(parts) + "\n"
    instruction_block = ""
    if additional_instructions:
        instruction_block = (
            f"Additional generation instructions:\n{additional_instructions}\n\n"
        )
    user_prompt = (
        f"{intent_block}"
        f"{instruction_block}"
        "Study cards:\n"
        f"{study_cards}\n\n"
        "Existing questions (avoid repeating these):\n"
        f"{existing_questions}\n\n"
        "Rules:\n"
        "- Use only the provided studyCardId values in study_card_refs.\n"
        "- Provide exactly 4 options per question.\n"
        "- Provide option_explanations with 4 short strings aligned to the options.\n"
        "- correct_option_indices must be 0-based indices into options.\n"
        "- If more than one correct index is provided, type must be 'multi'.\n"
        "- For multi-answer, include all correct indices.\n\n"
        f"Desired count (suggestion): {count}\n"
        f"Difficulty: {difficulty}\n\n"
        "If no new non-duplicative questions remain, return an empty list.\n"
        "Output JSON as { \"question_cards\": [ ... ] }."
    )

    response = client_instance.chat.completions.create(
        model=settings.openai_generation_model,
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
    ref_ids: Optional[List[str]] = None,
) -> dict:
    client_instance = _require_client()
    context = "\n\n".join(context_blocks)
    id_list = ", ".join(ref_ids or [])
    user_prompt = (
        f"Question: {question}\n\n"
        f"Available study_card_ids: [{id_list}]\n\n"
        "Context:\n"
        f"{context}\n\n"
        "Return JSON as { \"answer\": \"...\", \"used_ref_ids\": [\"...\"] }."
    )
    messages = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": user_prompt})
    response = client_instance.chat.completions.create(
        model=settings.openai_chat_model,
        messages=messages,
        temperature=0.2,
        response_format={"type": "json_object"},
    )
    payload = _parse_json(response.choices[0].message.content)
    answer = payload.get("answer", "").strip()
    used_refs = payload.get("used_ref_ids", [])
    if not isinstance(used_refs, list):
        used_refs = []
    return {"answer": answer, "used_ref_ids": used_refs}


def generate_note_group_title_suggestions(module_title: str, raw_text: str) -> List[str]:
    client_instance = _require_client()
    user_prompt = (
        f"Module: {module_title}\n"
        f"Raw text: {raw_text}\n"
        "Return exactly three title suggestions. Output JSON as { \"titles\": [\"...\", \"...\", \"...\"] }."
    )
    response = client_instance.chat.completions.create(
        model=settings.openai_generation_model,
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


def suggest_topic_chips(
    module_chip_pool: List[dict],
    content: str,
    module_goal: Optional[str] = None,
    module_scope: Optional[str] = None,
    subject_title: Optional[str] = None,
    subject_goal: Optional[str] = None,
    subject_scope: Optional[str] = None,
) -> dict:
    client_instance = _require_client()
    intent_block = ""
    if subject_goal or subject_scope or module_goal or module_scope:
        parts = []
        if subject_title:
            parts.append(f"Subject: {subject_title}")
        if subject_goal:
            parts.append(f"Subject goal: {subject_goal}")
        if subject_scope:
            parts.append(f"Subject scope: {subject_scope}")
        if module_goal:
            parts.append(f"Module goal: {module_goal}")
        if module_scope:
            parts.append(f"Module scope: {module_scope}")
        else:
            parts.append("Module scope: not restricted (knowledge may span modules)")
        intent_block = "\n".join(parts) + "\n"
    user_prompt = (
        f"{intent_block}"
        f"Module chip pool: {module_chip_pool}\n"
        f"Content: {content}\n"
        "Output JSON as { \"attach_chip_ids\": [\"...\"], \"new_chips\": [\"...\"] }."
    )
    response = client_instance.chat.completions.create(
        model=settings.openai_generation_model,
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
        model=settings.openai_generation_model,
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


def generate_subject_intent_response(
    message: str,
    history: Optional[List[dict]] = None,
    current_title: Optional[str] = None,
    current_goal: Optional[str] = None,
    current_scope: Optional[str] = None,
) -> dict:
    client_instance = _require_client()
    current_state = (
        f"Current fields — title: {current_title or 'none'}, "
        f"goal: {current_goal or 'none'}, "
        f"scope: {current_scope or 'none'}"
    )
    user_content = f"{current_state}\n\nUser message: {message}"
    messages: List[dict] = [{"role": "system", "content": SUBJECT_INTENT_SYSTEM_PROMPT}]
    if history:
        for item in history[-10:]:
            role = item.get("role")
            content = item.get("content")
            if role in {"user", "assistant"} and content and content.strip():
                messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_content})
    response = client_instance.chat.completions.create(
        model=settings.openai_chat_model,
        messages=messages,
        response_format={"type": "json_object"},
        temperature=0.4,
    )
    payload = _parse_json(response.choices[0].message.content)
    return {
        "assistant_message": payload.get("reply", ""),
        "title": payload.get("title", current_title),
        "goal": payload.get("goal", current_goal),
        "scope": payload.get("scope", current_scope),
    }


def generate_module_intent_response(
    message: str,
    history: Optional[List[dict]] = None,
    current_title: Optional[str] = None,
    current_goal: Optional[str] = None,
    current_scope: Optional[str] = None,
    subject_title: Optional[str] = None,
    subject_goal: Optional[str] = None,
    subject_scope: Optional[str] = None,
) -> dict:
    client_instance = _require_client()
    subject_block = ""
    if subject_title or subject_goal or subject_scope:
        parts = ["Context about the parent subject:"]
        if subject_title:
            parts.append(f"Subject: {subject_title}")
        if subject_goal:
            parts.append(f"Subject goal: {subject_goal}")
        if subject_scope:
            parts.append(f"Subject scope: {subject_scope}")
        subject_block = "\n".join(parts) + "\n\n"
    current_state = (
        f"Current fields — title: {current_title or 'none'}, "
        f"goal: {current_goal or 'none'}, "
        f"scope: {current_scope or 'none'}"
    )
    user_content = f"{subject_block}{current_state}\n\nUser message: {message}"
    messages: List[dict] = [{"role": "system", "content": MODULE_INTENT_SYSTEM_PROMPT}]
    if history:
        for item in history[-10:]:
            role = item.get("role")
            content = item.get("content")
            if role in {"user", "assistant"} and content and content.strip():
                messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_content})
    response = client_instance.chat.completions.create(
        model=settings.openai_chat_model,
        messages=messages,
        response_format={"type": "json_object"},
        temperature=0.4,
    )
    return _parse_json(response.choices[0].message.content)
