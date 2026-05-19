export function FieldError({ id, message }) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} className="text-sm font-medium text-destructive">
      {message}
    </p>
  );
}
