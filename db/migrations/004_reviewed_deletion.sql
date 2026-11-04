CREATE FUNCTION crm_complete_deletion(request integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE subject integer;
BEGIN
 IF NOT public.crm_is_staff() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT user_id INTO subject FROM public.deletion_requests WHERE id=request AND status='pending' FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.deletion_requests SET status='completed',completed_at=clock_timestamp() WHERE id=request;
 DELETE FROM public.users WHERE id=subject AND role IN ('student','faculty');
 INSERT INTO public.audit_logs(actor_id,action) VALUES(public.crm_user_id(),'deletion.completed');
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION crm_complete_deletion(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION crm_complete_deletion(integer) TO crm_app;
REVOKE DELETE ON users FROM crm_app;
