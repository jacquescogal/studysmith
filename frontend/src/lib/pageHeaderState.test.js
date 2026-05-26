import { describe, expect, test } from "vitest";

import { getStudyPageHeader } from "./pageHeaderState";

describe("getStudyPageHeader", () => {
  test("uses actual page titles without generic descriptions from module pages down", () => {
    expect(
      getStudyPageHeader({
        selectedModule: { title: "Cloud Computing" }
      })
    ).toEqual({
      title: "Cloud Computing",
      description: "",
      pageType: "Module",
      tone: "module"
    });

    expect(
      getStudyPageHeader({
        selectedModule: { title: "Cloud Computing" },
        selectedNoteGroup: { title: "AWS Pricing" }
      })
    ).toEqual({
      title: "AWS Pricing",
      description: "",
      pageType: "Note Group",
      tone: "note-group"
    });

    expect(
      getStudyPageHeader({
        selectedModule: { title: "Cloud Computing" },
        selectedConcept: { label: "Elasticity" }
      })
    ).toEqual({
      title: "Elasticity",
      description: "",
      pageType: "Concept",
      tone: "concept"
    });
  });

  test("keeps concise helper descriptions for subject selection and creation", () => {
    expect(getStudyPageHeader({})).toEqual({
      title: "Subjects",
      description: "Choose a subject to get started.",
      pageType: "Subjects",
      tone: "default"
    });

    expect(getStudyPageHeader({ selectedSubject: { title: "AWS" } })).toEqual({
      title: "AWS",
      description: "Pick a module to get started.",
      pageType: "Subject",
      tone: "subject"
    });

    expect(getStudyPageHeader({ noteGroupMode: "auto" })).toEqual({
      title: "Create Note Group",
      description: "Paste raw text and we will create a Note Group and questions in the background.",
      pageType: "Note Group generation",
      tone: "note-group"
    });
  });
});
