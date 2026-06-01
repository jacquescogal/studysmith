import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { StudyAppAuthActions } from "./StudyAppAuthActions";

function renderAuthActions(overrides = {}) {
  return renderToStaticMarkup(
    <StudyAppAuthActions
      auth={{
        error: "",
        isAuthenticated: false,
        isConfigured: true,
        loading: false,
        user: null
      }}
      authMessage=""
      authSubmitting={false}
      authUiError=""
      canManageSelectedSubject={false}
      canUseProtectedActions={false}
      currentUserError=""
      currentUserProfile={null}
      creatorRoleRequesting={false}
      handleRequestCreatorRole={vi.fn()}
      handleSignOut={vi.fn()}
      isAdmin={false}
      isAdminPanelOpen={false}
      isSubjectManagementOpen={false}
      setIsAdminPanelOpen={vi.fn()}
      setIsSubjectManagementOpen={vi.fn()}
      {...overrides}
    />
  );
}

describe("StudyAppAuthActions", () => {
  test("shows a sign in link without inline email login fields for guests", () => {
    const html = renderAuthActions();

    expect(html).toContain('href="/"');
    expect(html).toContain("Sign in");
    expect(html).not.toContain('type="email"');
    expect(html).not.toContain("placeholder=\"Email\"");
  });

  test("shows username identity and an obvious creator role request for readers", () => {
    const html = renderAuthActions({
      auth: {
        error: "",
        isAuthenticated: true,
        isConfigured: true,
        loading: false,
        user: { email: "reader@example.com" }
      },
      currentUserProfile: {
        app_role: "reader",
        creator_role_requested_at: null,
        username: "reader_one"
      },
      canUseProtectedActions: true
    });

    expect(html).toContain("reader_one");
    expect(html).not.toContain("reader@example.com");
    expect(html).toContain("Request creator role");
    expect(html).toContain("data-variant=\"default\"");
  });

  test("shows pending creator role request state for readers", () => {
    const html = renderAuthActions({
      auth: {
        error: "",
        isAuthenticated: true,
        isConfigured: true,
        loading: false,
        user: { email: "reader@example.com" }
      },
      currentUserProfile: {
        app_role: "reader",
        creator_role_requested_at: "2026-06-01T00:00:00Z",
        username: ""
      },
      canUseProtectedActions: true
    });

    expect(html).toContain("reader@example.com");
    expect(html).toContain("Creator role request pending.");
    expect(html).not.toContain("Request creator role");
  });

  test("does not show protected creator role action before profile gate is satisfied", () => {
    const html = renderAuthActions({
      auth: {
        error: "",
        isAuthenticated: true,
        isConfigured: true,
        loading: false,
        user: { email: "reader@example.com" }
      },
      canUseProtectedActions: false,
      currentUserProfile: {
        app_role: "reader",
        creator_role_requested_at: null,
        username: "reader_one"
      }
    });

    expect(html).not.toContain("Request creator role");
  });
});
