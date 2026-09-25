"use client";

import { useActionState, useState } from "react";
import { transferCommissioner } from "./actions";

type Member = { userId: string; name: string; isCurrentOwner: boolean };

export default function TransferCommissionerForm({ leagueId, members }: { leagueId: string; members: Member[] }) {
  const [error, formAction, pending] = useActionState(transferCommissioner, undefined);
  const [selectedUserId, setSelectedUserId] = useState("");
  const current = members.find((m) => m.isCurrentOwner);
  const others = members.filter((m) => !m.isCurrentOwner);

  return (
    <div>
      <p>Current commissioner: {current?.name ?? "—"}</p>
      {others.length === 0 ? (
        <p>There&apos;s no one else in this league to hand the role to.</p>
      ) : (
        <form
          action={formAction}
          onSubmit={(e) => {
            const name = others.find((m) => m.userId === selectedUserId)?.name ?? "this player";
            if (
              !confirm(
                `Make ${name} the commissioner of this league? You'll lose commissioner access immediately — this can't be undone except by them transferring it back.`,
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="leagueId" value={leagueId} />
          <label htmlFor="newOwnerUserId">Make commissioner:</label>{" "}
          <select
            id="newOwnerUserId"
            name="newOwnerUserId"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            required
          >
            <option value="" disabled>
              Select a player
            </option>
            {others.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>{" "}
          <button type="submit" disabled={pending || !selectedUserId}>
            {pending ? "Transferring..." : "Transfer"}
          </button>
          {error && <p role="alert">{error}</p>}
        </form>
      )}
    </div>
  );
}
