// =====================================================================
// Protección de páginas: exige sesión iniciada y, opcionalmente, un rol
// específico. También pinta el nombre de usuario en el header y
// muestra/oculta los enlaces del menú según el rol.
//
// Uso en cada página protegida:
//   const perfil = await protegerPagina(['administrador', 'bibliotecario']);
//   // perfil.rol, perfil.nombre_completo, perfil.id, etc.
//
// Pasa null o [] como roles permitidos si la página es válida para
// cualquier usuario autenticado (ej: dashboard.html, catalogo.html).
// =====================================================================

async function protegerPagina(rolesPermitidos) {
  const { data: sesionData } = await sb.auth.getSession();
  const sesion = sesionData.session;

  if (!sesion) {
    window.location.href = 'index.html';
    return null;
  }

  // Trae el perfil (nombre, rol, curso...) desde public.usuarios.
  const { data: perfil, error } = await sb
    .from('usuarios')
    .select('*')
    .eq('id', sesion.user.id)
    .single();

  // Sin perfil (o cuenta desactivada) = sin acceso a la app.
  if (error || !perfil || !perfil.activo) {
    await sb.auth.signOut();
    window.location.href = 'index.html';
    return null;
  }

  if (rolesPermitidos && rolesPermitidos.length > 0 && !rolesPermitidos.includes(perfil.rol)) {
    window.location.href = 'dashboard.html';
    return null;
  }

  pintarHeader(perfil);
  return perfil;
}

// Rellena el nombre/rol del usuario y filtra los enlaces del menú que
// tengan el atributo data-roles="administrador,bibliotecario" según
// corresponda al rol del usuario actual.
function pintarHeader(perfil) {
  const nombreEl = document.getElementById('nombre-usuario');
  if (nombreEl) nombreEl.textContent = `${perfil.nombre_completo} (${perfil.rol})`;

  document.querySelectorAll('[data-roles]').forEach((el) => {
    const rolesDelEnlace = el.getAttribute('data-roles').split(',').map((r) => r.trim());
    el.classList.toggle('oculto', !rolesDelEnlace.includes(perfil.rol));
  });

  const botonSalir = document.getElementById('btn-cerrar-sesion');
  if (botonSalir) botonSalir.addEventListener('click', cerrarSesion);
}
