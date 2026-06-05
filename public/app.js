const contentArea = document.getElementById('contentArea');
const dashboardCards = document.getElementById('dashboardCards');
const loadDashboard = document.getElementById('loadDashboard');
const loadInventario = document.getElementById('loadInventario');
const loadUsuarios = document.getElementById('loadUsuarios');
const loadAreas = document.getElementById('loadAreas');
const loadMantenimientos = document.getElementById('loadMantenimientos');
const loadAdmin = document.getElementById('loadAdmin');
const btnLogout = document.getElementById('btnLogout');
const mainNav = document.getElementById('mainNav');
const userInfo = document.getElementById('userInfo');

const apiBase = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';
const navButtons = [loadDashboard, loadInventario, loadUsuarios, loadAreas, loadMantenimientos, loadAdmin];
let currentUser = null;

loadDashboard.addEventListener('click', () => { setActiveTab(loadDashboard); loadDashboardData(); });
loadInventario.addEventListener('click', () => { setActiveTab(loadInventario); loadActivos(); });
loadUsuarios.addEventListener('click', () => { setActiveTab(loadUsuarios); loadUsuariosData(); });
loadAreas.addEventListener('click', () => { setActiveTab(loadAreas); loadAreasData(); });
loadMantenimientos.addEventListener('click', () => { setActiveTab(loadMantenimientos); loadMantenimientosData(); });
loadAdmin.addEventListener('click', () => { setActiveTab(loadAdmin); loadAdminPanel(); });
btnLogout.addEventListener('click', logout);

async function fetchApi(endpoint, options = {}) {
  const url = apiBase + endpoint;
  const res = await fetch(url, options);
  if (!res.ok) {
    let errorText = 'Error al cargar datos';
    try {
      const json = await res.json();
      errorText = json.error || JSON.stringify(json);
    } catch {
      errorText = await res.text();
    }
    throw new Error(errorText || 'Error al cargar datos');
  }
  return res.json();
}

function setActiveTab(button) {
  navButtons.forEach(btn => {
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-outline-light');
  });
  button.classList.remove('btn-outline-light');
  button.classList.add('btn-primary');
}

function renderAlert(type, message) {
  return `<div class="alert alert-${type} mt-3" role="alert">${message}</div>`;
}

function renderAuthScreen(message = '') {
  mainNav.style.display = 'none';
  dashboardCards.style.display = 'none';
  contentArea.innerHTML = `
<div class="row gy-4 justify-content-center">
<div class="col-lg-5">
    <div class="card border-0 shadow-sm p-4">
      <h3 class="card-title">Iniciar sesión</h3>
      <p class="text-muted">Ingresa con tu usuario y contraseña para gestionar el inventario.</p>
      ${message ? renderAlert('warning', message) : ''}
      <form id="loginForm">
        <div class="mb-3">
          <label class="form-label">Usuario</label>
          <input class="form-control" id="loginUsername" name="username" type="text" required />
        </div>
        <div class="mb-3">
          <label class="form-label">Contraseña</label>
          <input class="form-control" id="loginPassword" name="password" type="password" required />
        </div>
        <div class="mb-3 text-end">
          <button type="button" class="btn btn-link p-0" id="forgotPasswordButton">¿Olvidaste tu contraseña?</button>
        </div>
        <button type="submit" class="btn btn-primary">Entrar</button>
      </form>
    </div>
  </div>
<div class="col-lg-5">
    <div class="card border-0 shadow-sm p-4 h-100">
      <h3 class="card-title">Registrar cuenta</h3>
      <p class="text-muted">Crea un usuario nuevo para acceder al sistema de ITrack.</p>
      <form id="registerForm">
        <div class="mb-3">
          <label class="form-label">Nombre completo</label>
          <input class="form-control" id="registerName" name="nombre" type="text" required />
        </div>
        <div class="mb-3">
          <label class="form-label">Usuario</label>
          <input class="form-control" id="registerUsername" name="username" type="text" required />
        </div>
        <div class="mb-3">
          <label class="form-label">Correo</label>
          <input class="form-control" id="registerEmail" name="email" type="email" placeholder="usuario@dominio.com" />
        </div>
        <div class="mb-3">
          <label class="form-label">Contraseña</label>
          <input class="form-control" id="registerPassword" name="password" type="password" required />
        </div>
        <button type="submit" class="btn btn-outline-primary">Registrar</button>
      </form>
    </div>
  </div>
</div>
`;

  document.getElementById('loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const formData = new FormData(event.target);
      const payload = {
        username: formData.get('username'),
        password: formData.get('password')
      };
      const result = await postApi('/api/login', payload);
      currentUser = result.user;
      renderApp();
    } catch (error) {
      renderAuthScreen('Usuario o contraseña incorrectos.');
    }
  });
  document.getElementById('forgotPasswordButton').addEventListener('click', renderForgotPasswordScreen);

  document.getElementById('registerForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const formData = new FormData(event.target);
      const payload = {
        nombre: formData.get('nombre'),
        username: formData.get('username'),
        password: formData.get('password'),
        email: formData.get('email')
      };
      const result = await postApi('/api/register', payload);
      currentUser = result.user;
      renderApp();
    } catch (error) {
      const message = error.message.includes('ya existe') ? 'El usuario ya existe.' : 'No se pudo registrar. Intenta de nuevo.';
      renderAuthScreen(message);
    }
  });
}

