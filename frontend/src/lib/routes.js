export const subjectPath = (subjectCode) => `/app/subject/${subjectCode}`;

export const modulePath = (subjectCode, moduleCode) =>
  `/app/subject/${subjectCode}/module/${moduleCode}`;

export const moduleMindMapPath = (subjectCode, moduleCode) =>
  `/app/subject/${subjectCode}/module/${moduleCode}/mind-map`;

export const createNoteGroupPath = (subjectCode, moduleCode) =>
  `/app/subject/${subjectCode}/module/${moduleCode}/create-note-group`;

export const noteGroupPath = (subjectCode, moduleCode, noteGroupCode, panel = "overview") => {
  const basePath = `/app/subject/${subjectCode}/module/${moduleCode}/note-groups/${noteGroupCode}`;
  return panel && panel !== "overview" ? `${basePath}/${panel}` : basePath;
};

export const noteGroupMindMapPath = (subjectCode, moduleCode, noteGroupCode) =>
  noteGroupPath(subjectCode, moduleCode, noteGroupCode, "mind-map");

export const topicPath = (subjectCode, moduleCode, topicCode, panel = "overview") => {
  const basePath = `/app/subject/${subjectCode}/module/${moduleCode}/topics/${topicCode}`;
  return panel && panel !== "overview" ? `${basePath}/${panel}` : basePath;
};

export function matchAppRoute(pathname) {
  const subjectPage = pathname.match(/^\/app\/subject\/([a-zA-Z0-9_-]+)$/);
  const modulePage = pathname.match(
    /^\/app\/subject\/([a-zA-Z0-9_-]+)\/module\/([a-zA-Z0-9_-]+)$/
  );
  const moduleMindMap = pathname.match(
    /^\/app\/subject\/([a-zA-Z0-9_-]+)\/module\/([a-zA-Z0-9_-]+)\/mind-map$/
  );
  const createNoteGroup = pathname.match(
    /^\/app\/subject\/([a-zA-Z0-9_-]+)\/module\/([a-zA-Z0-9_-]+)\/create-note-group$/
  );
  const noteGroup = pathname.match(
    /^\/app\/subject\/([a-zA-Z0-9_-]+)\/module\/([a-zA-Z0-9_-]+)\/note-groups\/([a-zA-Z0-9_-]+)(?:\/(overview|view-cards|study-cards|question-cards|mind-map))?$/
  );
  const topic = pathname.match(
    /^\/app\/subject\/([a-zA-Z0-9_-]+)\/module\/([a-zA-Z0-9_-]+)\/topics\/([a-zA-Z0-9_-]+)(?:\/(overview|view-cards|study-cards|question-cards))?$/
  );
  const noteGroupMindMap = noteGroup?.[4] === "mind-map" ? noteGroup : null;

  return {
    subjectPage,
    modulePage,
    moduleMindMap,
    createNoteGroup,
    noteGroup,
    noteGroupMindMap,
    topic,
    subjectCode:
      subjectPage?.[1] ||
      modulePage?.[1] ||
      moduleMindMap?.[1] ||
      createNoteGroup?.[1] ||
      noteGroup?.[1] ||
      topic?.[1] ||
      "",
    moduleCode:
      modulePage?.[2] ||
      moduleMindMap?.[2] ||
      createNoteGroup?.[2] ||
      noteGroup?.[2] ||
      topic?.[2] ||
      "",
    noteGroupCode: noteGroup?.[3] || "",
    topicCode: topic?.[3] || "",
    panel: moduleMindMap ? "mind-map" : noteGroup?.[4] || topic?.[4] || "",
    isCreateNoteGroup: Boolean(createNoteGroup)
  };
}
