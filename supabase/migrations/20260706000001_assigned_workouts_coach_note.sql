-- Separa el mensaje del coach (coach_note) del comentario del alumno (notes).
-- coach_note: lo que el coach escribe al planificar; se copia al "Copiar a otros días".
-- notes: sigue siendo el comentario del alumno/sesión (kiosco / vista alumno); NO se copia.
ALTER TABLE public.assigned_workouts
  ADD COLUMN IF NOT EXISTS coach_note text;
