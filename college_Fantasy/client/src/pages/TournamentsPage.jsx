import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../services/api.js";
import { useAuth } from "../App.jsx";

const RUPEES_PER_CRORE = 10_000_000;
const formatRupees = (amount) => `₹${new Intl.NumberFormat("en-IN").format(amount)}`;

function suggestedSettings(format) {
  return {
    startingPlayers: format.defaultStartingPlayers,
    substitutes: format.defaultSubstitutes,
    fantasySquadSize: format.defaultFantasySquadSize
  };
}

export default function TournamentsPage() {
  const { token, user, loading: sessionLoading } = useAuth();
  const [formats, setFormats] = useState([]);
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState({
    name: "",
    format: "",
    fantasySquadSize: "",
    startingPlayers: "",
    substitutes: "",
    budgetCrores: "1.5",
    teamIds: []
  });
  const [customSettings, setCustomSettings] = useState({
    fantasySquadSize: false,
    startingPlayers: false,
    substitutes: false
  });
  const [tournaments, setTournaments] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [optionsError, setOptionsError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!token) {
      setLoadingList(false);
      setLoadingOptions(false);
      return undefined;
    }

    let active = true;
    const isAdmin = user?.role === "admin";
    setLoadingList(true);
    setListError("");
    if (isAdmin) {
      setLoadingOptions(true);
      apiRequest("/tournaments/formats", { token })
        .then(({ formats: availableFormats }) => {
          if (!active) return;
          setFormats(availableFormats);
          const firstFormat = availableFormats[0];
          if (firstFormat) {
            setForm((current) => ({
              ...current,
              format: firstFormat.name,
              ...suggestedSettings(firstFormat)
            }));
          }
        })
        .catch((requestError) => { if (active) setOptionsError(requestError.message); })
        .finally(() => { if (active) setLoadingOptions(false); });

      apiRequest("/teams", { token })
        .then(({ teams: availableTeams }) => { if (active) setTeams(availableTeams); })
        .catch((requestError) => { if (active) setOptionsError(requestError.message); });
    } else {
      setLoadingOptions(false);
    }
    apiRequest("/tournaments", { token })
      .then(({ tournaments: result }) => { if (active) setTournaments(result); })
      .catch((requestError) => { if (active) setListError(requestError.message); })
      .finally(() => { if (active) setLoadingList(false); });

    return () => { active = false; };
  }, [token, user?.role]);

  if (sessionLoading) {
    return <main className="empty-page"><p className="state-message">Checking your session...</p></main>;
  }
  if (!user) {
    return <main className="empty-page"><p className="eyebrow">TOURNAMENTS / SIGN IN</p><h1>Sign in to<br />browse tournaments.</h1><Link to="/login" className="button">Log in</Link></main>;
  }
  const isAdmin = user.role === "admin";

  const selectedFormat = formats.find(({ name }) => name === form.format);
  const playersPerSide = selectedFormat?.playersPerSide ?? 0;
  const budgetAmount = Number(form.budgetCrores) * RUPEES_PER_CRORE;
  const selectedTeamCount = form.teamIds.length;

  function updateFormat(name) {
    const nextFormat = formats.find((format) => format.name === name);
    const previousFormat = formats.find((format) => format.name === form.format);
    if (!nextFormat) return;

    const previousDefaults = previousFormat ? suggestedSettings(previousFormat) : {};
    const nextDefaults = suggestedSettings(nextFormat);
    setForm((current) => ({
      ...current,
      format: name,
      fantasySquadSize: customSettings.fantasySquadSize
        ? current.fantasySquadSize
        : String(nextDefaults.fantasySquadSize),
      startingPlayers: customSettings.startingPlayers
        ? current.startingPlayers
        : String(nextDefaults.startingPlayers),
      substitutes: customSettings.substitutes
        ? current.substitutes
        : String(nextDefaults.substitutes)
    }));
    if (!previousDefaults.fantasySquadSize) {
      setCustomSettings({ fantasySquadSize: false, startingPlayers: false, substitutes: false });
    }
  }

  function updateCount(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setCustomSettings((current) => ({ ...current, [field]: true }));
  }

  function updateTeamSelection(teamId, checked) {
    setForm((current) => ({
      ...current,
      teamIds: checked
        ? [...current.teamIds, teamId]
        : current.teamIds.filter((id) => id !== teamId)
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    const fantasySquadSize = Number(form.fantasySquadSize);
    const startingPlayers = Number(form.startingPlayers);
    const substitutes = Number(form.substitutes);

    if (!form.name.trim()) {
      setError("Enter a tournament name.");
      return;
    }
    if (!selectedFormat) {
      setError("Choose a supported football format.");
      return;
    }
    if (!Number.isSafeInteger(fantasySquadSize) || fantasySquadSize < 1) {
      setError("Fantasy squad size must be a positive whole number.");
      return;
    }
    if (!Number.isSafeInteger(startingPlayers) || startingPlayers < 1
      || startingPlayers > fantasySquadSize || startingPlayers > playersPerSide) {
      setError(`Starting players must be a whole number from 1 to ${Math.min(fantasySquadSize, playersPerSide)}.`);
      return;
    }
    if (!Number.isSafeInteger(substitutes) || substitutes < 0
      || startingPlayers + substitutes !== fantasySquadSize) {
      setError("Starting players and substitutes must add up to the fantasy squad size.");
      return;
    }
    if (!Number.isSafeInteger(budgetAmount) || budgetAmount < 1) {
      setError("Enter a positive budget in crores that converts to whole rupees.");
      return;
    }
    setSubmitting(true);
    try {
      const { tournament } = await apiRequest("/tournaments", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: form.name.trim(),
          format: form.format,
          fantasyBudget: budgetAmount,
          fantasySquadSize,
          startingPlayers,
          substitutes,
          teamIds: form.teamIds
        })
      });
      setTournaments((current) => [tournament, ...current]);
      setNotice("Tournament created successfully.");
      setForm({
        name: "",
        format: form.format,
        ...suggestedSettings(selectedFormat),
        budgetCrores: "1.5",
        teamIds: []
      });
      setCustomSettings({ fantasySquadSize: false, startingPlayers: false, substitutes: false });
      setTeams((current) => current.map((team) => (
        tournament.teams.some(({ _id }) => _id === team._id)
          ? { ...team, tournamentId: { _id: tournament._id, name: tournament.name } }
          : team
      )));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="tournaments-page">
      <section className="page-intro">
        <p className="eyebrow"><span className="live-dot" /> {isAdmin ? "ORGANIZER TOOLS / 03" : "TOURNAMENT DIRECTORY / 03"}</p>
        <div className="page-title-row">
          <h1>{isAdmin ? <>Set the rules.<br /><span>Start your tournament.</span></> : <>Find your<br /><span>tournament.</span></>}</h1>
          <p>{isAdmin ? <>Every tournament keeps its own format,<br />squad rules, and manager budget.</> : <>Choose a tournament to view its teams<br />and player roster.</>}</p>
        </div>
      </section>
      <section className={`tournament-content ${isAdmin ? "" : "tournament-content-browse"}`}>
        {isAdmin && <div className="tournament-form-panel">
          <p className="eyebrow">NEW TOURNAMENT</p>
          <h2>Configure the competition.</h2>
          {optionsError && <p className="form-error" role="alert">{optionsError}</p>}
          {loadingOptions ? <p className="state-message">Loading tournament settings...</p> : (
            <form className="tournament-form" onSubmit={handleSubmit}>
              <label className="tournament-field tournament-field-wide">
                Tournament name
                <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={120} minLength={2} required />
              </label>
              <label className="tournament-field">
                Football format
                <select value={form.format} onChange={(event) => updateFormat(event.target.value)} required>
                  {formats.map((format) => <option key={format.name} value={format.name}>{format.name}</option>)}
                </select>
              </label>
              <div className="field-count-card">
                <span>PLAYERS PER SIDE</span>
                <strong>{playersPerSide}</strong>
              </div>
              <label className="tournament-field">
                Fantasy squad size
                <input type="number" min="1" step="1" value={form.fantasySquadSize} onChange={(event) => updateCount("fantasySquadSize", event.target.value)} required />
              </label>
              <label className="tournament-field">
                Starting players
                <input type="number" min="1" max={Math.min(Number(form.fantasySquadSize) || 1, playersPerSide)} step="1" value={form.startingPlayers} onChange={(event) => updateCount("startingPlayers", event.target.value)} required />
              </label>
              <label className="tournament-field">
                Bench substitutes
                <input type="number" min="0" max={Math.max(0, Number(form.fantasySquadSize) - (Number(form.startingPlayers) || 0))} step="1" value={form.substitutes} onChange={(event) => updateCount("substitutes", event.target.value)} required />
                <span className="field-hint">Starting players + substitutes must equal squad size.</span>
              </label>
              <label className="tournament-field">
                Budget per manager (crores)
                <input type="number" min="0.0000001" step="any" value={form.budgetCrores} onChange={(event) => setForm({ ...form, budgetCrores: event.target.value })} required />
                <span className="field-hint">
                  {Number.isSafeInteger(budgetAmount) && budgetAmount > 0
                    ? `${formatRupees(budgetAmount)} stored in MongoDB`
                    : "Budget is converted to whole rupees before saving."}
                </span>
              </label>
              <fieldset className="team-select-field tournament-field-wide">
                <legend>Real-world teams in this tournament (optional)</legend>
                {teams.length === 0 && <span className="field-hint">No teams found. Add teams before creating a tournament.</span>}
                <div className="team-select-list">
                  {teams.map((team) => (
                    <label className={`team-select-option ${team.tournamentId ? "team-select-assigned" : ""}`} key={team._id}>
                      <input
                        type="checkbox"
                        checked={form.teamIds.includes(team._id)}
                        disabled={Boolean(team.tournamentId)}
                        onChange={(event) => updateTeamSelection(team._id, event.target.checked)}
                      />
                      <span>{team.name} <small>{team.shortName}</small></span>
                      {team.tournamentId && <small>Assigned to {team.tournamentId.name}</small>}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="tournament-summary tournament-field-wide" aria-live="polite">
                <p className="eyebrow">CONFIGURATION SUMMARY</p>
                <strong>{form.name.trim() || "Your tournament"} / {form.format || "Choose a format"}</strong>
                <span>{playersPerSide} players per side · {form.startingPlayers || 0} starters + {form.substitutes || 0} substitutes = {form.fantasySquadSize || 0} fantasy players</span>
                <span>{Number.isSafeInteger(budgetAmount) && budgetAmount > 0 ? formatRupees(budgetAmount) : "Set a valid budget"} per manager · {selectedTeamCount} teams selected</span>
              </div>
              {error && <p className="form-error tournament-message" role="alert">{error}</p>}
              {notice && <p className="success-message tournament-message" role="status">{notice}</p>}
              <button className="button form-submit tournament-submit" disabled={submitting || loadingOptions || formats.length === 0}>
                {submitting ? "Creating tournament..." : "Create tournament"} <span aria-hidden="true">↗</span>
              </button>
            </form>
          )}
        </div>}
        <div className="tournament-list-panel">
          <div className="section-heading">
            <div><p className="eyebrow">{isAdmin ? "YOUR TOURNAMENTS" : "AVAILABLE TOURNAMENTS"}</p><h2>{isAdmin ? <>Saved <span>configurations.</span></> : <>Browse <span>competitions.</span></>}</h2></div>
            <span className="section-count">{String(tournaments.length).padStart(2, "0")} TOTAL</span>
          </div>
          {loadingList && <p className="state-message">Loading tournaments<span className="loading-dots">...</span></p>}
          {!loadingList && listError && <p className="state-message error-state" role="alert">Couldn't load tournaments: {listError}</p>}
          {!loadingList && !listError && tournaments.length === 0 && <p className="empty-message">{isAdmin ? "No tournaments yet. Create one to save its rules." : "No tournaments are available yet."}</p>}
          {!loadingList && !listError && tournaments.length > 0 && (
            <div className="tournament-list">
              {tournaments.map((tournament) => (
                <Link className="tournament-card tournament-card-link" to={`/tournaments/${tournament._id}`} key={tournament._id}>
                  <div className="tournament-card-heading"><h3>{tournament.name}</h3><span className={`tournament-status status-${tournament.status.toLowerCase()}`}>{tournament.status}</span></div>
                  <div className="tournament-card-format">{tournament.footballFormat?.name ?? tournament.format}<span> / {tournament.footballFormat?.playersPerSide ?? tournament.playersOnField} PER SIDE</span></div>
                  <dl>
                    <div><dt>Fantasy squad</dt><dd>{tournament.fantasySquadSize ?? tournament.squadSize}</dd></div>
                    <div><dt>Starting / bench</dt><dd>{tournament.startingPlayers} / {tournament.substitutes}</dd></div>
                    <div><dt>Budget / manager</dt><dd>{formatRupees(tournament.fantasyBudget ?? tournament.budgetConfig?.amount)}</dd></div>
                  </dl>
                  <div className="tournament-card-teams">
                    <strong>Teams</strong>
                    <span>{tournament.teams?.length ? tournament.teams.map(({ name }) => name).join(", ") : "No teams assigned"}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
