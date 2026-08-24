-- Equipment Management (Materiales)
-- Fase 2 (staging): tablas de materiales y del mapeo ejercicio→material.
-- La Fase 1 (vista de ocupación por turno) NO usa estas tablas; quedan listas
-- para poblarse después sin romper nada.

-- Materiales / equipamiento del gimnasio
CREATE TABLE IF NOT EXISTS public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,   -- stock disponible en el gimnasio
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read materials"   ON public.materials FOR SELECT USING (true);
CREATE POLICY "Anyone can insert materials" ON public.materials FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update materials" ON public.materials FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete materials" ON public.materials FOR DELETE USING (true);

-- Qué materiales (y cuántas unidades) requiere cada ejercicio
CREATE TABLE IF NOT EXISTS public.exercise_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,   -- unidades que usa el ejercicio
  UNIQUE (exercise_id, material_id)
);
ALTER TABLE public.exercise_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read exercise_materials"   ON public.exercise_materials FOR SELECT USING (true);
CREATE POLICY "Anyone can insert exercise_materials" ON public.exercise_materials FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update exercise_materials" ON public.exercise_materials FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete exercise_materials" ON public.exercise_materials FOR DELETE USING (true);
