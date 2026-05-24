import json
import re
from typing import List, Optional

from openai import OpenAI

from app.config import settings
from app.models import (
    KNOWLEDGE_NODE_TYPES,
    MIND_MAP_IMPORTANCE_LEVELS,
    MIND_MAP_RELATION_TYPES,
    MIND_MAP_STUDY_CARD_ROLES,
)

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

CLEANED_TEXT_SYSTEM_PROMPT = (
    "Format raw study text into clean markdown. Fix spacing, headings, bullets, and line breaks only. "
    "Preserve all source content and meaning. Do not summarize, omit, add, or scope-filter content. "
    "Return JSON only with key cleaned_text_markdown."
)

MIND_MAP_SYSTEM_PROMPT = (
    "Extract a learning mind map from Study Cards. Return strict JSON only. "
    "Derive or reuse a single-parent Topic Tree, then derive leaf Knowledge Nodes under the deepest relevant Topic. "
    "Do not invent facts beyond the Study Cards. Every Study Card must link to at least one primary Topic."
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


def _responses_json(
    model: str,
    reasoning_effort: str,
    system_prompt: str,
    user_prompt: str,
    history: Optional[List[dict]] = None,
) -> dict:
    client_instance = _require_client()
    input_messages: List[dict] = [{"role": "system", "content": system_prompt}]
    if history:
        for item in history:
            role = item.get("role")
            content = item.get("content")
            if role in {"user", "assistant"} and content and content.strip():
                input_messages.append({"role": role, "content": content.strip()})
    input_messages.append({"role": "user", "content": user_prompt})
    response = client_instance.responses.create(
        model=model,
        input=input_messages,
        reasoning={"effort": reasoning_effort},
        text={"format": {"type": "json_object"}},
    )
    return _parse_json(response.output_text)


def _strong_json(system_prompt: str, user_prompt: str) -> dict:
    return _responses_json(
        settings.openai_strong_model,
        "medium",
        system_prompt,
        user_prompt,
    )


def _strong_high_json(system_prompt: str, user_prompt: str) -> dict:
    return _responses_json(
        settings.openai_strong_model,
        "high",
        system_prompt,
        user_prompt,
    )


def _weak_json(
    system_prompt: str,
    user_prompt: str,
    history: Optional[List[dict]] = None,
) -> dict:
    return _responses_json(
        settings.openai_weak_model,
        "low",
        system_prompt,
        user_prompt,
        history=history,
    )


def _build_intent_block(
    subject_title: Optional[str],
    subject_goal: Optional[str],
    subject_scope: Optional[str],
    module_goal: Optional[str],
    module_scope: Optional[str],
) -> str:
    if not (subject_goal or subject_scope or module_goal or module_scope):
        return ""
    parts = []
    if subject_title:
        parts.append(f"Subject: {subject_title}")
    if subject_goal:
        parts.append(f"Subject goal: {subject_goal}")
    if subject_scope:
        parts.append(f"Subject scope: {subject_scope}")
    if module_goal or module_scope:
        parts.append(f"Module goal: {module_goal or 'not specified'}")
        parts.append(
            f"Module scope: {module_scope or 'not restricted (knowledge may span modules)'}"
        )
    return "\n".join(parts) + "\n"


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
    intent_block = _build_intent_block(subject_title, subject_goal, subject_scope, module_goal, module_scope)
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

    payload = _strong_json(SYSTEM_PROMPT, user_prompt)
    study_cards = payload.get("study_cards", [])
    if not isinstance(study_cards, list):
        raise ValueError("OpenAI response did not include study_cards list")
    return study_cards


def generate_study_cards_with_context(
    module_title: str,
    module_description: Optional[str],
    note_group_title: str,
    raw_text: str,
    additional_instructions: Optional[str] = None,
    module_goal: Optional[str] = None,
    module_scope: Optional[str] = None,
    subject_title: Optional[str] = None,
    subject_goal: Optional[str] = None,
    subject_scope: Optional[str] = None,
) -> List[dict]:
    intent_block = _build_intent_block(subject_title, subject_goal, subject_scope, module_goal, module_scope)
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
        f"{instruction_block}"
        f"Cleaned markdown source text: {raw_text}\n"
        "Output JSON as { \"study_cards\": [ { \"title\": \"...\", \"content\": \"...\", "
        "\"evidence_snippets\": [\"...\"] } ] }.\n"
        "Each evidence_snippets value must be an exact copied substring from the cleaned markdown source text."
    )

    payload = _strong_json(STUDY_CARD_CONTEXT_PROMPT, user_prompt)
    study_cards = payload.get("study_cards", [])
    if not isinstance(study_cards, list):
        raise ValueError("OpenAI response did not include study_cards list")
    return study_cards


