"use client";

import { useState } from "react";
import DriverMergeForm from "./DriverMergeForm";
import styles from "./page.module.css";

export default function ManualMergePicker({ drivers }: { drivers: { id: string; name: string }[] }) {
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");
  const a = drivers.find((d) => d.id === aId);
  const b = drivers.find((d) => d.id === bId);

  return (
    <div>
      <div className={styles.manualPickerRow}>
        <select value={aId} onChange={(e) => setAId(e.target.value)}>
          <option value="">Select a driver…</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id} disabled={d.id === bId}>
              {d.name}
            </option>
          ))}
        </select>
        <span>and</span>
        <select value={bId} onChange={(e) => setBId(e.target.value)}>
          <option value="">Select a driver…</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id} disabled={d.id === aId}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      {a && b && <DriverMergeForm a={a} b={b} />}
    </div>
  );
}
