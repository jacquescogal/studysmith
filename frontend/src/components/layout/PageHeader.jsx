import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function PageHeader({
  eyebrow = "Study System",
  title,
  description,
  pageType,
  tone = "default",
  breadcrumbs = [],
  actions
}) {
  const current = breadcrumbs.find((item) => item.current);
  const headerClassName = ["study-page-header", tone ? `page-header-tone-${tone}` : "", "flex flex-col gap-4 border-b pb-5"]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={headerClassName}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{eyebrow}</p>
          <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            {breadcrumbs.map((item, index) => (
              <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1">
                {index > 0 ? <ChevronRight className="size-3" /> : null}
                {item.onClick ? (
                  <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={item.onClick}>
                    {item.label}
                  </Button>
                ) : (
                  <span className={item.current ? "font-medium text-foreground" : ""}>{item.label}</span>
                )}
              </span>
            ))}
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            {pageType ? <span className="page-header-type-badge">{pageType}</span> : null}
            <h1 className="text-2xl font-semibold tracking-normal text-foreground">{title}</h1>
            {current?.badge ? <Badge variant="secondary">{current.badge}</Badge> : null}
          </div>
          {description ? <p className="max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