function renderForgotPasswordScreen(message = '', type = 'info') {
  mainNav.style.display = 'none';
  dashboardCards.style.display = 'none';
  contentArea.innerHTML = `
    <div class="row gy-4 justify-content-center">
      <div class="col-lg-8">
        <div class="card border-0 shadow-sm p-4">
          <h3 class="card-title">Recuperar contraseña</h3>
          <p class="text-muted">Ingresa tu usuario y correo. Puedes recibir una contraseña nueva por email o establecer una nueva contraseña directamente.</p>
          ${message ? renderAlert(type, message) : ''}
          <div class="row g-4">
            <div class="col-md-6">
              <div class="card border-1 p-3 h-100">
                <h5>Enviar contraseña por correo</h5>
                <form id="formForgotEmail">
                  <div class="mb-3">
                    <label class="form-label">Usuario</label>
                    <input class="form-control" id="forgotUsernameEmail" name="username" type="text" required />
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Correo</label>
                    <input class="form-control" id="forgotEmail" name="email" type="email" required />
                  </div>
                  <button type="submit" class="btn btn-primary">Enviar por correo</button>
                </form>
              </div>
            </div>
            <div class="col-md-6">
              <div class="card border-1 p-3 h-100">
                <h5>Elegir contraseña nueva</h5>
                <form id="formForgotChange">
                  <div class="mb-3">
                    <label class="form-label">Usuario</label>
                    <input class="form-control" id="forgotUsernameChange" name="username" type="text" required />
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Correo</label>
                    <input class="form-control" id="forgotEmailChange" name="email" type="email" required />
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Nueva contraseña</label>
                    <input class="form-control" id="forgotNewPassword" name="newPassword" type="password" required />
                  </div>
                  <button type="submit" class="btn btn-secondary">Cambiar contraseña</button>
                </form>
              </div>
            </div>
          </div>
          <div class="mt-4 text-end">
            <button type="button" class="btn btn-link" id="backToLogin">Volver al inicio de sesión</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('formForgotEmail').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const formData = new FormData(event.target);
      const payload = {
        username: formData.get('username'),
        email: formData.get('email')
      };
      const result = await postApi('/api/forgot-password/email', payload);
      renderForgotPasswordScreen(result.message, 'success');
    } catch (error) {
      renderForgotPasswordScreen(error.message || 'No se pudo enviar el correo.', 'danger');
    }
  });

  document.getElementById('formForgotChange').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const formData = new FormData(event.target);
      const payload = {
        username: formData.get('username'),
        email: formData.get('email'),
        newPassword: formData.get('newPassword')
      };
      const result = await postApi('/api/forgot-password/change', payload);
      renderForgotPasswordScreen(result.message, 'success');
    } catch (error) {
      renderForgotPasswordScreen(error.message || 'No se pudo cambiar la contraseña.', 'danger');
    }
  });

  document.getElementById('backToLogin').addEventListener('click', () => renderAuthScreen());
}

function renderApp() {
  mainNav.style.display = 'flex';
  dashboardCards.style.display = '';
  loadAdmin.style.display = isRole('admin') ? '' : 'none';
  updateUserInfo();
  setActiveTab(loadDashboard);
  loadDashboardData();
}

function getRoleLabel(role) {
  const labels = { admin: 'Admin', technician: 'Técnico', user: 'Usuario' };
  return labels[role] || role;
}

function updateUserInfo() {
  if (!userInfo) return;
  userInfo.innerText = currentUser ? `Sesión: ${currentUser.nombre} (${getRoleLabel(currentUser.role)})` : '';
}

function isRole(...roles) {
  return currentUser && roles.includes(currentUser.role);
}

async function logout() {
  try { await postApi('/api/logout', {}); } catch (error) {}
  currentUser = null;
  renderAuthScreen();
}

async function checkAuth() {
  try {
    const status = await fetchApi('/api/auth-status');
    if (status.authenticated) {
      currentUser = status.user;
      renderApp();
    } else {
      renderAuthScreen();
    }
  } catch (error) {
    renderAuthScreen('No se pudo verificar la sesión.');
  }
}

async function postApi(endpoint, data) {
  return fetchApi(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

checkAuth();

function createTable(title, description, headers, rows) {
  return `
    <h3 class="card-title">${title}</h3>
    <p class="text-muted">${description}</p>
    <div class="table-responsive">
      <table class="table table-hover align-middle">
        <thead class="table-light">
          <tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderForm(title, fields, submitId, submitLabel) {
  const fieldsHtml = fields.map(field => `
      <div class="mb-3">
        <label class="form-label" for="${field.id}">${field.label}</label>
        <${field.type === 'textarea' ? 'textarea' : 'input'}
          class="form-control"
          id="${field.id}"
          name="${field.id}"
          ${field.type !== 'textarea' ? `type="${field.type}"` : ''}
          ${field.placeholder ? `placeholder="${field.placeholder}"` : ''}
          ${field.required ? 'required' : ''}
          ${field.type === 'textarea' ? 'rows="3"' : ''}
        ></${field.type === 'textarea' ? 'textarea' : 'input'}>
      </div>
    `).join('');
  return `
    <div class="mt-4">
      <h4>${title}</h4>
      <form id="${submitId}">
        ${fieldsHtml}
        <button type="submit" class="btn btn-primary">${submitLabel}</button>
      </form>
    </div>
  `;
}

async function loadAdminPanel() {
  try {
      const adminUsers = await fetchApi('/api/admin/users');
      const rows = adminUsers.map(user => `
  <tr>
    <td>${user._id}</td>
    <td>${user.nombre}</td>
    <td>${getRoleLabel(user.role)}</td>
    <td>${user.username}</td>
    <td>
      ${user.username !== 'admin' ? `
        <button class="btn btn-danger btn-sm" onclick="deleteUser('${user._id}')">Eliminar</button>
      ` : `<span class="text-success">Protegido</span>`}
    </td>
  </tr>
`).join('');

      contentArea.innerHTML = `
       ${createTable(
  'Panel de administración',
  'Sección exclusiva para administradores. Visualiza los usuarios de acceso y su rol.',
  ['ID', 'Nombre', 'Rol', 'Usuario', 'Acción'],
  rows
)}
        <div class="mt-4">
          <h5>Acciones de administrador</h5>
          <p class="text-muted">Este panel te permite verificar a los usuarios que pueden entrar al sistema. Solo los administradores tienen acceso.</p>
        </div>
      `;
  } catch (error) {
    setRequestError('No se pudo cargar el panel de administración.');
  }
}

function setRequestError(message) {
  if (window.location.protocol === 'file:') {
    message += ' Abre la app desde el servidor con `npm start` y usa `http://localhost:3000`.';
  }
  contentArea.innerHTML = renderAlert('danger', message);
}

async function loadDashboardData() {
  try {
    const data = await fetchApi('/api/dashboard');
    dashboardCards.innerHTML = `
  <div class="dashboard-item rounded-4 p-3 text-center">
    <h6 class="text-info">Equipos Totales</h6>
    <h2 class="text-white">${data.totalActivos}</h2>
  </div>
  <div class="dashboard-item rounded-4 p-3 text-center">
    <h6 class="text-info">Estado del sistema</h6>
    <p class="text-success mb-1">🟢 En línea</p>
    <small class="text-muted">Todo funcionando correctamente</small>
  </div>
  <div class="dashboard-item rounded-4 p-3 text-center">
    <h6 class="text-info">Actividad</h6>
    <small class="text-muted">${data.totalMantenimientos} mantenimientos registrados</small>
  </div>
  <div class="dashboard-item rounded-4 p-3 text-center">
    <h6 class="text-info">Usuarios</h6>
    <h3 class="text-white">${data.totalUsuarios}</h3>
  </div>
`;

    contentArea.innerHTML = `
  <h3 class="card-title">Dashboard</h3>
  <p class="text-muted">Visión de inventario con estadísticas del sistema.</p>
  <div class="card border-0 shadow-sm p-4 h-100">
    <h5 class="mb-4">Estadísticas del inventario</h5>
    <canvas id="inventoryChart" height="120"></canvas>
  </div>
`;
    const ctx = document.getElementById('inventoryChart').getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Computadoras', 'Impresoras', 'Switches', 'Usuarios', 'Mantenimientos'],
        datasets: [{
          label: 'Cantidad',
          data: [data.totalComputadoras, data.totalImpresoras, data.totalSwitches, data.totalUsuarios, data.totalMantenimientos],
          backgroundColor: ['rgba(0,255,255,0.7)', 'rgba(13,110,253,0.7)', 'rgba(170,0,255,0.7)', 'rgba(0,255,140,0.7)', 'rgba(255,0,255,0.7)'],
          borderColor: ['#00ffff', '#0d6efd', '#aa00ff', '#00ff8c', '#ff00ff'],
          borderWidth: 2,
          borderRadius: 12,
          hoverBorderWidth: 4
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#d9f8ff', font: { size: 14 } } } },
        scales: {
          x: { ticks: { color: '#9be7ff' }, grid: { color: 'rgba(0,255,255,.08)' } },
          y: { beginAtZero: true, ticks: { color: '#9be7ff' }, grid: { color: 'rgba(0,255,255,.08)' } }
        },
        animation: { duration: 2000 }
      }
    });
  } catch (error) {
    setRequestError('No se pudo cargar el dashboard. Intenta recargar la página.');
  }
}

