-- WARNING: This resets all CommunityHub tables and data.
-- Intended for development only.

BEGIN;

DROP TABLE IF EXISTS event_attendees CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT,
    email_verified_at TIMESTAMPTZ,
    verification_hash TEXT UNIQUE,
    verification_expires_at TIMESTAMPTZ,
    verification_sent_at TIMESTAMPTZ,
    google_subject TEXT UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE events (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50),
    cancelled_at TIMESTAMPTZ,
    capacity INTEGER CHECK (capacity > 0),
    price NUMERIC(10,2),
    currency VARCHAR(3),
    start_date DATE NOT NULL,
    start_time TIME NOT NULL,
    start_offset VARCHAR(6) NOT NULL,
    end_date DATE NOT NULL,
    end_time TIME NOT NULL,
    end_offset VARCHAR(6) NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Europe/London',
    registration_deadline TIMESTAMPTZ,
    location VARCHAR(255) NOT NULL,
    address VARCHAR(255),
    city VARCHAR(100),
    postcode VARCHAR(32),
    country VARCHAR(100),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    place_label VARCHAR(500),
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT events_coordinates_valid CHECK (
        (latitude IS NULL AND longitude IS NULL AND place_label IS NULL) OR
        (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
    ),
    CONSTRAINT events_price_valid CHECK (
        price IS NULL OR (price >= 0 AND price <= 99999999.99)
    ),
    CONSTRAINT events_price_currency_pair CHECK (
        (price IS NULL AND currency IS NULL) OR (price IS NOT NULL AND currency IS NOT NULL AND currency IN ('GBP', 'EUR', 'USD'))
    ),
    CONSTRAINT events_category_allowed CHECK (
        category IN ('Sports', 'Education', 'Volunteering', 'Social', 'Arts & Culture', 'Health & Wellbeing', 'Family & Kids')
    ),
    CONSTRAINT events_start_offset_format CHECK (
        start_offset ~ '^[+-]([01][0-9]|2[0-3]):[0-5][0-9]$'
    ),
    CONSTRAINT events_end_offset_format CHECK (
        end_offset ~ '^[+-]([01][0-9]|2[0-3]):[0-5][0-9]$'
    ),
    CONSTRAINT events_start_offset_matches_zone CHECK (
        (((start_date + start_time - start_offset::interval) AT TIME ZONE 'UTC')
            AT TIME ZONE timezone) = (start_date + start_time)
    ),
    CONSTRAINT events_end_offset_matches_zone CHECK (
        (((end_date + end_time - end_offset::interval) AT TIME ZONE 'UTC')
            AT TIME ZONE timezone) = (end_date + end_time)
    ),
    CONSTRAINT events_end_after_start CHECK (
        (end_date + end_time - end_offset::interval) >
        (start_date + start_time - start_offset::interval)
    ),
    CONSTRAINT events_deadline_not_after_start CHECK (
        registration_deadline IS NULL OR
        registration_deadline <= (
            (start_date + start_time - start_offset::interval) AT TIME ZONE 'UTC'
        )
    )
);

CREATE TABLE event_attendees (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, event_id)
);

COMMIT;
