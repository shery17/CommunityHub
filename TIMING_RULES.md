# Agreed MVP timing rules

Agreed on 2 November 2026. These rules supersede unresolved timing questions in
PROJECT_HANDOVER.md. Implementation is incremental; this is the target contract.

Activation verified on 2 November 2026: the development database was reset with
explicit user approval, recreated from createTables.js, and seeded. It now uses
the multi-day schema. Core browser flows and live API rules were verified; all
disposable verification data was removed, leaving six sample events and no users
or registrations. See MILESTONE_1_VERIFICATION.md for evidence and remaining work.

- Require start date/time, end date/time, and an IANA event time zone. New forms
  default to Europe/London, with other zones available.
- Display times in the event's zone and label that zone.
- New events must start in the future. End must be strictly after start.
- Upcoming means now is before start; ongoing means start <= now < end;
  past means now >= end. Compare actual instants on the backend.
- Registration closes at the earlier of an optional deadline and start.
  Registration is closed at that exact instant, including during ongoing events.
- A deadline may equal start but cannot exceed it. New or changed deadlines must
  be in the future; unchanged expired deadlines do not block unrelated edits.
- Attendance cancellation is allowed before and during events, but not after end.
- Upcoming event timing can change even with attendees. Warn organisers that
  attendees are affected. Automatic notifications are deferred.
- Ongoing events lock start, time zone, and deadline; end may only be extended.
- Past events lock timing and registration settings, preserving history.
- Date search uses overlap with the selected calendar day in the event's zone.
  An event ending at midnight does not occupy the following day.
- Reject nonexistent DST clock times. Repeated clock times require an explicit
  offset choice. Preserve that choice when storing the event.
- Keep separate local date/time columns plus the named zone. The proposed schema
  stores required start_offset and end_offset values, such as +01:00 or +00:00,
  to retain repeated-time choices. The backend resolves these for ordinary times;
  users only need to choose when a local time repeats. Constraints check that
  offsets match the zone and compare actual instants for duration and deadlines.
- Return resolved start/end instants and lifecycle/registration state to the UI.
  Registration deadlines in the API must include Z or an explicit UTC offset.

Current implementation: server/eventTiming.js provides resolution, creation/edit
validation, and lifecycle/registration calculations, using Temporal. Event create
and edit routes now accept the multi-day format and use these utilities. Edits
lock the row in a transaction before validating the current event's timing.
Responses include resolved instants, offsets, lifecycle, registration state, and
attendee count. Existing attendees are preserved on edits.

The existing date/time request format is temporarily supported for the current
frontend and original database. Multi-day requests require the proposed schema;
they return 503 if that schema is not installed. The running development database
now uses the multi-day schema. Forms, event displays and attendance controls
support both formats; compatibility branches are retained for now. Future resets
still require checking data and confirming readiness.

Event listing, detail and both profile lists now detect the active event schema.
With the multi-day schema, all four return event-local date strings, explicit
starts_at/ends_at instants, registration_closes_at, lifecycle, registration_open, cancellation_open,
offsets and attendee_count. SQL compares actual instants using the stored offsets;
each query uses one statement timestamp for consistent status calculations.

GET /api/events defaults to upcoming. Its optional status parameter accepts
upcoming, ongoing, past or all. Ordering uses start instants, then event ID.
Details and profile lists retain historical events. Registered events include
registered_at and sort oldest start first; created events sort newest start first.
On the original schema, the existing date/time fields and upcoming behavior are
preserved; status=all is also available. Ongoing/past filters return 400 until the
multi-day schema is installed because original events do not have an end time.
The multi-day transition is active and verified in the local development setup.

Create and Edit forms now share multi-day timing fields. Create checks
GET /api/events/config (multi_day plus default_timezone) to select the active
format even when no events exist. Edit uses the format of its fetched event.
With the original schema, both retain their original date/time payloads. Restart
the API after updating it so the new configuration endpoint is available.

With the multi-day schema, forms expose start/end dates and times, a named zone,
and an optional deadline entered in that event's zone. Repeated local times require
an explicit first/second occurrence choice, including for deadlines. Nonexistent
times display an error. Deadline instants and start/end offsets round-trip on edit;
changing a time or zone clears stale occurrence choices. Client checks provide
feedback, and backend rules remain authoritative.

Edit timing locks refresh every 15 seconds: started events lock start, zone and
deadline; past events lock the end as well. Other event details remain editable.
Upcoming events with attendees display a warning to inform them of timing changes.
The new fields are active with the installed multi-day schema.
Run frontend timing tests from client with `npm test`.

Cards, detail pages and both profile lists share EventSchedule. New-format events
show start/end dates and times, a named zone, explicit UTC offsets, optional
deadline, attendee count, and separate lifecycle/registration badges. Original
events retain their date/time display without inventing an end or event zone.
Display clocks update every 15 seconds using the explicit backend instants; they
can close controls as cutoffs pass but do not reopen backend-reported closed states.

