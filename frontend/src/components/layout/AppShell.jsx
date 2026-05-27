import { cn } from "@/lib/utils";

export function AppShell({ sidebar, header, sectionNav, children, hasSidebar }) {
  return (
    <div
      className={cn(
        "min-h-svh bg-background text-foreground",
        hasSidebar && "lg:grid lg:grid-cols-[20rem_minmax(0,1fr)]"
      )}
    >
      {hasSidebar ? (
        <aside className="border-r bg-white lg:sticky lg:top-0 lg:h-svh lg:overflow-y-auto">
          {sidebar}
        </aside>
      ) : null}
      <div className="min-w-0">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
          {header}
          <div className={cn("grid gap-6", sectionNav && "xl:grid-cols-[minmax(0,1fr)_14rem]")}>
            {sectionNav ? <div className="xl:hidden">{sectionNav}</div> : null}
            <main className="min-w-0">{children}</main>
            {sectionNav ? <div className="hidden xl:block">{sectionNav}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
