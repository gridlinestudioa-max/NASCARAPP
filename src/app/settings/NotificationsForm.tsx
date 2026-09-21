"use client";

import { useActionState } from "react";
import { updateNotifications } from "./actions";

export default function NotificationsForm({ notifyResultsEmail }: { notifyResultsEmail: boolean }) {
  const [result, formAction, pending] = useActionState(updateNotifications, undefined);

  return (
    <form action={formAction}>
      <div>
        <label>
          <input type="checkbox" name="notifyResultsEmail" defaultChecked={notifyResultsEmail} /> Email me when
          results are posted for a race I picked
        </label>
      </div>

      {result && <p role={result.kind === "error" ? "alert" : "status"}>{result.message}</p>}

      <button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save notification preferences"}
      </button>
    </form>
  );
}
