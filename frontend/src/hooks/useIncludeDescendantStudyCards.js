import { useEffect, useState } from "react";

export function useIncludeDescendantStudyCards(selectedConceptId) {
  const [includeDescendantStudyCards, setIncludeDescendantStudyCards] = useState(true);

  useEffect(() => {
    setIncludeDescendantStudyCards(true);
  }, [selectedConceptId]);

  return {
    includeDescendantStudyCards,
    setIncludeDescendantStudyCards
  };
}
