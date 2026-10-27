import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest } from "../services/api.js";

const positions = ["GK", "DEF", "MID", "FWD"];
const formatRupees = (amount) => `₹${new Intl.NumberFormat("en-IN").format(amount)}`;

export default function PlayersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [teamsError, setTeamsError] = useState("");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const position = searchParams.get("position") || "";
  const teamId = searchParams.get("teamId") || "";

  useEffect(() => {
    apiRequest("/teams")
      .then(({ teams: results }) => { setTeams(results); setTeamsError(""); })
      .catch((requestError) => setTeamsError(requestError.message));
  }, []);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setError("");
    const query = new URLSearchParams();
    if (position) query.set("position", position);
    if (teamId) query.set("teamId", teamId);
    apiRequest(`/players${query.size ? `?${query.toString()}` : ""}`)
      .then(({ players: results }) => { if (active) { setPlayers(results); setError(""); setStatus("success"); } })
      .catch((requestError) => { if (active) { setError(requestError.message); setStatus("error"); } });
    return () => { active = false; };
  }, [position, teamId]);

  function updateFilter(key, value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  }

  return (
    <main className="players-page">
      <section className="page-intro">
        <p className="eyebrow"><span className="live-dot" /> THE PLAYER ROSTER / 02</p>
        <div className="page-title-row"><h1>Every player.<br /><span>Every possibility.</span></h1><p>Get to know the names behind the badge.<br />Your favorites are waiting to be discovered.</p></div>
      </section>
      <section className="roster-section">
        <p className="demo-notice">Fictional sample roster and prices for testing only — not actual SFL players or auction results.</p>
        <div className="roster-toolbar">
          <div><p className="eyebrow">SFL / SQUAD LIST</p><h2>The roster <span>{status === "success" ? `(${players.length})` : ""}</span></h2></div>
          <div className="filters">
            <label className="sr-only" htmlFor="team-filter">Filter by team</label>
            <select id="team-filter" value={teamId} onChange={(event) => updateFilter("teamId", event.target.value)}>
              <option value="">All teams</option>
              {teams.map((item) => <option value={item.shortName} key={item._id}>{item.name}</option>)}
            </select>
            <label className="sr-only" htmlFor="position-filter">Filter by position</label>
            <select id="position-filter" value={position} onChange={(event) => updateFilter("position", event.target.value)}>
              <option value="">All positions</option>
              {positions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>
        {teamsError && <p className="filter-error" role="alert">Team filters are unavailable: {teamsError}</p>}
        {status === "loading" && <p className="state-message">Loading the roster<span className="loading-dots">...</span></p>}
        {status === "error" && <p className="state-message error-state" role="alert">Couldn't load players: {error}</p>}
        {status === "success" && (players.length === 0 ? <p className="empty-message">No players match these filters.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>PLAYER</th><th>TEAM</th><th>POSITION</th><th>AUCTION PRICE</th><th>FANTASY PRICE</th></tr></thead>
              <tbody>{players.map((player, index) => (
                <tr key={player._id}>
                  <td><span className="player-number">{String(index + 1).padStart(2, "0")}</span><strong>{player.name}</strong></td>
                  <td><span className="team-pill">{player.teamId?.shortName}</span> {player.teamId?.name}</td>
                  <td><span className={`position-tag position-${player.position.toLowerCase()}`}>{player.position}</span></td>
                  <td>{formatRupees(player.auctionPrice)}</td>
                  <td className="fantasy-price">{formatRupees(player.fantasyPrice)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ))}
      </section>
    </main>
  );
}
