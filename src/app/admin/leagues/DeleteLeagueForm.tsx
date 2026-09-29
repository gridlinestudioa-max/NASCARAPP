"use client";

import { useActionState, useState } from "react";
import { deleteLeagueAction } from "./actions";
import styles from "./page.module.css";

export default function DeleteLeagueForm({ leagueId, leagueName }: { leagueId: string; leagueName: string }) {
  const [error, formAction, pending] = useActionState(deleteLeagueAction, undefined);
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");

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
        if (!confirm(`Permanently delete "${leagueName}"? Every membership, rule set, pick, and score in it is gone for good.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="leagueId" value={leagueId} />
      <input type="hidden" name="leagueName" value={leagueName} />
      <label className={styles.confirmLabel}>
        Type <strong>{leagueName}</strong> to confirm
        <input
          type="text"
          name="confirmName"
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          autoComplete="off"
        />
      </label>
      <span className={styles.deleteActions}>
        <button type="submit" disabled={pending || confirmName.trim() !== leagueName.trim()}>
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
