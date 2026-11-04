# Event discovery progress

## Categories — implemented 2 November 2026

The initial taxonomy uses the seven examples from the handover:

- Sports
- Education
- Volunteering
- Social
- Arts & Culture
- Health & Wellbeing
- Family & Kids

One optional category is stored on each event. Empty form selections become SQL
NULL (uncategorised); the default All categories filter includes these events.
The taxonomy can be revised deliberately as product needs become clearer.

The backend publishes the allowed labels through GET /api/events/config. Create
and Edit use that list. Cards, detail pages and both profile lists display the
category through the shared event schedule component.

API rules:

- POST /api/events accepts category as one of the exact labels or null. Omission
  creates an uncategorised event.
- PUT /api/events/:id preserves the category when omitted, and clears it when
  explicitly null. Category edits retain the existing owner checks and timing rules.
- Invalid labels and non-string values other than null return 400. A database
  CHECK constraint also enforces the allowed values.
- GET /api/events accepts category as an optional query parameter. Values are
  validated and bound as SQL parameters. Category and lifecycle combine with AND.
  For example, category=Sports with status=past returns only past sports events.
- A missing or empty category filter means all categories. URL-encode labels such
  as Arts & Culture; the frontend uses URLSearchParams.
- Clear Filters resets category, lifecycle, keyword and date. Empty filtered
  results show "No events match your filters."

## Database and seeds

The category column and constraint are present in both reset schema definitions.
The existing development database was updated with the repeatable
`npm run add-event-categories` command from server. The update preserves schedules,
users and registrations and only backfills uncategorised, unowned rows matching
the known sample title, description and location.

Existing samples were assigned Volunteering (clean-up and welcome session), Sports
(football), Social (market), Arts & Culture (arts weekend), and Education (gardening).
Future seed runs include those categories. Reruns continue to preserve existing
samples and registrations.

Final development data after verification: six categorised events, zero users and
zero registrations. All disposable category verification data was removed.

## Verification

- 33 backend tests pass, including category write validation, omission/clearing,
  owner protection, category/lifecycle combinations, ampersands, invalid filter
  inputs, SQL constraints, reset-schema consistency and repeatable updates.
- 16 frontend tests pass, including category form round-trips and clearing.
- Production build and targeted lint checks for changed files pass.
- Browser checks cover Sports filtering, Arts & Culture combined with Ongoing,
  empty Family & Kids results, Clear Filters, category choices on Create, and
  loading/changing/saving a category through Edit and verifying it on Details.
- The previously recorded AuthContext Fast Refresh lint issue remains outside
  this change. No commits were made automatically.

## Server-side search — implemented 2 November 2026

GET /api/events now filters keyword, location and date in PostgreSQL alongside
category and lifecycle. Requests without pagination parameters return an array
ordered by start instant and event ID. No database schema or application data was changed for this
step.

| Parameter | Behavior |
| --- | --- |
| q | Case-insensitive literal substring of title OR description; maximum 200 characters |
| location | Case-insensitive literal substring of the existing location text; maximum 255 characters |
| date | Real YYYY-MM-DD calendar date, interpreted separately in each event's zone |
| status | Upcoming by default; ongoing, past or all available |
| category | One exact allowed category; missing/empty means all |

All supplied filters combine with AND. Text/date inputs are trimmed, blank values
are ignored, and repeated/non-string values or invalid dates return 400. Text
search treats %, _ and backslashes literally. Values are bound SQL parameters.
Location is separate from keyword; typing a city only in Keyword does not search
the location field. Structured city/address storage and geocoding are later work.

For date filtering, the backend resolves the selected day and following day in
each relevant event zone using Temporal. Only zone names and day boundaries are
prepared in JavaScript; PostgreSQL selects the matching events by instant overlap
with a bound per-zone day table. This retains 23/25-hour days, the first occurrence
of a repeated midnight, and skipped dates. End is exclusive: an event merely
ending at midnight does not occupy the following day. Original-schema events use
date equality.

The discovery UI has separate Keyword and Location or city inputs, plus date,
lifecycle and category controls. Text changes wait 300 ms before requesting;
superseded requests are aborted. Pending text changes hide old results. Clear
Filters resets every control and requests the upcoming default immediately. The
browser no longer performs keyword/date filtering; its clock only advances visible
lifecycle/availability states as cutoffs pass.

Verification for this step:

