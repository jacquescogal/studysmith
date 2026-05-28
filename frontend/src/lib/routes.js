export const subjectPath = (subjectCode) => `/app/subject/${subjectCode}`;

export const modulePath = (subjectCode, moduleCode) =>
  `/app/subject/${subjectCode}/module/${moduleCode}`;

export const moduleMindMapPath = (subjectCode, moduleCode) =>
  `/app/subject/${subjectCode}/module/${moduleCode}/mind-map`;

export const moduleViewCardsPath = (subjectCode, moduleCode) =>
  `/app/subject/${subjectCode}/module/${moduleCode}/view-cards`;

export const moduleStudyPath = (subjectCode, moduleCode) =>
  `/app/subject/${subjectCode}/module/${moduleCode}/study`;

export const createNoteGroupPath = (subjectCode, moduleCode) =>
  `/app/subject/${subjectCode}/module/${moduleCode}/create-note-group`;

export const noteGroupPath = (subjectCode, moduleCode, noteGroupCode, panel = "mind-map") => {
  const basePath = `/app/subject/${subjectCode}/module/${moduleCode}/note-groups/${noteGroupCode}`;
  const normalizedPanel = panel === "overview" ? "mind-map" : panel;
  return normalizedPanel ? `${basePath}/${normalizedPanel}` : basePath;
};

export const noteGroupMindMapPath = (subjectCode, moduleCode, noteGroupCode) =>
  noteGroupPath(subjectCode, moduleCode, noteGroupCode, "mind-map");

export const conceptPath = (subjectCode, moduleCode, conceptCode, panel = "mind-map") => {
  const basePath = `/app/subject/${subjectCode}/module/${moduleCode}/concepts/${conceptCode}`;
  const normalizedPanel = panel === "overview" ? "mind-map" : panel;
  return normalizedPanel ? `${basePath}/${normalizedPanel}` : basePath;
};

export const topicPath = (subjectCode, moduleCode, topicCode, panel = "overview") =>
  conceptPath(subjectCode, moduleCode, topicCode, panel);

const normalizePanel = (panel = "") => (!panel || panel === "overview" ? "mind-map" : panel);

export function matchAppRoute(pathname) {
  const subjectPage = pathname.match(/^\/app\/subject\/([a-zA-Z0-9_-]+)$/);
  const modulePage = pathname.match(
    /^\/app\/subject\/([a-zA-Z0-9_-]+)\/module\/([a-zA-Z0-9_-]+)$/
  );
  const moduleMindMap = pathname.match(
    /^\/app\/subject\/([a-zA-Z0-9_-]+)\/module\/([a-zA-Z0-9_-]+)\/mind-map$/
  );
  const moduleViewCards = pathname.match(
    /^\/app\/subject\/([a-zA-Z0-9_-]+)\/module\/([a-zA-Z0-9_-]+)\/view-cards$/
  );
  const moduleStudy = pathname.match(
    /^\/app\/subject\/([a-zA-Z0-9_-]+)\/module\/([a-zA-Z0-9_-]+)\/study$/
  );
  const createNoteGroup = pathname.match(
    /^\/app\/subject\/([a-zA-Z0-9_-]+)\/module\/([a-zA-Z0-9_-]+)\/create-note-group$/
  );
  const noteGroup = pathname.match(
    /^\/app\/subject\/([a-zA-Z0-9_-]+)\/module\/([a-zA-Z0-9_-]+)\/note-groups\/([a-zA-Z0-9_-]+)(?:\/(overview|view-cards|study|study-cards|question-cards|mind-map))?$/
  );
  const concept = pathname.match(
    /^\/app\/subject\/([a-zA-Z0-9_-]+)\/module\/([a-zA-Z0-9_-]+)\/concepts\/([a-zA-Z0-9_-]+)(?:\/(overview|mind-map|view-cards|study|study-cards|question-cards))?$/
  );
  const topic = concept || pathname.match(
    /^\/app\/subject\/([a-zA-Z0-9_-]+)\/module\/([a-zA-Z0-9_-]+)\/topics\/([a-zA-Z0-9_-]+)(?:\/(overview|mind-map|view-cards|study|study-cards|question-cards))?$/
  );
  const noteGroupMindMap = noteGroup?.[4] === "mind-map" ? noteGroup : null;
  const matchedScopeRoute = modulePage || moduleStudy || noteGroup || topic;
  const matchedScopePanel = moduleStudy ? "study" : noteGroup?.[4] || topic?.[4] || (modulePage ? "mind-map" : "");

  return {
    subjectPage,
    modulePage,
    moduleMindMap,
    moduleViewCards,
    moduleStudy,
    createNoteGroup,
    noteGroup,
    noteGroupMindMap,
    concept,
    topic,
    subjectCode:
      subjectPage?.[1] ||
      modulePage?.[1] ||
      moduleMindMap?.[1] ||
      moduleViewCards?.[1] ||
      moduleStudy?.[1] ||
      createNoteGroup?.[1] ||
      noteGroup?.[1] ||
      topic?.[1] ||
      "",
    moduleCode:
      modulePage?.[2] ||
      moduleMindMap?.[2] ||
      moduleViewCards?.[2] ||
      moduleStudy?.[2] ||
      createNoteGroup?.[2] ||
      noteGroup?.[2] ||
      topic?.[2] ||
      "",
    noteGroupCode: noteGroup?.[3] || "",
    conceptCode: concept?.[3] || topic?.[3] || "",
    topicCode: concept?.[3] || topic?.[3] || "",
    panel: moduleMindMap
      ? "mind-map"
      : moduleViewCards
        ? "view-cards"
        : moduleStudy
          ? "study"
          : matchedScopeRoute
            ? normalizePanel(matchedScopePanel)
            : "",
    isCreateNoteGroup: Boolean(createNoteGroup)
  };
}
