// =====================================================================
// Gestión de reservas para administrador/bibliotecario:
// aprobar (la convierte en préstamo) o rechazar.
// =====================================================================

function mostrarMensaje(texto, tipo) {
  const el = document.getElementById('mensaje');
  el.textContent = texto;
  el.className = `mensaje ${tipo}`;
}

async function cargarPendientes() {
  const { data, error } = await sb
    .from('reservas')
    .select('id, fecha_reserva, libros(titulo), estudiante:usuarios!reservas_estudiante_id_fkey(nombre_completo, curso)')
    .eq('estado', 'pendiente')
    .order('fecha_reserva');

  const cuerpo = document.getElementById('tabla-pendientes');
  cuerpo.innerHTML = '';

  if (error) {
    mostrarMensaje(`Error cargando reservas: ${error.message}`, 'error');
    return;
  }

  if (data.length === 0) {
    cuerpo.innerHTML = '<tr><td colspan="6" class="texto-ayuda">No hay reservas pendientes.</td></tr>';
    return;
  }

  data.forEach((reserva) => {
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${reserva.libros?.titulo ?? '—'}</td>
      <td>${reserva.estudiante?.nombre_completo ?? '—'}</td>
      <td>${reserva.estudiante?.curso ?? '—'}</td>
      <td>${new Date(reserva.fecha_reserva).toLocaleDateString()}</td>
      <td><input type="number" min="1" value="7" class="input-dias" style="width:70px" /></td>
      <td class="acciones">
        <button class="btn-aprobar" data-id="${reserva.id}">Aprobar</button>
        <button class="secundario btn-rechazar" data-id="${reserva.id}">Rechazar</button>
      </td>
    `;
    cuerpo.appendChild(fila);

    fila.querySelector('.btn-aprobar').addEventListener('click', () => {
      const dias = parseInt(fila.querySelector('.input-dias').value, 10) || 7;
      aprobarReserva(reserva.id, dias);
    });
    fila.querySelector('.btn-rechazar').addEventListener('click', () => rechazarReserva(reserva.id));
  });
}

async function aprobarReserva(reservaId, dias) {
  const { error } = await sb.rpc('rpc_aprobar_reserva', { p_reserva_id: reservaId, p_dias_prestamo: dias });
  if (error) {
    mostrarMensaje(`No se pudo aprobar: ${error.message}`, 'error');
    return;
  }
  mostrarMensaje('Reserva aprobada y convertida en préstamo.', 'exito');
  await Promise.all([cargarPendientes(), cargarHistorial()]);
}

async function rechazarReserva(reservaId) {
  const notas = prompt('Motivo del rechazo (opcional):') || null;
  const { error } = await sb.rpc('rpc_rechazar_reserva', { p_reserva_id: reservaId, p_notas: notas });
  if (error) {
    mostrarMensaje(`No se pudo rechazar: ${error.message}`, 'error');
    return;
  }
  mostrarMensaje('Reserva rechazada.', 'exito');
  await Promise.all([cargarPendientes(), cargarHistorial()]);
}

async function cargarHistorial() {
  const { data, error } = await sb
    .from('reservas')
    .select('id, fecha_reserva, estado, libros(titulo), estudiante:usuarios!reservas_estudiante_id_fkey(nombre_completo)')
    .neq('estado', 'pendiente')
    .order('fecha_reserva', { ascending: false })
    .limit(20);

  const cuerpo = document.getElementById('tabla-historial');
  cuerpo.innerHTML = '';

  if (error) {
    mostrarMensaje(`Error cargando historial: ${error.message}`, 'error');
    return;
  }

  if (data.length === 0) {
    cuerpo.innerHTML = '<tr><td colspan="4" class="texto-ayuda">Sin historial todavía.</td></tr>';
    return;
  }

  data.forEach((reserva) => {
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${reserva.libros?.titulo ?? '—'}</td>
      <td>${reserva.estudiante?.nombre_completo ?? '—'}</td>
      <td>${new Date(reserva.fecha_reserva).toLocaleDateString()}</td>
      <td><span class="etiqueta-estado estado-${reserva.estado}">${reserva.estado}</span></td>
    `;
    cuerpo.appendChild(fila);
  });
}

(async () => {
  const perfil = await protegerPagina(['administrador', 'bibliotecario']);
  if (!perfil) return;
  await Promise.all([cargarPendientes(), cargarHistorial()]);
})();
