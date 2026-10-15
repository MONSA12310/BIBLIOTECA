// =====================================================================
// Panel de control: muestra tarjetas de resumen distintas según el rol
// del usuario que inició sesión.
// =====================================================================

// Pequeño helper para contar filas de una tabla con filtros opcionales.
async function contar(tabla, filtros) {
  let consulta = sb.from(tabla).select('*', { count: 'exact', head: true });
  (filtros || []).forEach(([columna, operador, valor]) => {
    consulta = consulta[operador](columna, valor);
  });
  const { count } = await consulta;
  return count || 0;
}

function crearTarjeta(numero, etiqueta) {
  const div = document.createElement('div');
  div.className = 'tarjeta-resumen';
  div.innerHTML = `<div class="numero">${numero}</div><div class="etiqueta">${etiqueta}</div>`;
  return div;
}

async function cargarResumenAdministrador(contenedor) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [estudiantes, bibliotecarios, libros, prestamosActivos, atrasados, reservasPendientes] = await Promise.all([
    contar('usuarios', [['rol', 'eq', 'estudiante']]),
    contar('usuarios', [['rol', 'eq', 'bibliotecario']]),
    contar('libros', []),
    contar('prestamos', [['estado', 'eq', 'activo']]),
    contar('prestamos', [['estado', 'eq', 'activo'], ['fecha_limite', 'lt', hoy]]),
    contar('reservas', [['estado', 'eq', 'pendiente']]),
  ]);

  contenedor.append(
    crearTarjeta(estudiantes, 'Estudiantes registrados'),
    crearTarjeta(bibliotecarios, 'Bibliotecarios'),
    crearTarjeta(libros, 'Libros en catálogo'),
    crearTarjeta(prestamosActivos, 'Préstamos activos'),
    crearTarjeta(atrasados, 'Préstamos atrasados'),
    crearTarjeta(reservasPendientes, 'Reservas pendientes'),
  );
}

async function cargarResumenBibliotecario(contenedor) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [disponibles, prestados, reservasPendientes, prestamosActivos, atrasados] = await Promise.all([
    contar('libros', [['estado', 'eq', 'disponible']]),
    contar('libros', [['estado', 'eq', 'prestado']]),
    contar('reservas', [['estado', 'eq', 'pendiente']]),
    contar('prestamos', [['estado', 'eq', 'activo']]),
    contar('prestamos', [['estado', 'eq', 'activo'], ['fecha_limite', 'lt', hoy]]),
  ]);

  contenedor.append(
    crearTarjeta(disponibles, 'Libros disponibles'),
    crearTarjeta(prestados, 'Libros prestados'),
    crearTarjeta(reservasPendientes, 'Reservas por atender'),
    crearTarjeta(prestamosActivos, 'Préstamos activos'),
    crearTarjeta(atrasados, 'Préstamos atrasados'),
  );
}

async function cargarResumenEstudiante(contenedor, perfil) {
  const [reservasPendientes, prestamosActivos] = await Promise.all([
    contar('reservas', [['estudiante_id', 'eq', perfil.id], ['estado', 'eq', 'pendiente']]),
    contar('prestamos', [['estudiante_id', 'eq', perfil.id], ['estado', 'eq', 'activo']]),
  ]);

  contenedor.append(
    crearTarjeta(reservasPendientes, 'Reservas pendientes'),
    crearTarjeta(prestamosActivos, 'Libros que tengo prestados'),
  );
}

(async () => {
  const perfil = await protegerPagina(null); // cualquier rol autenticado
  if (!perfil) return;

  document.getElementById('titulo-bienvenida').textContent = `Hola, ${perfil.nombre_completo.split(' ')[0]}`;

  const contenedor = document.getElementById('resumen');

  if (perfil.rol === 'administrador') await cargarResumenAdministrador(contenedor);
  else if (perfil.rol === 'bibliotecario') await cargarResumenBibliotecario(contenedor);
  else await cargarResumenEstudiante(contenedor, perfil);
})();
