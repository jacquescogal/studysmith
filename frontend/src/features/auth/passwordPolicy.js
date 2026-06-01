export const passwordPolicyMessage =
  "Use at least 10 characters and include at least 3 of: uppercase letter, lowercase letter, number, symbol.";

export function getPasswordPolicyStatus(password) {
  const value = String(password || "");
  return [
    { group: "required", label: "At least 10 characters", met: value.length >= 10 },
    { group: "category", label: "Uppercase letter", met: /[A-Z]/.test(value) },
    { group: "category", label: "Lowercase letter", met: /[a-z]/.test(value) },
    { group: "category", label: "Number", met: /\d/.test(value) },
    { group: "category", label: "Symbol", met: /[^\sA-Za-z0-9]/.test(value) }
  ];
}

export function validatePassword(password) {
  const status = getPasswordPolicyStatus(password);
  const categoryCount = status.slice(1).filter((item) => item.met).length;
  return {
    isValid: status[0].met && categoryCount >= 3,
    message: passwordPolicyMessage,
    status
  };
}
