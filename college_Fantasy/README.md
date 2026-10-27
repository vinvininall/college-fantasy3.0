# SFL Fantasy

Foundation for Scaler Football League Fantasy: a React/Vite frontend and Express/MongoDB API with registration, login, JWT-protected profile access, and browsable teams and players.

## Production deployment (one Node web service)

Use the repository root as the service's root directory. Set the build command to
`npm ci && npm run build` and the start command to `npm start`.
The root install installs both the server and client dependencies. Express serves
the built frontend and API together, including direct links to frontend routes.

Set these environment variables on the hosting service:

- `MONGODB_URI`: your MongoDB connection string. Allow the host's outbound IP in Atlas Network Access.
- `JWT_SECRET`: a random secret of at least 32 characters.
- `NODE_ENV`: `production`.
- `CLIENT_ORIGIN`: your deployed HTTPS origin (no trailing slash).

Let the host supply `PORT`. Set the health-check path to `/api/health`.
The frontend uses `/api` on the same origin by default. If you host the frontend
separately, set `VITE_API_BASE_URL` to the backend's HTTPS URL ending in `/api`
**before building**, set `CLIENT_ORIGIN` to the frontend origin on the backend,
and configure the static host to rewrite frontend routes to `index.html`.

Do not upload or commit `node_modules`; install dependencies on the deployment
host so native packages match its operating system.

## Local requirements

- Node.js 20 or later and npm
- A MongoDB Atlas connection string (or a local MongoDB instance)

## Local setup

1. From the project root, install dependencies:

   ```sh
   npm install
   npm install --prefix server
   npm install --prefix client
   ```

2. Copy `.env.example` to `server/.env`. Set `MONGODB_URI` to your MongoDB connection string and replace `JWT_SECRET` with a random secret of at least 32 characters. For example, generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. The server checks this secret when it starts. Keep it only in the backend environment.

3. Start the app, sign in as an admin, and create a tournament. Copy its ID from `GET /api/tournaments`, then seed fictional demonstration teams and players into that tournament (all sample names and prices are invented for this project and are not real SFL auction results):

   ```sh
   npm run seed --prefix server -- TOURNAMENT_MONGODB_ID
   ```

   The seed uses tournament/team/player keys, so rerunning it does not create duplicates. It inserts missing demo records and leaves existing records untouched. In the sample data, fantasy price initially equals auction price.

4. Start both applications from the root:

   ```sh
   npm run dev
   ```

   The Vite frontend is at <http://localhost:5173> and the API is at <http://localhost:5000>. To run either independently, use `npm run dev:client` or `npm run dev:server`.

5. Check API and database readiness at <http://localhost:5000/api/health>. A healthy response includes `"status":"ok"` and `"database":"connected"`.

