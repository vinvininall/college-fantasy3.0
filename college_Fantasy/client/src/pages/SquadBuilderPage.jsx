import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../App.jsx";
import { apiRequest } from "../services/api.js";

const positions = ["GK", "DEF", "MID", "FWD"];
const money = (amount) => `₹${new Intl.NumberFormat("en-IN").format(amount ?? 0)}`;
const idOf = (value) => (typeof value === "string" ? value : value?._id);

export default function SquadBuilderPage() {
  const { tournamentId } = useParams();
  const { token, user, loading: sessionLoading } = useAuth();
  const [tournament, setTournament] = useState(null);
  const [teams, setTeams] = useState([]);
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [squad, setSquad] = useState(null);
  const [summary, setSummary] = useState(null);
  const [rules, setRules] = useState(null);
  const [teamFilter, setTeamFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [startingPlayerIds, setStartingPlayerIds] = useState([]);
  const [captainId, setCaptainId] = useState("");
  const [viceCaptainId, setViceCaptainId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function applySquadResponse(response) {
    setSquad(response.squad);
    setSummary(response.summary);
    setRules(response.rules);
    setStartingPlayerIds(response.squad?.startingPlayerIds ?? []);
    setCaptainId(response.squad?.captainId ?? "");
    setViceCaptainId(response.squad?.viceCaptainId ?? "");
  }

  async function fetchSquad() {
    const result = await apiRequest(`/tournaments/${encodeURIComponent(tournamentId)}/my-squad`, { token });
    if (result.squad) return result;
    return apiRequest(`/tournaments/${encodeURIComponent(tournamentId)}/my-squad`, {
      method: "POST",
      token,
      body: JSON.stringify({})
    });
  }

  useEffect(() => {
    if (sessionLoading) return undefined;
    if (!user || !token) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      apiRequest(`/tournaments/${encodeURIComponent(tournamentId)}`, { token }),
      apiRequest(`/tournaments/${encodeURIComponent(tournamentId)}/teams`, { token }),
      fetchSquad()
    ]).then(async ([{ tournament: record }, { teams: tournamentTeams }, squadResponse]) => {
      const playerResults = await Promise.all(tournamentTeams.map(({ _id }) =>
        apiRequest(`/teams/${encodeURIComponent(_id)}/players`)
      ));
      if (!active) return;
      setTournament(record);
      setTeams(tournamentTeams);
      setAvailablePlayers(playerResults.flatMap(({ players }) => players));
      applySquadResponse(squadResponse);
    }).catch((requestError) => {
      if (active) setError(requestError.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [sessionLoading, token, user, tournamentId]);

  const selectedIds = useMemo(
    () => new Set(squad?.playerIds?.map((player) => player._id) ?? []),
    [squad]
  );
  const squadPlayers = squad?.playerIds ?? [];
  const visiblePlayers = availablePlayers.filter((player) => (
    (!teamFilter || idOf(player.teamId) === teamFilter)
      && (!positionFilter || player.position === positionFilter)
  ));

  async function runSquadChange(path, options, successMessage) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      applySquadResponse(await apiRequest(path, { ...options, token }));
      setNotice(successMessage);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function addPlayer(player) {
    runSquadChange(
      `/tournaments/${encodeURIComponent(tournamentId)}/my-squad/players`,
      { method: "POST", body: JSON.stringify({ playerId: player._id }) },
      `${player.name} added to your squad.`
    );
  }

  function removePlayer(player) {
    runSquadChange(
      `/tournaments/${encodeURIComponent(tournamentId)}/my-squad/players/${encodeURIComponent(player._id)}`,
      { method: "DELETE" },
      `${player.name} removed. Their price is available again.`
    );
  }

  async function saveLineup() {
    await runSquadChange(
      `/tournaments/${encodeURIComponent(tournamentId)}/my-squad/lineup`,
      { method: "PUT", body: JSON.stringify({ startingPlayerIds }) },
      "Starting lineup saved."
    );
  }

  async function saveCaptains() {
    await runSquadChange(
      `/tournaments/${encodeURIComponent(tournamentId)}/my-squad/captain`,
      {
        method: "PUT",
        body: JSON.stringify({
          captainId: captainId || null,
          viceCaptainId: viceCaptainId || null
        })
      },
      "Captain selections saved."
    );
  }

  if (sessionLoading || loading) {
    return <main className="empty-page"><p className="state-message">Loading your fantasy squad...</p></main>;
  }
  if (!user) {
    return <main className="empty-page"><p className="eyebrow">SQUAD BUILDER / SIGN IN</p><h1>Log in to<br />build your squad.</h1><Link to="/login" className="button">Log in</Link></main>;
  }
  if (error && !tournament) {
    return <main className="empty-page"><p className="eyebrow">SQUAD BUILDER / ERROR</p><h1>Squad unavailable.</h1><p className="form-error" role="alert">{error}</p><Link to="/tournaments" className="button">Back to tournaments</Link></main>;
  }
  if (!tournament || !summary || !rules) return null;

  const isFull = summary.selected >= summary.squadSize;
  const lineupIsComplete = summary.starters === summary.requiredStarters;
  const squadIsComplete = summary.complete;
  const lineupIsDirty = startingPlayerIds.length !== squad.startingPlayerIds.length
    || startingPlayerIds.some((id, index) => id !== squad.startingPlayerIds[index]);

  return (
    <main className="squad-builder-page">
      <section className="page-intro">
        <p className="eyebrow"><span className="live-dot" /> FANTASY SQUAD BUILDER</p>
        <div className="page-title-row">
          <h1>{tournament.name}<br /><span>Pick your squad.</span></h1>
          <p>Build at your own pace. Your tournament's real rules<br />and each player's current fantasy price apply.</p>
        </div>
        <Link to={`/tournaments/${encodeURIComponent(tournamentId)}`} className="text-link">← Back to teams and players</Link>
      </section>

      <section className="squad-builder-content">
        <div className="squad-summary-bar" aria-live="polite">
          <div><span>SQUAD</span><strong>{summary.selected}/{summary.squadSize}</strong></div>
          <div><span>STARTERS</span><strong>{summary.starters}/{summary.requiredStarters}</strong></div>
          <div><span>SPENT</span><strong>{money(summary.spent)}</strong></div>
          <div><span>REMAINING</span><strong>{money(summary.remainingBudget)}</strong></div>
          <span className={`squad-completion ${squadIsComplete ? "squad-complete" : ""}`}>
            {squadIsComplete ? "SQUAD COMPLETE" : "IN PROGRESS"}
          </span>
        </div>

        <div className="squad-builder-columns">
          <section className="squad-player-browser">
            <div className="section-heading squad-heading">
              <div><p className="eyebrow">PLAYER MARKET</p><h2>Choose <span>players.</span></h2></div>
              <span className="section-count">{String(visiblePlayers.length).padStart(2, "0")} AVAILABLE</span>
            </div>
            <div className="squad-filters">
              <label className="tournament-field">Real-world team
                <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}>
                  <option value="">All tournament teams</option>
                  {teams.map((team) => <option key={team._id} value={team._id}>{team.name}</option>)}
                </select>
              </label>
              <label className="tournament-field">Position
                <select value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)}>
                  <option value="">All positions</option>
                  {positions.map((position) => <option key={position} value={position}>{position}</option>)}
                </select>
              </label>
            </div>
            {availablePlayers.length === 0 && <p className="empty-message">This tournament has no registered players yet.</p>}
            {availablePlayers.length > 0 && visiblePlayers.length === 0 && <p className="empty-message">No players match these filters.</p>}
            <div className="squad-player-list">
              {visiblePlayers.map((player) => {
                const selected = selectedIds.has(player._id);
                return (
                  <article className="squad-player-card" key={player._id}>
                    <div className="squad-player-identity">
                      <span className="position-tag">{player.position}</span>
                      <div><strong>{player.name}</strong><small>{player.teamId?.name ?? "Team"}</small></div>
                    </div>
                    <strong className="squad-player-price">{money(player.fantasyPrice)}</strong>
                    <button
                      type="button"
                      className={selected ? "button-quiet" : "button button-small"}
                      disabled={saving || (!selected && isFull)}
                      onClick={() => selected ? removePlayer(player) : addPlayer(player)}
                    >
                      {selected ? "Remove" : isFull ? "Squad full" : "Add player"}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          <aside className="fantasy-squad-panel">
            <div className="section-heading squad-heading">
              <div><p className="eyebrow">YOUR TEAM</p><h2>Fantasy <span>squad.</span></h2></div>
              <span className="section-count">{summary.selected} / {summary.squadSize}</span>
            </div>
            <p className="squad-rule-note">
              {money(rules.budget)} budget · {rules.squadSize} total players · {rules.startingPlayers} starters
            </p>
            {squadPlayers.length === 0 && <p className="empty-message">Your squad is empty. Add players from the list; you can save a partial squad and return later.</p>}
            <div className="squad-selected-list">
              {squadPlayers.map((player) => {
                const playerId = player._id;
                const isStarter = startingPlayerIds.includes(playerId);
                return (
                  <article className="squad-selected-card" key={playerId}>
                    <label className="starter-toggle">
                      <input
                        type="checkbox"
                        checked={isStarter}
                        disabled={saving || (!isStarter && startingPlayerIds.length >= rules.startingPlayers)}
                        onChange={(event) => setStartingPlayerIds((current) => event.target.checked
                          ? [...current, playerId]
                          : current.filter((id) => id !== playerId))}
                      />
                      Starter
                    </label>
                    <div><strong>{player.name}</strong><small>{player.position} · {player.teamId?.name}</small></div>
                    <strong className="squad-player-price">{money(player.fantasyPrice)}</strong>
                    <button type="button" className="button-quiet roster-delete-button" disabled={saving} onClick={() => removePlayer(player)}>Remove</button>
                  </article>
                );
              })}
            </div>
            {summary.selected < summary.squadSize && (
              <p className="squad-guidance">{summary.squadSize - summary.selected} more player(s) needed to fill the squad.</p>
            )}
            {!lineupIsComplete && (
              <p className="squad-guidance">{Math.max(0, summary.requiredStarters - startingPlayerIds.length)} more starter(s) needed for the required lineup.</p>
            )}
            <button type="button" className="button squad-save-button" onClick={saveLineup} disabled={saving || !lineupIsDirty}>
              {saving ? "Saving..." : "Save starting lineup"}
            </button>
            <p className="field-hint">Partial lineups and squads can be saved while you build. Completion requires the full squad and required starters.</p>

            <div className="captain-fields">
              <label className="tournament-field">Captain
                <select value={captainId} onChange={(event) => setCaptainId(event.target.value)}>
                  <option value="">Not selected</option>
                  {squadPlayers.map((player) => <option key={player._id} value={player._id}>{player.name}</option>)}
                </select>
              </label>
              <label className="tournament-field">Vice-captain
                <select value={viceCaptainId} onChange={(event) => setViceCaptainId(event.target.value)}>
                  <option value="">Not selected</option>
                  {squadPlayers.map((player) => <option key={player._id} value={player._id}>{player.name}</option>)}
                </select>
              </label>
              <button type="button" className="button button-quiet" onClick={saveCaptains} disabled={saving}>
                Save captain choices
              </button>
            </div>
          </aside>
        </div>
        {error && <p className="form-error squad-feedback" role="alert">{error}</p>}
        {notice && <p className="success-message squad-feedback" role="status">{notice}</p>}
      </section>
    </main>
  );
}
