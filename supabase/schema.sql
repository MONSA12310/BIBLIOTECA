-- =====================================================================
-- SISTEMA DE BIBLIOTECA ESCOLAR - IEMAB
-- Script completo para ejecutar en el Editor SQL de Supabase.
-- Correr TODO este archivo de una sola vez, de arriba hacia abajo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. EXTENSIONES
-- pgcrypto nos da gen_random_uuid() para generar IDs automáticamente.
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto;

-- =====================================================================
-- 1. TABLAS
-- =====================================================================

-- Perfil de cada usuario de la app. El id ES el mismo id de auth.users
-- (se crea la cuenta en Auth primero, y luego se inserta aquí su perfil).
create table public.usuarios (
  id              uuid primary key references auth.users (id) on delete cascade,
  nombre_completo text not null,
  rol             text not null check (rol in ('administrador', 'bibliotecario', 'estudiante')),
  curso           text,        -- solo aplica a estudiantes (ej: "11-A")
  documento       text,        -- número de identificación (opcional)
  activo          boolean not null default true,
  created_at      timestamptz not null default now()
);

comment on table public.usuarios is 'Perfil y rol de cada usuario del sistema (1 a 1 con auth.users).';

-- Catálogo de libros. Al ser un solo ejemplar por título, "estado"
-- controla si se puede reservar o no.
create table public.libros (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null,
  autor        text,
  isbn         text,
  categoria    text,
  descripcion  text,
  portada_url  text,        -- URL pública del bucket "portadas"
  estado       text not null default 'disponible'
               check (estado in ('disponible', 'reservado', 'prestado')),
  created_at   timestamptz not null default now(),
  created_by   uuid references public.usuarios (id)
);

comment on table public.libros is 'Catálogo de libros de la biblioteca (un ejemplar por título).';

-- Reserva: paso previo al préstamo. La hace el estudiante.
create table public.reservas (
  id             uuid primary key default gen_random_uuid(),
  libro_id       uuid not null references public.libros (id) on delete cascade,
  estudiante_id  uuid not null references public.usuarios (id) on delete cascade,
  fecha_reserva  timestamptz not null default now(),
  estado         text not null default 'pendiente'
                 check (estado in ('pendiente', 'aprobada', 'rechazada', 'cancelada', 'convertida')),
  atendido_por   uuid references public.usuarios (id),  -- bibliotecario que la gestionó
  fecha_atencion timestamptz,
  notas          text
);

comment on table public.reservas is 'Solicitudes de reserva de libros hechas por estudiantes.';

-- Préstamo: se crea cuando un bibliotecario aprueba y entrega una reserva.
create table public.prestamos (
  id                uuid primary key default gen_random_uuid(),
  libro_id          uuid not null references public.libros (id) on delete cascade,
  estudiante_id     uuid not null references public.usuarios (id) on delete cascade,
  reserva_id        uuid references public.reservas (id),
  bibliotecario_id  uuid not null references public.usuarios (id),
  fecha_prestamo    timestamptz not null default now(),
  fecha_limite      date not null,
  fecha_devolucion  timestamptz,
  estado            text not null default 'activo'
                    check (estado in ('activo', 'devuelto'))
);

comment on table public.prestamos is 'Préstamos activos e históricos de libros a estudiantes.';

-- Índices útiles para las consultas más frecuentes de la app.
create index idx_reservas_estudiante on public.reservas (estudiante_id);
create index idx_reservas_estado on public.reservas (estado);
create index idx_prestamos_estudiante on public.prestamos (estudiante_id);
create index idx_prestamos_estado on public.prestamos (estado);
create index idx_libros_estado on public.libros (estado);

-- =====================================================================
-- 2. FUNCIÓN AUXILIAR: rol del usuario autenticado actual
-- SECURITY DEFINER + search_path fijo para poder usarla dentro de las
-- políticas RLS sin caer en recursión infinita sobre "usuarios".
-- =====================================================================
create or replace function public.get_my_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select rol from public.usuarios where id = auth.uid();
$$;

comment on function public.get_my_role() is 'Devuelve el rol (administrador/bibliotecario/estudiante) del usuario autenticado actual.';

-- =====================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- =====================================================================
alter table public.usuarios  enable row level security;
alter table public.libros    enable row level security;
alter table public.reservas  enable row level security;
alter table public.prestamos enable row level security;

-- ---------------- usuarios ----------------
-- Un estudiante/bibliotecario puede ver su propio perfil.
create policy "usuarios_select_propio"
  on public.usuarios for select
  using (id = auth.uid());

-- Admin y bibliotecario pueden ver todos los perfiles.
create policy "usuarios_select_staff"
  on public.usuarios for select
  using (public.get_my_role() in ('administrador', 'bibliotecario'));

