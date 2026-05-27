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
    const text = await res.text();
    throw new Error(text || 'Error al cargar datos');
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

  <!-- LOGIN -->
<div class="col-lg-5">
    <div class="card border-0 shadow-sm p-4">
      <h3 class="card-title">Iniciar sesión</h3>

      <p class="text-muted">
        Ingresa con tu usuario y contraseña para gestionar el inventario.
      </p>

      ${message ? renderAlert('warning', message) : ''}

      <form id="loginForm">
        <div class="mb-3">
          <label class="form-label">
            Usuario
          </label>

          <input
            class="form-control"
            id="loginUsername"
            name="username"
            type="text"
            required
          />
        </div>

        <div class="mb-3">
          <label class="form-label">
            Contraseña
          </label>

          <input
            class="form-control"
            id="loginPassword"
            name="password"
            type="password"
            required
          />
        </div>

        <button type="submit"
          class="btn btn-primary">
          Entrar
        </button>
      </form>
    </div>
  </div>
<div class="col-lg-5">
    <div class="card border-0 shadow-sm p-4 h-100">
      <h3 class="card-title">
        Registrar cuenta
      </h3>

      <p class="text-muted">
        Crea un usuario nuevo para acceder al sistema de ITrack.
      </p>

      <form id="registerForm">

        <div class="mb-3">
          <label class="form-label">
            Nombre completo
          </label>

          <input
            class="form-control"
            id="registerName"
            name="nombre"
            type="text"
            required
          />
        </div>

        <div class="mb-3">
          <label class="form-label">
            Usuario
          </label>

          <input
            class="form-control"
            id="registerUsername"
            name="username"
            type="text"
            required
          />
        </div>

        <div class="mb-3">
          <label class="form-label">
            Contraseña
          </label>

          <input
            class="form-control"
            id="registerPassword"
            name="password"
            type="password"
            required
          />
        </div>

        <button
          type="submit"
          class="btn btn-outline-primary">
          Registrar
        </button>

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

  document.getElementById('registerForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const formData = new FormData(event.target);
      const payload = {
        nombre: formData.get('nombre'),
        username: formData.get('username'),
        password: formData.get('password'),
        role: formData.get('role')
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

function renderApp() {
  mainNav.style.display = 'flex';
  dashboardCards.style.display = '';
  loadAdmin.style.display = isRole('admin') ? '' : 'none';
  updateUserInfo();
  setActiveTab(loadDashboard);
  loadDashboardData();
}

function getRoleLabel(role) {
  const labels = {
    admin: 'Admin',
    technician: 'Técnico',
    user: 'Usuario'
  };
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
  try {
    await postApi('/api/logout', {});
  } catch (error) {
    // ignore logout errors
  }
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
        <button
          class="btn btn-danger btn-sm"
          onclick="deleteUser('${user._id}')">
          Eliminar
        </button>
      ` : `
        <span class="text-success">
          Protegido
        </span>
      `}
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
    <small class="text-muted">
      Todo funcionando correctamente
    </small>
  </div>

  <div class="dashboard-item rounded-4 p-3 text-center">
    <h6 class="text-info">Actividad</h6>
    <small class="text-muted">
      ${data.totalMantenimientos}
      mantenimientos registrados
    </small>
  </div>

  <div class="dashboard-item rounded-4 p-3 text-center">
    <h6 class="text-info">Usuarios</h6>
    <h3 class="text-white">${data.totalUsuarios}</h3>
  </div>
`;

    contentArea.innerHTML = `
  <h3 class="card-title">Dashboard</h3>
  <p class="text-muted">
    Visión de inventario con estadísticas del sistema.
  </p>

  <div class="card border-0 shadow-sm p-4 h-100">
    <h5 class="mb-4">Estadísticas del inventario</h5>

    <canvas id="inventoryChart" height="120"></canvas>
  </div>
`;
const ctx = document
  .getElementById('inventoryChart')
  .getContext('2d');

new Chart(ctx, {
  type: 'bar',

  data: {
    labels: [
      'Computadoras',
      'Impresoras',
      'Switches',
      'Usuarios',
      'Mantenimientos'
    ],

    datasets: [{
      label: 'Cantidad',

      data: [
        data.totalComputadoras,
        data.totalImpresoras,
        data.totalSwitches,
        data.totalUsuarios,
        data.totalMantenimientos
      ],

      backgroundColor: [
        'rgba(0,255,255,0.7)',
        'rgba(13,110,253,0.7)',
        'rgba(170,0,255,0.7)',
        'rgba(0,255,140,0.7)',
        'rgba(255,0,255,0.7)'
      ],

      borderColor: [
        '#00ffff',
        '#0d6efd',
        '#aa00ff',
        '#00ff8c',
        '#ff00ff'
      ],

      borderWidth: 2,
      borderRadius: 12,
      hoverBorderWidth: 4
    }]
  },

  options: {
    responsive: true,

    plugins: {
      legend: {
        labels: {
          color: '#d9f8ff',
          font: {
            size: 14
          }
        }
      }
    },

    scales: {
      x: {
        ticks: {
          color: '#9be7ff'
        },

        grid: {
          color: 'rgba(0,255,255,.08)'
        }
      },

      y: {
        beginAtZero: true,

        ticks: {
          color: '#9be7ff'
        },

        grid: {
          color: 'rgba(0,255,255,.08)'
        }
      }
    },
        animation: {
      duration: 2000
    }
  }
});
  } catch (error) {
    setRequestError(
      'No se pudo cargar el dashboard. Intenta recargar la página.'
    );
  }
}


function setDashboardCard(title, value) {
  return `
    <div class="dashboard-item rounded-4 p-3">
      <p class="mb-1 text-white-75">${title}</p>
      <h3 class="mb-0 text-white">${value}</h3>
    </div>
  `;
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
        <td>${activo.tipo}</td>
        <td>${activo.marca}</td>
        <td>${activo.serial}</td>
        <td>${activo.estado}</td>
        <td>${activo.area}</td>
        ${canDelete ? `<td><button class="btn btn-sm btn-danger" onclick="deleteRecord('/api/activos', '${activo._id}', loadActivos)"">Eliminar</button></td>` : ''}
      </tr>
      
    `).join('');

    
    contentArea.innerHTML = `
      ${createTable(
        'Inventario de equipos',
        'Registros de computadoras, impresoras y switches con sus números de serie y ubicación.',
        headers,
        rows
      )}
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
  document
    .getElementById('formActivos')
    .addEventListener('submit', async event => {

      event.preventDefault();

      const formData = new FormData(event.target);

      try {

        await postApi('/api/activos', {
          categoria: formData.get('categoria'),
          tipo: formData.get('tipo'),
          marca: formData.get('marca'),
          serial: formData.get('serial'),
          estado: formData.get('estado'),
          area: formData.get('area')
        });

        alert('Activo registrado correctamente ✅');

        loadActivos();

      } catch (error) {

        console.error(error);

        alert('No se pudo registrar el activo');
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
      ${createTable(
        'Usuarios registrados',
        'Lista de usuarios asignados a equipos y áreas del inventario.',
        headers,
        rows
      )}
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
      ${createTable(
        'Áreas registradas',
        'Departamentos y áreas donde se encuentran los equipos inventariados.',
        headers,
        rows
      )}
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
  try {
    const mantenimientos = await fetchApi('/api/mantenimientos');
    const activos = await fetchApi('/api/activos');

    const canDelete = isRole('admin');
    const canAdd = isRole('admin', 'technician', 'user');

    const headers = [
      'ID',
      'Activo',
      'Fecha',
      'Tipo',
      'Responsable',
      'Descripción'
    ];

    if (canDelete) headers.push('Acción');

    const rows = mantenimientos.map(m => `
      <tr>
        <td>${m._id}</td>
        <td>${m.activoId}</td>
        <td>${m.fecha}</td>
        <td>${m.tipo}</td>
        <td>${m.responsable}</td>
        <td>${m.descripcion}</td>
        ${canDelete ? `
          <td>
            <button class="btn btn-sm btn-danger"
              onclick="deleteRecord('/api/mantenimientos', '${m._id}', loadMantenimientosData)">
              Eliminar
            </button>
          </td>
        ` : ''}
      </tr>
    `).join('');

    contentArea.innerHTML = `
      ${createTable(
        'Mantenimientos programados',
        'Historial y reportes de fallas de los equipos.',
        headers,
        rows
      )}

      ${canAdd ? `
      <div class="mt-4">
        <h4>Levantar reporte</h4>

        <form id="formMantenimientos">

          <div class="mb-3">
            <label class="form-label">
              Selecciona la máquina
            </label>

            <select class="form-control"
              id="activoId"
              required>

              <option value="">
                Selecciona un equipo
              </option>

              ${activos.map(a => `
                <option value="${a._id}">
                  ${a.tipo} - ${a.marca} (${a.area})
                </option>
              `).join('')}

            </select>
          </div>

          <div class="mb-3">
            <label class="form-label">
              Tipo de problema
            </label>

            <input
              type="text"
              class="form-control"
              id="tipo"
              placeholder="No enciende, lenta, internet, monitor..."
              required>
          </div>

          <div class="mb-3">
            <label class="form-label">
              Describe el problema
            </label>

            <textarea
              class="form-control"
              id="descripcion"
              rows="3"
              required></textarea>
          </div>

          <button type="submit"
            class="btn btn-primary">
            Enviar reporte
          </button>

        </form>
      </div>
      ` : ''}
    `;

if (canAdd) {
  document
    .getElementById('formMantenimientos')
    .addEventListener('submit', async event => {

      event.preventDefault();

      try {

        await postApi('/api/reportes', {
          activoId:
            document.getElementById('activoId').value,

          equipo:
            document.getElementById('activoId')
              .options[
                document.getElementById('activoId').selectedIndex
              ].text,

          problema:
            document.getElementById('tipo').value,

          descripcion:
            document.getElementById('descripcion').value
        });

        alert('Reporte enviado correctamente ✅');

        loadMantenimientosData();

      } catch (error) {

        console.error(error);

        alert('No se pudo enviar el reporte');
      }
    });
}

  } catch (error) {
    setRequestError(
      'No se pudo cargar los mantenimientos.'
    );
  }
}

async function deleteUser(userId) {

  const confirmDelete = confirm(
    '¿Seguro que quieres eliminar este usuario del sistema?'
  );

  if (!confirmDelete) return;

  try {

    await fetchApi(`/api/admin/users/${userId}`, {
      method: 'DELETE'
    });

    alert('Usuario eliminado correctamente');

    loadAdminPanel();

  } catch (error) {

    alert('No se pudo eliminar el usuario');
  }
}