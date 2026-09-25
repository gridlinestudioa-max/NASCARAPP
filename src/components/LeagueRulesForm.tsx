"use client";

import { useState, useTransition } from "react";
import type { LeagueType } from "@prisma/client";
import {
  MAX_FIELD_SIZE,
  MAX_STAGE_POSITIONS,
  PRESETS,
  type PickemRuleSetConfig,
} from "@/lib/scoring";
import { buildTieredDraftDefaultConfig, type TieredDraftRuleSetConfig } from "@/lib/tieredDraft";
import { createLeague, previewRules, type PreviewRow } from "@/app/leagues/new/actions";
import { updateLeagueRules } from "@/app/leagues/[leagueId]/commissioner/actions";
import Card from "@/components/ui/Card";
import styles from "./LeagueRulesForm.module.css";

type RaceOption = { id: string; label: string };

// When set, the form edits this existing league's rules instead of
// creating a new one — the name and league type are fixed and hidden,
// and fields are seeded from its current config rather than a preset.
type EditingLeague = {
  id: string;
  type: LeagueType;
  pickemConfig?: PickemRuleSetConfig;
  tieredConfig?: TieredDraftRuleSetConfig;
};

// Every numeric field below is `type="text" inputMode="numeric"` rather
// than `type="number"` — Chromium/Firefox don't track a caret position for
// number inputs at all (selectionStart is always null), so a controlled
// number input snaps the cursor to the end on every keystroke no matter
// where you clicked to position it. Plain text with digit-only filtering
// gets normal, click-to-position cursor behavior back.
function parseDigits(raw: string, fallback: number): number {
  const digits = raw.replace(/[^0-9]/g, "");
  return digits === "" ? fallback : parseInt(digits, 10);
}

function clonePreset(preset: PickemRuleSetConfig): PickemRuleSetConfig {
  return {
    ...preset,
    positionPoints: [...preset.positionPoints],
    stagePositionPoints: [...preset.stagePositionPoints],
  };
}

