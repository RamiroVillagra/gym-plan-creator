-- Plano del gimnasio (editor interactivo). Guarda el layout como un único
-- documento JSON: lista de items {id, kind, x, y, w, h, label, exerciseId}.
CREATE TABLE IF NOT EXISTS public.gym_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gym_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read gym_map"   ON public.gym_map FOR SELECT USING (true);
CREATE POLICY "Anyone can insert gym_map" ON public.gym_map FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update gym_map" ON public.gym_map FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete gym_map" ON public.gym_map FOR DELETE USING (true);
