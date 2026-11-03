# CommunityHub — Project Handover for OpenAI Codex

> **Purpose:** Transfer the project context, implemented work, decisions, and next steps from the ChatGPT development conversation to Codex, which has access to the local Git repository.
>
> **Evidence standard:** This document reflects the conversation and code shared in it. It is **not** an independent audit of the current local repository. Items marked **Verify** must be checked against the actual files, database, and Git history before Codex changes anything.
>
> **Status at handover:** MVP planning is agreed. Development was paused at **Milestone 1, Step 2: adapt the Express backend and seed data to a proposed multi-day event schema**. A destructive development database reset has **not been confirmed as executed**.

## 1. Project overview

### Product and purpose

**CommunityHub** is a full-stack web application for discovering, attending, creating, and managing local community events. Its intended users are **local residents and community organisations equally**. Residents should be able to find activities and manage attendance; organisers should be able to publish events, manage registrations, and see who is attending.

The project takes inspiration from the event-discovery side of Meetup but is **not intended to clone Meetup**. In particular, **groups, group memberships, social feeds, and messaging are explicitly outside the current MVP**; groups may be revisited after launch.

### Core MVP journeys

1. **Resident:** Browse upcoming events without logging in; search and filter; inspect event details; register/log in to attend; cancel registration; view registered events in a profile.
2. **Organiser:** Log in; create an event; edit/delete only their own events; see their created events; configure event timing, registration rules, and capacity; eventually view attendee lists and manage cancellations.

The same personal account can both attend and organise events. **Separate organisation accounts and organisation profiles are not required for v1.** An optional organisation-profile model was discussed as a possible later extension, not selected as MVP work.

### Agreed event search filters

| Filter | Agreed behaviour | Default |
| --- | --- | --- |
| Keyword | Case-insensitive search across **title and description** | Any |
| Location / city | Search by city or event location | Any |
| Distance radius | Radius around a selected location; planned choices 5, 10, 25, 50 miles or any distance | **10 miles**, but **not applied** until a location is selected |
| Category | Filter by event type | All categories |
| Date | Find events occurring on the selected date, **including multi-day events overlapping that date** | Any |
| Event lifecycle | Upcoming, ongoing, past, or all | **Upcoming** |
| Pricing | Free, paid, or all | All |
| Joinability | Joinable, unavailable/registration expired, or all | All |

Filters should combine with **AND** semantics (keyword matches title **OR** description). Longer term, filtering should be performed by PostgreSQL via the Express API, with pagination, shareable URL parameters, reset controls, and useful empty states.

### MVP scope and exclusions

**In scope:** Authentication; event CRUD; discovery/filtering; multi-day events and time zones; optional registration deadlines; attendance registration/cancellation; attendee counts; capacity; organiser attendee list; clear lifecycle/availability statuses; responsive/accessibility polish; tests, security, documentation, and deployment.

**Out of scope for v1:** Groups, memberships, direct messages, social feeds, ticket checkout/payment processing, advanced analytics, recommendation algorithms, and native mobile apps. **Paid events in the MVP are informational listings**; storing a price does not mean implementing payments.

## 2. Technical architecture

### Confirmed technologies and development environment

- **Frontend:** React, Vite, React Router, Tailwind CSS v4; JavaScript/JSX.
- **Backend:** Node.js, Express, JavaScript ES modules (`import`/`export`).
- **Database:** PostgreSQL 17, run through Docker; Node `pg` connection pool.
- **Authentication:** `bcrypt` for password hashing, JSON Web Tokens (JWT), a custom `requireAuth` middleware.
- **Environment/configuration:** `dotenv/config` in `server/db.js`; backend secrets in `server/.env`, which should remain Git-ignored.
- **Development tools:** Windows/PowerShell, VS Code, GitHub Desktop; project is now connected to a local Git repository through Codex.
- **Previously used local addresses:** Express `http://localhost:5001`, Vite usually `http://localhost:5173`, PostgreSQL host port `5433`. **Verify** active ports and Docker configuration.

Exact package versions, npm scripts, Docker service names, test tooling, and deployment configuration have **not** been verified from the repository.

