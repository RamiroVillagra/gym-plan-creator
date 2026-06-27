-- Permite registrar el valor de la unidad secundaria (seg / m / cm) por serie,
-- separado de weight_used (que queda solo para los kg).
-- Columna nullable: los registros existentes y los ejercicios que no usan
-- unidad secundaria simplemente la dejan en NULL.
ALTER TABLE public.workout_logs
  ADD COLUMN IF NOT EXISTS distance_done numeric;
