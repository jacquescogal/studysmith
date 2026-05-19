import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SectionNav({ items }) {
  if (!items?.length) {
    return null;
  }

  return (
    <Card className="sticky top-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">On this page</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {items.map((item) => (
          <a key={item.id} href={`#${item.id}`} className="text-sm text-muted-foreground hover:text-foreground">
            {item.label}
          </a>
        ))}
      </CardContent>
    </Card>
  );
}
