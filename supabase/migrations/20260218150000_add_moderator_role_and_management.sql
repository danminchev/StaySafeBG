-- Allow 'moderator' role by updating constraint
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_role_check') THEN
        ALTER TABLE public.user_roles DROP CONSTRAINT user_roles_role_check;
    END IF;
END $$;

ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check CHECK (role IN ('user', 'admin', 'moderator'));

-- Create function to update user role securely
CREATE OR REPLACE FUNCTION public.admin_update_user_role(target_user_id UUID, new_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Only admins can change user roles';
  END IF;

  -- Validate new role
  IF new_role NOT IN ('user', 'admin', 'moderator') THEN
    RAISE EXCEPTION 'Invalid role: %', new_role;
  END IF;

  -- Prevent admin from demoting themselves (optional safety, but good practice)
  IF target_user_id = auth.uid() AND new_role != 'admin' THEN
     RAISE EXCEPTION 'Admins cannot demote themselves';
  END IF;

  UPDATE public.user_roles
  SET role = new_role
  WHERE user_id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_user_role(UUID, TEXT) TO authenticated;