def generate_cleaned_text_markdown(raw_text: str) -> str:
    payload = _strong_json(CLEANED_TEXT_SYSTEM_PROMPT, f"Raw text:\n{raw_text}")
    cleaned = payload.get("cleaned_text_markdown") or payload.get("cleaned_text") or ""
    if not isinstance(cleaned, str) or not cleaned.strip():
        raise ValueError("OpenAI response did not include cleaned_text_markdown")
    return cleaned.strip()


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
    difficulty: str,
    additional_instructions: Optional[str] = None,
    module_goal: Optional[str] = None,
    module_scope: Optional[str] = None,
    subject_title: Optional[str] = None,
    subject_goal: Optional[str] = None,
    subject_scope: Optional[str] = None,
) -> List[dict]:
    intent_block = _build_intent_block(subject_title, subject_goal, subject_scope, module_goal, module_scope)
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
        f"Difficulty: {difficulty}\n\n"
        "Generate as many high-quality, non-redundant questions as the material warrants. "
        "Do not pad with weak or repetitive questions to reach any particular number.\n"
        "If no new non-duplicative questions remain, return an empty list.\n"
        "Output JSON as { \"question_cards\": [ ... ] }."
    )

    payload = _strong_json(QUESTION_SYSTEM_PROMPT, user_prompt)
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
    context = "\n\n".join(context_blocks)
    id_list = ", ".join(ref_ids or [])
    user_prompt = (
        f"Question: {question}\n\n"
        f"Available study_card_ids: [{id_list}]\n\n"
        "Context:\n"
        f"{context}\n\n"
        "Return JSON as { \"answer\": \"...\", \"used_ref_ids\": [\"...\"] }."
    )
    payload = _weak_json(CHAT_SYSTEM_PROMPT, user_prompt, history=history)
    answer = payload.get("answer", "").strip()
    used_refs = payload.get("used_ref_ids", [])
    if not isinstance(used_refs, list):
        used_refs = []
    return {"answer": answer, "used_ref_ids": used_refs}


def generate_note_group_title_suggestions(module_title: str, raw_text: str) -> List[str]:
    user_prompt = (
        f"Module: {module_title}\n"
        f"Raw text: {raw_text}\n"
        "Return exactly three title suggestions. Output JSON as { \"titles\": [\"...\", \"...\", \"...\"] }."
    )
    payload = _weak_json(TITLE_SYSTEM_PROMPT, user_prompt)
    titles = payload.get("titles")
    if not isinstance(titles, list):
        raise ValueError("OpenAI response did not include titles")
    cleaned = [title.strip() for title in titles if isinstance(title, str) and title.strip()]
    if len(cleaned) < 3:
        raise ValueError("OpenAI response did not include three titles")
    return cleaned[:3]


def generate_formatted_sections(raw_text: str, study_cards: List[dict]) -> List[dict]:
    user_prompt = (
        "Raw text:\n"
        f"{raw_text}\n\n"
        "Study cards (use these to define sections and map study_card_id values):\n"
        f"{study_cards}\n\n"
        "Output JSON as { \"sections\": [ { \"study_card_id\": \"...\", \"title\": \"...\", "
        "\"content\": \"...\" } ] }."
    )

    payload = _weak_json(FORMATTED_TEXT_SYSTEM_PROMPT, user_prompt)
    sections = payload.get("sections", [])
    if not isinstance(sections, list):
        raise ValueError("OpenAI response did not include sections list")
    return sections


def generate_topic_tree_candidate_graph(
    module_title: str,
    note_group_title: str,
    study_cards: List[dict],
    existing_topics: Optional[List[dict]] = None,
) -> dict:
    existing_topics_json = json.dumps(existing_topics or [], ensure_ascii=True)
    study_cards_json = json.dumps(study_cards, ensure_ascii=True)
    user_prompt = (
        f"Module title: {module_title}\n"
        f"Note Group title: {note_group_title}\n\n"
        "Existing module Topics:\n"
        f"{existing_topics_json}\n\n"
        "Study Cards:\n"
        f"{study_cards_json}\n\n"
        "Return strict JSON with exactly these top-level keys: topics, study_card_topic_links.\n"
        "Topic objects must include temp_id, title, summary, optional parent_topic_id, "
        "and optional matched_existing_topic_id. parent_topic_id may reference a topic temp_id or existing Topic ID. "
        "Each Topic must have at most one parent. Topics are intermediary scope nodes and are never leaf nodes. "
        "Study Card Topic links must include study_card_id, topic_id, and role. "
        "Every provided Study Card must have at least one Topic link with role primary; use the deepest relevant Topic. "
        "Use only provided Study Card IDs in links."
    )
    payload = _strong_high_json(MIND_MAP_SYSTEM_PROMPT, user_prompt)
    return {
        "topics": payload.get("topics"),
        "study_card_topic_links": payload.get("study_card_topic_links"),
    }


