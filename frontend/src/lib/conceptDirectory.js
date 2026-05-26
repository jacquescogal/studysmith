const conceptId = (concept) => concept?.value || concept?.id || "";

const parentConceptId = (concept) =>
  concept?.parentConceptId ||
  concept?.parent_concept_id ||
  concept?.parentTopicId ||
  concept?.parent_topic_id ||
  "";

const directoryConcept = (concept, overrides = {}) => ({
  ...concept,
  value: conceptId(concept),
  parentConceptId: parentConceptId(concept),
  ...overrides
});

export function buildConceptDirectoryRows(concepts, currentConceptId = "") {
  const conceptList = Array.isArray(concepts) ? concepts.map((concept) => directoryConcept(concept)) : [];
  const conceptById = new Map(conceptList.map((concept) => [concept.value, concept]));
  const currentConcept = currentConceptId ? conceptById.get(currentConceptId) : null;
  const parentId = parentConceptId(currentConcept);

  if (!currentConcept) {
    return conceptList
      .filter((concept) => !parentConceptId(concept))
      .map((concept) => directoryConcept(concept, { directoryRole: "concept", directoryDepth: 0 }));
  }

  const children = conceptList
    .filter((concept) => parentConceptId(concept) === currentConceptId)
    .map((concept) => directoryConcept(concept, { directoryRole: "concept", directoryDepth: 1 }));

  return [
    {
      value: parentId,
      label: "..",
      description: parentId ? "Back to parent concept" : "Back to root concepts",
      directoryRole: "up",
      directoryDepth: 0
    },
    directoryConcept(currentConcept, {
      directoryRole: "current",
      directoryDepth: 0
    }),
    ...children
  ];
}
