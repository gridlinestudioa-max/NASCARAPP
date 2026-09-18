"use client";

import { useActionState } from "react";
import { submitEntryList } from "./actions";

export default function EntryListForm({ raceId, initialText }: { raceId: string; initialText: string }) {
  const [error, formAction, pending] = useActionState(submitEntryList, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="raceId" value={raceId} />
      <textarea
        name="entryList"
        rows={20}
        required
        defaultValue={initialText}
        style={{ width: "100%", fontFamily: "monospace" }}
      />
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save entry list"}
      </button>
    </form>
  );
}
