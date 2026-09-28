"use client";

import { useActionState, useState } from "react";
import { mergeDriversAction } from "./actions";
import styles from "./page.module.css";

export default function DriverMergeForm({
  a,
  b,
}: {
  a: { id: string; name: string };
  b: { id: string; name: string };
}) {
  const [error, formAction, pending] = useActionState(mergeDriversAction, undefined);
  const [keepId, setKeepId] = useState(a.id);
  const mergeId = keepId === a.id ? b.id : a.id;
  const keepName = keepId === a.id ? a.name : b.name;
  const dropName = keepId === a.id ? b.name : a.name;

  return (
    <form
      className={styles.mergeForm}
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`Merge "${dropName}" into "${keepName}"? All of ${dropName}'s results, picks, and history move to ${keepName}, and "${dropName}" is deleted. This can't be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <span>Keep:</span>
      <label className={styles.mergeOption}>
        <input type="radio" checked={keepId === a.id} onChange={() => setKeepId(a.id)} />
        {a.name}
      </label>
      <label className={styles.mergeOption}>
        <input type="radio" checked={keepId === b.id} onChange={() => setKeepId(b.id)} />
        {b.name}
      </label>
      <input type="hidden" name="keepId" value={keepId} />
      <input type="hidden" name="mergeId" value={mergeId} />
      <button type="submit" disabled={pending}>
        {pending ? "Merging..." : "Merge"}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
