"use client";

import { useActionState, useEffect, useState } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import DriverNumberBadge from "@/components/ui/DriverNumberBadge";
import type { DriverTier, TieredLineupSlot } from "@/lib/tieredDraft";
import { ItemTypes, type DriverDragItem } from "@/lib/dnd";
import { submitTieredLineup } from "./actions";
import styles from "./TieredLineupForm.module.css";

type DriverOption = { id: string; name: string; number: number | null; startsUsed: number; avgFinish: number | null };

const TIER_LABEL: Record<DriverTier, string> = { A: "Tier A", B: "Tier B", C: "Tier C" };
const TIER_CLASS: Record<DriverTier, string> = { A: styles.slotA, B: styles.slotB, C: styles.slotC };

// HTML5Backend on purpose, not a touch backend: native HTML5 drag-and-drop
// doesn't fire from a finger gesture on a phone, so this deliberately limits
// dragging to mouse/trackpad (desktop) while leaving touch devices with only
// the tap-to-open picker modal below — dragging a driver card with a thumb
// fights the page's own scroll gesture, so tap is the better mobile
// interaction rather than a lesser one. The driver pool itself is hidden on
// mobile widths in the CSS (a pool of cards that don't respond to touch drag
// would just be confusing) — see .pool's media query.

export default function TieredLineupForm({
  leagueId,
  raceId,
  lockPhase,
  maxStartsPerDriverPerSeason,
  slots,
  lateSwapGroups,
  driversByTier,
  currentDriverIdByPickNumber,
  usingCarriedOverPreview,
}: {
  leagueId: string;
  raceId: string;
  lockPhase: "open" | "lateSwapOnly";
  maxStartsPerDriverPerSeason: number;
  slots: TieredLineupSlot[];
  lateSwapGroups: { tier: DriverTier; pickNumbers: number[] }[];
  driversByTier: Record<DriverTier, DriverOption[]>;
  currentDriverIdByPickNumber: (string | null)[];
  usingCarriedOverPreview: boolean;
}) {
  const [error, formAction, pending] = useActionState(submitTieredLineup, undefined);
  const [selected, setSelected] = useState<Record<number, string | null>>(() => {
    const initial: Record<number, string | null> = {};
    slots.forEach((slot) => {
      initial[slot.pickNumber] = currentDriverIdByPickNumber[slot.pickNumber - 1] ?? null;
    });
    return initial;
  });
  const [activeSlotNumber, setActiveSlotNumber] = useState<number | null>(null);

  const driverById = new Map<string, DriverOption>();
  (["A", "B", "C"] as const).forEach((tier) => driversByTier[tier].forEach((d) => driverById.set(d.id, d)));

  const starterSlots = slots.filter((s) => s.role === "STARTER");
  const benchSlots = slots.filter((s) => s.role === "BENCH");
  const filledCount = Object.values(selected).filter(Boolean).length;

  const activeSlot = slots.find((s) => s.pickNumber === activeSlotNumber) ?? null;

  useEffect(() => {
    if (activeSlotNumber == null) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setActiveSlotNumber(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activeSlotNumber]);

  function eligibleDriversFor(tier: DriverTier, pickNumber: number): DriverOption[] {
    if (lockPhase === "open") return driversByTier[tier];
    // Late swap: only the drivers already rostered in this tier's
    // starter/bench pair(s) can be picked — no new driver can enter.
    const group = lateSwapGroups.find((g) => g.pickNumbers.includes(pickNumber));
    if (!group) return [];
    const rosteredIds = group.pickNumbers.map((pn) => selected[pn]).filter((id): id is string => id != null);
    return driversByTier[tier].filter((d) => rosteredIds.includes(d.id));
  }

  function assignedElsewhere(driverId: string, exceptPickNumber: number): boolean {
    return Object.entries(selected).some(([pn, id]) => Number(pn) !== exceptPickNumber && id === driverId);
  }

  // Moving a driver already rostered this week between two of its own slots
  // doesn't cost a fresh season start, so only a brand-new pool pick gets
  // capped against maxStartsPerDriverPerSeason.
  function canAssign(pickNumber: number, tier: DriverTier, role: "STARTER" | "BENCH", driverId: string, fromPickNumber: number | null): boolean {
    if (fromPickNumber === pickNumber) return false;
    const driver = eligibleDriversFor(tier, pickNumber).find((d) => d.id === driverId);
    if (!driver) return false;
    if (role === "STARTER" && fromPickNumber == null && driver.startsUsed >= maxStartsPerDriverPerSeason) return false;
    return true;
  }

  // Dropping a pool driver onto an empty/filled slot just fills it; dragging
  // between two slots swaps them (the displaced driver lands where the
  // dragged one came from) rather than getting silently discarded.
  function assignDriver(toPickNumber: number, driverId: string, fromPickNumber: number | null) {
    if (fromPickNumber === toPickNumber) return;
    setSelected((prev) => {
      const next = { ...prev };
      if (fromPickNumber != null) {
        next[fromPickNumber] = next[toPickNumber] ?? null;
      }
      next[toPickNumber] = driverId;
      return next;
    });
  }

  function openModal(pickNumber: number) {
    setActiveSlotNumber(pickNumber);
  }
  function closeModal() {
    setActiveSlotNumber(null);
  }

  function pick(driverId: string) {
    if (activeSlotNumber == null) return;
    setSelected((prev) => ({ ...prev, [activeSlotNumber]: driverId }));
    closeModal();
  }
  function clearActiveSlot() {
    if (activeSlotNumber == null) return;
    setSelected((prev) => ({ ...prev, [activeSlotNumber]: null }));
    closeModal();
  }

  const poolTiers = (["A", "B", "C"] as const).filter((tier) => slots.some((s) => s.tier === tier));
  const showPool = lockPhase === "open";

  return (
    <DndProvider backend={HTML5Backend}>
      <form action={formAction}>
        <input type="hidden" name="leagueId" value={leagueId} />
        <input type="hidden" name="raceId" value={raceId} />
        {slots.map((slot) => (
          <input key={slot.pickNumber} type="hidden" name={`driverId-${slot.pickNumber}`} value={selected[slot.pickNumber] ?? ""} />
        ))}

        {usingCarriedOverPreview && (
          <p>
            <em>Showing last week&apos;s lineup — it&apos;ll carry over as-is unless you change and save it.</em>
          </p>
        )}
        {lockPhase === "lateSwapOnly" && (
          <p>
            <em>
              Lineups are locked for new drivers — drag (or tap) to swap a slot&apos;s starter for its own bench
              driver (or back), right up until 5 minutes before the race.
            </em>
          </p>
        )}

        {showPool && (
          <div className={styles.pool}>
            <span className={styles.roleLabel}>Drag a driver into your lineup</span>
            {poolTiers.map((tier) => {
              const undrafted = driversByTier[tier].filter((d) => !Object.values(selected).includes(d.id));
              return (
                <div key={tier} className={styles.poolTierRow}>
                  <span className={`${styles.tierTag} ${TIER_CLASS[tier]}`}>{TIER_LABEL[tier]}</span>
                  <div className={styles.poolChips}>
                    {undrafted.length === 0 && <span className={styles.poolEmpty}>All drafted</span>}
                    {undrafted.map((d) => (
                      <DriverChip key={d.id} driver={d} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <span className={styles.roleLabel}>Starters</span>
        <div className={styles.slotRow}>
          {starterSlots.map((s) => (
            <Slot
              key={s.pickNumber}
              pickNumber={s.pickNumber}
              tier={s.tier}
              role={s.role}
              driver={selected[s.pickNumber] ? driverById.get(selected[s.pickNumber]!) : undefined}
              canAssign={canAssign}
              onAssign={assignDriver}
              onOpen={() => openModal(s.pickNumber)}
            />
          ))}
        </div>

        <div className={styles.roleGroup}>
          <span className={styles.roleLabel}>Bench</span>
          <div className={styles.slotRow}>
            {benchSlots.map((s) => (
              <Slot
                key={s.pickNumber}
                pickNumber={s.pickNumber}
                tier={s.tier}
                role={s.role}
                driver={selected[s.pickNumber] ? driverById.get(selected[s.pickNumber]!) : undefined}
                canAssign={canAssign}
                onAssign={assignDriver}
                onOpen={() => openModal(s.pickNumber)}
              />
            ))}
          </div>
        </div>

        <div className={styles.saveBar}>
          <div className={styles.status}>
            {filledCount === slots.length ? (
              <>
                All {slots.length} slots set — <strong>save whenever you&apos;re ready.</strong>
              </>
            ) : (
              <>
                {filledCount} of {slots.length} slots set.
              </>
            )}
          </div>
          <button type="submit" disabled={pending || filledCount < slots.length}>
            {pending ? "Saving..." : "Save lineup"}
          </button>
        </div>

        {error && <p role="alert">{error}</p>}

        {activeSlot && (
          <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && closeModal()}>
            <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="tieredPickerTitle">
              <div className={styles.modalHead}>
                <div className={styles.modalTitleWrap}>
                  <span className={`${styles.tierTag} ${TIER_CLASS[activeSlot.tier]}`}>{TIER_LABEL[activeSlot.tier]}</span>
                  <h3 id="tieredPickerTitle">
                    Choose your {TIER_LABEL[activeSlot.tier]} {activeSlot.role === "STARTER" ? "starter" : "bench driver"}
                  </h3>
                </div>
                <button type="button" className={styles.closeBtn} onClick={closeModal} aria-label="Close">
                  &times;
                </button>
              </div>

              {selected[activeSlot.pickNumber] && (
                <div className={styles.modalActions}>
                  <button type="button" className={styles.removeBtn} onClick={clearActiveSlot}>
                    Remove driver from this slot
                  </button>
                </div>
              )}

              {(() => {
                const options = eligibleDriversFor(activeSlot.tier, activeSlot.pickNumber);
                if (lockPhase === "lateSwapOnly" && options.length === 0) {
                  return <p className={styles.modalNote}>Nothing to swap — this tier has no bench driver rostered.</p>;
                }
                return null;
              })()}

              <div className={styles.modalListHead}>
                <span>Driver</span>
                <span>Avg finish</span>
                <span>Starts used</span>
              </div>
              <div className={styles.modalList}>
                {eligibleDriversFor(activeSlot.tier, activeSlot.pickNumber)
                  .slice()
                  .sort((a, b) => (a.avgFinish ?? 999) - (b.avgFinish ?? 999))
                  .map((d) => {
                    const isCurrent = d.id === selected[activeSlot.pickNumber];
                    const usedElsewhere = !isCurrent && assignedElsewhere(d.id, activeSlot.pickNumber);
                    const capped = activeSlot.role === "STARTER" && !isCurrent && d.startsUsed >= maxStartsPerDriverPerSeason;
                    const disabled = usedElsewhere || capped;
                    const pct = Math.min(100, Math.round((d.startsUsed / maxStartsPerDriverPerSeason) * 100));
                    const capBarClass = capped ? styles.capBarFull : pct >= 75 ? styles.capBarWarn : "";
                    return (
                      <button
                        key={d.id}
                        type="button"
                        className={`${styles.driverRow} ${isCurrent ? styles.driverRowCurrent : ""}`}
                        disabled={disabled}
                        onClick={() => pick(d.id)}
                      >
                        <span className={styles.dName}>
                          <DriverNumberBadge number={d.number} name={d.name} className={styles.driverBadge} />
                          {d.name}
                          {isCurrent && <span className={styles.curTag}>Current</span>}
                          {usedElsewhere && (
                            <span className={styles.curTag} style={{ color: "var(--text-muted)" }}>
                              In lineup
                            </span>
                          )}
                        </span>
                        <span className={styles.avgFinish}>{d.avgFinish != null ? `P${d.avgFinish.toFixed(1)}` : "—"}</span>
                        <span className={styles.capWrap}>
                          <span className={`${styles.capBar} ${capBarClass}`}>
                            <span style={{ width: `${pct}%` }} />
                          </span>
                          <span className={styles.capLabel}>
                            {d.startsUsed}/{maxStartsPerDriverPerSeason}
                          </span>
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </form>
    </DndProvider>
  );
}

function DriverChip({ driver }: { driver: DriverOption }) {
  const [{ isDragging }, dragRef] = useDrag<DriverDragItem, void, { isDragging: boolean }>(
    () => ({
      type: ItemTypes.DRIVER,
      item: { driverId: driver.id, sourcePickNumber: null },
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [driver.id],
  );

  return (
    <div ref={(node) => void dragRef(node)} className={styles.chip} style={{ opacity: isDragging ? 0.35 : 1 }}>
      <DriverNumberBadge number={driver.number} name={driver.name} className={styles.driverBadge} />
      <span className={styles.chipName}>{driver.name}</span>
    </div>
  );
}

function Slot({
  pickNumber,
  tier,
  role,
  driver,
  canAssign,
  onAssign,
  onOpen,
}: {
  pickNumber: number;
  tier: DriverTier;
  role: "STARTER" | "BENCH";
  driver: DriverOption | undefined;
  canAssign: (pickNumber: number, tier: DriverTier, role: "STARTER" | "BENCH", driverId: string, fromPickNumber: number | null) => boolean;
  onAssign: (toPickNumber: number, driverId: string, fromPickNumber: number | null) => void;
  onOpen: () => void;
}) {
  const [{ isOver, canDrop }, dropRef] = useDrop<DriverDragItem, void, { isOver: boolean; canDrop: boolean }>(
    () => ({
      accept: ItemTypes.DRIVER,
      canDrop: (item) => canAssign(pickNumber, tier, role, item.driverId, item.sourcePickNumber),
      drop: (item) => onAssign(pickNumber, item.driverId, item.sourcePickNumber),
      collect: (monitor) => ({ isOver: monitor.isOver(), canDrop: monitor.canDrop() }),
    }),
    [pickNumber, tier, role, canAssign, onAssign],
  );

  const [{ isDragging }, dragRef] = useDrag<DriverDragItem, void, { isDragging: boolean }>(
    () => ({
      type: ItemTypes.DRIVER,
      item: driver ? { driverId: driver.id, sourcePickNumber: pickNumber } : (undefined as unknown as DriverDragItem),
      canDrag: !!driver,
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [driver, pickNumber],
  );

  function combinedRef(node: HTMLButtonElement | null) {
    dragRef(node);
    dropRef(node);
  }

  const dropState = isOver && canDrop ? styles.slotDropOk : isOver && !canDrop ? styles.slotDropNo : "";

  return (
    <button
      ref={combinedRef}
      type="button"
      className={`${styles.slot} ${TIER_CLASS[tier]} ${driver ? styles.slotFilled : ""} ${dropState}`}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      onClick={onOpen}
    >
      <span className={styles.tierTag}>{TIER_LABEL[tier]}</span>
      {driver ? (
        <>
          <span className={styles.driverName}>
            <DriverNumberBadge number={driver.number} name={driver.name} className={styles.driverBadge} />
            {driver.name}
          </span>
          <span className={styles.tapHint}>
            <span className={styles.hintDesktop}>{role === "STARTER" ? "Starter" : "Bench"} · drag or tap to change</span>
            <span className={styles.hintMobile}>{role === "STARTER" ? "Starter" : "Bench"} · tap to change</span>
          </span>
        </>
      ) : (
        <>
          <span className={styles.placeholder}>Empty {role === "STARTER" ? "starter" : "bench"} slot</span>
          <span className={styles.tapHint}>
            <span className={styles.hintDesktop}>Drag a driver here, or tap</span>
            <span className={styles.hintMobile}>Tap to pick</span>
          </span>
        </>
      )}
    </button>
  );
}