def generate_knowledge_node_candidates(
    module_title: str,
    note_group_title: str,
    study_cards: List[dict],
    topics: List[dict],
    study_card_topic_links: List[dict],
    existing_concepts: List[dict],
    existing_topics: Optional[List[dict]] = None,
) -> dict:
    existing_concepts_json = json.dumps(existing_concepts, ensure_ascii=True)
    existing_topics_json = json.dumps(existing_topics or [], ensure_ascii=True)
    topics_json = json.dumps(topics, ensure_ascii=True)
    study_card_topic_links_json = json.dumps(study_card_topic_links, ensure_ascii=True)
    study_cards_json = json.dumps(study_cards, ensure_ascii=True)
    user_prompt = (
        f"Module title: {module_title}\n"
        f"Note Group title: {note_group_title}\n\n"
        "Existing module Topics:\n"
        f"{existing_topics_json}\n\n"
        "Existing module Knowledge Nodes:\n"
        f"{existing_concepts_json}\n\n"
        "Resolved candidate Topic Tree:\n"
        f"{topics_json}\n\n"
        "Study Card Topic links:\n"
        f"{study_card_topic_links_json}\n\n"
        "Study Cards:\n"
        f"{study_cards_json}\n\n"
        "Return strict JSON with exactly these top-level keys: knowledge_nodes, relations, study_card_knowledge_node_links.\n"
        "Knowledge Node objects must include temp_id, topic_id, title, summary, knowledge_type, importance, "
        "optional source_quote, and optional matched_existing_knowledge_node_id. "
        "topic_id may reference a topic temp_id or existing Topic ID. "
        "Allowed knowledge_type values: "
        f"{sorted(KNOWLEDGE_NODE_TYPES)}.\n"
        "Allowed importance values: "
        f"{sorted(MIND_MAP_IMPORTANCE_LEVELS)}.\n"
        "Allowed relation_type values: "
        f"{sorted(MIND_MAP_RELATION_TYPES)}.\n"
        "Allowed Study Card link role values: "
        f"{sorted(MIND_MAP_STUDY_CARD_ROLES)}.\n\n"
        "Relations must include source_knowledge_node_id, target_knowledge_node_id, relation_type, confidence, and optional label. "
        "Relation endpoints may reference a Knowledge Node temp_id or an existing Knowledge Node ID. "
        "Study Card Knowledge Node links must include study_card_id, knowledge_node_id, and role when a Study Card teaches a leaf node. "
        "Use only provided Study Card IDs in links. "
        "For each touched Topic, reconcile Knowledge Nodes using Study Cards directly linked to that Topic as the deepest Topic. "
        "Work from deepest child Topics upward. Immediate child Topic definitions may be used as dependency context for the parent Topic. "
        "Immediate child Topic definitions should inform parent definitions, but parent Topics should not absorb all descendant Study Cards. "
        "Prefer at least one definition Knowledge Node for each touched Topic when the Study Cards or child definitions support it. "
        "If a definition is not supported, omit it; the backend will mark the Topic as needs_review. "
        "Do not create relations that are unsupported by the Study Cards. "
        "Do not use topic, subtopic, term, process, principle, example, or detail as knowledge_type values."
    )
    payload = _strong_high_json(MIND_MAP_SYSTEM_PROMPT, user_prompt)
    return {
        "knowledge_nodes": payload.get("knowledge_nodes"),
        "relations": payload.get("relations"),
        "study_card_knowledge_node_links": payload.get("study_card_knowledge_node_links", []),
    }


def generate_mind_map_candidate_graph(
    module_title: str,
    note_group_title: str,
    study_cards: List[dict],
    existing_concepts: List[dict],
    existing_topics: Optional[List[dict]] = None,
) -> dict:
    topic_payload = generate_topic_tree_candidate_graph(
        module_title=module_title,
        note_group_title=note_group_title,
        study_cards=study_cards,
        existing_topics=existing_topics,
    )
    topics = topic_payload.get("topics") or []
    study_card_topic_links = topic_payload.get("study_card_topic_links") or []
    knowledge_payload = generate_knowledge_node_candidates(
        module_title=module_title,
        note_group_title=note_group_title,
        study_cards=study_cards,
        topics=topics,
        study_card_topic_links=study_card_topic_links,
        existing_concepts=existing_concepts,
        existing_topics=existing_topics,
    )
    return {
        "topics": topics,
        "knowledge_nodes": knowledge_payload.get("knowledge_nodes") or [],
        "relations": knowledge_payload.get("relations") or [],
        "study_card_topic_links": study_card_topic_links,
        "study_card_knowledge_node_links": knowledge_payload.get("study_card_knowledge_node_links", []),
    }


def generate_subject_intent_response(
    message: str,
    history: Optional[List[dict]] = None,
    current_title: Optional[str] = None,
    current_goal: Optional[str] = None,
    current_scope: Optional[str] = None,
) -> dict:
    current_state = (
        f"Current fields — title: {current_title or 'none'}, "
        f"goal: {current_goal or 'none'}, "
        f"scope: {current_scope or 'none'}"
    )
    user_content = f"{current_state}\n\nUser message: {message}"
    payload = _weak_json(
        SUBJECT_INTENT_SYSTEM_PROMPT,
        user_content,
        history=(history or [])[-10:],
    )
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
    payload = _weak_json(
        MODULE_INTENT_SYSTEM_PROMPT,
        user_content,
        history=(history or [])[-10:],
    )
    return {
        "assistant_message": payload.get("assistant_message", ""),
        "title": payload.get("title") or current_title,
        "goal": payload.get("goal") or current_goal,
        "scope": payload.get("scope") or current_scope,
    }
