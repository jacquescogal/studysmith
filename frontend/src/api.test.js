import { afterEach, describe, expect, test, vi } from "vitest";

import {
  clearAccessTokenProvider,
  createSubject,
  listPublicSubjects,
  listSubjects,
  setAccessTokenProvider
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