### Project structure described in the conversation

```text
CommunityHub/
├── client/
│   └── src/
│       ├── components/
│       │   ├── Header/Header.jsx
│       │   ├── Hero/
│       │   ├── EventCard/EventCard.jsx
│       │   ├── Events/
│       │   └── Footer/
│       ├── context/AuthContext.jsx
│       ├── pages/
│       │   ├── Home.jsx
│       │   ├── Events.jsx
│       │   ├── EventDetails.jsx
│       │   ├── CreateEvent.jsx
│       │   ├── EditEvent.jsx
│       │   ├── Login.jsx
│       │   ├── Register.jsx
│       │   └── Profile.jsx
│       ├── App.jsx
│       ├── App.css
│       ├── index.css
│       └── main.jsx
├── server/
│   ├── middleware/requireAuth.js
│   ├── createTables.js
│   ├── logTables.js
│   ├── seedEvents.js
│   ├── db.js
│   ├── server.js
│   └── .env             # secrets; do not commit
├── schema.sql
├── docker-compose.yml
├── README.md
└── .gitignore
```

**Verify** this tree in the local checkout; it reflects files discussed, not a fresh directory listing.

### Original database schema (confirmed from user-pasted code)

- `users`: `id` identity PK; `name`; unique `email`; `password_hash`; `created_at`.
- `events`: `id` identity PK; `title`; `description`; `date DATE`; `time TIME`; `location`; nullable `created_by` referencing `users(id) ON DELETE SET NULL`; `created_at`.
- `event_attendees`: `id` identity PK; `user_id` FK with cascade deletion; `event_id` FK with cascade deletion; `created_at`; unique `(user_id, event_id)`.

Both root `schema.sql` and `server/createTables.js` originally dropped and recreated all three tables in dependency order inside a transaction. This is **intentionally destructive development-only behaviour**. It deletes users, events, and registrations.

### Backend endpoints discussed / implemented

| Method | Route | Purpose / behaviour |
| --- | --- | --- |
| GET | `/` | Basic server endpoint |
| GET | `/api/test-db` | Database connectivity check |
| GET | `/api/events` | Event listing; at the earlier stage, upcoming events only, with attendee counts |
| GET | `/api/events/:id` | Single event including attendee count; includes past events |
| POST | `/api/events` | Authenticated event creation; creator is authenticated user |
| PUT | `/api/events/:id` | Authenticated owner-only edit |
| DELETE | `/api/events/:id` | Authenticated owner-only delete |
| POST | `/api/auth/register` | Account creation with bcrypt password hash |
| POST | `/api/auth/login` | Login and JWT issuance |
| GET | `/api/users/me/events` | Authenticated user's registered events, including past |
| GET | `/api/users/me/created-events` | Authenticated user's created events, including past |
| POST | `/api/events/:id/register` | Authenticated registration; duplicate prevention; event-start restriction |
| GET | `/api/events/:id/registration` | Intended registration-status lookup; **Verify route exists** (see known issue below) |
| DELETE | `/api/events/:id/register` | Authenticated cancellation of registration |

**Important known discrepancy:** A full `server/server.js` shared earlier in the conversation reportedly **did not contain** `GET /api/events/:id/registration`, although `EventDetails.jsx` depends on it. The prior assistant flagged this repeatedly. **Codex should check and repair this if still missing**, without duplicating a route that may have been added since.

### Prior event queries and rules

The original `GET /api/events` query filtered out events once their **start** passed:

```sql
SELECT e.*, COUNT(ea.id)::integer AS attendee_count
FROM events e
LEFT JOIN event_attendees ea ON ea.event_id = e.id
WHERE (e.date + e.time) >= LOCALTIMESTAMP
GROUP BY e.id
ORDER BY e.date ASC, e.time ASC;
```

The original detail query did not exclude past events and included `attendee_count`. The registration endpoint checked `(date + time) > LOCALTIMESTAMP` and used `ON CONFLICT DO NOTHING` for duplicate registrations, returning a conflict for an already registered user. `requireAuth.js` decoded the bearer JWT into `req.user.userId`. Tokens were described as expiring after **1 hour**.