Discovery offers upcoming/ongoing/past/all for the multi-day schema (upcoming
and all for the original schema). Lifecycle, category, keyword, location and date
filtering now run through the API and PostgreSQL. Keyword matches title OR
description; location has its own input. Date filtering uses event-zone calendar-day overlap,
including DST transitions and excluding a day on which the event merely ends at
midnight. Clear Filters restores the upcoming default. The other agreed search
filters remain later MVP work. Pagination and shareable filter URLs are now
implemented; see DISCOVERY_RULES.md for the API contract and navigation behavior.

Category support was subsequently added to forms, event displays and API-side
discovery filtering. The initial seven-category list, database update, optional
field behavior and verification are documented in DISCOVERY_RULES.md. Category
and lifecycle are filtered by SQL, alongside keyword, location and date.

The homepage fetches actual upcoming events and shows up to three with valid
detail links and counts, replacing the original hardcoded cards.

Details show registered state even after registration closes and allow attendance
cancellation while the event is upcoming or ongoing. The profile also hides
cancellation after end and preserves history. Failed cancellation does not hide
the registered-event list. Successful detail registration/cancellation updates the
displayed count immediately; profile cancellation also updates a matching created
event's count. Owner edit/delete controls are retained. Backend checks remain
authoritative for every mutation. Core browser flows against the activated schema
were verified on 2 November 2026; this does not mark the entire MVP complete.

Attendance endpoints also detect the active schema. With the multi-day schema:

- POST /api/events/:id/register locks the event, then enforces the earlier of
  deadline and start in the INSERT itself. Registration closes at equality.
- DELETE /api/events/:id/register locks the event, then allows cancellation only
  while now < end in the DELETE itself. Existing attendance is retained after end.
- GET /api/events/:id/registration returns registered, the timing/status fields,
  cancellation_open, and can_cancel (registered AND cancellation_open). Attendance
  can still be inspected after an event ends or registration closes.
- A missing event returns 404. Invalid IDs return 400; all three require auth.
  Duplicate registration while open returns 409; closed registration returns 403.
  Cancelling without attendance returns 404; cancelling past attendance returns 403.
- Mutations use the actual database execution clock after locking and recheck
  cutoffs in SQL, including if a cutoff passes after the initial status read.

The original schema retains its start-only registration cutoff and unrestricted
attendance cancellation because it has no event end. That compatibility path is
temporary until the coordinated transition; it does not infer historical end times.

Multi-day POST /api/events and PUT /api/events/:id require title, description,
location, start_date, start_time, end_date, end_time, and timezone. They accept
optional start_offset/end_offset (required for repeated local clock times), and
an optional registration_deadline as an instant with Z or an explicit offset.
PUT supplies the complete event, including timing. An omitted deadline clears it;
to preserve one, send its current value. Offsets are resolved and stored even when
not supplied. Ownership always comes from the authenticated account.

Development seeds now use the multi-day schema. After the coordinated database
transition, `npm run seed-events` from server inserts up to six unowned examples:

| Event | Initial timing relative to seeding | Registration |
| --- | --- | --- |
| Community Clean-Up | Starts in 48 hours; lasts 2 hours | Open until start |
| Local Football Meetup | Starts in 72 hours; lasts 2 hours | Deadline in 48 hours |
| Community Food Market | Starts in 96 hours; lasts 48 hours | Open until start |
| Community Arts Weekend | Started 24 hours ago; ends in 24 hours | Closed at start |
| Community Gardening Workshop | Started 72 hours ago; ended 70 hours ago | Closed |
| Volunteer Welcome Session | Starts in 168 hours; lasts 2 hours | Deadline passed 1 hour ago |

Samples store London local dates/times and explicit offsets derived from instants,
so they also work across DST transitions. Dates are generated relative to the
initial seed run, rather than fixed dates that become stale before testing.

Reruns skip unowned rows matching title, description and location. They never
refresh existing schedules or remove registrations; those rows age normally.
Changing those identifying fields or assigning an owner makes a row a different
event for matching purposes. Seed runs are serialized with an advisory lock and
insert as one transaction; errors roll back the entire batch and exit nonzero.
The script refuses the original schema and does not reset it. The updated seeder
has been run successfully against the reset application database.

Run timing tests from server with `npm test`.

Integration tests are opt-in and require the configured development database.
From server in PowerShell, set `$env:RUN_DB_TESTS = '1'`, run
`node --test eventWrites.integration.test.js`, then remove the flag with
`Remove-Item Env:RUN_DB_TESTS`. Tests use a unique schema inside a rolled-back
transaction, leaving application data untouched. Never run create-tables as part
of these tests.
