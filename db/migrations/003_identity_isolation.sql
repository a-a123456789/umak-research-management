CREATE FUNCTION crm_login_user(e text) RETURNS TABLE(id integer,password_hash text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
AS $$ SELECT id,password_hash FROM public.users WHERE email=e $$;
CREATE FUNCTION crm_session_user(h text) RETURNS TABLE(id integer,role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
AS $$ SELECT u.id,u.role FROM public.sessions s JOIN public.users u ON u.id=s.user_id WHERE s.token_hash=h AND s.expires_at>now() $$;
CREATE FUNCTION crm_rehash_password(u integer,old_hash text,new_hash text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public
AS $$ UPDATE public.users SET password_hash=new_hash WHERE id=u AND password_hash=old_hash $$;
CREATE FUNCTION crm_researcher_user(u integer) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
AS $$ SELECT EXISTS(SELECT 1 FROM public.users WHERE id=u AND role IN ('student','faculty')) $$;
REVOKE ALL ON FUNCTION crm_login_user(text),crm_session_user(text),crm_rehash_password(integer,text,text),crm_researcher_user(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION crm_login_user(text),crm_session_user(text),crm_rehash_password(integer,text,text),crm_researcher_user(integer) TO crm_app;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY profile_read ON users FOR SELECT TO crm_app USING(id=crm_user_id());
CREATE POLICY profile_update ON users FOR UPDATE TO crm_app USING(id=crm_user_id()) WITH CHECK(id=crm_user_id());
CREATE POLICY profile_delete ON users FOR DELETE TO crm_app USING(crm_is_staff() AND role IN ('student','faculty'));
REVOKE INSERT,UPDATE ON users FROM crm_app;
GRANT UPDATE(email) ON users TO crm_app;
CREATE TRIGGER audit_mutation AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION crm_audit_mutation();
DROP POLICY member_add ON study_members;
CREATE POLICY member_add ON study_members FOR INSERT TO crm_app WITH CHECK(crm_owns_study(study_id) AND crm_researcher_user(user_id));
ALTER TABLE consultation_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_tickets FORCE ROW LEVEL SECURITY;
CREATE POLICY ticket_read ON consultation_tickets FOR SELECT TO crm_app USING(requester_id=crm_user_id() OR crm_is_staff());
CREATE POLICY ticket_insert ON consultation_tickets FOR INSERT TO crm_app WITH CHECK(requester_id=crm_user_id());
CREATE POLICY ticket_update ON consultation_tickets FOR UPDATE TO crm_app USING(requester_id=crm_user_id() OR crm_is_staff()) WITH CHECK(requester_id=crm_user_id() OR crm_is_staff());
REVOKE DELETE ON consultation_tickets FROM crm_app;
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents FORCE ROW LEVEL SECURITY;
CREATE POLICY consent_read ON consents FOR SELECT TO crm_app USING(user_id=crm_user_id());
CREATE POLICY consent_insert ON consents FOR INSERT TO crm_app WITH CHECK(user_id=crm_user_id());
REVOKE UPDATE,DELETE ON consents FROM crm_app;
ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE deletion_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY deletion_read ON deletion_requests FOR SELECT TO crm_app USING(user_id=crm_user_id() OR crm_is_staff());
CREATE POLICY deletion_insert ON deletion_requests FOR INSERT TO crm_app WITH CHECK(user_id=crm_user_id());
CREATE POLICY deletion_update ON deletion_requests FOR UPDATE TO crm_app USING(user_id=crm_user_id() OR crm_is_staff()) WITH CHECK(user_id=crm_user_id() OR crm_is_staff());
REVOKE DELETE ON deletion_requests FROM crm_app;