For Atlas, add your machine's IP to the project's Network Access allowlist and create a database user. Keep the connection string and JWT secret in `server/.env`; never commit that file.

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/health` | API and MongoDB readiness |
| POST | `/api/auth/register` | Create an account (`name`, `email`, `password`) |
| POST | `/api/auth/login` | Sign in; returns a bearer JWT and public user |
| GET | `/api/auth/me` | Current user; requires `Authorization: Bearer <token>` |
| GET | `/api/teams` | List teams |
| GET | `/api/teams/:id` | Get a team by MongoDB ID |
| GET | `/api/tournaments/:tournamentId/teams` | List teams in a tournament; requires sign-in |
| POST | `/api/tournaments/:tournamentId/teams` | Create a tournament team; admin only |
| PUT | `/api/teams/:teamId` | Update team details; admin only |
| DELETE | `/api/teams/:teamId` | Delete a team with no registered players; admin only |
| GET | `/api/players` | List players; optional `teamId` (MongoDB ID) and `position` filters |
| GET | `/api/players/:id` | Get a player by MongoDB ID |
| GET | `/api/teams/:teamId/players` | List players on a team; optional `position` filter |
| POST | `/api/teams/:teamId/players` | Register a player; admin only |
| PUT | `/api/players/:playerId` | Update player details; admin only |
| DELETE | `/api/players/:playerId` | Currently blocked until deletion safety can be verified; admin only |
| POST | `/api/tournaments` | Create a tournament; requires an authenticated admin |
| GET | `/api/tournaments` | List tournaments visible to the authenticated user |
| GET | `/api/tournaments/:id` | Get a tournament visible to the authenticated user |
| GET | `/api/tournaments/:tournamentId/my-squad` | Get the signed-in user's squad and calculated budget summary |
| POST | `/api/tournaments/:tournamentId/my-squad` | Safely create the signed-in user's squad if needed |
| POST | `/api/tournaments/:tournamentId/my-squad/players` | Add a player using `{ "playerId": "..." }` |
| DELETE | `/api/tournaments/:tournamentId/my-squad/players/:playerId` | Remove a selected player |
| PUT | `/api/tournaments/:tournamentId/my-squad/lineup` | Save starters using `{ "startingPlayerIds": ["..."] }` |
| PUT | `/api/tournaments/:tournamentId/my-squad/captain` | Set/clear captain and vice-captain IDs |

Registration always assigns the `user` role, even if a client sends a different role. Passwords must be at least 8 characters and no more than 72 UTF-8 bytes (bcrypt's input limit). Login uses the same generic error for an unknown email and a wrong password.

The browser keeps only the JWT in local storage (never the password), checks it against `/api/auth/me` on startup, and removes it on logout or when it is expired/invalid. Local storage is convenient for this demo but JavaScript running through an XSS bug can read the token. A production deployment should consider secure, HTTP-only cookies and additional CSRF protections. Team and player browsing is public in this demo.

### Authentication manual test checklist

1. Register with a new name, email, and password. Confirm the response has no `passwordHash` and the database stores a bcrypt hash with role `user`.
2. Try registering the same email with different capitalization. Confirm the API returns `409` and no second account is created.
3. Try registration with missing fields, an invalid email, or a password shorter than 8 characters. Confirm the API returns `400`.
4. Include `"role":"admin"` in a registration request. Confirm the returned and stored role is still `user`.
5. Log in with the correct credentials. Confirm the API returns a JWT and safe user profile; try a wrong password and an unknown email and confirm both return the same `401` message.
6. Request `/api/auth/me` without a token, with a malformed token, and with a valid login token. Confirm the first two return `401` and the valid token returns the matching profile.
7. In the browser, log in and confirm the dashboard shows your account. Refresh and confirm the session is restored. Log out and confirm the login/register links return and the saved token is removed.
8. Call `GET /api/health` and confirm it still reports the server/database status.

To point the frontend at a different API, set `VITE_API_BASE_URL` in `client/.env` (for example, `http://localhost:5000/api`). Set `CLIENT_ORIGIN` in `server/.env` to the allowed frontend origin; comma-separated origins are supported.

## Teams and Players

The Team and Player collections are separate. Each player stores `teamId`, which is the MongoDB ID of a Team document. This lets MongoDB connect a player to its team when the API returns the roster. Player prices are whole rupee numbers in two separate fields: `auctionPrice` and `fantasyPrice`. The fictional seed sets those two values equal at first.

Team and player browsing is public in the API; signed-in users can also browse tournaments and their rosters in the Tournaments interface. Only admins can create or edit teams and players. New teams must be created under a tournament, and each player is tied to its team. Tournament names and team lists are scoped to that tournament.

Team deletion returns `409 Conflict` while the team has players. Player deletion is intentionally blocked with `409 Conflict`: the application has no fantasy squad or match-history models to establish whether removing a player would break later records. Editing and registering players remains available to admins.

Example requests (with the API running locally):

```sh
curl http://localhost:5000/api/teams
curl http://localhost:5000/api/teams/TEAM_MONGODB_ID
curl http://localhost:5000/api/players
curl "http://localhost:5000/api/players?teamId=TEAM_MONGODB_ID"
curl "http://localhost:5000/api/players?position=MID"
curl "http://localhost:5000/api/players?teamId=TEAM_MONGODB_ID&position=MID"
curl http://localhost:5000/api/players/PLAYER_MONGODB_ID
```

Malformed MongoDB IDs and invalid positions return `400`; valid IDs without a matching record return `404`. A valid filter with no matching players returns `200` and an empty `players` list.

### Teams and Players manual test checklist

1. Create a tournament as an admin, copy its MongoDB ID, then run the seed command twice using that same ID. Confirm the count stays stable and sample players have `fantasyPrice` equal to `auctionPrice`.
2. As an admin, open `/tournaments`, choose the created tournament and add a team. Confirm the team appears only under that tournament.
3. Add a player to the team with valid name, position, prices, optional jersey number/photo. Confirm it appears in the selected team's roster.
4. Edit a team and player; confirm the changes appear after navigating away and back.
5. Sign in as a normal user. Browse the tournament, select teams, filter positions, and check fantasy and auction prices. Confirm no management controls appear.
6. As a normal user, call team/player `POST`, `PUT`, and `DELETE` endpoints; confirm `403`. Call a protected write without a token; confirm `401`.
7. Try malformed tournament/team/player IDs, invalid positions, negative/fractional prices, duplicate team names/short names within a tournament, and a player with a nonexistent team; confirm validation rejects each request.
8. Try deleting a team with players and a player; confirm both operations are blocked with `409` and no records are removed.
9. Create the same team name in a different tournament; confirm the tournaments have separate team records and rosters.
10. Confirm `/api/health` still reports the database connection. Re-test registration, login, refresh/session restoration, and logout using the authentication checklist above.

