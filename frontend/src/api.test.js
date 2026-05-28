import { afterEach, describe, expect, test, vi } from "vitest";

import {
  clearAccessTokenProvider,
  approvePublicSubject,
  createSubject,
  deleteSubjectAccess,
  generateNoteGroupMindMap,
  getCurrentUser,
  getConceptQuestionTimeline,
  getModuleMindMap,
  getNoteGroupMindMap,
  keepSubjectPrivate,
  listAdminUsers,
  listConceptQuestionCards,
  listConceptReviewQuestionCards,
  listConceptStudyCards,
  listPublicSubjects,
  listPublicSubjectRequests,
  listSubjectAccess,
  listSubjectActivity,
  listSubjectSharingUsers,
  listSubjects,
  requestSubjectPublic,
  requestCreatorRole,
  setAccessTokenProvider,
  updateAdminUserRole,
  upsertSubjectAccess
} from "./api";

const jsonResponse = (payload) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });

afterEach(() => {
  clearAccessTokenProvider();
  vi.restoreAllMocks();
});

describe("admin and access API calls", () => {
  test("getCurrentUser calls profile endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ id: "user-1" }));

    await getCurrentUser();

    expect(fetchMock).toHaveBeenCalledWith("/me", expect.any(Object));
  });

  test("requestCreatorRole posts current user request endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ id: "user-1" }));

    await requestCreatorRole();

    expect(fetchMock).toHaveBeenCalledWith(
      "/me/creator-role-request",
      expect.objectContaining({ method: "POST" })
    );
  });

  test("listAdminUsers calls admin users endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([]));

    await listAdminUsers();

    expect(fetchMock).toHaveBeenCalledWith("/admin/users", expect.any(Object));
  });

  test("updateAdminUserRole sends app role payload", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ id: "user-1" }));

    await updateAdminUserRole("user-1", "creator");

    expect(fetchMock).toHaveBeenCalledWith(
      "/admin/users/user-1/role",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ app_role: "creator" })
      })
    );
  });

  test("public request helpers call admin approval endpoints", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(jsonResponse([])));

    await listPublicSubjectRequests();
    await approvePublicSubject("subject-1");
    await keepSubjectPrivate("subject-1");

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/admin/subjects/public-requests", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/admin/subjects/subject-1/approve-public",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/admin/subjects/subject-1/keep-private",
      expect.objectContaining({ method: "POST" })
    );
  });

  test("subject access helpers call access endpoints", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(jsonResponse([])));

    await listSubjectAccess("subject-1");
    await listSubjectSharingUsers("subject-1");
    await listSubjectActivity("subject-1");
    await requestSubjectPublic("subject-1");
    await upsertSubjectAccess("subject-1", "user-1", "maintainer");
    await deleteSubjectAccess("subject-1", "user-1");

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/subjects/subject-1/access", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/subjects/subject-1/sharing-users",
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/subjects/subject-1/activity",
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/subjects/subject-1/request-public",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "/subjects/subject-1/access/user-1",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ access_level: "maintainer" })
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "/subjects/subject-1/access/user-1",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

describe("mind map API calls", () => {
  test("mind map helpers call module and note group endpoints", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => Promise.resolve(jsonResponse({})));

    await getModuleMindMap("module-1");
    await getNoteGroupMindMap("note-1");
    await generateNoteGroupMindMap("note-1");

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/modules/module-1/mind-map", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/note-groups/note-1/mind-map", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/note-groups/note-1/mind-map/generate",
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("Concept API calls", () => {
  test("Concept card helpers can exclude descendant Concept data", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() =>
        Promise.resolve(jsonResponse({ study_cards: [], question_cards: [] }))
      );

    await listConceptStudyCards("concept-1", { includeDescendants: false });
    await listConceptQuestionCards("concept-1", { includeDescendants: false });
    await getConceptQuestionTimeline("concept-1", { includeDescendants: false });
    await listConceptReviewQuestionCards("concept-1", "due", 10, {
      includeDescendants: false
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/concepts/concept-1/study-cards?include_descendants=false",
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/concepts/concept-1/question-cards?include_descendants=false",
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/concepts/concept-1/question-cards/timeline?include_descendants=false",
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/concepts/concept-1/question-cards/review?mode=due&limit=10&include_descendants=false",
      expect.any(Object)
    );
  });
});

describe("API auth headers", () => {
  test("listPublicSubjects calls public endpoint without authorization", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse([{ id: "public-subject", title: "Public" }]));

    await listPublicSubjects();

    expect(fetchMock).toHaveBeenCalledWith(
      "/public/subjects",
      expect.objectContaining({
        headers: expect.not.objectContaining({
          Authorization: expect.any(String)
        })
      })
    );
  });

  test("listSubjects sends bearer token when provider returns a token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([]));
    setAccessTokenProvider(() => "test-token");

    await listSubjects();

    expect(fetchMock).toHaveBeenCalledWith(
      "/subjects",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token"
        })
      })
    );
  });

  test("createSubject sends bearer token and JSON body", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ id: "subject-1", title: "Algorithms" }));
    setAccessTokenProvider(async () => "test-token");

    await createSubject({ title: "Algorithms", goal: "Interview prep", scope: "DSA" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/subjects",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "Algorithms",
          goal: "Interview prep",
          scope: "DSA"
        }),
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-token"
        })
      })
    );
  });

  test("omits authorization when provider returns no token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([]));
    setAccessTokenProvider(() => "");

    await listSubjects();

    expect(fetchMock).toHaveBeenCalledWith(
      "/subjects",
      expect.objectContaining({
        headers: expect.not.objectContaining({
          Authorization: expect.any(String)
        })
      })
    );
  });
});
