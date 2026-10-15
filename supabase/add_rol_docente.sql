-- Agrega "docente" a los roles permitidos en public.usuarios.
-- Ejecutar en el SQL Editor de Supabase.
-- Este cambio no modifica las políticas RLS ni concede permisos de staff.

begin;

alter table public.usuarios
  drop constraint if exists usuarios_rol_check;

alter table public.usuarios
  add constraint usuarios_rol_check
  check (rol in ('administrador', 'bibliotecario', 'estudiante', 'docente'));

commit;