export const subjectPath = (subjectCode) => `/app/subject/${subjectCode}`;

export const modulePath = (subjectCode, moduleCode) =>
  `/app/subject/${subjectCode}/module/${moduleCode}`;

export const createNoteGroupPath = (subjectCode, moduleCode) =>
  `/app/subject/${subjectCode}/module/${moduleCode}/create-note-group`;

export const noteGroupPath = (subjectCode, moduleCode, noteGroupCode, panel = "overview") => {
  const basePath = `/app/subject/${subjectCode}/module/${moduleCode}/note-groups/${noteGroupCode}`;
  return panel && panel !== "overview" ? `${basePath}/${panel}` : basePath;
};

export const topicPath = (subjectCode, moduleCode, topicCode, panel = "overview") => {
  const basePath = `/app/subject/${subjectCode}/module/${moduleCode}/topics/${topicCode}`;
  return panel && panel !== "overview" ? `${basePath}/${panel}` : basePath;
};

export function matchAppRoute(pathname) {
  const subjectPage = pathname.match(/^\/app\/subject\/([a-zA-Z0-9_-]+)$/);
  const modulePage = pathname.match(
    /^\/app\/subject\/([a-zA-Z0-9_-]+)\/module\/([a-zA-Z0-9_-]+)$/
  );
  const createNoteGroup = pathname.match(
    /^\/app\/subject\/([a-zA-Z0-9_-]+)\/module\/([a-zA-Z0-9_-]+)\/create-note-group$/
  );
  const noteGroup = pathname.match(
    /^\/app\/subject\/([a-zA-Z0-9_-]+)\/module\/([a-zA-Z0-9_-]+)\/note-groups\/([a-zA-Z0-9_-]+)(?:\/(overview|view-cards|study-cards|question-cards))?$/
  );
  const topic = pathname.match(
    /^\/app\/subject\/([a-zA-Z0-9_-]+)\/module\/([a-zA-Z0-9_-]+)\/topics\/([a-zA-Z0-9_-]+)(?:\/(overview|view-cards|study-cards|question-cards))?$/
  );

  return {
    subjectPage,
    modulePage,
    createNoteGroup,
    noteGroup,
    topic,
    subjectCode:
      subjectPage?.[1] ||
      modulePage?.[1] ||
      createNoteGroup?.[1] ||
      noteGroup?.[1] ||
      topic?.[1] ||
      "",
    moduleCode: modulePage?.[2] || createNoteGroup?.[2] || noteGroup?.[2] || topic?.[2] || "",
    noteGroupCode: noteGroup?.[3] || "",
    topicCode: topic?.[3] || "",
    panel: noteGroup?.[4] || topic?.[4] || "",
    isCreateNoteGroup: Boolean(createNoteGroup)
  };
}
