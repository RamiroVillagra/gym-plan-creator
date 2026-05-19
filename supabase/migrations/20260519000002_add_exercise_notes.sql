-- Add coach notes field to exercises (visible to students in kiosk and student view)
ALTER TABLE public.routine_exercises ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.assigned_workout_exercises ADD COLUMN IF NOT EXISTS notes TEXT;