- **41 backend tests pass**, including actual PostgreSQL checks for text OR
  grouping, five-filter combinations, literal pattern characters, invalid input,
  date overlap, midnight endings, viewer/database-zone independence, DST gaps and
  repetitions, skipped dates, and original-schema compatibility.
- **13 frontend tests pass**. Obsolete client-filter utilities/tests were removed;
  their filtering rules are now covered by backend tests.
- Production build and changed-file lint checks pass. The previously recorded
  AuthContext full-project lint issue is unchanged.
- Browser checks confirm description-only keyword matching, independent location
  matching, category AND semantics, an inside/outside multi-day date, empty states,
  and reset. No live fixture records were needed.

## Pagination and shareable URLs — implemented 2 November 2026

Supplying page or page_size opts GET /api/events into a paginated response:

```json
{
  "events": [],
  "pagination": {
    "page": 1,
    "page_size": 12,
    "total": 0,
    "total_pages": 0,
    "has_previous": false,
    "has_next": false
  }
}
```

Page defaults to 1 and page_size to 12. Both must be positive whole numbers;
page_size is capped at 100 and page at 1,000,000. Invalid or repeated parameters
return 400. Page numbers beyond the last page return no events but retain the
correct filtered total. No results means total_pages=0. Requests without either
parameter retain their original array response for compatibility.

Matching IDs, ordering, totals and page membership are evaluated in one PostgreSQL
statement. Full event details/counts are loaded only for page rows. Start instant
plus event ID provides deterministic ordering, including tied start times.

The discovery page always requests pagination. It shows the filtered total,
Previous/Next controls and a page-size selector (3, 12, 24 or 48; valid custom sizes
from shared URLs are also supported). An unavailable page offers Go to first page.
The homepage requests only the first three upcoming events.

The URL is the source of truth for q, location, date, status, category, page and
page_size. Copied URLs and reloads restore all controls and results. Browser
Back/Forward restores previous views. Filter and page-size changes reset page one;
page navigation preserves filters. Default values are omitted from generated URLs.
Clear Filters restores the bare /events URL, upcoming events, page one and size 12.

Text input replaces the current history entry while typing to avoid one Back step
per character; requests remain debounced by 300 ms. Discrete filter, page-size and
page changes add history entries. Superseded requests are aborted and prior-query
results stay hidden until the matching response completes. Malformed shared URLs
are shown as API validation errors and can be recovered with Clear Filters.

Latest verification:

- **45 backend tests pass**, including filtered totals, stable/non-overlapping
  pages, empty/out-of-range pages, bounds validation and original-schema support.
- **17 frontend tests pass**, including URL restoration, encoding, page resets,
  preservation of filters during pagination, and malformed-link handling.
- Production build and changed-file lint checks pass. The known AuthContext
  full-project lint issue is unchanged.
- Browser checks cover page size 3 over all six samples, Next, Back/Forward,
  reload, changing category from page two, opening a full five-filter copied link
  in a fresh tab, out-of-range/invalid page recovery, and the homepage's three cards.
- No database changes or live test fixtures were required.

## Remaining discovery work

Joinability filtering depends on the remaining capacity and cancellation work.
Paid listings remain informational; payment processing stays outside the MVP.

## Informational pricing (implemented)

Events can have an unspecified price, an explicit free price (zero), or a paid
price. Create/edit forms expose these choices. GBP is the default; GBP, EUR and
USD are supported. Paid listings show the currency code to avoid ambiguity.
Prices use NUMERIC(10,2), with API validation allowing at most two decimal places
and values from zero through 99999999.99. Currency and amount must form a valid pair.
Omitting both fields on edit preserves pricing; null clears it. Unknown prices
are never treated as free. Payment collection is outside this feature.

GET /events accepts pricing=all|free|paid, combined with existing filters and
pagination. Free means price=0 and paid means price>0. Invalid/repeated values
return 400. The URL retains pricing, and changing it resets page one.

Run `npm run add-event-pricing` from server to update an existing multi-day
database. This repeatable update preserves existing data and prices only the six
known unowned seed examples. Other existing listings retain unspecified pricing.
The local update preserved all six events, schedules and registrations; a second
run changed nothing. Fresh schemas and seeding include pricing.

Verification: 51 backend and 20 frontend tests pass, including database constraints,
ownership, edit preservation/clearing, migration repeatability and combined filters.
Production build and changed-file lint pass. Browser checks confirmed free/paid
results, price display, Back navigation and reload restoration of the pricing URL.
The existing full-project AuthContext lint issue remains unchanged.

