
-- Create exercises table (library of exercises)
CREATE TABLE public.exercises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  muscle_group TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read exercises" ON public.exercises FOR SELECT USING (true);
CREATE POLICY "Anyone can insert exercises" ON public.exercises FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update exercises" ON public.exercises FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete exercises" ON public.exercises FOR DELETE USING (true);

-- Create clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read clients" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Anyone can insert clients" ON public.clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update clients" ON public.clients FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete clients" ON public.clients FOR DELETE USING (true);

-- Create routines table (template routines)
CREATE TABLE public.routines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read routines" ON public.routines FOR SELECT USING (true);
CREATE POLICY "Anyone can insert routines" ON public.routines FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update routines" ON public.routines FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete routines" ON public.routines FOR DELETE USING (true);

-- Create routine_exercises table (exercises in a routine template)
CREATE TABLE public.routine_exercises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  routine_id UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  sets INTEGER NOT NULL DEFAULT 3,
  reps INTEGER NOT NULL DEFAULT 10,
  weight NUMERIC,
  rest_seconds INTEGER DEFAULT 60,
  order_index INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.routine_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read routine_exercises" ON public.routine_exercises FOR SELECT USING (true);
CREATE POLICY "Anyone can insert routine_exercises" ON public.routine_exercises FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update routine_exercises" ON public.routine_exercises FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete routine_exercises" ON public.routine_exercises FOR DELETE USING (true);

-- Create assigned_workouts table (workouts assigned to clients on specific dates)
CREATE TABLE public.assigned_workouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  routine_id UUID REFERENCES public.routines(id) ON DELETE SET NULL,
  workout_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.assigned_workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read assigned_workouts" ON public.assigned_workouts FOR SELECT USING (true);
CREATE POLICY "Anyone can insert assigned_workouts" ON public.assigned_workouts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update assigned_workouts" ON public.assigned_workouts FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete assigned_workouts" ON public.assigned_workouts FOR DELETE USING (true);

-- Create workout_logs table (student logs actual weights/reps)
CREATE TABLE public.workout_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assigned_workout_id UUID NOT NULL REFERENCES public.assigned_workouts(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  reps_done INTEGER,
  weight_used NUMERIC,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read workout_logs" ON public.workout_logs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert workout_logs" ON public.workout_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update workout_logs" ON public.workout_logs FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete workout_logs" ON public.workout_logs FOR DELETE USING (true);
