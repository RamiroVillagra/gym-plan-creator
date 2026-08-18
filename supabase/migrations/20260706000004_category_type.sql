-- Categorías de ejercicios con tipo (fuerza/aeróbico): 'strength' por defecto →
-- las categorías actuales quedan de Fuerza y NO aparecen en Aeróbico.
ALTER TABLE public.exercise_categories
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'strength';
