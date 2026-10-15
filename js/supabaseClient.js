// =====================================================================
// Conexión a Supabase, compartida por todas las páginas.
// Este script se carga DESPUÉS del <script> del SDK de Supabase (CDN)
// y ANTES de cualquier otro script propio (auth.js, guard.js, etc).
// =====================================================================

// TODO: reemplaza estos dos valores por los de tu proyecto de Supabase
// (Dashboard -> Project Settings -> API).
const SUPABASE_URL = 'https://ovppnhrgkqjhrszcebml.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92cHBuaHJna3FqaHJzemNlYm1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNzM5NjQsImV4cCI6MjEwMjY0OTk2NH0.03Z5s17I61sIqRxkfZXrkiiHIcU3wLqNq7qSu3gDJ2I';

// Cliente principal: guarda la sesión de quien inició sesión (login normal).
// Todas las páginas lo usan a través de la variable global `sb`.
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Crea un cliente "desechable" SIN sesión persistente.
// Se usa únicamente en usuarios.js para que el administrador pueda dar de
// alta una cuenta nueva (auth.signUp) sin que esa llamada reemplace su
// propia sesión guardada en `sb` (evita "perder" el login del admin).
function crearClienteTemporal() {
  return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