**Verify** exact current implementations. The old `date`/`time` SQL will be incompatible with the proposed new schema after reset.

### Frontend architecture

- `AuthContext.jsx` provides `{ user, login, logout }`, storing token/user in **`sessionStorage`**. `main.jsx` wraps the app in `AuthProvider`.
- Header changes navigation based on authentication.
- `Events.jsx` fetches `/api/events`, filters by title/location and date on the client in the earlier implementation, and renders `EventCard` components.
- `EventCard.jsx` shows event metadata and attendee count, linking to `/events/:id`.
- `EventDetails.jsx` shows event information, attendee count, registration status/actions, and owner-only edit/delete controls.
- `CreateEvent.jsx` and `EditEvent.jsx` create/update events; edit checks ownership.
- `Profile.jsx` includes account details, **My Registered Events** with cancellation, and **My Created Events** with view/edit links.

A previous frontend change added a clock/timer (15-second updates) to `EventDetails.jsx` to display **Registration Closed** once the start time passes. **Verify** whether that version was copied into the local repository.

## 3. What we have completed

The following work was described as implemented in the conversation; **not all changes have been independently tested against the current local checkout**.

### Functional foundation

1. Account registration and login with hashed passwords and JWT authentication.
2. Authenticated event creation; organiser-only editing and deletion.
3. Event browsing and event details.
4. Event registration and cancellation, with uniqueness enforced at the database level.
5. Profile showing a user's registered events.
6. Profile **My Created Events** section.
7. Hide started/past events from public event listings (under the **old** start-time-only definition).
8. Reject event creation/editing with invalid or past start dates/times.
9. Show attendee counts on event cards and detail pages; update detail count immediately after successful registration.
10. Prevent registrations after an event starts at the API level; show a frontend **Registration Closed** state.

### Previously completed priority-one checklist

- Hide past/started events from public listings.
- Validate event creation/edit dates and times.
- Add My Created Events to profile.
- Display attendee counts.
- Close registration when events start.

These were considered the first development milestone, **subject to end-to-end testing**. Some behaviour will intentionally change when multi-day event lifecycle support is implemented: ongoing and past events should become discoverable via explicit status filters.

### Known code and data details

- A previously shared `validateEventDateTime(date, time)` helper validated `YYYY-MM-DD` and `HH:MM` or `HH:MM:SS`, checked calendar validity, and required the start to be in the future.
- The earlier `server/seedEvents.js` inserted **three sample events dated May 2027**, with `created_by = NULL`. Re-running it could duplicate sample events. **Verify** actual seed data before relying on it.
- The earlier event list passed `attendeeCount={event.attendee_count}` into `EventCard`.
- A development checkpoint was committed at some point, but **the exact commit hash and which changes it contains are unknown**.

## 4. Important decisions and rationale

### Product decisions

- **Equal focus on residents and organisations:** Both event discovery and organiser management are first-class journeys.
- **Events first:** Build a focused event platform, not a Meetup clone; postpone groups and social features.
- **One account can both attend and organise:** Avoid premature role/account-type complexity.
- **All eight filters are in the intended MVP:** Keyword, city, distance, category, date, lifecycle, price, and joinability.
- **Upcoming is the default event view:** Users can deliberately select ongoing, past, or all events.
- **Distance defaults to 10 miles only when a search origin is provided:** Do not silently geolocate users or apply a meaningless radius with no location.
- **Paid event listings do not imply payments:** Show pricing information; defer checkout/payment processing.

### Event timing and registration decisions

- **Support multi-day events**, including a full end date and time, not merely an end time.
- **Support event time zones.** The discussion proposed `Europe/London` as the development default, but this should not be treated as the only supported time zone.
- **Allow an optional registration deadline.** Without one, registration closes at event start. With one, registration closes at the **earlier of deadline and start**.
- **Do not allow standard registration after the event starts**, even if the event is ongoing; late registration is not in the MVP.
- **Upcoming:** current instant before start; **ongoing:** start reached but end not reached; **past:** end reached.
- **Joinability is independent of lifecycle:** A future event can be unavailable because of a deadline, capacity, or cancellation.
- **Date search must use overlap semantics** for multi-day events.
- Event cancellation should be represented explicitly; a cancelled event is not simply a past event.

