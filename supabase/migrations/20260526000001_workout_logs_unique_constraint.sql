-- Add unique constraint to workout_logs so upsert works correctly.
-- First remove any duplicate rows keeping the most recent one per (workout, exercise, set).
DELETE FROM public.workout_logs a
USING public.workout_logs b
WHERE a.id < b.id
  AND a.assigned_workout_id = b.assigned_workout_id
  AND a.exercise_id = b.exercise_id
  AND a.set_number = b.set_number;

-- Now add the constraint
ALTER TABLE public.workout_logs
  ADD CONSTRAINT workout_logs_unique_set
  UNIQUE (assigned_workout_id, exercise_id, set_number);
