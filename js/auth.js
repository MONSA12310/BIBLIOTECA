// =====================================================================
// Lógica de inicio de sesión / cierre de sesión.
// Se usa en index.html (login) y desde guard.js (botón "Salir").
// =====================================================================

// Cierra la sesión actual y vuelve al login.
async function cerrarSesion() {
  await sb.auth.signOut();
  window.location.href = 'index.html';
}

// Solo corre esta parte si estamos en la página de login (existe el form).
document.addEventListener('DOMContentLoaded', () => {
  const formLogin = document.getElementById('form-login');
  if (!formLogin) return; // no estamos en index.html, no hacer nada

  const mensaje = document.getElementById('mensaje-login');

  // Si ya hay una sesión activa, saltar directo al dashboard.
  sb.auth.getSession().then(({ data }) => {
    if (data.session) window.location.href = 'dashboard.html';
  });

  formLogin.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    mensaje.className = 'mensaje oculto';

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const boton = formLogin.querySelector('button[type="submit"]');

    boton.disabled = true;
    boton.textContent = 'Ingresando...';

    const { error } = await sb.auth.signInWithPassword({ email, password });

    boton.disabled = false;
    boton.textContent = 'Ingresar';

    if (error) {
      mensaje.textContent = 'Correo o contraseña incorrectos.';
      mensaje.className = 'mensaje error';
      return;
    }

    window.location.href = 'dashboard.html';
  });
});
