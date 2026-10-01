"use client";

import { useFormStatus } from "react-dom";

/**
 * A submit button that shows a spinner + alternate label while its parent
 * form's Server Action is in flight. Scoped to the specific <form> it's
 * inside of (React's useFormStatus), not global -- other forms on the same
 * page (e.g. "Run extraction" on a different source document) stay usable.
 */
export function SubmitButton({
  children,
  pendingText,
  className,
}: {
  children: React.ReactNode;
  pendingText: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? (
        <>
          <span className="spinner" aria-hidden="true" />
          {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}
