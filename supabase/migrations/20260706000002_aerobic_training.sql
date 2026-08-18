-- Entrenamiento Aeróbico: tipo por ejercicio (default 'strength' → Fuerza intacto)
-- y campos aeróbicos opcionales. No toca nada de Fuerza.
ALTER TABLE public.routine_exercises
  ADD COLUMN IF NOT EXISTS workout_type    text NOT NULL DEFAULT 'strength',
  ADD COLUMN IF NOT EXISTS duration_seconds numeric,  -- Tiempo / Duración (seg)
  ADD COLUMN IF NOT EXISTS distance_meters  numeric,  -- Distancia (m)
  ADD COLUMN IF NOT EXISTS micro_pause      numeric,  -- Micro pausa (seg)
  ADD COLUMN IF NOT EXISTS macro_pause      numeric;  -- Macro pausa (seg)

ALTER TABLE public.assigned_workout_exercises
  ADD COLUMN IF NOT EXISTS workout_type    text NOT NULL DEFAULT 'strength',
  ADD COLUMN IF NOT EXISTS duration_seconds numeric,
  ADD COLUMN IF NOT EXISTS distance_meters  numeric,
  ADD COLUMN IF NOT EXISTS micro_pause      numeric,
  ADD COLUMN IF NOT EXISTS macro_pause      numeric;
