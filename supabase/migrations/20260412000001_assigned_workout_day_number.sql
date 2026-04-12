ALTER TABLE public.assigned_workouts ADD COLUMN IF NOT EXISTS day_number integer NOT NULL DEFAULT 1;
