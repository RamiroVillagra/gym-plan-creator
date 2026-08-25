-- Materiales · Grupos que comparten estación, ahora colgados de un turno.
-- Cada grupo pertenece a un turno (kiosk_group) para mantener el orden.
-- Si se borra el turno, se borran sus grupos que comparten.
ALTER TABLE public.sharing_groups
  ADD COLUMN IF NOT EXISTS kiosk_group_id uuid REFERENCES public.kiosk_groups(id) ON DELETE CASCADE;
