import { ModuleIndex } from "./ModuleIndex";

export function ModuleIndexPage({
  modules,
  dueCounts,
  subjectDescription,
  error,
  canManageSelectedSubject,
  canUseProtectedActions,
  onOpenWizard,
  onBack,
  onSelectModule,
  onDeleteModule
}) {
  return (
    <ModuleIndex
      modules={modules}
      dueCounts={dueCounts}
      subjectDescription={subjectDescription}
      error={error}
      canCreate={canManageSelectedSubject}
      showCreate={canUseProtectedActions}
      canEdit={canManageSelectedSubject}
      showEditControls={canUseProtectedActions}
      onOpenWizard={onOpenWizard}
      onBack={onBack}
      onSelect={(module) =>
        onSelectModule({
          value: module.id,
          label: module.title
        })
      }
      onDelete={onDeleteModule}
    />
  );
}
