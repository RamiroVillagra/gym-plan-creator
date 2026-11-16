-- Tests aeróbicos por alumno. El resultado varía según el test: puede ser una
-- distancia (metros), un tiempo (segundos) o una velocidad (value + unit).
CREATE TABLE IF NOT EXISTS public.aerobic_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  test_date date NOT NULL DEFAULT CURRENT_DATE,
  name text NOT NULL,
  result_type text NOT NULL,   -- 'distancia' | 'tiempo' | 'velocidad'
  value numeric NOT NULL,      -- distancia en metros / tiempo en segundos / velocidad (segun unit)
  unit text,                   -- 'm' | 'seg' | 'km/h' | 'm/s'
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.aerobic_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read aerobic_tests"   ON public.aerobic_tests FOR SELECT USING (true);
CREATE POLICY "Anyone can insert aerobic_tests" ON public.aerobic_tests FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update aerobic_tests" ON public.aerobic_tests FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete aerobic_tests" ON public.aerobic_tests FOR DELETE USING (true);
