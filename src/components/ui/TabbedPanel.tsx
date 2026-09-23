"use client";

import { useState, type ReactNode } from "react";
import MiniTabs from "./MiniTabs";

// Renders one of several server-rendered panels, switched by a small pill
// tab bar — the panels themselves (tables, lists, whatever) are built by
// the server component that uses this, so this only ever owns the "which
// one is showing" state.
export default function TabbedPanel({ tabs }: { tabs: { id: string; label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  if (!current) return null;

  return (
    <div>
      <MiniTabs tabs={tabs.map(({ id, label }) => ({ id, label }))} active={current.id} onChange={setActive} />
      {current.content}
    </div>
  );
}
