# CommunityHub

CommunityHub is a full-stack app for discovering and organising local events. Visitors can browse events without an account. Signed-in users can RSVP, manage their registrations, and host events of their own.

## Features

- Search events by keyword, location, or date and narrow results by category, price, or distance.
- Register and sign in with email and password. Email verification and Google sign-in are disabled by default.
- Join or withdraw from events. Registration respects event deadlines and capacity, including when multiple people try to claim the last spot at once.
- Create, edit, and cancel events with optional cover photos. Organisers can view attendee lists for their own events.
- Schedule single-day and multi-day events with time zone and daylight-saving handling.

## Tech stack

- **Frontend** — React, Vite, Tailwind CSS, and React Router
- **Backend** — Node.js, Express, and PostgreSQL
- **Authentication and scheduling** — bcrypt, JWT, and Temporal

## Run locally

Use Node.js 22.13 or later in the Node 22 series, npm, and Docker with Docker Compose. The included Compose file runs PostgreSQL 17.

### 1. Start PostgreSQL

From the repository root, with Docker running:

```sh
docker compose up -d
```

### 2. Configure and start the API

Create `server/.env` with the local database settings from the Compose file:

```dotenv
DB_HOST=localhost
DB_PORT=5433
DB_NAME=communityhub
DB_USER=communityhub
DB_PASSWORD=communityhub_dev_password
JWT_SECRET=replace-with-a-random-secret
```

Generate a value for `JWT_SECRET` with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and paste it into your local file. Keep `server/.env` out of version control.

From the repository root:

```sh
cd server
npm ci
```

For a fresh local database, create the tables and optionally seed six sample events:

> **Database reset:** `npm run create-tables` drops and recreates the app tables, deleting existing users, events, registrations, and cover photos. Skip it if your database is already set up and you want to keep its data.

```sh
npm run create-tables
npm run seed-events
```

Start the API at `http://localhost:5001`:

```sh
npm start
```

### 3. Start the frontend

Open a second terminal at the repository root:

```sh
cd client
npm ci
npm run dev
```

Open `http://localhost:5173` to browse events. If the sample dates have passed, use **Show all events** on the empty Upcoming view. Seeding again preserves existing sample dates.

## Tests

Run each command from its package directory.

| Directory | Command | Purpose |
| --- | --- | --- |
| `client/` | `npm test` | Run frontend tests |
| `client/` | `npm run build` | Verify the frontend production build |
| `server/` | `npm test` | Run backend tests |

To include PostgreSQL integration tests, start the local database and set `RUN_DB_TESTS=1` before running `npm test` from `server/`. In PowerShell:

```powershell
$env:RUN_DB_TESTS = '1'
npm test
```

See [DESIGN.md](DESIGN.md) for the interface design decisions.
