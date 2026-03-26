
CREATE TABLE public.assigned_workout_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_workout_id uuid NOT NULL REFERENCES public.assigned_workouts(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  sets integer NOT NULL DEFAULT 3,
  reps integer NOT NULL DEFAULT 10,
  weight numeric,
  order_index integer NOT NULL DEFAULT 0,
  block_number integer NOT NULL DEFAULT 1,
  day_number integer NOT NULL DEFAULT 1,
  rest_seconds integer DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assigned_workout_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read assigned_workout_exercises" ON public.assigned_workout_exercises FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert assigned_workout_exercises" ON public.assigned_workout_exercises FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update assigned_workout_exercises" ON public.assigned_workout_exercises FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete assigned_workout_exercises" ON public.assigned_workout_exercises FOR DELETE TO public USING (true);
