
-- Exercise categories table
CREATE TABLE public.exercise_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.exercise_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read exercise_categories" ON public.exercise_categories FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert exercise_categories" ON public.exercise_categories FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update exercise_categories" ON public.exercise_categories FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete exercise_categories" ON public.exercise_categories FOR DELETE TO public USING (true);

-- Add category_id to exercises (keep muscle_group for backward compat)
ALTER TABLE public.exercises ADD COLUMN category_id uuid REFERENCES public.exercise_categories(id) ON DELETE SET NULL;

-- Add block and day support to routine_exercises
ALTER TABLE public.routine_exercises ADD COLUMN block_number integer NOT NULL DEFAULT 1;
ALTER TABLE public.routine_exercises ADD COLUMN day_number integer NOT NULL DEFAULT 1;

-- Add total_days to routines
ALTER TABLE public.routines ADD COLUMN total_days integer NOT NULL DEFAULT 1;
