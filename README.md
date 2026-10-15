# Biblioteca IEMAB

Sistema simple de biblioteca escolar en HTML, CSS y JavaScript puro
(sin frameworks ni build tools), con [Supabase](https://supabase.com)
como backend: autenticación, base de datos Postgres y almacenamiento de
portadas de libros.

## Roles

- **Administrador**: CRUD completo de usuarios, gestiona libros,
  reservas y préstamos, ve el dashboard completo.
- **Bibliotecario**: gestiona libros, aprueba/rechaza reservas y
  registra préstamos/devoluciones.
- **Estudiante**: navega el catálogo, reserva libros y ve sus propios
  préstamos.

## 1. Crear el proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com) y crea un proyecto nuevo.
2. Ve a **Authentication → Providers → Email** y **desactiva** la opción
   "Confirm email". Esto es necesario porque las cuentas de estudiantes
   y bibliotecarios las crea el administrador desde la app, no ellos
   mismos, y deben poder iniciar sesión de inmediato.
3. Ve a **SQL Editor**, pega TODO el contenido de
   [`supabase/schema.sql`](supabase/schema.sql) y ejecútalo. Esto crea:
   - Las tablas `usuarios`, `libros`, `reservas`, `prestamos`.
   - Las políticas de seguridad (RLS) para cada rol.
   - Las funciones `rpc_crear_reserva`, `rpc_cancelar_reserva`,
     `rpc_aprobar_reserva`, `rpc_rechazar_reserva` y
     `rpc_registrar_devolucion`, que controlan el flujo
     reserva → préstamo → devolución de forma segura.
   - El bucket público `portadas` para las carátulas de los libros.

## 2. Crear el primer administrador

No es posible crear un usuario de Auth solo con SQL, así que este primer
paso es manual (los siguientes usuarios ya se crean desde la app):

1. En el Dashboard de Supabase, ve a **Authentication → Users → Add user**.
2. Ingresa un correo y una contraseña, y marca **Auto Confirm User**.
3. Copia el UUID que se generó para ese usuario.
4. En el **SQL Editor**, ejecuta (reemplazando los valores):

   ```sql
   insert into public.usuarios (id, nombre_completo, rol)
   values ('PEGA-AQUI-EL-UUID', 'Nombre del Administrador', 'administrador');
   ```

5. Ya puedes iniciar sesión con ese usuario y, desde `usuarios.html`,
   crear a los bibliotecarios y estudiantes del colegio.

## 3. Conectar el frontend con tu proyecto

Abre [`js/supabaseClient.js`](js/supabaseClient.js) y reemplaza:

```js
const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'TU-CLAVE-ANON-PUBLICA';
```

Ambos valores están en tu proyecto de Supabase, en
**Project Settings → API**. La `anon key` es pública y segura de exponer
en el navegador: todo el control de acceso real lo hacen las políticas
RLS del script SQL.

## 4. Ejecutar el sitio

Es un sitio estático: no requiere `npm install` ni build. Basta con
servirlo con cualquier servidor local (recomendado, en vez de abrir los
`.html` directamente con doble clic, para que el guardado de sesión
funcione bien en todos los navegadores):

- **VS Code**: extensión "Live Server" → clic derecho en `index.html` →
  "Open with Live Server".
- O con Node instalado: `npx serve .` desde esta carpeta.

Luego entra con el usuario administrador que creaste en el paso 2.

## Estructura del proyecto

```
index.html            Login
dashboard.html         Panel con resumen según el rol
catalogo.html          Catálogo de libros (portada + título), reservar
mis-reservas.html      Estudiante: sus reservas y préstamos
usuarios.html          Administrador: CRUD de usuarios
libros.html             Admin/Bibliotecario: CRUD de libros + portada
reservas.html           Admin/Bibliotecario: aprobar/rechazar reservas
prestamos.html          Admin/Bibliotecario: préstamos y devoluciones
css/style.css           Estilos de todo el sitio
js/                     Un archivo por página + supabaseClient/auth/guard
supabase/schema.sql     Script SQL completo (ejecutar en Supabase)
```

## Flujo de reserva y préstamo

1. El estudiante reserva un libro **disponible** desde `catalogo.html`
   (`rpc_crear_reserva`). El libro pasa a estado `reservado` para que
   nadie más lo reserve mientras tanto.
2. El bibliotecario/administrador ve la solicitud en `reservas.html` y:
   - **Aprueba** (`rpc_aprobar_reserva`): se crea el préstamo con una
     fecha límite de devolución y el libro pasa a `prestado`.
   - **Rechaza** (`rpc_rechazar_reserva`): el libro vuelve a
     `disponible`.
3. Cuando el estudiante devuelve el libro físicamente, el bibliotecario
   lo marca en `prestamos.html` (`rpc_registrar_devolucion`): el
   préstamo queda `devuelto` y el libro vuelve a `disponible`.

## Limitaciones conocidas (por diseño, para mantenerlo simple y seguro)

- **Eliminar un usuario** borra su perfil (`public.usuarios`), lo que le
  quita el acceso a la app de inmediato. Su cuenta de autenticación
  técnica (`auth.users`) queda huérfana, porque borrarla de verdad
  requiere la `service_role key` de Supabase, que nunca debe exponerse
  en código de navegador. Si en el futuro se necesita un borrado
  completo, la forma correcta es agregar una Supabase Edge Function que
  use esa clave desde el servidor.
- No hay recuperación de contraseña integrada en la interfaz; se puede
  añadir usando `sb.auth.resetPasswordForEmail(...)` si el colegio
  quiere que los estudiantes puedan cambiarla ellos mismos.
