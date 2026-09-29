"use client";

import { useActionState, useState } from "react";
import { deleteUserAction } from "./actions";
import styles from "./page.module.css";

export default function DeleteUserForm({ userId, identifier }: { userId: string; identifier: string }) {
  const [error, formAction, pending] = useActionState(deleteUserAction, undefined);
  const [open, setOpen] = useState(false);
  const [confirmIdentifier, setConfirmIdentifier] = useState("");

  if (!open) {
    return (
      <button type="button" className={styles.deleteTrigger} onClick={() => setOpen(true)}>
        Delete
      </button>
    );
  }

  return (
    <form
      className={styles.deleteForm}
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`Permanently delete "${identifier}"? Every membership, pick, and score they have is gone for good.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="identifier" value={identifier} />
      <label className={styles.confirmLabel}>
        Type <strong>{identifier}</strong> to confirm
        <input
          type="text"
          name="confirmIdentifier"
          value={confirmIdentifier}
          onChange={(e) => setConfirmIdentifier(e.target.value)}
          autoComplete="off"
        />
      </label>
      <span className={styles.deleteActions}>
        <button type="submit" disabled={pending || confirmIdentifier.trim() !== identifier.trim()}>
          {pending ? "Deleting..." : "Confirm delete"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setConfirmIdentifier("");
          }}
        >
          Cancel
        </button>
      </span>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