### Engineering decisions

- Keep existing React/Express/PostgreSQL architecture; expand `GET /api/events` with query parameters rather than introducing a separate search service.
- Prefer server-side SQL filtering, validation, sorting, and pagination as search complexity grows.
- Use parameterised SQL and enforce security/ownership/registration rules **in the backend**, not only in the UI.
- **Development database resets are permitted** because the user explicitly confirmed the project is still in development. However, resets are destructive and should be deliberate; **never run one without checking the user's current data and readiness**.
- Make changes **incrementally, one feature at a time**, with verification after each stage.

## 5. Current state and outstanding issues

### Exact handoff point

The most recent implementation discussion was:

1. User pasted the complete original `schema.sql` and `server/createTables.js`.
2. The assistant proposed replacing `events.date` / `events.time` with `start_date` / `start_time` and adding `end_date`, `end_time`, `timezone`, and `registration_deadline`.
3. The assistant supplied an updated `server/createTables.js` as paste-ready code and referred to an updated `schema.sql` as a download.
4. The user said **“next”**.
5. The assistant identified **Milestone 1, Step 2**: update `server/server.js` and `server/seedEvents.js` for the new columns, validation, lifecycle, and registration deadlines, and requested those files.
6. The user moved development to Codex **before providing the current backend files or completing that step**.

**Do not assume the schema files were saved to Git or that the reset was run.** The conversation does not confirm either action. The original full `schema.sql` is visible in the conversation; the exact contents of the previously downloadable updated `schema.sql` were not pasted in the transcript. Codex should inspect the actual repository.

### Proposed `createTables.js` event schema (assistant-supplied, not verified as applied)

```sql
CREATE TABLE events (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  start_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_date DATE NOT NULL,
  end_time TIME NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/London',
  registration_deadline TIMESTAMPTZ,
  location VARCHAR(255) NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT events_end_after_start CHECK (
    (end_date + end_time) > (start_date + start_time)
  ),
  CONSTRAINT events_deadline_not_after_start CHECK (
    registration_deadline IS NULL OR
    registration_deadline <= ((start_date + start_time) AT TIME ZONE timezone)
  )
);
```

The supplied `createTables.js` retained the original `users` and `event_attendees` definitions and transactional drop/recreate logic. **Verify** that the root `schema.sql` and `server/createTables.js` are identical in meaning before resetting.

### Risks / outstanding verification

1. **Schema/backend mismatch:** Existing API SQL, forms, and seed data use `date`/`time`; the proposed schema uses `start_date`/`start_time` and adds required end fields. A reset before updating dependent code will break the application.
2. **Registration-status endpoint:** Check whether `GET /api/events/:id/registration` exists; an earlier full backend file omitted it despite frontend usage.
3. **Time zones:** The earlier implementation compared PostgreSQL `LOCALTIMESTAMP`, Node `Date`, and browser-local times without a unified time-zone policy. Multi-day events and registration deadlines need **consistent instant-based comparisons**, including daylight-saving transitions. `TIMESTAMPTZ` and explicit IANA zones are relevant; verify behaviour rather than assuming local timestamps are interchangeable.
4. **Date/time validation:** Check calendar validity, end strictly after start, future start for new events, deadline not after start, and clear edit semantics for events that have begun. Database constraints alone do not cover all business rules.
5. **Concurrency:** Capacity limits and registrations will eventually need atomic enforcement to prevent overbooking; frontend-only checks are insufficient.
6. **Seed script:** Update old columns and required fields; avoid accidental duplicate seeds.
7. **Frontend deployment status:** Confirm the latest `EventDetails.jsx` registration-closed changes and attendee count changes are present.
8. **Auth/session behaviour:** Session storage and one-hour JWT expiry were used; verify how the UI handles expired tokens and 401 responses.
9. **Reset consequences:** Users, events, registrations, and all test data are lost when `createTables.js` runs. Check current database and ensure user approval before execution.
10. **No verified tests/deployment:** Automated tests, deployment and production hardening remain planned, not completed.
11. **No completed search overhaul:** Existing client-side title/location/date search should not be confused with the agreed eight-filter system.

