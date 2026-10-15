// =====================================================================
// Vista del estudiante: sus propias reservas y préstamos.
// (La gestión de TODAS las reservas/préstamos, para el bibliotecario,
// vive en reservas.js y prestamos.js).
// =====================================================================

let perfilEstudiante = null;

function mostrarMensaje(texto, tipo) {
  const el = document.getElementById('mensaje');
  el.textContent = texto;
  el.className = `mensaje ${tipo}`;
}

async function cargarMisReservas() {
  const { data, error } = await sb
    .from('reservas')
    .select('id, fecha_reserva, estado, libros(titulo)')
    .eq('estudiante_id', perfilEstudiante.id)
    .order('fecha_reserva', { ascending: false });

  const cuerpo = document.getElementById('tabla-reservas');
  cuerpo.innerHTML = '';

  if (error) {
    mostrarMensaje(`Error cargando reservas: ${error.message}`, 'error');
    return;
  }

  if (data.length === 0) {
    cuerpo.innerHTML = '<tr><td colspan="4" class="texto-ayuda">Aún no tienes reservas.</td></tr>';
    return;
  }

  data.forEach((reserva) => {
    const fila = document.createElement('tr');
    const puedeCancelar = reserva.estado === 'pendiente';
    fila.innerHTML = `
      <td>${reserva.libros?.titulo ?? '—'}</td>
      <td>${new Date(reserva.fecha_reserva).toLocaleDateString()}</td>
      <td><span class="etiqueta-estado estado-${reserva.estado}">${reserva.estado}</span></td>
      <td>${puedeCancelar ? `<button class="secundario btn-cancelar" data-id="${reserva.id}">Cancelar</button>` : ''}</td>
    `;
    cuerpo.appendChild(fila);
  });

  cuerpo.querySelectorAll('.btn-cancelar').forEach((boton) => {
    boton.addEventListener('click', () => cancelarReserva(boton.dataset.id));
  });
}

async function cancelarReserva(reservaId) {
  const { error } = await sb.rpc('rpc_cancelar_reserva', { p_reserva_id: reservaId });
  if (error) {
    mostrarMensaje(`No se pudo cancelar: ${error.message}`, 'error');
    return;
  }
  mostrarMensaje('Reserva cancelada.', 'exito');
  await cargarMisReservas();
}

async function cargarMisPrestamos() {
  const { data, error } = await sb
    .from('prestamos')
    .select('id, fecha_prestamo, fecha_limite, estado, libros(titulo)')
    .eq('estudiante_id', perfilEstudiante.id)
    .order('fecha_prestamo', { ascending: false });

  const cuerpo = document.getElementById('tabla-prestamos');
  cuerpo.innerHTML = '';

  if (error) {
    mostrarMensaje(`Error cargando préstamos: ${error.message}`, 'error');
    return;
  }

  if (data.length === 0) {
    cuerpo.innerHTML = '<tr><td colspan="4" class="texto-ayuda">Aún no tienes préstamos.</td></tr>';
    return;
  }

  const hoy = new Date().toISOString().slice(0, 10);

  data.forEach((prestamo) => {
    const atrasado = prestamo.estado === 'activo' && prestamo.fecha_limite < hoy;
    const estadoMostrado = atrasado ? 'atrasado' : prestamo.estado;

    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${prestamo.libros?.titulo ?? '—'}</td>
      <td>${new Date(prestamo.fecha_prestamo).toLocaleDateString()}</td>
      <td>${prestamo.fecha_limite}</td>
      <td><span class="etiqueta-estado estado-${estadoMostrado}">${estadoMostrado}</span></td>
    `;
    cuerpo.appendChild(fila);
  });
}

(async () => {
  perfilEstudiante = await protegerPagina(['estudiante']);
  if (!perfilEstudiante) return;
  await Promise.all([cargarMisReservas(), cargarMisPrestamos()]);
})();