async function deleteRecord(endpoint, id, callback) {
  if (!confirm('¿Estás seguro de que deseas eliminar este registro?')) return;
  try {
    await fetchApi(`${endpoint}/${id}`, { method: 'DELETE' });
    callback();
  } catch (error) {
    alert('Error al eliminar. Intenta nuevamente.');
  }
}

async function loadActivos() {
  try {
    const activos = await fetchApi('/api/activos');
    const canDelete = isRole('admin');
    const canAdd = isRole('admin', 'technician');
    const headers = ['ID', 'Categoría', 'Tipo', 'Marca', 'Serie', 'Estado', 'Área'];
    if (canDelete) headers.push('Acción');

    const rows = activos.map(activo => `
      <tr>
        <td>${activo._id}</td>
        <td>${activo.categoria}</td>
        <td>${activo.tipo || activo.type || 'N/A'}</td>
        <td>${activo.marca}</td>
        <td>${activo.serial}</td>
        <td>${activo.estado}</td>
        <td>${activo.area}</td>
        ${canDelete ? `<td><button class="btn btn-sm btn-danger" onclick="deleteRecord('/api/activos', '${activo._id}', loadActivos)">Eliminar</button></td>` : ''}
      </tr>
    `).join('');

    contentArea.innerHTML = `
      ${createTable('Inventario de equipos', 'Registros de computadoras, impresoras y switches con sus números de serie y ubicación.', headers, rows)}
      ${canAdd ? renderForm('Registrar nuevo activo', [
        { id: 'categoria', label: 'Categoría', type: 'text', placeholder: 'Computadora / Impresora / Switch', required: true },
        { id: 'tipo', label: 'Tipo', type: 'text', placeholder: 'Laptop, Impresora láser, Switch 24 puertos', required: true },
        { id: 'marca', label: 'Marca', type: 'text', placeholder: 'Dell, HP, Cisco', required: true },
        { id: 'serial', label: 'Número de serie', type: 'text', placeholder: 'DL-0034', required: true },
        { id: 'estado', label: 'Estado', type: 'text', placeholder: 'Activo / En mantenimiento', required: true },
        { id: 'area', label: 'Área', type: 'text', placeholder: 'Finanzas, Redes', required: true }
      ], 'formActivos', 'Registrar activo') : ''}
    `;

    if (canAdd) {
      document.getElementById('formActivos').addEventListener('submit', async event => {
        event.preventDefault();
        try {
          const formData = new FormData(event.target);
          const response = await fetch('/api/activos', {
            method: 'POST',
            body: formData
          });
          if (!response.ok) throw new Error('Error al registrar activo');
          alert('Activo registrado correctamente ✅');
          loadActivos();
        } catch (error) {
          console.error(error);
          alert('No se pudo guardar el activo.');
        }
      });
    }
  } catch (error) {
    setRequestError('No se pudo cargar los activos. Intenta nuevamente.');
  }
}