### First actions for Codex (inspection only)

- Inspect `git status`, recent commits, and working-tree changes; **do not overwrite uncommitted work**.
- Inspect `schema.sql`, `server/createTables.js`, `server/server.js`, `server/seedEvents.js`, `server/db.js`, `server/middleware/requireAuth.js`.
- Inspect `client/src/pages/{Events,EventDetails,CreateEvent,EditEvent,Profile}.jsx`, `client/src/components/EventCard/EventCard.jsx`, `client/src/context/AuthContext.jsx`, and route setup.
- Check `package.json` scripts, Docker Compose, `.gitignore`, and any existing tests.
- Determine whether the DB has been reset and which schema actually exists before running destructive scripts.
- Report discrepancies between this handover and the checked-out code, then propose the smallest safe next change.

## 6. Next steps and priorities

### Immediate next task — Milestone 1, Step 2

**Adapt backend and seed data to the agreed multi-day event model**, after verifying the schema files in the repository.

Recommended incremental sequence:

1. **Audit current files** and reconcile `schema.sql` / `createTables.js` with the proposed schema. Clarify any missing or inconsistent field definitions before running SQL.
2. **Update backend event validation and CRUD** to accept `start_date`, `start_time`, `end_date`, `end_time`, `timezone`, and optional `registration_deadline`. Preserve auth, ownership, and attendee counts.
3. **Update event listing/detail queries** to support correct lifecycle states. Preserve detail access to past events. Define consistent time-zone conversion and comparisons.
4. **Update registration/status/cancellation endpoints** to enforce the earlier of deadline and start; ensure the frontend's registration-status endpoint exists.
5. **Update `seedEvents.js`** for required fields and useful upcoming/ongoing/past sample scenarios.
6. **Update frontend Create/Edit forms**, then event cards/details/profile/listings, to use the new data model and display start/end, deadline, and lifecycle appropriately.
7. **With explicit user approval**, reset the development database, seed, recreate an account, and run end-to-end tests. The user has allowed resets in principle, but Codex should still confirm readiness before destructive execution.

The user prefers **one step at a time**, not a large simultaneous refactor. Steps 2–6 above are a roadmap, not authorization to change everything at once.

### Subsequent MVP milestones

**Milestone 2 — Event discovery**

- Categories and filtering (earlier examples: Sports, Education, Volunteering, Social, Arts & Culture, Health & Wellbeing, Family & Kids; **final taxonomy not locked**).
- Keyword search across title/description.
- Structured city/location search.
- Geocoded location and radius search (5/10/25/50 miles or unrestricted).
- Date filtering with multi-day overlap semantics.
- Pricing fields (`price`, `currency`) and free/paid filtering, without payment processing.
- Combined backend filters, pagination, reset, URL query parameters, loading/empty states.

**Milestone 3 — Attendance management**

- Optional event capacity, remaining spaces, atomic overbooking prevention.
- Joinable/unavailable filtering based on lifecycle, deadline, capacity, and cancellation.
- Owner-only attendee list, with attention to appropriate disclosure of attendee personal data.
- Explicit event cancellation state and clear UX.

**Milestone 4 — User experience**

- Better success/error messages instead of basic alerts.
- Mobile responsiveness, keyboard accessibility, labels, feedback, and consistent loading/error states.

**Milestone 5 — Launch readiness**

- Automated frontend/backend tests and end-to-end verification.
- Security and reliability review (auth, validation, CORS, errors, concurrency, time zones).
- Replace destructive reset workflow with proper migrations **before production**.
- README/setup instructions, documentation, and deployment of frontend, backend, and database.

### Definition of MVP done

A resident can reliably discover, filter, register for, and manage events; an organiser can create, manage, cancel, and monitor events/attendees; all eight filters work together; lifecycle and registration rules are correct; mobile/desktop UX is usable; backend constraints are enforced; and the app is tested and deployed.

