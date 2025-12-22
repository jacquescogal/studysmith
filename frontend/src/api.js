const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const raw = await response.text();
    let detail = raw || "Request failed";
    try {
      const parsed = JSON.parse(raw);
      detail = parsed.detail || JSON.stringify(parsed);
    } catch (error) {
      // keep raw as detail
    }
    throw new Error(detail);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function listSubjects() {
  return request("/subjects");
}

export function createSubject(payload) {
  return request("/subjects", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function listModules(subjectId) {
  return request(`/subjects/${subjectId}/modules`);
}

export function createModule(subjectId, payload) {
  return request(`/subjects/${subjectId}/modules`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateModule(moduleId, payload) {
  return request(`/modules/${moduleId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function createNoteGroup(moduleId, payload) {
  return request(`/modules/${moduleId}/note-groups`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function listNoteGroups(moduleId, chipIds = []) {
  const params = new URLSearchParams();
  if (chipIds.length) {
    params.set("chip_ids", chipIds.join(","));
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request(`/modules/${moduleId}/note-groups${suffix}`);
}

export function getNoteGroup(noteGroupId) {
  return request(`/note-groups/${noteGroupId}`);
}

export function updateNoteGroupTitle(noteGroupId, payload) {
  return request(`/note-groups/${noteGroupId}/title`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function getTitleSuggestions(payload) {
  return request("/note-groups/title-suggestions", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function suggestTopicChips(payload) {
  return request("/note-groups/topic-chips/suggest", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function finalizeNoteGroup(payload) {
  return request("/note-groups/finalize", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function listTopicChips(moduleId) {
  return request(`/modules/${moduleId}/topic-chips`);
}

export function createTopicChip(moduleId, payload) {
  return request(`/modules/${moduleId}/topic-chips`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function attachTopicChips(noteGroupId, payload) {
  return request(`/note-groups/${noteGroupId}/topic-chips`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function detachTopicChip(noteGroupId, chipId) {
  return request(`/note-groups/${noteGroupId}/topic-chips/${chipId}`, {
    method: "DELETE"
  });
}

export function generateNoteGroup(noteGroupId) {
  return request(`/note-groups/${noteGroupId}/generate`, {
    method: "POST"
  });
}

export function getJob(jobId) {
  return request(`/jobs/${jobId}`);
}

export function listStudyCards(noteGroupId) {
  return request(`/note-groups/${noteGroupId}/study-cards`);
}

export function getStudyCard(studyCardId) {
  return request(`/study-cards/${studyCardId}`);
}

export function createStudyCard(noteGroupId, payload) {
  return request(`/note-groups/${noteGroupId}/study-cards`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateStudyCard(studyCardId, payload) {
  return request(`/study-cards/${studyCardId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteStudyCard(studyCardId) {
  return request(`/study-cards/${studyCardId}`, {
    method: "DELETE"
  });
}

export function reviewStudyCards(noteGroupId, payload) {
  return request(`/note-groups/${noteGroupId}/study-cards/review`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function generateQuestionCards(noteGroupId, payload) {
  return request(`/note-groups/${noteGroupId}/question-cards/generate`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function listQuestionCards(noteGroupId) {
  return request(`/note-groups/${noteGroupId}/question-cards`);
}

export function listReviewQuestionCards(noteGroupId, mode, limit) {
  const params = new URLSearchParams({ mode });
  if (limit) {
    params.set("limit", String(limit));
  }
  return request(`/note-groups/${noteGroupId}/question-cards/review?${params.toString()}`);
}

export function listModuleReviewQuestionCards(moduleId, mode, limit) {
  const params = new URLSearchParams({ mode });
  if (limit) {
    params.set("limit", String(limit));
  }
  return request(`/modules/${moduleId}/question-cards/review?${params.toString()}`);
}

export function createQuestionCard(noteGroupId, payload) {
  return request(`/note-groups/${noteGroupId}/question-cards`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateQuestionCard(questionCardId, payload) {
  return request(`/question-cards/${questionCardId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteQuestionCard(questionCardId) {
  return request(`/question-cards/${questionCardId}`, {
    method: "DELETE"
  });
}

export function reviewQuestionCard(questionCardId, payload) {
  return request(`/question-cards/${questionCardId}/review`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function sendChat(payload) {
  return request("/chat", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
