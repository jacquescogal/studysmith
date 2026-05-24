import { describe, expect, test } from "vitest";

import {
  reconcileSubjectAccessAfterGrant,
  reconcileSubjectAfterAccessGrant
} from "./SubjectManagementPanel";

describe("SubjectManagementPanel state reconciliation", () => {
  test("owner transfer demotes previous owner grant immediately", () => {
    const grants = [
      {
        id: "owner-grant",
        subject_id: "subject-1",
        user_id: "owner",
        access_level: "owner"
      },
      {
        id: "next-owner-grant",
        subject_id: "subject-1",
        user_id: "next-owner",
        access_level: "reader"
      }
    ];

    const updated = reconcileSubjectAccessAfterGrant(grants, {
      id: "next-owner-grant",
      subject_id: "subject-1",
      user_id: "next-owner",
      access_level: "owner"
    });

    expect(updated).toEqual([
      {
        id: "owner-grant",
        subject_id: "subject-1",
        user_id: "owner",
        access_level: "maintainer"
      },
      {
        id: "next-owner-grant",
        subject_id: "subject-1",
        user_id: "next-owner",
        access_level: "owner"
      }
    ]);
  });

  test("owner transfer updates current user access metadata", () => {
    const subject = {
      id: "subject-1",
      owner_user_id: "owner",
      current_user_access_level: "owner"
    };

    const updated = reconcileSubjectAfterAccessGrant(
      subject,
      { user_id: "next-owner", access_level: "owner" },
      { id: "owner" },
      false
    );

    expect(updated).toEqual({
      id: "subject-1",
      owner_user_id: "next-owner",
      current_user_access_level: "maintainer"
    });
  });
});
