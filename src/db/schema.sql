-- MealBridge schema
--
-- Timestamps are epoch milliseconds (INTEGER) throughout. Pickup windows are
-- compared constantly ("is this still open?", "which closes first?"), and
-- integer comparison keeps that honest across time zones — the server stores
-- absolute instants and each client renders them in its own local time.
--
-- Booleans are INTEGER 0/1, the SQLite convention.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- zip_codes: the bundled centroid table. This is what makes "nearest" work
-- without a geocoding service. Loaded from data/zip-centroids.csv by
-- scripts/db-setup.mjs. Never written to at runtime.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS zip_codes (
  zip   TEXT PRIMARY KEY,
  city  TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  lat   REAL NOT NULL,
  lng   REAL NOT NULL
);

-- Distance search reads a bounding box off these before doing Haversine, which
-- turns a 41k-row scan into a few hundred rows.
CREATE INDEX IF NOT EXISTS idx_zip_lat ON zip_codes (lat);
CREATE INDEX IF NOT EXISTS idx_zip_lng ON zip_codes (lng);

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  role       TEXT NOT NULL CHECK (role IN ('seeker', 'provider', 'admin')),
  name       TEXT NOT NULL DEFAULT '',
  email      TEXT UNIQUE,
  phone      TEXT UNIQUE,
  language   TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'es')),
  created_at INTEGER NOT NULL,
  -- A seeker may be signed in without ever telling us a ZIP; this is only
  -- their convenience default, and deleting it is a one-tap action.
  home_zip   TEXT REFERENCES zip_codes (zip),
  -- Null means the account predates passwords, or was created by a seed.
  -- Those accounts are asked to choose one the next time they sign in; see
  -- src/app/actions/auth.ts. Never the password itself — see lib/password.ts.
  password_hash TEXT,
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

-- ---------------------------------------------------------------------------
-- Sessions.
--
-- There is no password table and no one-time code table: sign-in trusts the
-- address you type. See README "Authentication" for what that means and what
-- to restore before this is used for anything beyond a demo.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,       -- stored as a hash of the cookie token
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

-- ---------------------------------------------------------------------------
-- providers. Pending until an admin approves; only 'approved' may post.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS providers (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  street        TEXT NOT NULL,
  city          TEXT NOT NULL,
  state         TEXT NOT NULL,
  zip           TEXT NOT NULL REFERENCES zip_codes (zip),
  contact_name  TEXT NOT NULL DEFAULT '',
  phone         TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL DEFAULT '',
  permit_number TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'suspended')),
  -- Opt-in. A provider's phone reaches seekers only if they chose to publish
  -- it; the default is that it does not.
  show_phone    INTEGER NOT NULL DEFAULT 0,
  -- Opt-in. Shows the provider an aggregate saved-count and nothing else.
  show_interest INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL,
  reviewed_at   INTEGER,
  review_note   TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_providers_status ON providers (status);

-- ---------------------------------------------------------------------------
-- listings
--
-- The address is denormalised onto the row rather than read from the provider.
-- A chain may hand off from a second location, and more importantly a listing
-- is a historical record: editing the business address next year must not
-- rewrite where last year's food was handed out.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS listings (
  id                TEXT PRIMARY KEY,
  provider_id       TEXT NOT NULL REFERENCES providers (id) ON DELETE CASCADE,
  description       TEXT NOT NULL,
  categories        TEXT NOT NULL DEFAULT '[]',   -- JSON array
  dietary_tags      TEXT NOT NULL DEFAULT '[]',   -- JSON array
  allergen_tags     TEXT NOT NULL DEFAULT '[]',   -- JSON array
  portions_total    INTEGER NOT NULL,
  portions_remaining INTEGER NOT NULL,
  street            TEXT NOT NULL,
  city              TEXT NOT NULL,
  state             TEXT NOT NULL,
  zip               TEXT NOT NULL REFERENCES zip_codes (zip),
  pickup_start      INTEGER NOT NULL,
  pickup_end        INTEGER NOT NULL,
  notes             TEXT NOT NULL DEFAULT '',     -- handoff instructions
  photo_url         TEXT,
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'expired', 'cancelled', 'gone')),
  recurring_rule_id TEXT REFERENCES recurring_rules (id) ON DELETE SET NULL,
  safety_ack_at     INTEGER NOT NULL,             -- food-safety checklist
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  CHECK (pickup_end > pickup_start),
  CHECK (portions_remaining >= 0),
  CHECK (portions_remaining <= portions_total)
);

