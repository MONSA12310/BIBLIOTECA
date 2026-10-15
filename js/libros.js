// =====================================================================
// CRUD de libros (solo administrador/bibliotecario) + subida de la
// carátula al bucket público "portadas".
// =====================================================================

const PORTADA_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="90">' +
    '<rect width="100%" height="100%" fill="%23e5e9ef"/></svg>'
  );

function mostrarMensaje(texto, tipo) {
  const el = document.getElementById('mensaje');
  el.textContent = texto;
  el.className = `mensaje ${tipo}`;
}

// Sube el archivo de portada al bucket "portadas" y devuelve su URL pública.
async function subirPortada(archivo) {
  const nombreArchivo = `${Date.now()}-${archivo.name}`.replace(/\s+/g, '-');

  const { error: errorSubida } = await sb.storage.from('portadas').upload(nombreArchivo, archivo);
  if (errorSubida) throw errorSubida;

  const { data } = sb.storage.from('portadas').getPublicUrl(nombreArchivo);
  return data.publicUrl;
}

function limpiarFormulario() {
  document.getElementById('form-libro').reset();
  document.getElementById('libro-id').value = '';
  document.getElementById('titulo-form').textContent = 'Agregar libro';
  document.getElementById('btn-guardar-libro').textContent = 'Guardar';
  document.getElementById('btn-cancelar-edicion').classList.add('oculto');
}

function cargarLibroEnFormulario(libro) {
  document.getElementById('libro-id').value = libro.id;
  document.getElementById('libro-titulo').value = libro.titulo;
  document.getElementById('libro-autor').value = libro.autor || '';
  document.getElementById('libro-isbn').value = libro.isbn || '';
  document.getElementById('libro-categoria').value = libro.categoria || '';
  document.getElementById('libro-descripcion').value = libro.descripcion || '';
  document.getElementById('titulo-form').textContent = `Editar: ${libro.titulo}`;
  document.getElementById('btn-guardar-libro').textContent = 'Guardar cambios';
  document.getElementById('btn-cancelar-edicion').classList.remove('oculto');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function cargarTablaLibros() {
  const { data, error } = await sb.from('libros').select('*').order('titulo');
  const cuerpo = document.getElementById('tabla-libros');
  cuerpo.innerHTML = '';

  if (error) {
    mostrarMensaje(`Error cargando libros: ${error.message}`, 'error');
    return;
  }

  data.forEach((libro) => {
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td><img src="${libro.portada_url || PORTADA_PLACEHOLDER}" alt="" style="width:45px;height:65px;object-fit:cover;border-radius:4px;" /></td>
      <td>${libro.titulo}</td>
      <td>${libro.autor || '—'}</td>
      <td><span class="etiqueta-estado estado-${libro.estado}">${libro.estado}</span></td>
      <td class="acciones">
        <button class="secundario btn-editar" data-id="${libro.id}">Editar</button>
        <button class="peligro btn-eliminar" data-id="${libro.id}">Eliminar</button>
      </td>
    `;
    cuerpo.appendChild(fila);

    fila.querySelector('.btn-editar').addEventListener('click', () => cargarLibroEnFormulario(libro));
    fila.querySelector('.btn-eliminar').addEventListener('click', () => eliminarLibro(libro.id));
  });
}

async function eliminarLibro(id) {
  if (!confirm('¿Eliminar este libro del catálogo?')) return;

  const { error } = await sb.from('libros').delete().eq('id', id);
  if (error) {
    mostrarMensaje(`No se pudo eliminar: ${error.message}`, 'error');
    return;
  }
  mostrarMensaje('Libro eliminado.', 'exito');
  await cargarTablaLibros();
}

document.getElementById('btn-cancelar-edicion').addEventListener('click', limpiarFormulario);

document.getElementById('form-libro').addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const id = document.getElementById('libro-id').value;
  const archivoPortada = document.getElementById('libro-portada').files[0];
  const boton = document.getElementById('btn-guardar-libro');

  boton.disabled = true;
  boton.textContent = 'Guardando...';

  try {
    const datosLibro = {
      titulo: document.getElementById('libro-titulo').value.trim(),
      autor: document.getElementById('libro-autor').value.trim() || null,
      isbn: document.getElementById('libro-isbn').value.trim() || null,
      categoria: document.getElementById('libro-categoria').value.trim() || null,
      descripcion: document.getElementById('libro-descripcion').value.trim() || null,
    };

    if (archivoPortada) {
      datosLibro.portada_url = await subirPortada(archivoPortada);
    }

    let error;
    if (id) {
      ({ error } = await sb.from('libros').update(datosLibro).eq('id', id));
    } else {
      ({ error } = await sb.from('libros').insert(datosLibro));
    }

    if (error) throw error;

    mostrarMensaje(id ? 'Libro actualizado.' : 'Libro agregado.', 'exito');
    limpiarFormulario();
    await cargarTablaLibros();
  } catch (error) {
    mostrarMensaje(`Error guardando el libro: ${error.message}`, 'error');
  } finally {
    boton.disabled = false;
    boton.textContent = id ? 'Guardar cambios' : 'Guardar';
  }
});

(async () => {
  const perfil = await protegerPagina(['administrador', 'bibliotecario']);
  if (!perfil) return;
  await cargarTablaLibros();
})();
