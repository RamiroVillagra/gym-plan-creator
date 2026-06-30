-- Permite que un coach liste las cuentas de acceso (id + email) para vincularlas
-- a un alumno desde la app, sin copiar el UID a mano en el panel de Supabase.
-- SECURITY DEFINER: la función puede leer auth.users (la app con la key pública no).
CREATE OR REPLACE FUNCTION public.list_auth_accounts()
RETURNS TABLE (id uuid, email text, linked_client text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo coaches pueden ver el listado de cuentas
  IF NOT public.has_role(auth.uid(), 'coach'::app_role) THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT u.id,
           u.email::text,
           (SELECT c.name FROM public.clients c WHERE c.user_id = u.id LIMIT 1) AS linked_client
    FROM auth.users u
    ORDER BY u.email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_auth_accounts() TO authenticated;
