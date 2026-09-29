"use client";

import { useActionState, useState } from "react";
import styles from "./ConfirmDeleteForm.module.css";

// One generic "type the name to confirm, then delete" form, used by every
// admin page that permanently removes something (leagues, users, ...
// whatever's next). Each caller supplies its own server action and warning
// copy; the id/name/confirm-typing/dialog mechanics live here exactly
// once instead of being re-copied per entity type.
export default function ConfirmDeleteForm({
  id,
  name,
  action,
  confirmMessage,
  triggerLabel = "Delete",
}: {
  id: string;
  name: string;
  action: (prevState: string | undefined, formData: FormData) => Promise<string | undefined>;
  confirmMessage: string;
  triggerLabel?: string;
}) {
  const [error, formAction, pending] = useActionState(action, undefined);
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  if (!open) {
    return (
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
        {triggerLabel}
      </button>
    );
  }

  return (
    <form
      className={styles.form}
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="name" value={name} />
      <label className={styles.confirmLabel}>
        Type <strong>{name}</strong> to confirm
        <input
          type="text"
          name="confirmName"
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          autoComplete="off"
        />
      </label>
      <span className={styles.actions}>
        <button type="submit" disabled={pending || confirmName.trim() !== name.trim()}>
          {pending ? "Deleting..." : "Confirm delete"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setConfirmName("");
          }}
        >
          Cancel
        </button>
      </span>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