## Fantasy Squad Builder

Each user may have one `FantasySquad` per tournament. The collection stores references rather than copied player profiles:

- `userId`: authenticated owner (`User` reference).
- `tournamentId`: selected tournament (`Tournament` reference).
- `playerIds`: selected `Player` references.
- `startingPlayerIds`: the selected players currently assigned as starters.
- `captainId` and `viceCaptainId`: optional selected `Player` references.
- `createdAt` and `updatedAt`: Mongoose timestamps.

A unique database index on `{ userId, tournamentId }` prevents duplicate squads for the same user/tournament. The server derives the budget, squad size, and starter count from that tournament (including legacy tournament settings). It reads player fantasy prices from MongoDB whenever calculating squad spending; there is no client-editable `budgetRemaining` field. A failed add due to the budget, a full squad, a duplicate player, or a player from another tournament is rejected by the API. Removing a player removes them from the lineup and clears their captain assignment if applicable.

Partial squads and lineups can be saved. The response marks a squad complete only when it has the tournament's full squad size and the configured number of starters. Starters must be selected squad members and cannot exceed the configured requirement. Captain and vice-captain must be distinct squad members. This feature does not apply captain multipliers, position formation rules, or scoring.

Open a tournament and choose **Build your fantasy squad**. The builder filters its available players by real-world team and position, displays player fantasy prices, and shows selected players, starter assignments, captain choices, amount spent, budget remaining, and completion status. The route uses the existing API utility and JWT session; the API always derives ownership from the verified token, never from a request-body user ID.

### Fantasy Squad manual test checklist

1. Sign in as a normal user and open a tournament roster, then choose **Build your fantasy squad**. Confirm its displayed rules and budget match that tournament.
2. Add a player; confirm the selected count and amount spent update. Remove the player and confirm the cost becomes available again.
3. Try to add the same player twice, exceed the tournament squad size, exceed the budget, and select a player from another tournament using API requests; confirm the server rejects each.
4. Build a partial squad, refresh, and return to the builder. Confirm the partial squad persists and can be continued.
5. Select and save starters. Confirm an unselected player cannot be saved as a starter and the configured starter limit is enforced.
6. Set captain and vice-captain to distinct squad members; try setting the same player for both and a non-member; confirm the API rejects invalid choices.
7. Create two normal user accounts and build separate squads in the same tournament. Confirm each account sees and changes only its own squad.
8. Build squads in tournaments with different configured budgets and squad sizes; confirm those settings are applied independently.
9. Without a token, call every `my-squad` endpoint and confirm `401`. Confirm existing auth, tournament configuration, team/player management, and `/api/health` still work.

## Tournament Configuration

Each tournament has its own football and fantasy settings. The canonical football format is stored in `footballFormat` as `{ name, playersPerSide }`; supported formats are `5v5`, `6v6`, `7v7`, `9v9`, and `11v11`. The older `format` and `playersOnField` fields remain for compatibility with tournament documents created before this update.

Fantasy settings are stored separately from the real-world football format:

- `fantasyBudget`: integer rupees per fantasy manager (`₹1 crore = ₹10,000,000`).
- `fantasySquadSize`: total fantasy players.
- `startingPlayers`: fantasy starters. This cannot exceed the selected format's players per side.
- `substitutes`: fantasy bench players. `startingPlayers + substitutes` must equal `fantasySquadSize`.

For example, a 7v7 tournament can suggest 7 starters + 3 substitutes = a 10-player fantasy squad. The admin can customize these values; the fantasy squad is not automatically set to the real-world side size. The legacy `squadSize` and `budgetConfig` fields are also written for older clients. The manager's budget is not an individual real player's auction price.

Each new real-world team requires a `tournamentId` reference to its Tournament. The schema remains backward-compatible with existing teams that do not have this field; existing records are neither deleted nor assigned automatically. Players reference their real-world team through `teamId`, so their tournament can be found through that team. Team names and abbreviations are unique within a tournament, allowing separate colleges to reuse names in different competitions. The tournament creation page can associate unassigned legacy teams; admins can also add/manage teams from a tournament's roster page. Players are created and managed from their team's roster.

