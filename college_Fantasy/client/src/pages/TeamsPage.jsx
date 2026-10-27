import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../services/api.js";

function TeamCards({ teams }) {
  if (teams.length === 0) return <p className="empty-message">No teams yet. Run the sample data seed to get started.</p>;
  return (
    <div className="team-grid">
      {teams.map((team, index) => (
        <Link to={`/players?teamId=${encodeURIComponent(team._id)}`} className="team-card" key={team._id}>
          <div className="team-card-top"><span className="team-index">SFL / {String(index + 1).padStart(2, "0")}</span><span className="team-arrow" aria-hidden="true">↗</span></div>
          <div className="team-monogram">{team.shortName.slice(0, 1)}</div>
          <div className="team-card-bottom"><div><h3>{team.name}</h3><p>SCALER FOOTBALL LEAGUE</p></div><strong>{team.shortName}</strong></div>
        </Link>
      ))}
    </div>
  );
}

export default function TeamsPage({ compact = false }) {
  const [teams, setTeams] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest("/teams")
      .then(({ teams: results }) => { if (active) { setTeams(results); setStatus("success"); } })
      .catch((requestError) => { if (active) { setError(requestError.message); setStatus("error"); } });
    return () => { active = false; };
  }, []);

  return (
    <section className={`teams-section ${compact ? "teams-compact" : ""}`}>
      <div className="section-heading">
        <div><p className="eyebrow">THE CLUBS / 01</p><h2>Meet the <span>lineup.</span></h2></div>
        <span className="section-count">{status === "success" ? `${String(teams.length).padStart(2, "0")} TEAMS` : "SFL / TEAMS"}</span>
      </div>
      <p className="demo-notice">Fictional demo teams and players. This is sample content, not the official SFL roster.</p>
      {status === "loading" && <p className="state-message">Loading the teams<span className="loading-dots">...</span></p>}
      {status === "error" && <p className="state-message error-state" role="alert">Couldn't load teams: {error}</p>}
      {status === "success" && <TeamCards teams={teams} />}
      {compact && <Link to="/players" className="text-link">View all players <span aria-hidden="true">↗</span></Link>}
    </section>
  );
}
