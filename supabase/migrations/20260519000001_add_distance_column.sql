-- Add distance column to store cm/m value separately from weight (kg)
-- Used when unit is 'm' or 'cm': format becomes sets x reps x weight(kg) x distance(m/cm)

ALTER TABLE public.routine_exercises ADD COLUMN IF NOT EXISTS distance NUMERIC;
ALTER TABLE public.assigned_workout_exercises ADD COLUMN IF NOT EXISTS distance NUMERIC;
ALTER TABLE public.workout_block_exercises ADD COLUMN IF NOT EXISTS distance NUMERIC;
