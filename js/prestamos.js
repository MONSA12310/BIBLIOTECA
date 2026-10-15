// =====================================================================
// Gestión de préstamos para administrador/bibliotecario:
// ver préstamos activos (con aviso de atraso) y registrar devoluciones.
// =====================================================================

function mostrarMensaje(texto, tipo) {
  const el = document.getElementById('mensaje');
  el.textContent = texto;
  el.className = `mensaje ${tipo}`;
}

async function cargarActivos() {
  const { data, error } = await sb
    .from('prestamos')
    .select('id, fecha_prestamo, fecha_limite, estado, libros(titulo), estudiante:usuarios!prestamos_estudiante_id_fkey(nombre_completo, curso)')
    .eq('estado', 'activo')
    .order('fecha_limite');

  const cuerpo = document.getElementById('tabla-activos');
  cuerpo.innerHTML = '';

  if (error) {
    mostrarMensaje(`Error cargando préstamos: ${error.message}`, 'error');
    return;
  }

  if (data.length === 0) {
    cuerpo.innerHTML = '<tr><td colspan="7" class="texto-ayuda">No hay préstamos activos.</td></tr>';
    return;
  }

  const hoy = new Date().toISOString().slice(0, 10);

  data.forEach((prestamo) => {
    const atrasado = prestamo.fecha_limite < hoy;
    const estadoMostrado = atrasado ? 'atrasado' : prestamo.estado;

    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${prestamo.libros?.titulo ?? '—'}</td>
      <td>${prestamo.estudiante?.nombre_completo ?? '—'}</td>
      <td>${prestamo.estudiante?.curso ?? '—'}</td>
      <td>${new Date(prestamo.fecha_prestamo).toLocaleDateString()}</td>
      <td>${prestamo.fecha_limite}</td>
      <td><span class="etiqueta-estado estado-${estadoMostrado}">${estadoMostrado}</span></td>
      <td><button class="btn-devolver" data-id="${prestamo.id}">Registrar devolución</button></td>
    `;
    cuerpo.appendChild(fila);

    fila.querySelector('.btn-devolver').addEventListener('click', () => registrarDevolucion(prestamo.id));
  });
}

async function registrarDevolucion(prestamoId) {
  const { error } = await sb.rpc('rpc_registrar_devolucion', { p_prestamo_id: prestamoId });
  if (error) {
    mostrarMensaje(`No se pudo registrar la devolución: ${error.message}`, 'error');
    return;
  }
  mostrarMensaje('Devolución registrada. El libro vuelve a estar disponible.', 'exito');
  await Promise.all([cargarActivos(), cargarDevueltos()]);
}

async function cargarDevueltos() {
  const { data, error } = await sb
    .from('prestamos')
    .select('id, fecha_devolucion, libros(titulo), estudiante:usuarios!prestamos_estudiante_id_fkey(nombre_completo)')
    .eq('estado', 'devuelto')
    .order('fecha_devolucion', { ascending: false })
    .limit(20);

  const cuerpo = document.getElementById('tabla-devueltos');
  cuerpo.innerHTML = '';

  if (error) {
    mostrarMensaje(`Error cargando devoluciones: ${error.message}`, 'error');
    return;
  }

  if (data.length === 0) {
    cuerpo.innerHTML = '<tr><td colspan="3" class="texto-ayuda">Sin devoluciones todavía.</td></tr>';
    return;
  }

  data.forEach((prestamo) => {
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${prestamo.libros?.titulo ?? '—'}</td>
      <td>${prestamo.estudiante?.nombre_completo ?? '—'}</td>
      <td>${new Date(prestamo.fecha_devolucion).toLocaleDateString()}</td>
    `;
    cuerpo.appendChild(fila);
  });
}

(async () => {
  const perfil = await protegerPagina(['administrador', 'bibliotecario']);
  if (!perfil) return;
  await Promise.all([cargarActivos(), cargarDevueltos()]);
})();