-- Solo el administrador crea, edita o elimina cuentas.
create policy "usuarios_insert_admin"
  on public.usuarios for insert
  with check (public.get_my_role() = 'administrador');

create policy "usuarios_update_admin"
  on public.usuarios for update
  using (public.get_my_role() = 'administrador');

create policy "usuarios_delete_admin"
  on public.usuarios for delete
  using (public.get_my_role() = 'administrador');

-- ---------------- libros ----------------
-- Cualquier usuario autenticado (staff o estudiante) puede ver el catálogo.
create policy "libros_select_autenticados"
  on public.libros for select
  using (auth.uid() is not null);

-- Solo admin/bibliotecario administran el catálogo.
create policy "libros_insert_staff"
  on public.libros for insert
  with check (public.get_my_role() in ('administrador', 'bibliotecario'));

create policy "libros_update_staff"
  on public.libros for update
  using (public.get_my_role() in ('administrador', 'bibliotecario'));

create policy "libros_delete_staff"
  on public.libros for delete
  using (public.get_my_role() in ('administrador', 'bibliotecario'));

-- ---------------- reservas ----------------
-- El estudiante ve y crea sus propias reservas.
create policy "reservas_select_propia_o_staff"
  on public.reservas for select
  using (
    estudiante_id = auth.uid()
    or public.get_my_role() in ('administrador', 'bibliotecario')
  );

create policy "reservas_insert_propia"
  on public.reservas for insert
  with check (
    estudiante_id = auth.uid()
    and public.get_my_role() = 'estudiante'
  );

-- No se permiten UPDATE directos desde el cliente: todos los cambios de
-- estado de una reserva pasan por las funciones RPC de la sección 4,
-- que corren con privilegios elevados y validan las reglas de negocio.

-- ---------------- prestamos ----------------
create policy "prestamos_select_propio_o_staff"
  on public.prestamos for select
  using (
    estudiante_id = auth.uid()
    or public.get_my_role() in ('administrador', 'bibliotecario')
  );

-- Igual que reservas: la escritura de préstamos solo ocurre vía RPC.

-- =====================================================================
-- 4. PERMISOS BASE (GRANT)
-- RLS solo FILTRA filas; antes de eso, Postgres exige el permiso base
-- sobre la tabla. Sin este GRANT, cualquier consulta del rol
-- "authenticated" falla con "permission denied for table ..." (42501)
-- aunque las políticas de la sección 3 estén perfectas.
-- =====================================================================
grant usage on schema public to authenticated;

grant select, insert, update, delete
  on public.usuarios, public.libros, public.reservas, public.prestamos
  to authenticated;

-- =====================================================================
-- 5. FUNCIONES RPC (máquina de estados reserva -> préstamo -> devolución)
-- Cada una es SECURITY DEFINER: valida el rol/dueño manualmente y luego
-- hace los cambios necesarios en una sola transacción atómica.
-- =====================================================================

