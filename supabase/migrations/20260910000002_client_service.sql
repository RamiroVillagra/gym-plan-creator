-- Servicio que toma cada alumno: 'delta_mas' o 'delta_academia'. Nullable: los
-- alumnos que ya existen no tienen ninguno cargado hasta que se asigne uno.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS service text;
