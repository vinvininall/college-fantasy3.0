import { createContext, useContext, useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { ApiError } from "./services/api.js";
import { clearStoredToken, fetchCurrentUser, getStoredToken, storeToken } from "./services/auth.js";
import AuthPage from "./pages/AuthPage.jsx";
import TeamsPage from "./pages/TeamsPage.jsx";
import PlayersPage from "./pages/PlayersPage.jsx";
import TournamentsPage from "./pages/TournamentsPage.jsx";
import TournamentDetailsPage from "./pages/TournamentDetailsPage.jsx";
import SquadBuilderPage from "./pages/SquadBuilderPage.jsx";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function Navigation() {
  const { user, loading, logout } = useAuth();
  return (
    <header className="topbar">
      <Link to="/" className="brand"><span className="brand-mark">S</span><span>SFL<span className="brand-light"> FANTASY</span></span></Link>
      <nav aria-label="Main navigation">
        <NavLink to="/" end>Teams</NavLink>
        <NavLink to="/players">Players</NavLink>
        {user && <NavLink to="/dashboard">My account</NavLink>}
        {user && <NavLink to="/tournaments">Tournaments</NavLink>}
      </nav>
      <div className="nav-account">
        {loading ? <span className="welcome">Checking session...</span> : user ? (
          <><span className="welcome">Hi, {user.name.split(" ")[0]}</span><button className="button button-quiet" onClick={logout}>Log out</button></>
        ) : (
          <><NavLink className="nav-login" to="/login">Log in</NavLink><Link className="button button-small" to="/register">Join now</Link></>
        )}
      </div>
    </header>
  );
}

function DashboardPage() {
  const { user, loading, error, retrySession } = useAuth();

  if (loading) {
    return <main className="empty-page"><p className="state-message">Checking your session...</p></main>;
  }
  if (!user) {
    return <main className="empty-page"><p className="eyebrow">ACCOUNT / SIGN IN</p><h1>Your SFL account<br />is waiting.</h1>{error && <><p className="error-state" role="alert">Could not validate your saved session: {error}</p><button className="button button-quiet retry-button" onClick={retrySession}>Try again</button></>}<Link to="/login" className="button">Log in <span aria-hidden="true">↗</span></Link></main>;
  }

  return (
    <main className="empty-page dashboard-page">
      <p className="eyebrow"><span className="live-dot" /> YOUR SFL ACCOUNT</p>
      <h1>Welcome to<br /><span>{user.name}.</span></h1>
      <p className="dashboard-email">{user.email}</p>
      <p className="dashboard-note">Your account is ready. Team and player browsing is open to everyone.</p>
      <Link to="/players" className="button">Explore players <span aria-hidden="true">↗</span></Link>
    </main>
  );
}

function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><span className="live-dot" /> SCALER FOOTBALL LEAGUE</p>
          <h1>The next big<br /><span>match starts here.</span></h1>
          <p className="hero-description">Meet the teams. Know the players. Your SFL story starts on the pitch.</p>
          <Link to="/players" className="button">Explore the players <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="ball">⚽</div>
          <span className="art-label">SEASON 01<br /><strong>READY TO PLAY</strong></span>
          <span className="art-number">01</span>
        </div>
        <div className="hero-foot"><span>BUILT FOR THE LOVE OF THE GAME</span><span>01 — 04 / TEAMS</span></div>
      </section>
      <TeamsPage compact />
    </main>
  );
}

function NotFound() {
  return <main className="empty-page"><p className="eyebrow">404 / OFFSIDE</p><h1>That page is<br />out of play.</h1><Link to="/" className="button">Back to teams</Link></main>;
}

export default function App() {
  const [auth, setAuth] = useState({ token: null, user: null, loading: true, error: null });
  const [sessionAttempt, setSessionAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const token = getStoredToken();
    if (!token) {
      setAuth({ token: null, user: null, loading: false, error: null });
      return () => { active = false; };
    }
    fetchCurrentUser(token)
      .then(({ user }) => { if (active) setAuth({ token, user, loading: false, error: null }); })
      .catch((requestError) => {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 401) {
          clearStoredToken();
          setAuth({ token: null, user: null, loading: false, error: null });
          return;
        }
        setAuth({ token, user: null, loading: false, error: requestError.message });
      });
    return () => { active = false; };
  }, [sessionAttempt]);

  const login = (token, user) => {
    storeToken(token);
    setAuth({ token, user, loading: false, error: null });
  };
  const logout = () => {
    clearStoredToken();
    setAuth({ token: null, user: null, loading: false, error: null });
  };

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, retrySession: () => setSessionAttempt((attempt) => attempt + 1) }}>
      <Navigation />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/tournaments" element={<TournamentsPage />} />
        <Route path="/tournaments/:tournamentId" element={<TournamentDetailsPage />} />
        <Route path="/tournaments/:tournamentId/squad" element={<SquadBuilderPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <footer className="site-footer"><span>SFL FANTASY</span><span>MADE FOR THE BEAUTIFUL GAME.</span><span>SCALER FOOTBALL LEAGUE · 2026</span></footer>
    </AuthContext.Provider>
  );
}
