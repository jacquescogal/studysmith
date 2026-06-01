import React from "react";
import { Check } from "lucide-react";

import { getPasswordPolicyStatus } from "./passwordPolicy";

export function PasswordPolicyChecklist({ password }) {
  const status = getPasswordPolicyStatus(password);
  const requiredItems = status.filter((item) => item.group === "required");
  const categoryItems = status.filter((item) => item.group === "category");

  return (
    <div className="rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-muted-foreground">
      <p className="font-medium text-[#315e89]">Password requirements</p>
      <p className="mt-2 font-medium text-[#55718f]">Required</p>
      <ul className="mt-1 grid gap-1">
        {requiredItems.map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                item.met
                  ? "border-[#2f69aa] bg-[#2f69aa] text-white"
                  : "border-blue-200 bg-white"
              }`}
            >
              {item.met ? <Check className="h-3 w-3" /> : null}
            </span>
            <span className={item.met ? "text-[#315e89]" : undefined}>{item.label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 font-medium text-[#55718f]">Choose any 3 of 4</p>
      <ul className="mt-1 grid gap-1 sm:grid-cols-2">
        {categoryItems.map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                item.met
                  ? "border-[#2f69aa] bg-[#2f69aa] text-white"
                  : "border-blue-200 bg-white"
              }`}
            >
              {item.met ? <Check className="h-3 w-3" /> : null}
            </span>
            <span className={item.met ? "text-[#315e89]" : undefined}>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