-- 4.1 Estudiante reserva un libro disponible.
create or replace function public.rpc_crear_reserva(p_libro_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserva_id uuid;
  v_estado_libro text;
begin
  if public.get_my_role() <> 'estudiante' then
    raise exception 'Solo un estudiante puede reservar libros';
  end if;

  select estado into v_estado_libro from public.libros where id = p_libro_id for update;

  if v_estado_libro is null then
    raise exception 'El libro no existe';
  end if;

  if v_estado_libro <> 'disponible' then
    raise exception 'El libro no está disponible para reserva';
  end if;

  insert into public.reservas (libro_id, estudiante_id, estado)
  values (p_libro_id, auth.uid(), 'pendiente')
  returning id into v_reserva_id;

  update public.libros set estado = 'reservado' where id = p_libro_id;

  return v_reserva_id;
end;
$$;

-- 4.2 Estudiante cancela su propia reserva pendiente.
create or replace function public.rpc_cancelar_reserva(p_reserva_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_libro_id uuid;
  v_estudiante_id uuid;
  v_estado text;
begin
  select libro_id, estudiante_id, estado
    into v_libro_id, v_estudiante_id, v_estado
    from public.reservas where id = p_reserva_id for update;

  if v_estudiante_id is null then
    raise exception 'La reserva no existe';
  end if;

  if v_estudiante_id <> auth.uid() then
    raise exception 'No puedes cancelar una reserva que no es tuya';
  end if;

  if v_estado <> 'pendiente' then
    raise exception 'Solo se pueden cancelar reservas pendientes';
  end if;

  update public.reservas set estado = 'cancelada' where id = p_reserva_id;
  update public.libros set estado = 'disponible' where id = v_libro_id;
end;
$$;

-- 4.3 Bibliotecario/admin aprueba una reserva y la convierte en préstamo.
create or replace function public.rpc_aprobar_reserva(p_reserva_id uuid, p_dias_prestamo int default 7)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_libro_id uuid;
  v_estudiante_id uuid;
  v_estado text;
  v_prestamo_id uuid;
begin
  if public.get_my_role() not in ('administrador', 'bibliotecario') then
    raise exception 'No autorizado';
  end if;

  select libro_id, estudiante_id, estado
    into v_libro_id, v_estudiante_id, v_estado
    from public.reservas where id = p_reserva_id for update;

  if v_estudiante_id is null then
    raise exception 'La reserva no existe';
  end if;

  if v_estado <> 'pendiente' then
    raise exception 'Solo se pueden aprobar reservas pendientes';
  end if;

  update public.reservas
    set estado = 'convertida', atendido_por = auth.uid(), fecha_atencion = now()
    where id = p_reserva_id;

  insert into public.prestamos (libro_id, estudiante_id, reserva_id, bibliotecario_id, fecha_limite)
  values (v_libro_id, v_estudiante_id, p_reserva_id, auth.uid(), (current_date + p_dias_prestamo))
  returning id into v_prestamo_id;

  update public.libros set estado = 'prestado' where id = v_libro_id;

  return v_prestamo_id;
end;
$$;

-- 4.4 Bibliotecario/admin rechaza una reserva.
create or replace function public.rpc_rechazar_reserva(p_reserva_id uuid, p_notas text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_libro_id uuid;
  v_estado text;
begin
  if public.get_my_role() not in ('administrador', 'bibliotecario') then
    raise exception 'No autorizado';
  end if;

  select libro_id, estado into v_libro_id, v_estado
    from public.reservas where id = p_reserva_id for update;

  if v_libro_id is null then
    raise exception 'La reserva no existe';
  end if;

  if v_estado <> 'pendiente' then
    raise exception 'Solo se pueden rechazar reservas pendientes';
  end if;

  update public.reservas
    set estado = 'rechazada', atendido_por = auth.uid(), fecha_atencion = now(), notas = p_notas
    where id = p_reserva_id;

  update public.libros set estado = 'disponible' where id = v_libro_id;
end;
$$;

-- 4.5 Bibliotecario/admin registra la devolución de un préstamo.
create or replace function public.rpc_registrar_devolucion(p_prestamo_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_libro_id uuid;
  v_estado text;
begin
  if public.get_my_role() not in ('administrador', 'bibliotecario') then
    raise exception 'No autorizado';
  end if;

  select libro_id, estado into v_libro_id, v_estado
    from public.prestamos where id = p_prestamo_id for update;

  if v_libro_id is null then
    raise exception 'El préstamo no existe';
  end if;

  if v_estado <> 'activo' then
    raise exception 'Este préstamo ya fue devuelto';
  end if;

  update public.prestamos
    set estado = 'devuelto', fecha_devolucion = now()
    where id = p_prestamo_id;

  update public.libros set estado = 'disponible' where id = v_libro_id;
end;
$$;

-- =====================================================================
-- 6. STORAGE: bucket público para portadas de libros
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('portadas', 'portadas', true)
on conflict (id) do nothing;

-- Lectura: como el bucket es público, Supabase ya sirve los archivos por
-- URL pública sin pasar por RLS. Igual dejamos una policy explícita de
-- SELECT por claridad y para el acceso vía API con las claves normales.
create policy "portadas_select_publico"
  on storage.objects for select
  using (bucket_id = 'portadas');

-- Escritura: solo admin/bibliotecario pueden subir/editar/borrar portadas.
create policy "portadas_insert_staff"
  on storage.objects for insert
  with check (bucket_id = 'portadas' and public.get_my_role() in ('administrador', 'bibliotecario'));

create policy "portadas_update_staff"
  on storage.objects for update
  using (bucket_id = 'portadas' and public.get_my_role() in ('administrador', 'bibliotecario'));

create policy "portadas_delete_staff"
  on storage.objects for delete
  using (bucket_id = 'portadas' and public.get_my_role() in ('administrador', 'bibliotecario'));

-- =====================================================================
-- 7. PRIMER USUARIO ADMINISTRADOR (pasos manuales, NO se ejecutan solos)
-- =====================================================================
-- No se puede crear un usuario de Auth por SQL de forma soportada.
-- Pasos:
--   1. Ir al Dashboard de Supabase -> Authentication -> Users -> "Add user".
--      Crear el usuario con email y contraseña, marcando "Auto Confirm User".
--   2. Copiar el UUID que se generó para ese usuario.
--   3. Ejecutar (reemplazando los valores) SOLO esta última sentencia:
--
-- insert into public.usuarios (id, nombre_completo, rol)
-- values ('PEGA-AQUI-EL-UUID', 'Nombre del Administrador', 'administrador');
--
-- Con ese usuario ya puedes entrar a la app y crear desde ahí a los demás
-- bibliotecarios y estudiantes (usuarios.html).
-- =====================================================================
