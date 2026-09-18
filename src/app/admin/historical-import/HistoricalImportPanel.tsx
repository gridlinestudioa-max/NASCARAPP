"use client";

import { useState, useTransition } from "react";
import { runHistoricalImportBatch } from "./actions";

export default function HistoricalImportPanel() {
  const [message, setMessage] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await runHistoricalImportBatch();
      setMessage(result);
    });
  }

  return (
    <>
      <p>
        <button type="button" onClick={handleClick} disabled={pending}>
          {pending ? "Importing..." : "Import next batch"}
        </button>
      </p>
      {message && <p role="status">{message}</p>}
    </>
  );
}