## Structured event locations (implemented)

The required location label remains compatible with existing listings. Optional
address (255 characters), city (100), postcode (32) and country (100) are now
available in create/edit forms and displayed with event schedules. These fields
are public, trimmed text; blank or null clears an individual field, while omitted
fields on API edits preserve their values. Country and postcode are free text to
support international addresses; they are not geographically verified.

The existing location query searches any of the label, address, city, postcode or
country using literal, case-insensitive substring matching. It combines with all
other filters and pagination. This remains text search, without a selected search
origin or radius. Coordinates are not inferred from these fields.

`npm run add-event-locations` in server applies the repeatable additive schema
update. Existing locations and all other event data remain unchanged. Config
exposes structured_location; the preceding multi-day schema continues to support
label-only reads/writes until the update is installed. New fields are nullable in
fresh schemas; existing samples retain their original location labels.

Verified: 53 backend and 21 frontend tests pass, production build and targeted lint
pass. Integration checks cover validation, ownership, field preservation/clearing,
paginated search, attendance preservation and repeatable schema updates. The local
update preserved all six events and registrations. Browser checks confirmed the
new labelled fields render and accept input; browser form submission was not tested
in this step (API writes are covered by PostgreSQL integration tests).

## Geocoding and radius search (implemented)

Organisers can explicitly search for a public venue and select a result to save
its latitude, longitude and display label. The original location label and
address stay editable. Changing them clears a saved map point unless a replacement
is provided. Map points are optional. The API accepts valid coordinate pairs,
preserves them on unrelated edits and clears them when both values are null.

The discovery page uses the same picker to select a search origin. The default
is 10 miles after selection, with 5, 25, 50 and any distance also available. Results
use straight-line distance and retain chronological ordering. A finite radius
excludes events without a point. Any distance includes them. Text location search
and all other filters compose with radius before counting or pagination.

Shared URLs retain `origin_lat`, `origin_lon`, `origin_label` and `radius`.
Changing or removing the origin or changing the radius resets page one.
The API validates the origin pair and radius and returns `distance_miles` when
an origin is supplied. Unmapped events have a null distance.

`GET /api/places?q=…` proxies explicit searches to Photon and returns up to five
labelled points. The server caches results for 24 hours in a bounded in-memory
cache and limits upstream traffic to one request per second per process with at
most one in flight. The UI credits Photon and OpenStreetMap. The development
default is the [public Photon API](https://photon.komoot.io/), which permits
moderate project use and can throttle requests. Set `PHOTON_URL` to a Photon
search endpoint for another instance. Shared search URLs do not require a repeat
lookup. Provider errors leave ordinary text search available.

Run `npm run add-event-coordinates` from server after the structured locations
update. This repeatable schema update preserves existing data. The six existing
sample listings still need organiser-selected points to appear in radius results.

Verified with PostgreSQL integration tests, a live Photon lookup and browser
checks of selection, radius changes, any distance, reload and Back navigation.
The event form cleared its selected point on address change. Disposable browser
fixtures were removed after verification.

## Event capacity

The optional attendee limit is a positive whole number. A blank field or null
means unlimited attendance. Edits that omit capacity preserve the current limit.
An organiser cannot lower the limit below the current attendee count.

Registration, withdrawal and capacity edits share the event row lock.
Registration returns HTTP 409 with EVENT_FULL when every spot is taken and
ALREADY_REGISTERED for a duplicate while registration is open. The timing
rules still govern when registrations and withdrawals are allowed. Successful
mutations return the current attendee count and limit for the event page.

Run npm run add-event-capacity from server to add the nullable column without
resetting existing data. Existing events start with unlimited capacity.

## Organiser event cancellation

Organisers can cancel an event from its details page. Cancellation records a
timestamp and preserves the event and its sign-ups. Discovery and profile
entries display the cancelled status. Registration and withdrawal are closed.
Repeat cancellation requests retain the original timestamp.

Run npm run add-event-cancellation from server to add the cancellation timestamp
to an existing multi-day schema without resetting data.

## Event cover photos

Organisers can add one optional JPEG, PNG or WebP cover photo up to 4 MB.
The server checks and resizes uploads to WebP and stores them with the event.
Deleting an event removes its cover photo.

For an existing database, run npm run add-event-cover-photos from server.
Fresh databases include the photo table.
