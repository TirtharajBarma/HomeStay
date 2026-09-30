/** Inline field-level error, shared by the stay and cab booking forms. */
export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;

  return (
    <p id={id} className="mt-1.5 text-label-sm text-error">
      {message}
    </p>
  );
}