async function loadUsuariosData() {
  try {
    const usuarios = await fetchApi('/api/usuarios');
    const canAdmin = isRole('admin');
    const headers = ['ID', 'Nombre', 'Cargo', 'Área'];
    if (canAdmin) headers.push('Acción');

    const rows = usuarios.map(usuario => `
      <tr>
        <td>${usuario.id}</td>
        <td>${usuario.nombre}</td>
        <td>${usuario.cargo}</td>
        <td>${usuario.area}</td>
        ${canAdmin ? `<td><button class="btn btn-sm btn-danger" onclick="deleteRecord('/api/usuarios', ${usuario.id}, loadUsuariosData)">Eliminar</button></td>` : ''}
      </tr>
    `).join('');

    contentArea.innerHTML = `
      ${createTable('Usuarios registrados', 'Lista de usuarios asignados a equipos y áreas del inventario.', headers, rows)}
      ${canAdmin ? renderForm('Registrar nuevo usuario', [
        { id: 'nombre', label: 'Nombre completo', type: 'text', placeholder: 'Ana Pérez', required: true },
        { id: 'cargo', label: 'Cargo', type: 'text', placeholder: 'Analista, Técnico', required: true },
        { id: 'area', label: 'Área', type: 'text', placeholder: 'Finanzas, Redes', required: true }
      ], 'formUsuarios', 'Registrar usuario') : ''}
    `;

    if (canAdmin) {
      document.getElementById('formUsuarios').addEventListener('submit', async event => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const payload = {
          nombre: formData.get('nombre'),
          cargo: formData.get('cargo'),
          area: formData.get('area')
        };
        await postApi('/api/usuarios', payload);
        loadUsuariosData();
      });
    }
  } catch (error) {
    setRequestError('No se pudo cargar los usuarios. Intenta nuevamente.');
  }
}

