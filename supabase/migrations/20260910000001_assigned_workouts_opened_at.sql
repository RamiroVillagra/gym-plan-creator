-- Asistencia: marca cuándo se ABRIÓ un entrenamiento (desde el modo alumno o
-- el modo sala). Si opened_at tiene valor → el alumno vino; si es null y la
-- fecha ya pasó → no vino. No afecta el registro de series ni el plan.
ALTER TABLE public.assigned_workouts
  ADD COLUMN IF NOT EXISTS opened_at timestamptz;
