ALTER TABLE users ADD COLUMN active boolean NOT NULL DEFAULT true;
CREATE TABLE account_activations (
 token_hash text PRIMARY KEY CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 user_id integer NOT NULL REFERENCES users ON DELETE CASCADE,
 expires_at timestamptz NOT NULL,used_at timestamptz
);
CREATE OR REPLACE FUNCTION crm_login_user(e text) RETURNS TABLE(id integer,password_hash text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
AS $$ SELECT id,password_hash FROM public.users WHERE email=e AND active $$;
CREATE OR REPLACE FUNCTION crm_session_user(h text) RETURNS TABLE(id integer,role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
AS $$ SELECT u.id,u.role FROM public.sessions s JOIN public.users u ON u.id=s.user_id WHERE s.token_hash=h AND s.expires_at>now() AND u.active $$;
CREATE FUNCTION crm_invite(e text,r text,h text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE subject integer;
BEGIN
 IF NOT public.crm_is_staff() OR r NOT IN ('student','faculty') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 INSERT INTO public.users(email,password_hash,role,active) VALUES(e,'!',r,false) RETURNING id INTO subject;
 INSERT INTO public.account_activations VALUES(h,subject,clock_timestamp()+interval '15 minutes',NULL);
 RETURN subject;
END $$;
CREATE FUNCTION crm_activate(h text,new_hash text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE subject integer;
BEGIN
 SELECT user_id INTO subject FROM public.account_activations WHERE token_hash=h AND used_at IS NULL AND expires_at>clock_timestamp() FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.users SET password_hash=new_hash,active=true WHERE id=subject;
 UPDATE public.account_activations SET used_at=clock_timestamp() WHERE token_hash=h;
 DELETE FROM public.sessions WHERE user_id=subject;
 RETURN true;
END $$;
REVOKE ALL ON account_activations FROM PUBLIC,crm_app;
REVOKE ALL ON FUNCTION crm_invite(text,text,text),crm_activate(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION crm_invite(text,text,text),crm_activate(text,text) TO crm_app;
CREATE TABLE object_cleanup (
 document_id uuid PRIMARY KEY,object_key text NOT NULL,
 requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),completed_at timestamptz
);
CREATE FUNCTION crm_queue_object_cleanup() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN INSERT INTO public.object_cleanup(document_id,object_key) VALUES(OLD.id,OLD.object_key) ON CONFLICT DO NOTHING;RETURN OLD;END $$;
REVOKE ALL ON FUNCTION crm_queue_object_cleanup() FROM PUBLIC;
REVOKE ALL ON object_cleanup FROM PUBLIC,crm_app;
CREATE TRIGGER queue_object_cleanup BEFORE DELETE ON documents FOR EACH ROW EXECUTE FUNCTION crm_queue_object_cleanup();
