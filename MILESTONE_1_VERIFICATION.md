# Multi-day event transition verification

Verified locally on 2 November 2026.

## Database activation

The user explicitly approved resetting the development database rather than
altering its existing tables. Verified the configured target was local PostgreSQL
on port 5433, database communityhub. Before reset it contained 1 user, 4 events,
and 0 registrations.

Ran `npm run create-tables`, then `npm run seed-events` from server. The reset
deleted the old application data and installed the new schema, including named
zones, start/end offsets and timing constraints. Seeding inserted six events.

After verification, all disposable accounts and their test events/registrations
were removed. Final application data: **0 users, 6 events, 0 registrations**.
The original account no longer exists; create a new account to use authenticated
features. Sample events remain unowned, as before; create your own event to edit it.

## Verified in the browser

- Homepage displays actual event links and timing data.
- Discovery defaults to upcoming, and ongoing/past/all selections work.
- Selecting 7 November matches the market spanning 6–8 November.
- Account registration and login succeed with a disposable local account.
- Create accepts a multi-day event and an optional registration deadline.
- Detail shows correct start/end, named zone, deadline and attendee count.
- Registration persists after a page reload.
- Owner editing preserves attendees and displays the timing-change warning.
- Changing the event zone to America/New_York preserves the entered local times,
  displays the correct UTC-05:00 offset, and converts the deadline correctly.
- Profile shows both registered and created events.
- Profile cancellation removes attendance and updates the matching created-event
  count. The native confirmation dialog required keyboard/browser recovery in the
  automation environment; the final success message and removed attendance were
  verified. No confirmation remains open.
- Logged out and reloaded the clean six-event listing after fixture cleanup.

## Verified through the live API

- Another account cannot edit or delete the owner's event (403).
- Registration is rejected for ongoing/past events and a future event whose
  deadline has passed (403).
- Duplicate registration is rejected (409), and status lookup identifies attendance.
- Cancellation succeeds and removes attendance.
- Owner deletion removes the test event and cascades its registrations.

## Automated checks

- Backend: **29 tests pass**, including isolated PostgreSQL integration checks.
- Frontend: **15 tests pass**, including event-zone display, date overlap, DST
  boundaries, payload conversion, deadline precision and edit locks.
- Frontend production build passes.
- Changed frontend files pass targeted lint checks.
- Full-project lint still has the previously identified Fast Refresh export-rule
  error in client/src/context/AuthContext.jsx. It has not been suppressed or changed.

Regression tests use a unique schema inside a rolled-back transaction and do not
reset the application tables. Browser/live API fixtures were explicitly cleaned up.

## Local development

The API was started on http://localhost:5001 and Vite on http://127.0.0.1:5173.
If stopped, run `npm start` from server and `npm run dev` from client.
No changes have been committed automatically.

## Remaining MVP work

Subsequent progress: categories have now been implemented and verified. See
DISCOVERY_RULES.md for current discovery behavior and the next incremental step.

This completes the local activation of the timing model, not the full MVP.
Discovery now supports categories, server-side keyword/location/date filtering,
pagination, shareable filter URLs and informational free/paid pricing.
Structured location fields, place lookup and radius filtering are also implemented.
See DISCOVERY_RULES.md for current verification.
Capacity, organiser attendee lists, explicit event cancellation and launch
hardening also remain outstanding. Existing groups/payment exclusions still apply.
