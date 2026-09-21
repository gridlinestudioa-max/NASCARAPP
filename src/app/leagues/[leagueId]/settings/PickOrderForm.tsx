"use client";

import { useActionState, useState } from "react";
import { updatePickOrder } from "./actions";
import { PICK_ORDER_MODE_INFO, type PickOrderMode } from "@/lib/pickOrder";

type Member = { userId: string; name: string };

export default function PickOrderForm({
  leagueId,
  mode: initialMode,
  members,
}: {
  leagueId: string;
  mode: PickOrderMode;
  members: Member[];
}) {
  const [error, formAction, pending] = useActionState(updatePickOrder, undefined);
  const [mode, setMode] = useState<PickOrderMode>(initialMode);
  const [order, setOrder] = useState(members.map((m) => m.userId));
  const nameByUserId = new Map(members.map((m) => [m.userId, m.name]));

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="leagueId" value={leagueId} />
      <input type="hidden" name="order" value={order.join(",")} />

      <label htmlFor="mode">Weekly order changes by:</label>
      <br />
      <select id="mode" name="mode" value={mode} onChange={(e) => setMode(e.target.value as PickOrderMode)}>
        {Object.entries(PICK_ORDER_MODE_INFO).map(([value, info]) => (
          <option key={value} value={value}>
            {info.label}
          </option>
        ))}
      </select>
      <p>
        <small>{PICK_ORDER_MODE_INFO[mode].description}</small>
      </p>

      <h3>Base order</h3>
      <p>
        <small>
          {mode === "SNAKE" || mode === "ROTATE"
            ? "Starting order — the mode above decides how it changes week to week."
            : "Used to break ties (like week 1, before anyone has points) and as the order for any week the standings can't decide."}
        </small>
      </p>
      <ol>
        {order.map((userId, i) => (
          <li key={userId}>
            {nameByUserId.get(userId) ?? "—"}{" "}
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0}>
              &uarr;
            </button>{" "}
            <button type="button" onClick={() => move(i, 1)} disabled={i === order.length - 1}>
              &darr;
            </button>
          </li>
        ))}
      </ol>

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save pick order"}
      </button>
    </form>
  );
}