Only users with the existing `admin` role can create tournaments. Public registration always creates a `user`, so promote a trusted organizer account manually in MongoDB after registering it. In `mongosh`, connected to the same database as `MONGODB_URI`, run:

```javascript
db.users.updateOne(
  { email: "organizer@example.com" },
  { $set: { role: "admin" } }
)
```

Use the organizer's actual normalized email. The command changes only that account's role. Log out and back in (or refresh the session) to load the updated role in the frontend. Signed-in users can browse tournaments and rosters; only admins can create tournaments or manage teams and players. There is no public endpoint for changing roles.

### Existing database setup

Existing tournaments and teams are not deleted or bulk-rewritten. Older tournament records remain readable: the API derives the new response fields from their existing `format`, `playersOnField`, `squadSize`, `substitutes`, and `budgetConfig` values. Existing teams with no `tournamentId` remain unassigned and can be selected for a new tournament.

Older databases may have global unique indexes on team name and abbreviation. To allow the same team name/abbreviation in different tournaments while preventing duplicates within one tournament, run this **index-only** migration once:

```sh
npm run migrate:tournament-team-indexes --prefix server
```

It removes only the legacy global `name_1` and `shortName_1` unique indexes and creates partial unique indexes scoped by `tournamentId`. It does not change or delete team documents. No tournament data migration is required.

Example requests:

```sh
curl -X POST http://localhost:5000/api/tournaments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"name":"Campus Cup Demo","format":"7v7","fantasyBudget":15000000,"fantasySquadSize":10,"startingPlayers":7,"substitutes":3,"teamIds":["TEAM_MONGODB_ID"]}'

curl http://localhost:5000/api/tournaments \
  -H "Authorization: Bearer YOUR_TOKEN"

curl http://localhost:5000/api/tournaments/TOURNAMENT_MONGODB_ID \
  -H "Authorization: Bearer YOUR_TOKEN"

curl "http://localhost:5000/api/teams?tournamentId=TOURNAMENT_MONGODB_ID"
curl http://localhost:5000/api/tournaments/formats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

The create request above stores a per-manager budget of ₹1.5 crore (`15000000` INR). The API returns supported formats and suggested fantasy settings from `GET /api/tournaments/formats`, so the frontend does not maintain a separate format list. Team IDs are optional. The API ignores client-supplied internal fields such as `createdBy`, `status`, `playersOnField`, `footballFormat`, `squadSize`, and `_id`. Reusing an already assigned team returns `409`.

### Tournament manual test checklist

1. Register a user, then promote only the intended organizer to `admin` using the MongoDB command above. Sign in again as that organizer.
2. As a regular user, confirm `GET /api/tournaments` and `GET /api/tournaments/:id` list and open tournaments. Try `POST /api/tournaments`; confirm it returns `403`. Without a token, confirm tournament retrieval and writes return `401`.
3. In the organizer UI at `/tournaments`, create 5v5, 6v6, 7v7, 9v9, and 11v11 tournaments. Confirm field players update from the format response and defaults are suggested.
4. Change one or more suggested fantasy values, then change another form field and a format. Confirm manually edited values are not silently overwritten; confirm starters plus substitutes must equal squad size.
5. Select unassigned teams and create a tournament with a 1.5 crore budget. Confirm it stores `15000000` rupees and the selected team documents get that tournament's `tournamentId`.
6. Create a second tournament with a different budget and other teams; confirm each tournament retains its own settings. Confirm a team cannot be assigned twice.
7. Try invalid formats, starter count above the format, mismatched squad totals, fractional counts, zero/negative budgets, malformed/duplicate team IDs, and already assigned teams; confirm the API rejects them.
8. Try to send `createdBy`, `status`, `playersOnField`, `footballFormat`, `fantasySquadSize`, or `_id` in the request; confirm server-controlled values cannot be overridden.
9. As a regular authenticated user, try to create a tournament and confirm `403`. Confirm the tournament directory is available to signed-in users while tournament creation remains admin-only.
10. Confirm pre-existing tournament records remain accessible and show derived compatibility fields; check `/api/teams?tournamentId=<id>`, tournament roster pages, auth flows, and `/api/health`.

## Day 1 data model

`User`, `Team`, and `Player` are separate MongoDB collections. Player `teamId` values reference Team documents, and prices are integer rupee amounts. Password hashes are excluded by default from user queries and never returned by the API. Squad, fixture, event, and scoring data are intentionally left for later days.
