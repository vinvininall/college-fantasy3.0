import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../App.jsx";
import { apiRequest } from "../services/api.js";

const positions = ["GK", "DEF", "MID", "FWD"];
const money = (amount) => `₹${new Intl.NumberFormat("en-IN").format(amount ?? 0)}`;
const blankTeam = { name: "", shortName: "", logoUrl: "" };
const blankPlayer = { name: "", position: "MID", auctionPrice: "", fantasyPrice: "", jerseyNumber: "", photoUrl: "" };

export default function TournamentDetailsPage() {
  const { tournamentId } = useParams();
  const { token, user, loading: sessionLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const [tournament, setTournament] = useState(null);
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [players, setPlayers] = useState([]);
  const [position, setPosition] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [teamForm, setTeamForm] = useState(blankTeam);
  const [editingTeamId, setEditingTeamId] = useState("");
  const [playerForm, setPlayerForm] = useState(blankPlayer);
  const [editingPlayerId, setEditingPlayerId] = useState("");

  useEffect(() => {
    if (sessionLoading) return undefined;
    if (!token) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    Promise.all([
      apiRequest(`/tournaments/${encodeURIComponent(tournamentId)}`, { token }),
      apiRequest(`/tournaments/${encodeURIComponent(tournamentId)}/teams`, { token })
    ]).then(([{ tournament: record }, { teams: result }]) => {
      if (!active) return;
      setTournament(record);
      setTeams(result);
      setSelectedTeamId((current) => result.some(({ _id }) => _id === current) ? current : result[0]?._id ?? "");
    }).catch((requestError) => {
      if (active) setError(requestError.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [sessionLoading, token, tournamentId]);

  useEffect(() => {
    if (!selectedTeamId) {
      setPlayers([]);
      return undefined;
    }
    let active = true;
    setLoadingPlayers(true);
    setPlayers([]);
    setError("");
    const query = position ? `?position=${encodeURIComponent(position)}` : "";
    apiRequest(`/teams/${encodeURIComponent(selectedTeamId)}/players${query}`)
      .then(({ players: result }) => { if (active) setPlayers(result); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoadingPlayers(false); });
    return () => { active = false; };
  }, [selectedTeamId, position]);

  const selectedTeam = useMemo(
    () => teams.find(({ _id }) => _id === selectedTeamId) ?? null,
    [teams, selectedTeamId]
  );

  async function saveTeam(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const path = editingTeamId
        ? `/teams/${encodeURIComponent(editingTeamId)}`
        : `/tournaments/${encodeURIComponent(tournamentId)}/teams`;
      const { team } = await apiRequest(path, {
        method: editingTeamId ? "PUT" : "POST",
        token,
        body: JSON.stringify({
          name: teamForm.name,
          shortName: teamForm.shortName,
          logoUrl: teamForm.logoUrl
        })
      });
      setTeams((current) => editingTeamId
        ? current.map((item) => item._id === team._id ? team : item)
        : [...current, team].sort((a, b) => a.name.localeCompare(b.name)));
      if (!selectedTeamId) setSelectedTeamId(team._id);
      setTeamForm(blankTeam);
      setEditingTeamId("");
      setNotice(editingTeamId ? "Team updated." : "Team added to this tournament.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeTeam(team) {
    if (!window.confirm(`Delete ${team.name}? Teams with registered players cannot be deleted.`)) return;
    setError("");
    setNotice("");
    try {
      await apiRequest(`/teams/${encodeURIComponent(team._id)}`, { method: "DELETE", token });
      const remaining = teams.filter(({ _id }) => _id !== team._id);
      setTeams(remaining);
      if (selectedTeamId === team._id) setSelectedTeamId(remaining[0]?._id ?? "");
      setNotice("Team deleted.");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function savePlayer(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        name: playerForm.name,
        position: playerForm.position,
        auctionPrice: Number(playerForm.auctionPrice),
        fantasyPrice: Number(playerForm.fantasyPrice),
        jerseyNumber: playerForm.jerseyNumber ? Number(playerForm.jerseyNumber) : null,
        photoUrl: playerForm.photoUrl
      };
      const path = editingPlayerId
        ? `/players/${encodeURIComponent(editingPlayerId)}`
        : `/teams/${encodeURIComponent(selectedTeamId)}/players`;
      const { player } = await apiRequest(path, {
        method: editingPlayerId ? "PUT" : "POST",
        token,
        body: JSON.stringify(payload)
      });
      setPlayers((current) => editingPlayerId
        ? current.map((item) => item._id === player._id ? player : item)
        : [...current, player].sort((a, b) => a.name.localeCompare(b.name)));
      setPlayerForm(blankPlayer);
      setEditingPlayerId("");
      setNotice(editingPlayerId ? "Player updated." : "Player registered.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  if (sessionLoading || loading) {
    return <main className="empty-page"><p className="state-message">Loading tournament roster...</p></main>;
  }
  if (!user) {
    return <main className="empty-page"><p className="eyebrow">TOURNAMENT / SIGN IN</p><h1>Sign in to<br />view this roster.</h1><Link className="button" to="/login">Log in</Link></main>;
  }
  if (error && !tournament) {
    return <main className="empty-page"><p className="eyebrow">TOURNAMENT / ERROR</p><h1>Roster unavailable.</h1><p className="form-error" role="alert">{error}</p><Link className="button" to="/tournaments">Back to tournaments</Link></main>;
  }
  if (!tournament) return null;

  const format = tournament.footballFormat?.name ?? tournament.format;
  const playersPerSide = tournament.footballFormat?.playersPerSide ?? tournament.playersOnField;

  return (
    <main className="tournament-detail-page">
      <section className="page-intro">
        <p className="eyebrow"><span className="live-dot" /> {isAdmin ? "ORGANIZER TOOLS / TEAM & PLAYER ROSTER" : "TOURNAMENT ROSTER"}</p>
        <div className="page-title-row">
          <h1>{tournament.name}<br /><span>{format} football.</span></h1>
          <p>{playersPerSide} players per side · {tournament.fantasySquadSize ?? tournament.squadSize} fantasy squad<br />{money(tournament.fantasyBudget ?? tournament.budgetConfig?.amount)} budget per manager</p>
        </div>
        <Link to="/tournaments" className="text-link">← All tournaments</Link>
        <Link to={`/tournaments/${encodeURIComponent(tournamentId)}/squad`} className="button tournament-squad-link">Build your fantasy squad <span aria-hidden="true">↗</span></Link>
      </section>

      <section className="tournament-roster-layout">
        <aside className="roster-team-panel">
          <div className="section-heading">
            <div><p className="eyebrow">PARTICIPATING TEAMS</p><h2>Real-world<br /><span>teams.</span></h2></div>
            <span className="section-count">{String(teams.length).padStart(2, "0")}</span>
          </div>
          {teams.length === 0 && <p className="empty-message">No teams have been added to this tournament yet.</p>}
          <div className="roster-team-list">
            {teams.map((team) => (
              <article className={`roster-team-card ${selectedTeamId === team._id ? "roster-team-selected" : ""}`} key={team._id}>
                <button className="roster-team-select" onClick={() => setSelectedTeamId(team._id)}>
                  <span className="team-monogram">{team.shortName?.slice(0, 2)}</span>
                  <span><strong>{team.name}</strong><small>{team.shortName}</small></span>
                </button>
                {isAdmin && (
                  <div className="roster-card-actions">
                    <button type="button" className="button-quiet" onClick={() => {
                      setEditingTeamId(team._id);
                      setTeamForm({ name: team.name, shortName: team.shortName, logoUrl: team.logoUrl ?? "" });
                    }}>Edit</button>
                    <button type="button" className="button-quiet roster-delete-button" onClick={() => removeTeam(team)}>Delete</button>
                  </div>
                )}
              </article>
            ))}
          </div>
          {isAdmin && (
            <form className="roster-edit-form" onSubmit={saveTeam}>
              <p className="eyebrow">{editingTeamId ? "EDIT TEAM" : "ADD A TEAM"}</p>
              <label className="tournament-field">Team name<input value={teamForm.name} onChange={(event) => setTeamForm({ ...teamForm, name: event.target.value })} maxLength={100} required /></label>
              <label className="tournament-field">Short name<input value={teamForm.shortName} onChange={(event) => setTeamForm({ ...teamForm, shortName: event.target.value })} minLength={2} maxLength={6} required /></label>
              <label className="tournament-field">Logo URL (optional)<input type="url" value={teamForm.logoUrl} onChange={(event) => setTeamForm({ ...teamForm, logoUrl: event.target.value })} /></label>
              <div className="roster-form-actions">
                <button className="button" disabled={saving}>{saving ? "Saving..." : editingTeamId ? "Save team" : "Add team"}</button>
                {editingTeamId && <button type="button" className="button-quiet" onClick={() => { setEditingTeamId(""); setTeamForm(blankTeam); }}>Cancel</button>}
              </div>
            </form>
          )}
        </aside>

        <section className="roster-player-panel">
          <div className="section-heading roster-toolbar">
            <div><p className="eyebrow">PLAYER ROSTER</p><h2>{selectedTeam?.name ?? "Select a team"} <span>{selectedTeam ? ` / ${selectedTeam.shortName}` : ""}</span></h2></div>
            <label className="filters">Position
              <select value={position} onChange={(event) => setPosition(event.target.value)}>
                <option value="">All positions</option>
                {positions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>
          {!selectedTeam && teams.length > 0 && <p className="empty-message">Select a team to see its players.</p>}
          {selectedTeam && loadingPlayers && <p className="state-message">Loading players...</p>}
          {selectedTeam && !loadingPlayers && players.length === 0 && <p className="empty-message">No players match this roster filter yet.</p>}
          {selectedTeam && !loadingPlayers && players.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>PLAYER</th><th>POSITION</th><th>FANTASY PRICE</th><th>AUCTION PRICE</th>{isAdmin && <th>MANAGE</th>}</tr></thead>
                <tbody>
                  {players.map((player) => (
                    <tr key={player._id}>
                      <td><strong>{player.name}</strong>{player.jerseyNumber && <span className="roster-jersey"> #{player.jerseyNumber}</span>}</td>
                      <td><span className="position-tag">{player.position}</span></td>
                      <td>{money(player.fantasyPrice)}</td>
                      <td>{money(player.auctionPrice)}</td>
                      {isAdmin && <td><button className="button-quiet" onClick={() => {
                        setEditingPlayerId(player._id);
                        setPlayerForm({
                          name: player.name,
                          position: player.position,
                          auctionPrice: String(player.auctionPrice),
                          fantasyPrice: String(player.fantasyPrice),
                          jerseyNumber: player.jerseyNumber ? String(player.jerseyNumber) : "",
                          photoUrl: player.photoUrl ?? ""
                        });
                      }}>Edit</button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {isAdmin && selectedTeam && (
            <form className="roster-edit-form player-edit-form" onSubmit={savePlayer}>
              <p className="eyebrow">{editingPlayerId ? "EDIT PLAYER" : "REGISTER PLAYER"}</p>
              <label className="tournament-field">Player name<input value={playerForm.name} onChange={(event) => setPlayerForm({ ...playerForm, name: event.target.value })} maxLength={100} required /></label>
              <label className="tournament-field">Position<select value={playerForm.position} onChange={(event) => setPlayerForm({ ...playerForm, position: event.target.value })}>{positions.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="tournament-field">Fantasy price (₹)<input type="number" min="0" step="1" value={playerForm.fantasyPrice} onChange={(event) => setPlayerForm({ ...playerForm, fantasyPrice: event.target.value })} required /></label>
              <label className="tournament-field">Auction price (₹)<input type="number" min="0" step="1" value={playerForm.auctionPrice} onChange={(event) => setPlayerForm({ ...playerForm, auctionPrice: event.target.value })} required /></label>
              <label className="tournament-field">Jersey number<input type="number" min="1" max="99" step="1" value={playerForm.jerseyNumber} onChange={(event) => setPlayerForm({ ...playerForm, jerseyNumber: event.target.value })} /></label>
              <label className="tournament-field">Photo URL (optional)<input type="url" value={playerForm.photoUrl} onChange={(event) => setPlayerForm({ ...playerForm, photoUrl: event.target.value })} /></label>
              <div className="roster-form-actions tournament-field-wide">
                <button className="button" disabled={saving}>{saving ? "Saving..." : editingPlayerId ? "Save player" : "Register player"}</button>
                {editingPlayerId && <button type="button" className="button-quiet" onClick={() => { setEditingPlayerId(""); setPlayerForm(blankPlayer); }}>Cancel</button>}
                <span className="field-hint">Player deletion is unavailable until squad and match-history safety checks exist.</span>
              </div>
            </form>
          )}
          {error && <p className="form-error roster-message" role="alert">{error}</p>}
          {notice && <p className="success-message roster-message" role="status">{notice}</p>}
        </section>
      </section>
    </main>
  );
}
