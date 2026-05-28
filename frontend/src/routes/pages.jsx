import { useConceptPageModel } from "@/features/concepts/useConceptPageModel";
import { useModulePageModel } from "@/features/modules/useModulePageModel";
import { useNoteGroupPageModel } from "@/features/note-groups/useNoteGroupPageModel";

export function useRoutePageModels() {
  return {
    modulePageModel: useModulePageModel(),
    noteGroupPageModel: useNoteGroupPageModel(),
    conceptPageModel: useConceptPageModel()
  };
}

function AppShellRoutePage({ renderAppShell }) {
  const routePageModels = useRoutePageModels();
  return renderAppShell({ routePageModels });
}

export function ModuleWorkspacePage(props) {
  return <AppShellRoutePage {...props} />;
}

export function SubjectIndexPage(props) {
  return <AppShellRoutePage {...props} />;
}

export function SubjectModulesPage(props) {
  return <AppShellRoutePage {...props} />;
}

export function ModuleMindMapPage(props) {
  return <AppShellRoutePage {...props} />;
}

export function ModuleCardsPage(props) {
  return <AppShellRoutePage {...props} />;
}

export function ModuleStudyPage(props) {
  return <AppShellRoutePage {...props} />;
}

export function NoteGroupCreatePage(props) {
  return <AppShellRoutePage {...props} />;
}

export function NoteGroupMindMapPage(props) {
  return <AppShellRoutePage {...props} />;
}

export function NoteGroupStudyPage(props) {
  return <AppShellRoutePage {...props} />;
}

export function NoteGroupCardsPage(props) {
  return <AppShellRoutePage {...props} />;
}

export function NoteGroupStudyCardsPage(props) {
  return <AppShellRoutePage {...props} />;
}

export function NoteGroupQuestionCardsPage(props) {
  return <AppShellRoutePage {...props} />;
}

export function ConceptMindMapPage(props) {
  return <AppShellRoutePage {...props} />;
}

export function ConceptCardsPage(props) {
  return <AppShellRoutePage {...props} />;
}

export function ConceptStudyCardsPage(props) {
  return <AppShellRoutePage {...props} />;
}

export function ConceptQuestionCardsPage(props) {
  return <AppShellRoutePage {...props} />;
}
