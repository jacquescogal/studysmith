import { SubjectIndex } from "./SubjectIndex";

export function SubjectIndexPage({
  subjects,
  error,
  canCreateSubjects,
  canUseProtectedActions,
  canMaintainSubject,
  canDeleteSubject,
  onOpenWizard,
  onSelectSubject,
  onEditSubject,
  onDeleteSubject
}) {
  return (
    <SubjectIndex
      subjects={subjects}
      error={error}
      canCreate={canCreateSubjects}
      showCreate={canUseProtectedActions}
      showEditControls={canUseProtectedActions}
      canEditSubject={canMaintainSubject}
      canDeleteSubject={canDeleteSubject}
      onOpenWizard={onOpenWizard}
      onSelect={(subject) =>
        onSelectSubject({
          value: subject.id,
          label: subject.title
        })
      }
      onEdit={onEditSubject}
      onDelete={onDeleteSubject}
    />
  );
}
