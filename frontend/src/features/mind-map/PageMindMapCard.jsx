export function PageMindMapCard({ id, children }) {
  if (!children) {
    return null;
  }

  return (
    <section id={id} className="page-mind-map-card">
      {children}
    </section>
  );
}