// A compact grid of "position -> points" number inputs, chunked into a
// wrapping grid instead of the old side-by-side raw <table>s — shared by
// every points matrix in this form (Pick'em position/stage points, Tiered
// Lineup qualifying/finish points).
function PointsMatrix({
  label,
  helper,
  values,
  onChange,
}: {
  label: string;
  helper?: string;
  values: number[];
  onChange: (index: number, value: number) => void;
}) {
  return (
    <div>
      <div className={styles.matrixLabel}>{label}</div>
      {helper && <div className={styles.matrixHelper}>{helper}</div>}
      <div className={styles.matrix}>
        {values.map((pts, i) => (
          <div key={i} className={styles.matrixCell}>
            <span className={styles.matrixPos}>Pos {i + 1}</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              aria-label={`Points for position ${i + 1}`}
              value={pts}
              onChange={(e) => onChange(i, parseDigits(e.target.value, 0))}
              className={styles.matrixInput}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LeagueRulesForm({
  completedRaces,
  editingLeague,
}: {
  completedRaces: RaceOption[];
  editingLeague?: EditingLeague;
}) {
  const [name, setName] = useState("");
  const [leagueType, setLeagueType] = useState<LeagueType>(editingLeague?.type ?? "PICKEM");
  const [config, setConfig] = useState<PickemRuleSetConfig>(() =>
    editingLeague?.pickemConfig ? clonePreset(editingLeague.pickemConfig) : clonePreset(PRESETS.ourDefault),
  );
  const [unlimitedRepeats, setUnlimitedRepeats] = useState(
    editingLeague?.pickemConfig ? editingLeague.pickemConfig.maxPicksPerDriverPerSeason == null : true,
  );
  const [tieredConfig, setTieredConfig] = useState<TieredDraftRuleSetConfig>(
    editingLeague?.tieredConfig ?? buildTieredDraftDefaultConfig(),
  );

  const [createError, setCreateError] = useState<string | undefined>();
  const [creating, startCreate] = useTransition();

  const [previewRaceId, setPreviewRaceId] = useState(completedRaces[0]?.id ?? "");
  const [previewRows, setPreviewRows] = useState<PreviewRow[] | null>(null);
  const [previewError, setPreviewError] = useState<string | undefined>();
  const [previewing, startPreview] = useTransition();

  function applyPreset(preset: PickemRuleSetConfig) {
    setConfig(clonePreset(preset));
    setUnlimitedRepeats(preset.maxPicksPerDriverPerSeason == null);
  }

  function updatePositionPoint(index: number, value: number) {
    setConfig((c) => {
      const positionPoints = [...c.positionPoints];
      positionPoints[index] = value;
      return { ...c, positionPoints };
    });
  }

  function updateStagePoint(index: number, value: number) {
    setConfig((c) => {
      const stagePositionPoints = [...c.stagePositionPoints];
      stagePositionPoints[index] = value;
      return { ...c, stagePositionPoints };
    });
  }

  function updateTieredQualifyingPoint(index: number, value: number) {
    setTieredConfig((c) => {
      const qualifyingPositionPoints = [...c.qualifyingPositionPoints];
      qualifyingPositionPoints[index] = value;
      return { ...c, qualifyingPositionPoints };
    });
  }

  function updateTieredFinishPoint(index: number, value: number) {
    setTieredConfig((c) => {
      const finishPositionPoints = [...c.finishPositionPoints];
      finishPositionPoints[index] = value;
      return { ...c, finishPositionPoints };
    });
  }

  function handlePreview() {
    setPreviewError(undefined);
    startPreview(async () => {
      const result = await previewRules(config, previewRaceId);
      if (typeof result === "string") {
        setPreviewError(result);
        setPreviewRows(null);
      } else {
        setPreviewRows(result);
      }
    });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(undefined);
    startCreate(async () => {
      const rawConfig = leagueType === "TIERED_DRAFT" ? tieredConfig : config;
      const error = editingLeague
        ? await updateLeagueRules(editingLeague.id, leagueType, rawConfig)
        : await createLeague(name, leagueType, rawConfig);
      if (error) setCreateError(error);
    });
  }

  return (
    <form onSubmit={handleCreate} className={styles.form}>
      {!editingLeague && (
        <Card title="League details">
          <div className={styles.fieldBlock}>
            <label htmlFor="name" className={styles.fieldLabel}>
              League name
            </label>
            <input
              id="name"
              className={styles.textInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={3}
              autoFocus
            />
          </div>
        </Card>
      )}

      {!editingLeague && (
        <Card title="League type">
          <div className={styles.typeGrid}>
            <label className={`${styles.typeCard} ${leagueType === "PICKEM" ? styles.typeCardActive : ""}`}>
              <input
                type="radio"
                name="leagueType"
                className={styles.typeCardRadio}
                checked={leagueType === "PICKEM"}
                onChange={() => setLeagueType("PICKEM")}
              />
              <span>
                <span className={styles.typeCardTitle}>Pick&apos;em</span>
                <div className={styles.typeCardDesc}>
                  Pick a driver (or several) each week, fully customizable scoring.
                </div>
              </span>
            </label>
            <label className={`${styles.typeCard} ${leagueType === "TIERED_DRAFT" ? styles.typeCardActive : ""}`}>
              <input
                type="radio"
                name="leagueType"
                className={styles.typeCardRadio}
                checked={leagueType === "TIERED_DRAFT"}
                onChange={() => setLeagueType("TIERED_DRAFT")}
              />
              <span>
                <span className={styles.typeCardTitle}>Tiered Lineup</span>
                <div className={styles.typeCardDesc}>
                  Draft a weekly 8-driver roster from 3 performance tiers, old-Yahoo-style.
                </div>
              </span>
            </label>
          </div>
        </Card>
      )}

      {leagueType === "TIERED_DRAFT" ? (
        <>
          <Card title="How Tiered Lineup works">
            <p className={styles.intro}>
              Every week, drivers are sorted into three tiers (A, B, C) based on that week&apos;s performance/ranking.
              Each player drafts a lineup of 8 drivers: 1 starter + 1 bench from Tier A, 2 starters + 2 bench from
              Tier B, and 1 starter + 1 bench from Tier C.
            </p>
            <p className={styles.intro}>
              <strong>Lineup lock:</strong> your lineup locks at 2:00 AM Pacific on qualifying day. After that, you
              can still swap a starter for its bench counterpart (no new drivers) right up until 5 minutes before the
              race starts. If you never touch your lineup for a week, last week&apos;s carries over.
            </p>
            <p className={styles.intro}>
              <strong>Scoring:</strong> every rostered driver, starter or bench, scores qualifying points (only the
              top 4 qualifiers ever score). Starters additionally score finishing points; bench drivers never score
              finishing points, win or lose. The tier structure and lock timing aren&apos;t editable, but every point
              value below is — the defaults shown match the classic Yahoo Fantasy NASCAR payouts.
            </p>
          </Card>

          <Card title="Rules">
            <div className={styles.fieldBlock}>
              <label htmlFor="maxStarts" className={styles.fieldLabel}>
                Max times a player can START the same driver per season
              </label>
              <input
                id="maxStarts"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className={styles.numberInputSmall}
                value={tieredConfig.maxStartsPerDriverPerSeason}
                onChange={(e) =>
                  setTieredConfig((c) => ({
                    ...c,
                    maxStartsPerDriverPerSeason: Math.max(1, parseDigits(e.target.value, 1)),
                  }))
                }
              />
              <div className={styles.fieldHelper}>Benching a driver doesn&apos;t count against this cap — only starting them does.</div>
            </div>
          </Card>

          <Card title="Qualifying points">
            <PointsMatrix
              label="Every rostered driver earns these"
              helper="Only the top 4 qualifiers score anything."
              values={tieredConfig.qualifyingPositionPoints}
              onChange={updateTieredQualifyingPoint}
            />
          </Card>

          <Card title="Finishing points">
            <PointsMatrix
              label={`Positions 1 through ${MAX_FIELD_SIZE}`}
              helper="Starters only — bench drivers never score these."
              values={tieredConfig.finishPositionPoints}
              onChange={updateTieredFinishPoint}
            />
          </Card>

          {createError && <p role="alert">{createError}</p>}

          <div className={styles.submitRow}>
            <button type="submit" disabled={creating}>
              {creating ? "Saving..." : editingLeague ? "Save changes" : "Create league"}
            </button>
          </div>
        </>
      ) : (
        <>
          <Card title="Presets">
            <div className={styles.presetRow}>
              <button type="button" className={styles.presetButton} onClick={() => applyPreset(PRESETS.nascarOfficial)}>
                NASCAR Official Points
              </button>
              <button type="button" className={styles.presetButton} onClick={() => applyPreset(PRESETS.ourDefault)}>
                Fantasy NASCAR HQ Points
              </button>
              <button type="button" className={styles.presetButton} onClick={() => applyPreset(PRESETS.custom)}>
                Custom Points
              </button>
            </div>
          </Card>

          <Card title="Editable rules">
            <div className={styles.fieldBlock}>
              <label htmlFor="picksPerWeek" className={styles.fieldLabel}>
                Drivers picked per player per week
              </label>
              <input
                id="picksPerWeek"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className={styles.numberInputSmall}
                value={config.picksPerWeek}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, picksPerWeek: Math.min(10, Math.max(1, parseDigits(e.target.value, 1))) }))
                }
              />
            </div>

            <div className={styles.fieldBlock}>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={unlimitedRepeats}
                  onChange={(e) => {
                    setUnlimitedRepeats(e.target.checked);
                    setConfig((c) => ({ ...c, maxPicksPerDriverPerSeason: e.target.checked ? null : 1 }));
                  }}
                />
                Unlimited repeat picks of the same driver
              </label>
              {!unlimitedRepeats && (
                <div style={{ marginTop: 10 }}>
                  <label htmlFor="maxRepeats" className={styles.fieldLabel}>
                    Max times a player can pick the same driver per season
                  </label>
                  <input
                    id="maxRepeats"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className={styles.numberInputSmall}
                    value={config.maxPicksPerDriverPerSeason ?? 1}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, maxPicksPerDriverPerSeason: Math.max(1, parseDigits(e.target.value, 1)) }))
                    }
                  />
                </div>
              )}
            </div>

            <div className={styles.fieldBlock}>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={config.includeNonPointsRaces}
                  onChange={(e) => setConfig((c) => ({ ...c, includeNonPointsRaces: e.target.checked }))}
                />
                Include non-points races (e.g. the All-Star race)
              </label>
            </div>

            <div className={styles.fieldBlock}>
              <div className={styles.fieldLabel}>When do picks lock?</div>
              <div className={styles.radioGroup}>
                <label
                  className={`${styles.radioOption} ${config.lockTiming === "afterQualifying" ? styles.radioOptionActive : ""}`}
                >
                  <input
                    type="radio"
                    name="lockTiming"
                    className={styles.radioOptionRadio}
                    checked={config.lockTiming === "afterQualifying"}
                    onChange={() => setConfig((c) => ({ ...c, lockTiming: "afterQualifying" }))}
                  />
                  <span>
                    <div className={styles.radioOptionTitle}>After qualifying</div>
                    <div className={styles.radioOptionDesc}>
                      Picks lock 5 minutes before the race starts, informed by starting position.
                    </div>
                  </span>
                </label>
                <label
                  className={`${styles.radioOption} ${config.lockTiming === "beforeQualifying" ? styles.radioOptionActive : ""}`}
                >
                  <input
                    type="radio"
                    name="lockTiming"
                    className={styles.radioOptionRadio}
                    checked={config.lockTiming === "beforeQualifying"}
                    onChange={() => setConfig((c) => ({ ...c, lockTiming: "beforeQualifying" }))}
                  />
                  <span>
                    <div className={styles.radioOptionTitle}>Before qualifying</div>
                    <div className={styles.radioOptionDesc}>Picks lock blind, the moment qualifying begins.</div>
                  </span>
                </label>
              </div>
            </div>
          </Card>

          <Card title="Points rules">
            <div className={styles.fieldBlock}>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={config.includeStagePoints}
                  onChange={(e) => setConfig((c) => ({ ...c, includeStagePoints: e.target.checked }))}
                />
                Include stage points
              </label>
            </div>

            <div className={styles.fieldBlock}>
              <div className={styles.fieldLabel}>Position points</div>
              <div className={styles.radioGroup}>
                <label className={`${styles.radioOption} ${config.pointsMode === "fixed" ? styles.radioOptionActive : ""}`}>
                  <input
                    type="radio"
                    name="pointsMode"
                    className={styles.radioOptionRadio}
                    checked={config.pointsMode === "fixed"}
                    onChange={() => setConfig((c) => ({ ...c, pointsMode: "fixed" }))}
                  />
                  <span>
                    <div className={styles.radioOptionTitle}>Fixed points matrix</div>
                    <div className={styles.radioOptionDesc}>Each position is always worth the same, like real NASCAR points.</div>
                  </span>
                </label>
                <label
                  className={`${styles.radioOption} ${config.pointsMode === "fieldSizeRelative" ? styles.radioOptionActive : ""}`}
                >
                  <input
                    type="radio"
                    name="pointsMode"
                    className={styles.radioOptionRadio}
                    checked={config.pointsMode === "fieldSizeRelative"}
                    onChange={() => setConfig((c) => ({ ...c, pointsMode: "fieldSizeRelative" }))}
                  />
                  <span>
                    <div className={styles.radioOptionTitle}>Field-size relative</div>
                    <div className={styles.radioOptionDesc}>
                      1st place is worth however many cars started, scaling down each race.
                    </div>
                  </span>
                </label>
              </div>
              <div className={styles.fieldHelper} style={{ marginTop: 10 }}>
                Want to reward 1st place extra? Switch to the fixed points matrix and set position 1&apos;s points
                higher than position 2&apos;s — no separate winner bonus needed.
              </div>
            </div>
          </Card>

          {config.pointsMode === "fixed" && (
            <Card title="Position points">
              <PointsMatrix
                label="Points awarded for each finishing position"
                helper={`Positions 1 through ${MAX_FIELD_SIZE}.`}
                values={config.positionPoints}
                onChange={updatePositionPoint}
              />
            </Card>
          )}
          {config.pointsMode === "fieldSizeRelative" && (
            <Card title="Position points">
              <p className={styles.intro}>
                A finisher scores (field size + 1 − finishing position) points — e.g. 1st in a 36-car field scores
                36, last scores 1.
              </p>
            </Card>
          )}

          {config.includeStagePoints && (
            <Card title="Stage points">
              <PointsMatrix
                label={`Only the top ${MAX_STAGE_POSITIONS} finishers of a stage score`}
                values={config.stagePositionPoints}
                onChange={updateStagePoint}
              />
            </Card>
          )}

          <Card title="Test these rules against real results">
            {completedRaces.length === 0 ? (
              <p className={styles.intro}>No race has results entered yet — nothing to test against.</p>
            ) : (
              <>
                <div className={styles.previewRow}>
                  <div className={styles.fieldBlock} style={{ padding: 0, border: "none" }}>
                    <label htmlFor="previewRace" className={styles.fieldLabel}>
                      Race
                    </label>
                    <select
                      id="previewRace"
                      className={styles.select}
                      value={previewRaceId}
                      onChange={(e) => setPreviewRaceId(e.target.value)}
                    >
                      {completedRaces.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button type="button" onClick={handlePreview} disabled={previewing}>
                    {previewing ? "Testing..." : "Test"}
                  </button>
                </div>

                {previewError && <p role="alert">{previewError}</p>}

                {previewRows && (
                  <div className={styles.previewTableWrap}>
                    <table>
                      <thead>
                        <tr>
                          <th>Driver</th>
                          <th>Finish</th>
                          <th>Base</th>
                          <th>Win bonus</th>
                          <th>Stage bonus</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((r) => (
                          <tr key={r.driverId}>
                            <td>{r.driverName}</td>
                            <td>{r.finishPosition}</td>
                            <td>{r.baseScore}</td>
                            <td>{r.winBonus}</td>
                            <td>{r.stageBonus}</td>
                            <td>{r.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </Card>

          {createError && <p role="alert">{createError}</p>}

          <div className={styles.submitRow}>
            <button type="submit" disabled={creating}>
              {creating ? "Saving..." : editingLeague ? "Save changes" : "Create league"}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
