-- Bootstrap a least-privilege application role.
--
-- The app's PrismaClient must NEVER connect as the migration/owner role
-- (`omnipos`), because Postgres superusers AND table owners bypass Row-
-- Level Security (FORCE ROW LEVEL SECURITY only re-subjects the owner, and
-- does nothing at all for a superuser). `omnipos_app` has ordinary CRUD
-- grants only — no BYPASSRLS, no DDL, not the table owner, not a superuser —
-- so every tenant_isolation policy in this schema actually applies to it.
--
-- Runs automatically on first container init (mounted into
-- /docker-entrypoint-initdb.d/ by docker-compose.yml). Safe to re-run
-- manually against an existing database too (idempotent).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'omnipos_app') THEN
    CREATE ROLE omnipos_app LOGIN PASSWORD 'omnipos_app';
  END IF;
END
$$;

-- Re-assert the password every run (not just on first creation) so this
-- script stays idempotent even if the role's password was ever changed
-- out-of-band.
ALTER ROLE omnipos_app WITH PASSWORD 'omnipos_app';

GRANT CONNECT ON DATABASE omnipos_db TO omnipos_app;
GRANT USAGE ON SCHEMA public TO omnipos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO omnipos_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO omnipos_app;

-- Tables/sequences created by FUTURE migrations (run as `omnipos`, the owner)
-- are granted to omnipos_app automatically, so this script never needs to be
-- re-run after a schema change.
ALTER DEFAULT PRIVILEGES FOR ROLE omnipos IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO omnipos_app;
ALTER DEFAULT PRIVILEGES FOR ROLE omnipos IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO omnipos_app;