-- The seeker list query filters on (status, pickup_end) then sorts by distance.
CREATE INDEX IF NOT EXISTS idx_listings_live ON listings (status, pickup_end);
CREATE INDEX IF NOT EXISTS idx_listings_zip ON listings (zip, status);
CREATE INDEX IF NOT EXISTS idx_listings_provider ON listings (provider_id, created_at DESC);

CREATE TABLE IF NOT EXISTS recurring_rules (
  id             TEXT PRIMARY KEY,
  provider_id    TEXT NOT NULL REFERENCES providers (id) ON DELETE CASCADE,
  -- Comma-separated ISO weekday numbers, 1=Mon .. 7=Sun, e.g. '1,2,3,4,5'
  weekdays       TEXT NOT NULL,
  start_minutes  INTEGER NOT NULL,  -- minutes past local midnight
  end_minutes    INTEGER NOT NULL,
  template       TEXT NOT NULL,     -- JSON: description, portions, tags, notes
  timezone       TEXT NOT NULL DEFAULT 'America/New_York',
  paused         INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL,
  last_run_on    TEXT               -- 'YYYY-MM-DD', so a day never double-posts
);
CREATE INDEX IF NOT EXISTS idx_recurring_provider ON recurring_rules (provider_id);

-- ---------------------------------------------------------------------------
-- alerts: a seeker's standing request to hear about food near a ZIP.
--
-- This table is the only place a seeker's ZIP is ever stored, and the row is
-- theirs to delete. Deleting it removes the ZIP with it.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
  id              TEXT PRIMARY KEY,
  seeker_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  zip             TEXT NOT NULL REFERENCES zip_codes (zip),
  radius_miles    INTEGER NOT NULL DEFAULT 10,
  dietary_filters TEXT NOT NULL DEFAULT '[]',  -- JSON array
  channel         TEXT NOT NULL DEFAULT 'push' CHECK (channel IN ('push', 'sms', 'both')),
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alerts_live ON alerts (active, zip);
CREATE INDEX IF NOT EXISTS idx_alerts_seeker ON alerts (seeker_id);

-- Saved listings drive both "tell me if this one changes" and the aggregate
-- interest count. Providers can read the COUNT and never the rows.
CREATE TABLE IF NOT EXISTS saved_listings (
  seeker_id  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (seeker_id, listing_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_listing ON saved_listings (listing_id);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions (user_id);

-- Outbox. Writing the intent to send before sending means a crashed worker
-- retries instead of silently dropping someone's only dinner notice.
CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  listing_id TEXT REFERENCES listings (id) ON DELETE CASCADE,
  channel    TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  url        TEXT NOT NULL DEFAULT '/food',
  created_at INTEGER NOT NULL,
  sent_at    INTEGER,
  error      TEXT
);
CREATE INDEX IF NOT EXISTS idx_notifications_pending ON notifications (sent_at, created_at);

-- ---------------------------------------------------------------------------
-- reports. reporter_id is nullable: a seeker browsing without an account must
-- still be able to say "this food is gone" or "this address is wrong".
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  id         TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  reporter_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  reason     TEXT NOT NULL CHECK (reason IN ('gone', 'closed', 'unsafe', 'wrong_info', 'other')),
  details    TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed')),
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  reviewed_by TEXT REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_listing ON reports (listing_id);

-- Moderation trail. Suspending a business is a consequential act; it should
-- never be anonymous.
CREATE TABLE IF NOT EXISTS admin_actions (
  id          TEXT PRIMARY KEY,
  admin_id    TEXT NOT NULL REFERENCES users (id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_actions_time ON admin_actions (created_at DESC);

-- Fixed-window counters for abuse protection on every public form.
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket       TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL
);