async function loadAreasData() {
  try {
    const areas = await fetchApi('/api/areas');
    const canAdmin = isRole('admin');
    const headers = ['ID', 'Área'];
    if (canAdmin) headers.push('Acción');

    const rows = areas.map(area => `
      <tr>
        <td>${area.id}</td>
        <td>${area.nombre}</td>
        ${canAdmin ? `<td><button class="btn btn-sm btn-danger" onclick="deleteRecord('/api/areas', ${area.id}, loadAreasData)">Eliminar</button></td>` : ''}
      </tr>
    `).join('');

    contentArea.innerHTML = `
      ${createTable('Áreas registradas', 'Departamentos y áreas donde se encuentran los equipos inventariados.', headers, rows)}
      ${canAdmin ? renderForm('Registrar nueva área', [
        { id: 'nombre', label: 'Nombre del área', type: 'text', placeholder: 'Finanzas, Redes', required: true }
      ], 'formAreas', 'Registrar área') : ''}
    `;

    if (canAdmin) {
      document.getElementById('formAreas').addEventListener('submit', async event => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const payload = { nombre: formData.get('nombre') };
        await postApi('/api/areas', payload);
        loadAreasData();
      });
    }
  } catch (error) {
    setRequestError('No se pudo cargar las áreas. Intenta nuevamente.');
  }
}

