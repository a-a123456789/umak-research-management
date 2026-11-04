CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE FUNCTION crm_normalize_title(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$ SELECT trim(regexp_replace(lower(normalize(value, NFKC)), '[^[:alnum:]]+', ' ', 'g')) $$;
ALTER TABLE research_records
 ADD COLUMN normalized_title text GENERATED ALWAYS AS (crm_normalize_title(title)) STORED,
 ADD COLUMN research_year integer CHECK (research_year BETWEEN 1900 AND 9999),
 ADD COLUMN department text CHECK (length(department) BETWEEN 1 AND 100);
CREATE INDEX research_title_trgm ON research_records USING gin(normalized_title gin_trgm_ops);
CREATE INDEX research_metadata ON research_records(research_year, department);
CREATE TABLE consultation_tickets (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 requester_id integer NOT NULL REFERENCES users ON DELETE CASCADE,
 service_type text NOT NULL CHECK (length(service_type) BETWEEN 1 AND 100),
 deadline_at timestamptz,
 submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','claimed','resolved','cancelled')),
 assigned_staff_id integer REFERENCES users ON DELETE SET NULL,
 claimed_at timestamptz,
 version integer NOT NULL DEFAULT 1 CHECK(version > 0)
);
CREATE INDEX consultation_edf ON consultation_tickets(deadline_at ASC NULLS LAST, submitted_at, id) WHERE status='queued';
CREATE INDEX consultation_requester ON consultation_tickets(requester_id,id);
GRANT SELECT,INSERT,UPDATE,DELETE ON consultation_tickets TO crm_app;
GRANT USAGE,SELECT ON SEQUENCE consultation_tickets_id_seq TO crm_app;
