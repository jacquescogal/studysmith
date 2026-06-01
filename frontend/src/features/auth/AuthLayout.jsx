import React from "react";
import { Check } from "lucide-react";

const roles = [
  { name: "Guest", requirement: "Not signed in" },
  { name: "Reader", requirement: "Signed in" },
  { name: "Creator", requirement: "Signed in + requested" }
];

const privileges = [
  {
    label: "Preview public Subjects",
    included: ["Guest", "Reader", "Creator"]
  },
  {
    label: "Review Question Cards and track stats",
    included: ["Reader", "Creator"]
  },
  {
    label: "Create Subjects, Modules, and Note Groups",
    included: ["Creator"]
  }
];

export function AuthLayout({ children, eyebrow = "StudySmith access", title, subtitle }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-12">
          <div className="w-full max-w-md">
            <div className="mb-8 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
              <h1 className="text-3xl font-semibold tracking-normal text-foreground">{title}</h1>
              {subtitle ? (
                <p className="text-sm leading-6 text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
            {children}
          </div>
        </section>

        <aside className="border-t border-blue-100 bg-[#eef6ff] px-6 py-10 text-[#153e6f] sm:px-10 lg:border-l lg:border-t-0 lg:px-12">
          <div className="mx-auto flex h-full max-w-2xl flex-col justify-center gap-8">
            <div className="space-y-4">
              <p className="text-sm font-medium text-[#4777a8]">StudySmith workspace</p>
              <h2 className="text-3xl font-semibold tracking-normal text-[#123a68]">
                Turn source material into a durable study system.
              </h2>
              <p className="text-sm leading-6 text-[#4d6f91]">
                Organize a Subject into focused Modules, capture each source session as a Note
                Group, then review the Study Cards and Question Cards that grow from that material.
              </p>
            </div>

            <div className="overflow-hidden rounded-md border border-blue-100 bg-white/85 shadow-sm shadow-blue-950/5">
              <div className="grid grid-cols-[minmax(8rem,1.25fr)_repeat(3,minmax(4.5rem,0.75fr))] border-b border-blue-100 bg-blue-50/80 text-sm font-semibold text-[#123a68]">
                <div aria-hidden="true" className="px-4 py-3" />
                {roles.map((role) => (
                  <div key={role.name} className="px-3 py-3 text-center">
                    <div>{role.name}</div>
                    <div className="mt-1 text-xs font-medium text-[#5d81a5]">
                      {role.requirement}
                    </div>
                  </div>
                ))}
              </div>
              {privileges.map((privilege) => (
                <div
                  key={privilege.label}
                  className="grid grid-cols-[minmax(8rem,1.25fr)_repeat(3,minmax(4.5rem,0.75fr))] border-b border-blue-50 text-sm last:border-b-0"
                >
                  <div className="px-4 py-3 font-medium leading-5 text-[#315e89]">
                    {privilege.label}
                  </div>
                  {roles.map((role) => (
                    <div key={role.name} className="flex items-center justify-center px-3 py-3">
                      {privilege.included.includes(role.name) ? (
                        <Check aria-label={`${role.name} includes ${privilege.label}`} className="h-4 w-4 text-[#256da8]" />
                      ) : (
                        <span aria-hidden="true" className="h-4 w-4" />
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
