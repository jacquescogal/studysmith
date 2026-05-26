export function moduleRouteSidebarScope(navigationState) {
  return navigationState?.sidebarScope === "topics" || navigationState?.sidebarScope === "concepts"
    ? "concepts"
    : "note-groups";
}
