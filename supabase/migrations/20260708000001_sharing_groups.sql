-- Materiales · Grupos que comparten estación (Fase 2)
-- Alumnos que, por decisión del coach, comparten un material a la vez. En la
-- vista "Por material", los integrantes de un mismo grupo que usan el mismo
-- material en el mismo bloque se cuentan como UNO (no inflan la demanda).
-- No afecta nada del entrenamiento ni del Modo Sala; solo el cálculo de ocupación.

CREATE TABLE IF NOT EXISTS public.sharing_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sharing_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read sharing_groups"   ON public.sharing_groups FOR SELECT USING (true);
CREATE POLICY "Anyone can insert sharing_groups" ON public.sharing_groups FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update sharing_groups" ON public.sharing_groups FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete sharing_groups" ON public.sharing_groups FOR DELETE USING (true);

CREATE TABLE IF NOT EXISTS public.sharing_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sharing_group_id uuid NOT NULL REFERENCES public.sharing_groups(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  UNIQUE (sharing_group_id, client_id)
);
ALTER TABLE public.sharing_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read sharing_group_members"   ON public.sharing_group_members FOR SELECT USING (true);
CREATE POLICY "Anyone can insert sharing_group_members" ON public.sharing_group_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update sharing_group_members" ON public.sharing_group_members FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete sharing_group_members" ON public.sharing_group_members FOR DELETE USING (true);
