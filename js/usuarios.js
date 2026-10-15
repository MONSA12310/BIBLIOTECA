// =====================================================================
// CRUD completo de usuarios (solo administrador).
//
// Crear un usuario implica dos pasos:
//   1. Registrar la cuenta en Supabase Auth (auth.signUp) usando un
//      cliente TEMPORAL (ver crearClienteTemporal en supabaseClient.js)
//      para no reemplazar la sesión del administrador que está logueado.
//   2. Insertar su perfil (nombre, rol, curso...) en public.usuarios
//      usando el cliente principal `sb` (ya autenticado como admin).
//
// Eliminar un usuario borra su fila en public.usuarios, lo que le quita
// el acceso a la app (guard.js exige que exista ese perfil). El registro
// de Auth queda huérfano porque borrarlo de verdad requiere la
// service_role key, que no debe usarse desde el navegador.
// =====================================================================

function mostrarMensaje(texto, tipo) {
  const el = document.getElementById('mensaje');
  el.textContent = texto;
  el.className = `mensaje ${tipo}`;
}

function actualizarVisibilidadCurso() {
  const esEstudiante = document.getElementById('usuario-rol').value === 'estudiante';
  document.getElementById('campo-curso').classList.toggle('oculto', !esEstudiante);
}
document.getElementById('usuario-rol').addEventListener('change', actualizarVisibilidadCurso);

function limpiarFormulario() {
  document.getElementById('form-usuario').reset();
  document.getElementById('usuario-id').value = '';
  document.getElementById('titulo-form').textContent = 'Crear usuario';
  document.getElementById('btn-guardar-usuario').textContent = 'Crear usuario';
  document.getElementById('btn-cancelar-edicion').classList.add('oculto');
  document.getElementById('campos-solo-creacion').classList.remove('oculto');
  document.getElementById('usuario-email').required = true;
  document.getElementById('usuario-password').required = true;
  actualizarVisibilidadCurso();
}

function cargarUsuarioEnFormulario(usuario) {
  document.getElementById('usuario-id').value = usuario.id;
  document.getElementById('usuario-nombre').value = usuario.nombre_completo;
  document.getElementById('usuario-rol').value = usuario.rol;
  document.getElementById('usuario-curso').value = usuario.curso || '';
  document.getElementById('usuario-documento').value = usuario.documento || '';

  // El correo/contraseña solo se piden al crear, no se pueden editar aquí.
  document.getElementById('campos-solo-creacion').classList.add('oculto');
  document.getElementById('usuario-email').required = false;
  document.getElementById('usuario-password').required = false;

  document.getElementById('titulo-form').textContent = `Editar: ${usuario.nombre_completo}`;
  document.getElementById('btn-guardar-usuario').textContent = 'Guardar cambios';
  document.getElementById('btn-cancelar-edicion').classList.remove('oculto');
  actualizarVisibilidadCurso();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function cargarTablaUsuarios() {
  const { data, error } = await sb.from('usuarios').select('*').order('nombre_completo');
  const cuerpo = document.getElementById('tabla-usuarios');
  cuerpo.innerHTML = '';

  if (error) {
    mostrarMensaje(`Error cargando usuarios: ${error.message}`, 'error');
    return;
  }

  data.forEach((usuario) => {
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${usuario.nombre_completo}</td>
      <td>${usuario.rol}</td>
      <td>${usuario.curso || '—'}</td>
      <td>${usuario.documento || '—'}</td>
      <td>${usuario.activo ? 'Sí' : 'No'}</td>
      <td class="acciones">
        <button class="secundario btn-editar" data-id="${usuario.id}">Editar</button>
        <button class="secundario btn-toggle" data-id="${usuario.id}" data-activo="${usuario.activo}">
          ${usuario.activo ? 'Desactivar' : 'Activar'}
        </button>
        <button class="peligro btn-eliminar" data-id="${usuario.id}">Eliminar</button>
      </td>
    `;
    cuerpo.appendChild(fila);

    fila.querySelector('.btn-editar').addEventListener('click', () => cargarUsuarioEnFormulario(usuario));
    fila.querySelector('.btn-toggle').addEventListener('click', () => alternarActivo(usuario.id, !usuario.activo));
    fila.querySelector('.btn-eliminar').addEventListener('click', () => eliminarUsuario(usuario.id));
  });
}

async function alternarActivo(id, nuevoEstado) {
  const { error } = await sb.from('usuarios').update({ activo: nuevoEstado }).eq('id', id);
  if (error) {
    mostrarMensaje(`No se pudo actualizar: ${error.message}`, 'error');
    return;
  }
  mostrarMensaje(nuevoEstado ? 'Usuario activado.' : 'Usuario desactivado.', 'exito');
  await cargarTablaUsuarios();
}

async function eliminarUsuario(id) {
  if (!confirm('¿Eliminar este usuario? Perderá el acceso a la aplicación.')) return;

  const { error } = await sb.from('usuarios').delete().eq('id', id);
  if (error) {
    mostrarMensaje(`No se pudo eliminar: ${error.message}`, 'error');
    return;
  }
  mostrarMensaje('Usuario eliminado.', 'exito');
  await cargarTablaUsuarios();
}

document.getElementById('btn-cancelar-edicion').addEventListener('click', limpiarFormulario);

document.getElementById('form-usuario').addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const id = document.getElementById('usuario-id').value;
  const boton = document.getElementById('btn-guardar-usuario');
  boton.disabled = true;

  const rol = document.getElementById('usuario-rol').value;
  const datosPerfil = {
    nombre_completo: document.getElementById('usuario-nombre').value.trim(),
    rol,
    curso: rol === 'estudiante' ? (document.getElementById('usuario-curso').value.trim() || null) : null,
    documento: document.getElementById('usuario-documento').value.trim() || null,
  };

  try {
    if (id) {
      // Edición: solo se actualiza el perfil.
      const { error } = await sb.from('usuarios').update(datosPerfil).eq('id', id);
      if (error) throw error;
      mostrarMensaje('Usuario actualizado.', 'exito');
    } else {
      // Creación: primero la cuenta de Auth (con un cliente temporal para
      // no perder la sesión del admin), luego el perfil.
      const email = document.getElementById('usuario-email').value.trim();
      const password = document.getElementById('usuario-password').value;

      const clienteTemporal = crearClienteTemporal();
      const { data, error: errorSignUp } = await clienteTemporal.auth.signUp({ email, password });
      if (errorSignUp) throw errorSignUp;

      const { error: errorPerfil } = await sb
        .from('usuarios')
        .insert({ id: data.user.id, ...datosPerfil });
      if (errorPerfil) throw errorPerfil;

      mostrarMensaje('Usuario creado correctamente.', 'exito');
    }

    limpiarFormulario();
    await cargarTablaUsuarios();
  } catch (error) {
    mostrarMensaje(`Error guardando el usuario: ${error.message}`, 'error');
  } finally {
    boton.disabled = false;
    boton.textContent = id ? 'Guardar cambios' : 'Crear usuario';
  }
});

(async () => {
  const perfil = await protegerPagina(['administrador']);
  if (!perfil) return;
  actualizarVisibilidadCurso();
  await cargarTablaUsuarios();
})();
