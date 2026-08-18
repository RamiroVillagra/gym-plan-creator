-- Tipo del ejercicio en la biblioteca: 'strength' por defecto → los ejercicios
-- actuales quedan de Fuerza y NO aparecen en Aeróbico.
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'strength';

-- Registro aeróbico del alumno: tiempo realizado por serie.
-- (la distancia realizada usa distance_done, que ya existe en workout_logs)
ALTER TABLE public.workout_logs
  ADD COLUMN IF NOT EXISTS duration_done numeric;
