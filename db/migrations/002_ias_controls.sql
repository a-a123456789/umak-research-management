ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK(role IN ('student','faculty','staff'));
CREATE TABLE study_members (
 study_id integer REFERENCES research_records ON DELETE CASCADE,
 user_id integer REFERENCES users ON DELETE CASCADE,
 PRIMARY KEY(study_id,user_id)
);
CREATE TABLE review_assignments (
 study_id integer REFERENCES research_records ON DELETE CASCADE,
 staff_id integer REFERENCES users ON DELETE CASCADE,
 PRIMARY KEY(study_id,staff_id)
);
INSERT INTO study_members SELECT id,author_id FROM research_records;
CREATE TABLE research_feedback (
 study_id integer PRIMARY KEY REFERENCES research_records ON DELETE CASCADE,
 researcher_visible_feedback text NOT NULL CHECK(length(researcher_visible_feedback)<=4000),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE staff_notes (
 study_id integer PRIMARY KEY REFERENCES research_records ON DELETE CASCADE,
 internal_staff_notes text NOT NULL CHECK(length(internal_staff_notes)<=4000)
);
CREATE TABLE documents (
 id uuid PRIMARY KEY,study_id integer NOT NULL REFERENCES research_records ON DELETE CASCADE,
 object_key text UNIQUE NOT NULL, filename text NOT NULL,
 size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 1 AND 25000000),
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 media_type text NOT NULL CHECK(media_type IN ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION crm_user_id() RETURNS integer LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('app.user_id',true),'')::integer $$;
CREATE FUNCTION crm_is_staff() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
AS $$ SELECT EXISTS(SELECT 1 FROM public.users WHERE id=public.crm_user_id() AND role='staff') $$;
CREATE FUNCTION crm_is_researcher() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
AS $$ SELECT EXISTS(SELECT 1 FROM public.users WHERE id=public.crm_user_id() AND role IN ('student','faculty')) $$;
CREATE FUNCTION crm_owns_study(s integer) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
AS $$ SELECT EXISTS(SELECT 1 FROM public.research_records WHERE id=s AND author_id=public.crm_user_id()) $$;
CREATE FUNCTION crm_member(s integer) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
AS $$ SELECT public.crm_owns_study(s) OR EXISTS(SELECT 1 FROM public.study_members WHERE study_id=s AND user_id=public.crm_user_id()) $$;
CREATE FUNCTION crm_assigned(s integer) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
AS $$ SELECT public.crm_is_staff() AND EXISTS(SELECT 1 FROM public.review_assignments WHERE study_id=s AND staff_id=public.crm_user_id()) $$;
CREATE FUNCTION crm_can_access(s integer) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
AS $$ SELECT public.crm_member(s) OR public.crm_assigned(s) $$;

ALTER TABLE research_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_records FORCE ROW LEVEL SECURITY;
-- Helpers are owned by the privileged migration identity, never crm_app.
CREATE POLICY research_read ON research_records FOR SELECT TO crm_app USING(author_id=crm_user_id() OR crm_can_access(id));
CREATE POLICY research_insert ON research_records FOR INSERT TO crm_app WITH CHECK(author_id=crm_user_id() AND crm_is_researcher() AND status='Draft');
CREATE POLICY research_update ON research_records FOR UPDATE TO crm_app USING(crm_member(id)) WITH CHECK(crm_member(id));
REVOKE UPDATE,DELETE ON research_records FROM crm_app;
GRANT UPDATE(title,abstract,research_year,department) ON research_records TO crm_app;

ALTER TABLE study_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_members FORCE ROW LEVEL SECURITY;
CREATE POLICY member_read ON study_members FOR SELECT TO crm_app USING(crm_can_access(study_id));
CREATE POLICY member_add ON study_members FOR INSERT TO crm_app WITH CHECK(crm_owns_study(study_id) AND EXISTS(SELECT 1 FROM users WHERE id=user_id AND role IN ('student','faculty')));
CREATE POLICY member_remove ON study_members FOR DELETE TO crm_app USING(crm_owns_study(study_id) AND user_id<>crm_user_id());
ALTER TABLE review_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY assignment_read ON review_assignments FOR SELECT TO crm_app USING(crm_can_access(study_id));
-- Assignment provisioning is deliberately an operator operation, not a self-assignment API.
GRANT SELECT ON review_assignments TO crm_app;
GRANT SELECT,INSERT,DELETE ON study_members TO crm_app;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['research_feedback','staff_notes','documents'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 END LOOP;
END $$;
CREATE POLICY feedback_read ON research_feedback FOR SELECT TO crm_app USING(crm_can_access(study_id));
CREATE POLICY feedback_insert ON research_feedback FOR INSERT TO crm_app WITH CHECK(crm_assigned(study_id));
CREATE POLICY feedback_update ON research_feedback FOR UPDATE TO crm_app USING(crm_assigned(study_id)) WITH CHECK(crm_assigned(study_id));
CREATE POLICY notes_read ON staff_notes FOR SELECT TO crm_app USING(crm_assigned(study_id));
CREATE POLICY notes_insert ON staff_notes FOR INSERT TO crm_app WITH CHECK(crm_assigned(study_id));
CREATE POLICY notes_update ON staff_notes FOR UPDATE TO crm_app USING(crm_assigned(study_id)) WITH CHECK(crm_assigned(study_id));
CREATE POLICY document_read ON documents FOR SELECT TO crm_app USING(crm_can_access(study_id));
CREATE POLICY document_insert ON documents FOR INSERT TO crm_app WITH CHECK(crm_member(study_id) AND crm_is_researcher());
GRANT SELECT,INSERT,UPDATE ON research_feedback,staff_notes TO crm_app;
GRANT SELECT,INSERT ON documents TO crm_app;

-- Only explicitly approved catalogue fields cross the public boundary.
CREATE FUNCTION crm_public_research() RETURNS TABLE(id integer,title text,abstract text,status text,research_year integer,department text,normalized_title text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
AS $$ SELECT id,title,abstract,status,research_year,department,normalized_title FROM public.research_records WHERE status='Approved' $$;

CREATE TABLE audit_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_ref text NOT NULL,target_table text NOT NULL,target_record_id text NOT NULL,
 action_type text NOT NULL,old_value jsonb,new_value jsonb,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),request_id text,ip_address inet
);
CREATE FUNCTION crm_audit_mutation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE old_j jsonb; new_j jsonb; target text;
BEGIN
 IF TG_OP<>'INSERT' THEN old_j=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN new_j=to_jsonb(NEW); END IF;
 target=coalesce(new_j->>'id',old_j->>'id',new_j->>'study_id',old_j->>'study_id');
 -- Sensitive content is excluded even from staff audit projections.
 old_j=old_j-ARRAY['password_hash','abstract','internal_staff_notes','researcher_visible_feedback','object_key','sha256'];
 new_j=new_j-ARRAY['password_hash','abstract','internal_staff_notes','researcher_visible_feedback','object_key','sha256'];
 INSERT INTO public.audit_history(actor_ref,target_table,target_record_id,action_type,old_value,new_value,request_id,ip_address)
 VALUES(coalesce(public.crm_user_id()::text,'system'),TG_TABLE_NAME,target,TG_OP,old_j,new_j,
 nullif(current_setting('app.request_id',true),''),nullif(current_setting('app.ip',true),'')::inet);
 RETURN coalesce(NEW,OLD);
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['research_records','study_members','review_assignments','research_feedback','staff_notes','documents','consultation_tickets','consents','deletion_requests'] LOOP
  EXECUTE format('CREATE TRIGGER audit_mutation AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION crm_audit_mutation()',t);
 END LOOP;
END $$;
REVOKE ALL ON audit_history FROM PUBLIC,crm_app;
GRANT SELECT ON audit_history TO crm_app;
ALTER TABLE audit_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_history FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_read ON audit_history FOR SELECT TO crm_app USING(crm_is_staff());

CREATE TABLE rate_buckets(key text PRIMARY KEY,tokens double precision NOT NULL,updated_at timestamptz NOT NULL);
CREATE TABLE login_attempts(key text NOT NULL,request_id uuid NOT NULL,attempted_at timestamptz NOT NULL,PRIMARY KEY(key,request_id));
CREATE INDEX login_attempts_time ON login_attempts(attempted_at);
CREATE FUNCTION crm_take_token(k text,capacity integer,refill double precision) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE b public.rate_buckets; available double precision; instant timestamptz=clock_timestamp();
BEGIN
 IF capacity<1 OR capacity>1000 OR refill<=0 OR refill>100 THEN RAISE EXCEPTION 'Invalid bucket'; END IF;
 INSERT INTO public.rate_buckets VALUES(k,capacity,instant) ON CONFLICT DO NOTHING;
 SELECT * INTO b FROM public.rate_buckets WHERE key=k FOR UPDATE;
 available=least(capacity,b.tokens+greatest(0,extract(epoch FROM instant-b.updated_at))*refill);
 UPDATE public.rate_buckets SET tokens=greatest(0,available-CASE WHEN available>=1 THEN 1 ELSE 0 END),updated_at=instant WHERE key=k;
 RETURN available>=1;
END $$;
CREATE FUNCTION crm_reserve_login(account_key text,ip_key text,r uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE k text; instant timestamptz=clock_timestamp();
BEGIN
 -- Sorted locks make account/IP counters atomic across all API workers.
 FOR k IN SELECT x FROM unnest(ARRAY[account_key,ip_key]) x ORDER BY x LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended(k,812));
 END LOOP;
 DELETE FROM public.login_attempts WHERE key IN(account_key,ip_key) AND attempted_at<=instant-interval '15 minutes';
 IF EXISTS(SELECT 1 FROM public.login_attempts WHERE key IN(account_key,ip_key) GROUP BY key HAVING count(*)>=5) THEN RETURN false; END IF;
 INSERT INTO public.login_attempts VALUES(account_key,r,instant),(ip_key,r,instant);
 RETURN true;
END $$;
CREATE FUNCTION crm_finish_login(r uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public
AS $$ DELETE FROM public.login_attempts WHERE request_id=r $$;
REVOKE ALL ON rate_buckets,login_attempts FROM PUBLIC,crm_app;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'crm_%' AND p.prosecdef LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f.signature);
  IF f.signature::text NOT LIKE 'crm_audit_mutation%' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO crm_app',f.signature); END IF;
 END LOOP;
END $$;
