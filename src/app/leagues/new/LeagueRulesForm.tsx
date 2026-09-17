"use client";

import { useState, useTransition } from "react";
import type { LeagueType } from "@prisma/client";
import {
  MAX_FIELD_SIZE,
  MAX_STAGE_POSITIONS,
  PRESETS,
  type PickemRuleSetConfig,
} from "@/lib/scoring";
import { DEFAULT_MAX_STARTS_PER_DRIVER_PER_SEASON, type TieredDraftRuleSetConfig } from "@/lib/tieredDraft";
import { createLeague, previewRules, type PreviewRow } from "./actions";

type RaceOption = { id: string; label: string };

function clonePreset(preset: PickemRuleSetConfig): PickemRuleSetConfig {
  return {
    ...preset,
    positionPoints: [...preset.positionPoints],
    stagePositionPoints: [...preset.stagePositionPoints],
  };
}

export default function LeagueRulesForm({ completedRaces }: { completedRaces: RaceOption[] }) {
  const [name, setName] = useState("");
  const [leagueType, setLeagueType] = useState<LeagueType>("PICKEM");
  const [config, setConfig] = useState<PickemRuleSetConfig>(() => clonePreset(PRESETS.ourDefault));
  const [unlimitedRepeats, setUnlimitedRepeats] = useState(true);
  const [tieredConfig, setTieredConfig] = useState<TieredDraftRuleSetConfig>({
    maxStartsPerDriverPerSeason: DEFAULT_MAX_STARTS_PER_DRIVER_PER_SEASON,
  });

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
      const error = await createLeague(name, leagueType, leagueType === "TIERED_DRAFT" ? tieredConfig : config);
      if (error) setCreateError(error);
    });
  }

  return (
    <form onSubmit={handleCreate}>
      <div>
        <label htmlFor="name">League name</label>
        <br />
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={3} autoFocus />
      </div>

      <h2>League type</h2>
      <div>
        <label>
          <input
            type="radio"
            name="leagueType"
            checked={leagueType === "PICKEM"}
            onChange={() => setLeagueType("PICKEM")}
          />{" "}
          Pick&apos;em — pick a driver (or several) each week, fully customizable scoring
        </label>
        <br />
        <label>
          <input
            type="radio"
            name="leagueType"
            checked={leagueType === "TIERED_DRAFT"}
            onChange={() => setLeagueType("TIERED_DRAFT")}
          />{" "}
          Tiered Lineup — draft a weekly 8-driver roster from 3 performance tiers, old-Yahoo-style
        </label>
      </div>

      {leagueType === "TIERED_DRAFT" ? (
        <>
          <h2>How Tiered Lineup works</h2>
          <p>
            Every week, drivers are sorted into three tiers (A, B, C) based on that week&apos;s performance/ranking.
            Each player drafts a lineup of 8 drivers: 1 starter + 1 bench from Tier A, 2 starters + 2 bench from
            Tier B, and 1 starter + 1 bench from Tier C.
          </p>
          <p>
            <strong>Lineup lock:</strong> your lineup locks at 2:00 AM Pacific on qualifying day. After that, you
            can still swap a starter for its bench counterpart (no new drivers) right up until 5 minutes before the
            race starts. If you never touch your lineup for a week, last week&apos;s carries over.
          </p>
          <p>
            <strong>Scoring:</strong> only the top 4 qualifiers score qualifying points (1st=10, 2nd=5, 3rd=3,
            4th=1) — every rostered driver, starter or bench, earns these. Starters additionally score finishing
            points, from 90 for the win down by 2 per position (43rd=6); bench drivers don&apos;t score finishing
            points at all, win or lose.
          </p>
          <p>None of the above is editable. The one rule you can set:</p>
          <div>
            <label htmlFor="maxStarts">Max times a player can START the same driver per season</label>
            <br />
            <input
              id="maxStarts"
              type="number"
              min={1}
              value={tieredConfig.maxStartsPerDriverPerSeason}
              onChange={(e) =>
                setTieredConfig({ maxStartsPerDriverPerSeason: Math.max(1, parseInt(e.target.value, 10) || 1) })
              }
            />{" "}
            (benching a driver doesn&apos;t count against this cap — only starting them does)
          </div>

          {createError && <p role="alert">{createError}</p>}

          <p>
            <button type="submit" disabled={creating}>
              {creating ? "Creating..." : "Create league"}
            </button>
          </p>
        </>
      ) : (
        <>
      <h2>Presets</h2>
      <p>
        <button type="button" onClick={() => applyPreset(PRESETS.nascarOfficial)}>
          NASCAR official points
        </button>{" "}
        <button type="button" onClick={() => applyPreset(PRESETS.ourDefault)}>
          Our default (1 pt/position, +10 win, +5 stage win)
        </button>
      </p>

      <h2>Editable Rules</h2>
      <div>
        <label htmlFor="picksPerWeek">Drivers picked per player per week</label>
        <br />
        <input
          id="picksPerWeek"
          type="number"
          min={1}
          max={10}
          value={config.picksPerWeek}
          onChange={(e) => setConfig((c) => ({ ...c, picksPerWeek: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
        />
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={unlimitedRepeats}
            onChange={(e) => {
              setUnlimitedRepeats(e.target.checked);
              setConfig((c) => ({ ...c, maxPicksPerDriverPerSeason: e.target.checked ? null : 1 }));
            }}
          />{" "}
          Unlimited repeat picks of the same driver
        </label>
        {!unlimitedRepeats && (
          <>
            <br />
            <label htmlFor="maxRepeats">Max times a player can pick the same driver per season</label>
            <br />
            <input
              id="maxRepeats"
              type="number"
              min={1}
              value={config.maxPicksPerDriverPerSeason ?? 1}
              onChange={(e) =>
                setConfig((c) => ({ ...c, maxPicksPerDriverPerSeason: Math.max(1, parseInt(e.target.value, 10) || 1) }))
              }
            />
          </>
        )}
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={config.includeNonPointsRaces}
            onChange={(e) => setConfig((c) => ({ ...c, includeNonPointsRaces: e.target.checked }))}
          />{" "}
          Include non-points races (e.g. the All-Star race)
        </label>
      </div>

      <div>
        <p>When do picks lock?</p>
        <label>
          <input
            type="radio"
            name="lockTiming"
            checked={config.lockTiming === "afterQualifying"}
            onChange={() => setConfig((c) => ({ ...c, lockTiming: "afterQualifying" }))}
          />{" "}
          After qualifying — picks lock 5 minutes before the race starts, informed by starting position
        </label>
        <br />
        <label>
          <input
            type="radio"
            name="lockTiming"
            checked={config.lockTiming === "beforeQualifying"}
            onChange={() => setConfig((c) => ({ ...c, lockTiming: "beforeQualifying" }))}
          />{" "}
          Before qualifying — picks lock blind, the moment qualifying begins
        </label>
      </div>

      <h2>Points Rules</h2>
      <div>
        <label>
          <input
            type="checkbox"
            checked={config.includeStagePoints}
            onChange={(e) => setConfig((c) => ({ ...c, includeStagePoints: e.target.checked }))}
          />{" "}
          Include stage points
        </label>
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={config.includeWinnerBonus}
            onChange={(e) => setConfig((c) => ({ ...c, includeWinnerBonus: e.target.checked }))}
          />{" "}
          Winner bonus
        </label>
        {config.includeWinnerBonus && (
          <>
            {" "}
            <input
              type="number"
              aria-label="Winner bonus value"
              value={config.winnerBonus}
              onChange={(e) => setConfig((c) => ({ ...c, winnerBonus: parseInt(e.target.value, 10) || 0 }))}
              style={{ width: "5em" }}
            />{" "}
            points added on top of 1st place&apos;s position points
          </>
        )}
      </div>

      <h3>Position points</h3>
      <div>
        <label>
          <input
            type="radio"
            name="pointsMode"
            checked={config.pointsMode === "fixed"}
            onChange={() => setConfig((c) => ({ ...c, pointsMode: "fixed" }))}
          />{" "}
          Fixed points matrix — each position is always worth the same, like real NASCAR points
        </label>
        <br />
        <label>
          <input
            type="radio"
            name="pointsMode"
            checked={config.pointsMode === "fieldSizeRelative"}
            onChange={() => setConfig((c) => ({ ...c, pointsMode: "fieldSizeRelative" }))}
          />{" "}
          Field-size relative — 1st place is worth however many cars started, scaling down each race
        </label>
      </div>

      {config.pointsMode === "fixed" ? (
        <>
          <p>Points awarded for each finishing position.</p>
          <div style={{ display: "flex", gap: "1em", flexWrap: "wrap" }}>
            {[0, 10, 20, 30].map((start) => (
              <table key={start}>
                <thead>
                  <tr>
                    <th>Pos</th>
                    <th>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 10 }, (_, i) => start + i).map((i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>
                        <input
                          type="number"
                          aria-label={`Points for position ${i + 1}`}
                          value={config.positionPoints[i]}
                          onChange={(e) => updatePositionPoint(i, parseInt(e.target.value, 10) || 0)}
                          style={{ width: "4em" }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
          <p>(Positions 1 through {MAX_FIELD_SIZE}.)</p>
        </>
      ) : (
        <p>
          A finisher scores (field size + 1 − finishing position) points — e.g. 1st in a 36-car field scores 36,
          last scores 1.
        </p>
      )}

      {config.includeStagePoints && (
        <>
          <h3>Stage points</h3>
          <p>Only the top {MAX_STAGE_POSITIONS} finishers of a stage score stage points.</p>
          <table>
            <thead>
              <tr>
                <th>Stage pos</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {config.stagePositionPoints.map((pts, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>
                    <input
                      type="number"
                      aria-label={`Stage points for position ${i + 1}`}
                      value={pts}
                      onChange={(e) => updateStagePoint(i, parseInt(e.target.value, 10) || 0)}
                      style={{ width: "4em" }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>Test these rules against real results</h2>
      {completedRaces.length === 0 ? (
        <p>No race has results entered yet — nothing to test against.</p>
      ) : (
        <>
          <label htmlFor="previewRace">Race</label>
          <br />
          <select id="previewRace" value={previewRaceId} onChange={(e) => setPreviewRaceId(e.target.value)}>
            {completedRaces.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>{" "}
          <button type="button" onClick={handlePreview} disabled={previewing}>
            {previewing ? "Testing..." : "Test"}
          </button>

          {previewError && <p role="alert">{previewError}</p>}

          {previewRows && (
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
          )}
        </>
      )}

      {createError && <p role="alert">{createError}</p>}

      <p>
        <button type="submit" disabled={creating}>
          {creating ? "Creating..." : "Create league"}
        </button>
      </p>
        </>
      )}
    </form>
  );
}
