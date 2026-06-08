const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
require('dotenv').config();
console.log("Mongo URI:", process.env.MONGODB_URI);
const mongoose = require('mongoose');
const sendMail = require("./mailer");
const app = express();
const PORT = process.env.PORT || 3000;
const multer = require('multer');

const smtpConfigured = process.env.EMAIL_USER && process.env.EMAIL_PASS;
console.log(smtpConfigured
  ? 'ℹ️ SMTP configurado. Recuperación de contraseña por correo habilitada.'
  : 'ℹ️ SMTP no configurado. Las funciones de recuperación por correo no estarán disponibles.');

// Configuración para almacenar los archivos en la carpeta de subidas
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    // Esto les cambia el nombre por la fecha actual para que no se dupliquen
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Habilitar debug para Mongoose (ver comandos en consola)
mongoose.set('debug', true);

// Intento de conexión a MongoDB
console.log('🔗 Intentando conectar a MongoDB con URI:', process.env.MONGODB_URI);

mongoose.connect(process.env.MONGODB_URI, {
  dbName: process.env.MONGODB_DB || 'itrack',
  writeConcern: { w: 'majority', j: true, wtimeout: 10000 },
  readPreference: 'primary',
  maxPoolSize: 10,
  minPoolSize: 5,
  retryWrites: true,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
})
.then(async () => {
  console.log('✅ MongoDB conectado con writeConcern configurado');
  console.log('📚 Base de datos usada:', mongoose.connection.db.databaseName);
  await crearUsuariosIniciales();
  const server = app.listen(PORT, () => {
    console.log(`✅ ITrack server escuchando en http://localhost:${PORT}`);
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`❌ Puerto ${PORT} en uso. Detén el proceso que lo ocupa o usa otro puerto.`);
      console.error('Usa: Get-NetTCPConnection -LocalPort 3000 | Select-Object -ExpandProperty OwningProcess');
      process.exit(1);
    }
    console.error('Server error:', err);
    process.exit(1);
  });
})
.catch(err => {
  console.error('❌ Error conectando MongoDB');
  console.error('Error message:', err.message);
  console.error('Full error:', err);
  console.error('Error stack:', err.stack);
});

// MODELOS MONGODB ORIGINALES
const activoSchema = new mongoose.Schema({
  categoria: String,
  type: String,
  marca: String,
  serial: String,
  estado: String,
  area: String
});

const usuarioSchema = new mongoose.Schema({
  nombre: String,
  cargo: String,
  area: String
});

const areaSchema = new mongoose.Schema({
  nombre: String
});

const mantenimientoSchema = new mongoose.Schema({
  activoId: String,
  fecha: String,
  tipo: String,
  responsable: String,
  descripcion: String
});

const reporteSchema = new mongoose.Schema({
  activoId: String,
  equipo: String,
  usuario: String,
  correoUsuario: String,
  problema: String,
  descripcion: String,
  fecha: String,
  archivo: String,
  estado: {
    type: String,
    default: 'Pendiente'
  }
});

const authUserSchema = new mongoose.Schema({
  username: String,
  nombre: String,
  role: String,
  email: String,
  passwordHash: String
});

const Activo = mongoose.model('Activo', activoSchema);
const Usuario = mongoose.model('Usuario', usuarioSchema);
const Area = mongoose.model('Area', areaSchema);
const Mantenimiento = mongoose.model('Mantenimiento', mantenimientoSchema);
const Reporte = mongoose.model('Reporte', reporteSchema);
const AuthUser = mongoose.model('AuthUser', authUserSchema);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 2
  }
}));
app.use(express.static(path.join(__dirname, 'public')));