## 7. Working preferences and collaboration rules

- **Work one feature or change at a time.** Explain the purpose, make the change, then give concrete test/verification steps before moving on.
- The user often asks for **complete, paste-ready files** or directly applied changes, not vague snippets. Since Codex is connected to the local Git repository, prefer **small, precise edits to existing files**, with a summary of what changed and how to test.
- **Preserve existing functionality**. Review full files before editing so that auth, owner checks, attendee counts, registration cancellation, and profile functionality are not accidentally removed.
- Keep explanations **clear, practical, and learning-oriented**, without overwhelming the user with unrelated improvements.
- The user uses **Windows/PowerShell, VS Code, and GitHub Desktop**. Provide commands compatible with that environment; don't assume Unix-only shell syntax.
- The user values **Git checkpoints/commits**. Suggest concise, descriptive commit messages at completed milestones, but do not assume a commit has been made unless verified.
- The user explicitly said **development database resets are acceptable**. Still state clearly what will be deleted, inspect the current state, and request confirmation before running destructive commands.
- Avoid unrequested features, especially groups and social functionality. Prioritise the agreed MVP.
- **Do not implement product-planning discussions automatically**: the user explicitly requested planning-only in several preceding turns. The immediate next coding task is the backend adaptation, but Codex should confirm scope before editing.

## 8. Important context and safeguards

### Distinguish implemented, proposed, and verified

- **Implemented in conversation:** The original auth/event/registration flows and Priority 1 changes were worked through, but the exact current Git state requires verification.
- **Proposed and code supplied:** The revised `createTables.js` with multi-day event columns. Its application to the local repository and DB is **unconfirmed**.
- **Planned only:** The complete eight-filter search system, multi-day frontend/backend support, capacity, pricing, organiser attendee lists, cancellation status, advanced search, tests, and deployment.

### Do not undo intentional decisions

- Do **not** reintroduce groups or separate organisation account types into the MVP.
- Do **not** remove past events from all API access: the new search specification explicitly allows filtering to ongoing and past events; profile history and event details need historical access.
- Do **not** treat “ongoing” as “joinable”: standard registration closes at event start.
- Do **not** apply the 10-mile radius without a selected origin.
- Do **not** implement payment processing just because paid-event filtering is planned.
- Do **not** rely on frontend checks alone for permissions, registration deadlines, duplicate prevention, or future capacity enforcement.
- Do **not** reset the DB casually or use the development reset script in production.
- Do **not** hardcode `Europe/London` as a universal time zone; it was a proposed default, not a requirement that all events occur there.
- Do **not** invent missing file contents, migration history, test results, or Git commits. Inspect the checkout and report uncertainty.

### Unresolved details requiring deliberate decisions

- Final representation of event instants (`start_date`/`start_time`/`end_date`/`end_time` plus IANA zone vs `starts_at`/`ends_at` `TIMESTAMPTZ` plus zone). The **latest supplied code used separate date/time columns**, while earlier planning also considered timestamp-based fields. Preserve the agreed behaviour and settle representation against actual code before a broad refactor.
- Handling DST gaps/ambiguous local times and consistency between PostgreSQL, Node, and browsers.
- Whether a deadline can equal the event start (the proposed SQL permits equality; registration still closes at that instant).
- Edit rules for events already started or with registrations, including whether end times may be extended.
- Event cancellation behaviour for already registered attendees.
- Category taxonomy, city/geocoding provider, search sorting/pagination conventions, and price currency defaults.
- Whether registration deadlines and capacity are optional in all cases (the agreed deadline is optional; capacity was discussed as optional).
- Whether existing test data needs preserving before the first reset.

---

## Suggested opening instruction to Codex

> Read `PROJECT_HANDOVER.md` and inspect the current repository before changing anything. First report which parts of the handover match the code and which require verification. We are at Milestone 1, Step 2: updating the backend and seed data for multi-day events and optional registration deadlines. Keep changes incremental, preserve existing features, and do not reset the database without asking me first. Start by reviewing `schema.sql`, `server/createTables.js`, `server/server.js`, and `server/seedEvents.js`, then propose the smallest next edit.
