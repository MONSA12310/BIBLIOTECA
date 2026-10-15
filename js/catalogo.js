// =====================================================================
// Catálogo de libros: muestra la carátula y el título de cada libro.
// Los estudiantes pueden reservar los que estén disponibles.
// =====================================================================

// Imagen de respaldo cuando un libro no tiene portada cargada.
const PORTADA_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300">' +
    '<rect width="100%" height="100%" fill="%23e5e9ef"/>' +
    '<text x="50%" y="50%" font-size="16" text-anchor="middle" fill="%23888" font-family="sans-serif">Sin portada</text>' +
    '</svg>'
  );

let perfilActual = null;
let librosCargados = [];

function normalizarTexto(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function mostrarMensaje(texto, tipo) {
  const el = document.getElementById('mensaje-catalogo');
  el.textContent = texto;
  el.className = `mensaje ${tipo}`;
}

function renderizarLibros(libros) {
  const grid = document.getElementById('grid-libros');
  grid.innerHTML = '';

  if (libros.length === 0) {
    grid.innerHTML = '<p class="texto-ayuda">No se encontraron libros.</p>';
    return;
  }

  libros.forEach((libro) => {
    const tarjeta = document.createElement('div');
    tarjeta.className = 'tarjeta-libro';

    const puedeReservar = perfilActual.rol === 'estudiante' && libro.estado === 'disponible';

    tarjeta.innerHTML = `
      <img class="portada" src="${libro.portada_url || PORTADA_PLACEHOLDER}" alt="Portada de ${libro.titulo}" />
      <div class="info">
        <div class="titulo-libro">${libro.titulo}</div>
        <div class="autor-libro">${libro.autor || 'Autor desconocido'}</div>
        <span class="etiqueta-estado estado-${libro.estado}">${libro.estado}</span>
        ${puedeReservar ? `<button class="btn-reservar" data-id="${libro.id}">Reservar</button>` : ''}
      </div>
    `;

    grid.appendChild(tarjeta);
  });

  grid.querySelectorAll('.btn-reservar').forEach((boton) => {
    boton.addEventListener('click', () => reservarLibro(boton.dataset.id, boton));
  });
}

async function reservarLibro(libroId, boton) {
  boton.disabled = true;
  boton.textContent = 'Reservando...';

  const { error } = await sb.rpc('rpc_crear_reserva', { p_libro_id: libroId });

  if (error) {
    mostrarMensaje(`No se pudo reservar: ${error.message}`, 'error');
    boton.disabled = false;
    boton.textContent = 'Reservar';
    return;
  }

  mostrarMensaje('Reserva creada. Espera a que el bibliotecario la apruebe.', 'exito');
  await cargarLibros();
}

async function cargarLibros() {
  const { data, error } = await sb.from('libros').select('*').order('titulo');
  if (error) {
    mostrarMensaje(`Error cargando el catálogo: ${error.message}`, 'error');
    return;
  }
  librosCargados = data || [];
  aplicarFiltro();
}

function aplicarFiltro() {
  const buscador = document.getElementById('buscador');
  const texto = normalizarTexto(buscador.value);
  const filtrados = librosCargados.filter((libro) =>
    [libro.titulo, libro.autor, libro.categoria]
      .map(normalizarTexto)
      .join(' ')
      .includes(texto)
  );
  renderizarLibros(filtrados);
}

document.getElementById('buscador').addEventListener('input', aplicarFiltro);

(async () => {
  perfilActual = await protegerPagina(null); // cualquier rol autenticado
  if (!perfilActual) return;
  await cargarLibros();
})();