async function crearUsuariosIniciales() {
  const total = await AuthUser.countDocuments();
  if (total === 0) {
    await AuthUser.insertMany([
      {
        username: 'admin',
        nombre: 'Administrador',
        role: 'admin',
        email: 'admin@itrack.local',
        passwordHash: bcrypt.hashSync('Admin1234', 10)
      },
      {
        username: 'tecnico',
        nombre: 'Técnico ITrack',
        role: 'technician',
        email: 'tecnico@itrack.local',
        passwordHash: bcrypt.hashSync('Tech1234', 10)
      },
      {
        username: 'usuario',
        nombre: 'Usuario ITrack',
        role: 'user',
        email: 'usuario@itrack.local',
        passwordHash: bcrypt.hashSync('User1234', 10)
      }
    ]);
    console.log('Usuarios iniciales creados');
  }
}

function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ error: 'No autorizado' });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    next();
  };
}

function generateTempPassword() {
  return Math.random().toString(36).slice(-6) + Math.random().toString(36).slice(-4);
}

app.post('/api/register', async (req, res) => {
  try {
    const { username, password, nombre, email } = req.body;
    console.log('📝 Registro intento:', { username, nombre, email });
    
    if (!username || !password || !nombre) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }
    
    const usuarioExistente = await AuthUser.findOne({ username: username.toLowerCase() });
    if (usuarioExistente) {
      console.log('⚠️ Usuario ya existe:', username);
      return res.status(409).json({ error: 'El nombre de usuario ya existe' });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    const nuevoUsuario = new AuthUser({
      username: username.toLowerCase(),
      nombre,
      role: 'user',
      email: email ? email.toLowerCase() : undefined,
      passwordHash
    });
    
    console.log('💾 Guardando usuario...');
    const usuarioGuardado = await nuevoUsuario.save();
    console.log('✅ Usuario guardado. ID:', usuarioGuardado._id);
    
    // Verificar que existe en la base de datos
    const verificar = await AuthUser.findById(usuarioGuardado._id);
    if (verificar) {
      console.log('✅ Usuario verificado en BD:', verificar.username);
    } else {
      console.error('❌ Usuario NO existe en BD después de guardar!');
    }
    
    req.session.user = {
      id: usuarioGuardado._id,
      username: usuarioGuardado.username,
      nombre: usuarioGuardado.nombre,
      role: usuarioGuardado.role
    };
    res.status(201).json({ user: req.session.user });
  } catch (error) {
    console.error('❌ ERROR REGISTER:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'No se pudo registrar: ' + error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Faltan datos' });
    }
    const user = await AuthUser.findOne({ username: username.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    req.session.user = {
      id: user._id,
      username: user.username,
      nombre: user.nombre,
      role: user.role
    };
    res.json({ user: req.session.user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

app.post('/api/forgot-password/email', async (req, res) => {
  try {
    const { username, email } = req.body;
    if (!username || !email) {
      return res.status(400).json({ error: 'Usuario y correo son obligatorios' });
    }
    const user = await AuthUser.findOne({ username: username.toLowerCase() });
    if (!user || !user.email) {
      return res.status(404).json({ error: 'Usuario no encontrado o sin correo registrado' });
    }
    if (user.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(400).json({ error: 'Correo no coincide con el usuario' });
    }
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({ error: 'SMTP no configurado en variables de entorno' });
    }
    const tempPassword = generateTempPassword();
    user.passwordHash = await bcrypt.hash(tempPassword, 10);
    await user.save();

    const html = `
      <p>Hola ${user.nombre},</p>
      <p>Se ha generado una nueva contraseña temporal para tu cuenta de ITrack.</p>
      <p><strong>${tempPassword}</strong></p>
      <p>Úsala para iniciar sesión y luego cambia tu contraseña en el sistema.</p>
    `;

    await sendMail(user.email, 'Recuperación de contraseña ITrack', html);
    res.json({ message: 'Se envió una nueva contraseña a tu correo.' });
  } catch (error) {
    console.error('ERROR FORGOT EMAIL:', error);
    res.status(500).json({ error: 'No se pudo enviar el correo de recuperación. ' + (error.message || 'Revisa la configuración SMTP.') });
  }
});

app.post('/api/forgot-password/change', async (req, res) => {
  try {
    const { username, email, newPassword } = req.body;
    if (!username || !newPassword) {
      return res.status(400).json({ error: 'Usuario y nueva contraseña son obligatorios' });
    }
    const user = await AuthUser.findOne({ username: username.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (user.email && email && user.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(400).json({ error: 'Correo no coincide con el usuario' });
    }
    if (!user.email) {
      return res.status(400).json({ error: 'El usuario no tiene correo registrado. Contacta al administrador.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Contraseña actualizada correctamente. Ahora puedes iniciar sesión.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo cambiar la contraseña' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get('/api/auth-status', (req, res) => {
  res.json({ authenticated: Boolean(req.session && req.session.user), user: req.session?.user || null });
});

app.get('/api/usuarios', requireAuth, async (req, res) => {
  try {
    const usuarios = await Usuario.find();
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: 'Error cargando usuarios' });
  }
});

app.get('/api/areas', requireAuth, async (req, res) => {
  try {
    const areas = await Area.find();
    res.json(areas);
  } catch (error) {
    res.status(500).json({ error: 'Error cargando áreas' });
  }
});

app.get('/api/mantenimientos', requireAuth, async (req, res) => {
  try {
    const mantenimientos = await Mantenimiento.find();
    res.json(mantenimientos);
  } catch (error) {
    res.status(500).json({ error: 'Error cargando mantenimientos' });
  }
});

app.get('/api/admin/users', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const users = await AuthUser.find().select('-passwordHash');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Error cargando usuarios admin' });
  }
});

app.delete('/api/admin/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const user = await AuthUser.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (user.username === 'admin') {
      return res.status(403).json({ error: 'No puedes eliminar el admin principal' });
    }
    await AuthUser.findByIdAndDelete(id);
    res.json({ success: true, message: 'Usuario eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo eliminar el usuario' });
  }
});

app.get('/api/activos', requireAuth, async (req, res) => {
  try {
    const tipo = req.query.tipo;
    let activos;
    if (tipo) {
      activos = await Activo.find({ categoria: new RegExp(tipo, 'i') });
    } else {
      activos = await Activo.find();
    }
    res.json(activos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error obteniendo activos' });
  }
});

app.post('/api/activos', requireAuth, requireRole('admin', 'technician'), async (req, res) => {
  try {
    const nuevoActivo = await Activo.create(req.body);
    res.status(201).json(nuevoActivo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error creando activo' });
  }
});

app.put('/api/activos/:id', requireAuth, requireRole('admin', 'technician'), async (req, res) => {
  try {
    const actualizado = await Activo.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!actualizado) {
      return res.status(404).json({ error: 'Activo no encontrado' });
    }
    res.json(actualizado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error actualizando activo' });
  }
});

app.delete('/api/activos/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const eliminado = await Activo.findByIdAndDelete(req.params.id);
    if (!eliminado) {
      return res.status(404).json({ error: 'Activo no encontrado' });
    }
    res.json(eliminado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const totalActivos = await Activo.countDocuments();
    const totalComputadoras = await Activo.countDocuments({ categoria: 'Computadora' });
    const totalImpresoras = await Activo.countDocuments({ categoria: 'Impresora' });
    const totalSwitches = await Activo.countDocuments({ categoria: 'Switch' });
    const totalUsuarios = await AuthUser.countDocuments();
    const totalAreas = await Area.countDocuments();
    const totalMantenimientos = await Mantenimiento.countDocuments();
    const activosMantenimiento = await Activo.countDocuments({ estado: /mantenimiento/i });

    res.json({
      totalActivos,
      totalComputadoras,
      totalImpresoras,
      totalSwitches,
      totalMantenimientos,
      totalUsuarios,
      totalAreas,
      activosMantenimiento
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cargar dashboard' });
  }
});

app.post('/api/usuarios', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const nuevoUsuario = await Usuario.create(req.body);
    res.status(201).json(nuevoUsuario);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/areas', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const nuevaArea = await Area.create(req.body);
    res.status(201).json(nuevaArea);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/mantenimientos', requireAuth, requireRole('admin', 'technician', 'user'), async (req, res) => {
  try {
    const nuevoMantenimiento = await Mantenimiento.create(req.body);
    res.status(201).json(nuevoMantenimiento);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/usuarios/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const actualizado = await Usuario.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!actualizado) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(actualizado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/areas/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const actualizada = await Area.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!actualizada) {
      return res.status(404).json({ error: 'Área no encontrada' });
    }
    res.json(actualizada);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/mantenimientos/:id', requireAuth, requireRole('admin', 'technician'), async (req, res) => {
  try {
    const actualizado = await Mantenimiento.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!actualizado) {
      return res.status(404).json({ error: 'Mantenimiento no encontrado' });
    }
    res.json(actualizado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/usuarios/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const eliminado = await Usuario.findByIdAndDelete(req.params.id);
    if (!eliminado) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(eliminado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/areas/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const eliminada = await Area.findByIdAndDelete(req.params.id);
    if (!eliminada) {
      return res.status(404).json({ error: 'Área no encontrada' });
    }
    res.json(eliminada);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/mantenimientos/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const eliminado = await Mantenimiento.findByIdAndDelete(req.params.id);
    if (!eliminado) {
      return res.status(404).json({ error: 'Mantenimiento no encontrado' });
    }
    res.json(eliminado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/test-email', async (req, res) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return res.status(500).json({ error: 'SMTP no configurado en variables de entorno' });
  }
  try {
    await sendMail(process.env.EMAIL_USER, 'Prueba de correo ITrack', '<h1>Si ves esto, el correo funciona ✅</h1>');
    res.json({ message: 'Correo enviado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error enviando correo' });
  }
});

// NUEVA RUTA POST CORREGIDA CON MULTER
app.post('/api/reportes', requireAuth, upload.single('archivo'), async (req, res) => {
  try {
    if (!req.body.equipo || !req.body.problema || !req.body.descripcion) {
      return res.status(400).json({ error: 'Faltan datos del reporte' });
    }
    
    const rutaArchivo = req.file ? `/uploads/${req.file.filename}` : '';

    const nuevoReporte = await Reporte.create({
      activoId: req.body.activoId,
      equipo: req.body.equipo,
      problema: req.body.problema,
      descripcion: req.body.descripcion,
      usuario: req.session.user.nombre,
      correoUsuario: req.body.correoUsuario || '',
      fecha: new Date().toLocaleDateString(),
      archivo: rutaArchivo,
      estado: 'Pendiente'
    });

    await Mantenimiento.create({
      activoId: req.body.activoId,
      fecha: new Date().toLocaleDateString(),
      tipo: req.body.problema,
      responsable: req.session.user.nombre,
      descripcion: req.body.descripcion
    });

    return res.status(201).json(nuevoReporte);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error creando reporte' });
  }
});

app.get('/api/reportes', requireAuth, async (req, res) => {
  try {
    const reportes = await Reporte.find();
    return res.json(reportes || []);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error cargando reportes' });
  }
});

app.put('/api/reportes/:id/solucionar', requireAuth, requireRole('admin', 'technician'), async (req, res) => {
  try {
    const reporte = await Reporte.findById(req.params.id);
    if (!reporte) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }
    reporte.estado = 'Solucionado';
    await reporte.save();
    return res.json({ success: true, reporte });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error solucionando reporte' });
  }
});
// ====================== BUSCAR ACTIVO POR SERIAL (PARA QR) ======================
app.get('/api/activos/search', requireAuth, async (req, res) => {
  try {
    const { serial } = req.query;
    
    if (!serial) {
      return res.status(400).json({ error: 'Se requiere el número de serie' });
    }

    const activo = await Activo.findOne({ 
      serial: { $regex: serial, $options: 'i' } 
    });

    if (!activo) {
      return res.status(404).json({ error: 'Activo no encontrado' });
    }

    res.json(activo);
  } catch (error) {
    console.error('Error en búsqueda QR:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.use((req, res) => {
  res.status(404).send('Recurso no encontrado');
});