async function loadMantenimientosData() {
  dashboardCards.innerHTML = '';
  try {
    const mantenimientos = await fetchApi('/api/mantenimientos');
    const activos = await fetchApi('/api/activos');
    const canAdd = currentUser && (currentUser.role === 'admin' || currentUser.role === 'technician' || currentUser.role === 'user');

    contentArea.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2>Mantenimientos Programados</h2>
      </div>
      <div class="table-responsive bg-surface p-3 rounded-4 shadow-sm mb-4">
        <table class="table table-hover align-middle mb-0">
          <thead>
            <tr>
              <th>Equipo / Activo</th>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Responsable</th>
              <th>Descripción</th>
            </tr>
          </thead>
          <tbody>
            ${mantenimientos.map(m => {
              const activo = activos.find(a => String(a._id) === String(m.activoId));
              return `
                <tr>
                  <td>
                    <strong>${activo ? activo.categoria : 'Equipo'}</strong><br>
                    <small class="text-muted">${activo ? `${activo.marca} - ${activo.serial}` : 'Reporte General'}</small>
                  </td>
                  <td>${m.fecha}</td>
                  <td><span class="badge bg-warning text-dark">${m.tipo}</span></td>
                  <td>${m.responsable}</td>
                  <td>${m.descripcion}</td>
                </tr>
              `;
            }).join('')}
            ${mantenimientos.length === 0 ? '<tr><td colspan="5" class="text-center text-muted py-4">No hay mantenimientos programados.</td></tr>' : ''}
          </tbody>
        </table>
      </div>
      ${canAdd ? `
      <div class="card p-4 border-0 shadow-sm rounded-4">
        <h4 class="mb-3">Reportar Falla / Programar Mantenimiento</h4>
        <form id="formMantenimientos">
          <div class="mb-3">
            <label for="activoId" class="form-label">Seleccionar Equipo Afectado</label>
            <select class="form-select" id="activoId" required>
              <option value="">-- Selecciona un activo de la lista --</option>
              ${activos.map(a => `<option value="${a._id}">${a.categoria} - ${a.marca} (${a.serial})</option>`).join('')}
            </select>
          </div>
          <div class="row">
            <div class="col-md-6 mb-3">
              <label for="tipo" class="form-label">Tipo de Problema</label>
              <input type="text" class="form-control" id="tipo" placeholder="Ej: Pantalla rota, No enciende" required>
            </div>
            <div class="col-md-6 mb-3">
              <label for="descripcion" class="form-label">Descripción detallada</label>
              <textarea class="form-control" id="descripcion" rows="1" placeholder="Describe lo que sucede..." required></textarea>
            </div>
          </div>
          <div class="mb-3">
            <label for="archivoInput" class="form-label">Adjuntar Evidencia / Foto (Opcional)</label>
            <input type="file" class="form-control" id="archivoInput" accept="image/*,application/pdf">
          </div>
          <button type="submit" class="btn btn-primary rounded-pill px-4">Enviar reporte</button>
        </form>
      </div>
      ` : ''}
    `;

    if (canAdd) {
      document.getElementById('formMantenimientos').addEventListener('submit', async event => {
        event.preventDefault();
        try {
          const activoSelect = document.getElementById('activoId');
          const equipoTexto = activoSelect.options[activoSelect.selectedIndex].text;
          const archivoInput = document.getElementById('archivoInput');

          const formData = new FormData();
          formData.append('activoId', activoSelect.value);
          formData.append('equipo', equipoTexto);
          formData.append('problema', document.getElementById('tipo').value);
          formData.append('descripcion', document.getElementById('descripcion').value);
          formData.append('correoUsuario', currentUser ? currentUser.username + "@dominio.com" : "");
          
          if (archivoInput && archivoInput.files.length > 0) {
            formData.append('archivo', archivoInput.files[0]);
          }

          const response = await fetch('/api/reportes', {
            method: 'POST',
            body: formData
          });
          if (!response.ok) throw new Error('Error al enviar el reporte');
          alert('Reporte enviado correctamente con evidencia ✅');
          document.getElementById('formMantenimientos').reset();
          loadMantenimientosData();
        } catch (error) {
          console.error(error);
          alert('No se pudo enviar el reporte');
        }
      });
    }
  } catch (error) {
    setRequestError('No se pudo cargar los mantenimientos.');
  }
}

async function deleteUser(userId) {
  const confirmDelete = confirm('¿Seguro que quieres eliminar este usuario del sistema?');
  if (!confirmDelete) return;
  try {
    await fetchApi(`/api/admin/users/${userId}`, { method: 'DELETE' });
    alert('Usuario eliminado correctamente');
    loadAdminPanel();
  } catch (error) {
    alert('No se pudo eliminar el usuario');
  }
}

document.addEventListener('click', async (e) => {
    if (e.target && (e.target.id === 'btnExportarPDF' || e.target.closest('#btnExportarPDF'))) {
        e.preventDefault();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        let activos = [];
        try {
            const response = await fetch('/api/activos', { method: 'GET' });
            if (response.status === 401 || response.status === 403) {
                alert("Sesión expirada o no autorizada. Por favor, vuelve a iniciar sesión.");
                return;
            }
            if (!response.ok) throw new Error('Error en la respuesta del servidor');
            activos = await response.json();
        } catch (error) {
            console.error(error);
            alert("No se pudieron obtener los activos desde el servidor.");
            return;
        }

        if (!activos || activos.length === 0) {
            alert("No hay activos registrados en el inventario para exportar.");
            return;
        }

        doc.setFillColor(30, 58, 138); 
        doc.rect(0, 0, 210, 40, 'F');  
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("ITrack | Gestión de Infraestructura", 14, 26);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const fechaHoy = new Date().toLocaleDateString();
        doc.text(`Fecha de Emisión: ${fechaHoy}`, 140, 18);
        doc.text("Destinatario: Jefatura de Sistemas", 140, 25);
        doc.text("Estatus: Reporte Mensual de TI", 140, 32);

        doc.setTextColor(33, 37, 41);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Resumen Ejecutivo de Activos de Cómputo e Infraestructura", 14, 55);

        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.text("El presente documento detalla el estado actual, ubicación y categorías de los componentes tecnológicos auditados dentro del sistema centralizado de inventarios de Alimentos de Alta Calidad El Pedregal Toluca.", 14, 63);

        const tablaFilas = activos.map((activo, index) => [
            index + 1,
            activo.categoria || 'N/A',
            activo.type || activo.tipo || 'N/A',
            activo.marca || 'N/A',
            activo.serial || 'N/A',
            activo.area || 'N/A',
            activo.estado || 'N/A'
        ]);

        doc.autoTable({
            startY: 75,
            head: [['#', 'Categoría', 'Tipo', 'Marca', 'N. Serie', 'Área', 'Estado']],
            body: tablaFilas,
            theme: 'striped',
            headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold' },
            styles: { font: "helvetica", fontSize: 10, cellPadding: 3 },
            alternateRowStyles: { fillColor: [245, 247, 250] }
        });

        const finalY = doc.lastAutoTable.finalY + 20;
        doc.setDrawColor(200, 200, 200);
        doc.line(14, finalY, 196, finalY); 
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(100, 100, 100);
        doc.text("Reporte automatizado y certificado por el sistema de control interno ITrack. Confidencialidad de Sistemas Nivel 1.", 14, finalY + 8);
        doc.save(`Reporte_Infraestructura_TI_${fechaHoy.replace(/\//g, '-')}.pdf`);
    }
});