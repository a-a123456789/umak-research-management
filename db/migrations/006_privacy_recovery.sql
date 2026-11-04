ALTER TABLE users ADD COLUMN subject_ref uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE;
CREATE TABLE privacy_deletions (
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),subject_ref uuid NOT NULL,
 requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),exported_at timestamptz
);
CREATE FUNCTION crm_record_deletion() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN INSERT INTO public.privacy_deletions(subject_ref) VALUES(OLD.subject_ref);RETURN OLD;END $$;
REVOKE ALL ON privacy_deletions FROM PUBLIC,crm_app;
REVOKE ALL ON FUNCTION crm_record_deletion() FROM PUBLIC;
CREATE TRIGGER privacy_recovery BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION crm_record_deletion();
