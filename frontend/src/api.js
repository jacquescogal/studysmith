const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const MAX_REQUEST_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [250, 750];

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const isRetryableStatus = (status) =>
  status === 408 || status === 429 || (status >= 500 && status < 600);

const isAbortError = (error) => error?.name === "AbortError";

async function parseErrorResponse(response) {
  const raw = await response.text();
  let detail = raw || "Request failed";
  try {
    const parsed = JSON.parse(raw);
    detail = parsed.detail || JSON.stringify(parsed);
  } catch (error) {
    // keep raw as detail
  }
  const error = new Error(detail);
  error.status = response.status;
  return error;
}

async function request(path, options = {}) {
  const requestOptions = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  };
  let lastError;

  for (let attempt = 1; attempt <= MAX_REQUEST_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${API_BASE}${path}`, requestOptions);

      if (!response.ok) {
        const error = await parseErrorResponse(response);
        if (!isRetryableStatus(response.status) || attempt === MAX_REQUEST_ATTEMPTS) {
          throw error;
        }
        lastError = error;
      } else if (response.status === 204) {
        return null;
      } else {
        return response.json();
      }
    } catch (error) {
      if (
        isAbortError(error) ||
        (error.status && !isRetryableStatus(error.status)) ||
        attempt === MAX_REQUEST_ATTEMPTS
      ) {
        throw error;
      }
      lastError = error;
    }

    await sleep(RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
  }

  throw lastError || new Error("Request failed");
}

export function listSubjects() {
  return request("/subjects");
}

export function resolveAppSubjectRoute(subjectCode) {
  return request(`/routes/app/subject/${subjectCode}`);
}

export function resolveAppModuleRoute(subjectCode, moduleCode) {
  return request(`/routes/app/subject/${subjectCode}/module/${moduleCode}`);
}

export function resolveAppNoteGroupRoute(subjectCode, moduleCode, noteGroupCode) {
  return request(
    `/routes/app/subject/${subjectCode}/module/${moduleCode}/note-groups/${noteGroupCode}`
  );
}

export function resolveAppTopicRoute(subjectCode, moduleCode, topicCode) {
  return request(
    `/routes/app/subject/${subjectCode}/module/${moduleCode}/topics/${topicCode}`
  );
}

export function createSubject(payload) {
  return request("/subjects", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function deleteSubject(subjectId) {
  return request(`/subjects/${subjectId}`, {
    method: "DELETE"
  });
}

export function listModules(subjectId) {
  return request(`/subjects/${subjectId}/modules`);
}

export function listAllModules() {
  return request("/modules");
}

export function getModule(moduleId) {
  return request(`/modules/${moduleId}`);
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

export function deleteModule(moduleId) {
  return request(`/modules/${moduleId}`, {
    method: "DELETE"
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

export function getModuleOverview(moduleId, chipIds = []) {
  const params = new URLSearchParams();
  if (chipIds.length) {
    params.set("chip_ids", chipIds.join(","));
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request(`/modules/${moduleId}/overview${suffix}`);
}

export function checkNoteGroupSource(payload) {
  return request("/note-groups/source-check", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateNoteGroupOrder(moduleId, noteGroupIds) {
  return request(`/modules/${moduleId}/note-groups/order`, {
    method: "PUT",
    body: JSON.stringify({ note_group_ids: noteGroupIds })
  });
}

export function getNoteGroup(noteGroupId) {
  return request(`/note-groups/${noteGroupId}`);
}

export function deleteNoteGroup(noteGroupId) {
  return request(`/note-groups/${noteGroupId}`, {
    method: "DELETE"
  });
}

export function updateNoteGroupTitle(noteGroupId, payload) {
  return request(`/note-groups/${noteGroupId}/title`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function autoCreateNoteGroup(payload) {
  return request("/note-groups/auto", {
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

export function getTopic(topicId) {
  return request(`/topics/${topicId}`);
}

export function updateTopic(topicId, payload) {
  return request(`/topics/${topicId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteTopic(topicId) {
  return request(`/topics/${topicId}`, {
    method: "DELETE"
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

export function getJob(jobId) {
  return request(`/jobs/${jobId}`);
}

export function listJobs({ type, status, moduleId } = {}) {
  const params = new URLSearchParams();
  if (type) {
    params.set("type", type);
  }
  if (status) {
    params.set("status", status);
  }
  if (moduleId) {
    params.set("module_id", moduleId);
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request(`/jobs${suffix}`);
}

export function cancelJob(jobId) {
  return request(`/jobs/${jobId}/cancel`, {
    method: "POST"
  });
}

export function retryAutoJob(jobId) {
  return request(`/jobs/${jobId}/retry`, {
    method: "POST"
  });
}

export function listStudyCards(noteGroupId) {
  return request(`/note-groups/${noteGroupId}/study-cards`);
}

export function listTopicStudyCards(topicId) {
  return request(`/topics/${topicId}/study-cards`);
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

export function listTopicQuestionCards(topicId) {
  return request(`/topics/${topicId}/question-cards`);
}

export function getNoteGroupQuestionTimeline(noteGroupId, chipIds = []) {
  const params = new URLSearchParams();
  if (chipIds.length) {
    params.set("chip_ids", chipIds.join(","));
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request(`/note-groups/${noteGroupId}/question-cards/timeline${suffix}`);
}

export function getModuleQuestionTimeline(moduleId, chipIds = []) {
  const params = new URLSearchParams();
  if (chipIds.length) {
    params.set("chip_ids", chipIds.join(","));
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request(`/modules/${moduleId}/question-cards/timeline${suffix}`);
}

export function getTopicQuestionTimeline(topicId) {
  return request(`/topics/${topicId}/question-cards/timeline`);
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

export function listTopicReviewQuestionCards(topicId, mode, limit) {
  const params = new URLSearchParams({ mode });
  if (limit) {
    params.set("limit", String(limit));
  }
  return request(`/topics/${topicId}/question-cards/review?${params.toString()}`);
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

export function sendModuleIntentChat(payload) {
  return request("/modules/intent-chat", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function sendSubjectIntentChat(payload) {
  return request("/subjects/intent-chat", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateSubject(subjectId, payload) {
  return request(`/subjects/${subjectId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}
