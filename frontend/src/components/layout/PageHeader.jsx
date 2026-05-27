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
  const headerClassName = ["study-page-header", tone ? `page-header-tone-${tone}` : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={headerClassName}>
      <div className="page-header-frame">
        <div className="page-header-content">
          <p className="page-header-eyebrow text-xs font-medium uppercase tracking-wide text-muted-foreground">{eyebrow}</p>
          <nav className="page-header-breadcrumbs text-sm text-muted-foreground">
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
          <div className="page-header-title-block">
            <div className="page-header-meta-row">
              {pageType ? <span className="page-header-type-badge">{pageType}</span> : null}
              {current?.badge ? <Badge variant="secondary">{current.badge}</Badge> : null}
            </div>
            <h1 className="page-header-title text-2xl font-semibold tracking-normal text-foreground">{title}</h1>
          </div>
          {description ? <p className="page-header-description text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="page-header-actions">{actions}</div> : null}
      </div>
    </header>
  );
}
