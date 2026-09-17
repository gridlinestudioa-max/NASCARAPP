"use client";

import { useState, useTransition } from "react";
import {
  MAX_FIELD_SIZE,
  MAX_STAGE_POSITIONS,
  PRESETS,
  type PickemRuleSetConfig,
} from "@/lib/scoring";
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
  const [config, setConfig] = useState<PickemRuleSetConfig>(() => clonePreset(PRESETS.ourDefault));
  const [unlimitedRepeats, setUnlimitedRepeats] = useState(true);

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
      const error = await createLeague(name, config);
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
    </form>
  );
}
