import { useConceptPageModel } from "@/features/concepts/useConceptPageModel";
import { useModulePageModel } from "@/features/modules/useModulePageModel";
import { useNoteGroupPageModel } from "@/features/note-groups/useNoteGroupPageModel";

function useRoutePageModels() {
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

export function SubjectIndexPage(props) {
  return <AppShellRoutePage {...props} />;
}

export function SubjectModulesPage(props) {
  return <AppShellRoutePage {...props} />;
}

export function ModuleOverviewPage(props) {
  return <AppShellRoutePage {...props} />;
}

export function ModuleMindMapPage(props) {
  return <AppShellRoutePage {...props} />;
}

export function NoteGroupCreatePage(props) {
  return <AppShellRoutePage {...props} />;
}

export function NoteGroupOverviewPage(props) {
  return <AppShellRoutePage {...props} />;
}

export function NoteGroupMindMapPage(props) {
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

export function ConceptOverviewPage(props) {
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
