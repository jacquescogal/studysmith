import { describe, expect, test } from "vitest";

import { getPasswordPolicyStatus, validatePassword } from "./passwordPolicy";

describe("passwordPolicy", () => {
  test("accepts at least 10 characters with any 3 character categories", () => {
    expect(validatePassword("Longlower1").isValid).toBe(true);
    expect(validatePassword("LONGUPPER1!").isValid).toBe(true);
    expect(validatePassword("Lowercase!").isValid).toBe(true);
  });

  test("rejects passwords that are short or have fewer than 3 categories", () => {
    expect(validatePassword("Short1!").isValid).toBe(false);
    expect(validatePassword("longlowercase").isValid).toBe(false);
    expect(validatePassword("1234567890").isValid).toBe(false);
  });

  test("reports policy checklist status", () => {
    const status = getPasswordPolicyStatus("Longlower1");

    expect(status).toEqual([
      { group: "required", label: "At least 10 characters", met: true },
      { group: "category", label: "Uppercase letter", met: true },
      { group: "category", label: "Lowercase letter", met: true },
      { group: "category", label: "Number", met: true },
      { group: "category", label: "Symbol", met: false }
    ]);
  });
});
