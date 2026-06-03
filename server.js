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
const nodemailer = require('nodemailer');
const multer = require('multer');

// Configuración de almacenamiento para Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/'); 
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

transporter.verify((error, success) => {
  if (error) {
    console.log('❌ Error Gmail:', error);
  } else {
    console.log('✅ Gmail listo');
  }
});

mongoose.connect(process.env.MONGODB_URI)
.then(async () => {
  console.log('✅ MongoDB conectado');
  await crearUsuariosIniciales();
  app.listen(PORT, () => {
    console.log(`✅ ITrack server escuchando en http://localhost:${PORT}`);
  });
})
.catch(err => {
  console.error('❌ Error conectando MongoDB');
  console.error(err);
});

const usuarioSchema = new mongoose.Schema({
  nombre: String,
  usuario: { type: String, unique: true },
  contrasena: String,
  rol: { type: String, enum: ['admin', 'technician', 'user'], default: 'user' }
});

const Usuario = mongoose.model('Usuario', usuarioSchema);

const activoSchema = new mongoose.Schema({
  nombre: String,
  tipo: String,
  serial: String,
  estado: String
});

const Activo = mongoose.model('Activo', activoSchema);

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

const Reporte = mongoose.model('Reporte', reporteSchema);

const mantenimientoSchema = new mongoose.Schema({
  activoId: String,
  fecha: String,
  tipo: String,
  responsable: String,
  descripcion: String
});

const Mantenimiento = mongoose.model('Mantenimiento', mantenimientoSchema);

async function crearUsuariosIniciales() {
  try {
    const count = await Usuario.countDocuments();
    if (count === 0) {
      const salt = await bcrypt.genSalt(10);
      const hashAdmin = await bcrypt.hash('admin123', salt);
      const hashTec = await bcrypt.hash('tec123', salt);
      const hashUser = await bcrypt.hash('user123', salt);

      await Usuario.create([
        { nombre: 'Administrador Principal', usuario: 'admin', contrasena: hashAdmin, rol: 'admin' },
        { nombre: 'Técnico de Soporte', usuario: 'tecnico', contrasena: hashTec, rol: 'technician' },
        { nombre: 'Usuario Empleado', usuario: 'usuario', contrasena: hashUser, rol: 'user' }
      ]);
      console.log('✅ Usuarios iniciales creados (admin, tecnico, usuario)');
    }
  } catch (err) {
    console.error('❌ Error creando usuarios iniciales:', err);
  }
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'clave_secreta_itrack_2024_xyz',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ error: 'No autenticado' });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (req.session && req.session.user && roles.includes(req.session.user.rol)) {
      return next();
    }
    return res.status(403).json({ error: 'No autorizado para este rol' });
  };
}

app.post('/api/login', async (req, res) => {
  const { usuario, contrasena } = req.body;
  if (!usuario || !contrasena) {
    return res.status(400).json({ error: 'Faltan credenciales' });
  }
  try {
    const user = await Usuario.findOne({ usuario });
    if (!user) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
    const match = await bcrypt.compare(contrasena, user.contrasena);
    if (!match) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
    req.session.user = {
      id: user._id,
      nombre: user.nombre,
      usuario: user.usuario,
      rol: user.rol
    };
    return res.json({ success: true, user: req.session.user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'No se pudo cerrar sesión' });
    res.clearCookie('connect.sid');
    return res.json({ success: true });
  });
});

app.get('/api/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ user: req.session.user });
  }
  return res.status(401).json({ error: 'No autenticado' });
});

app.get('/api/activos', requireAuth, async (req, res) => {
  try {
    const activos = await Activo.find();
    return res.json(activos);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error cargando activos' });
  }
});

app.post('/api/activos', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const nuevoActivo = await Activo.create(req.body);
    return res.status(201).json(nuevoActivo);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error creando activo' });
  }
});

app.get('/api/mantenimientos', requireAuth, async (req, res) => {
  try {
    const mantenimientos = await Mantenimiento.find();
    return res.json(mantenimientos || []);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error cargando mantenimientos' });
  }
});

app.post('/api/reportes',
  requireAuth,
  upload.single('archivo'),
  async (req, res) => {
    try {
      if (!req.body.equipo || !req.body.problema || !req.body.descripcion) {
        return res.status(400).json({
          error: 'Faltan datos del reporte'
        });
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
      return res.status(500).json({
        error: 'Error creando reporte'
      });
    }
});

app.get('/api/reportes',
  requireAuth,
  async (req, res) => {
    try {
      const reportes = await Reporte.find();
      return res.json(reportes || []);
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        error: 'Error cargando reportes'
      });
    }
});

app.put('/api/reportes/:id/solucionar',
  requireAuth,
  requireRole('admin', 'technician'),
  async (req, res) => {
    try {
      const reporte = await Reporte.findById(req.params.id);
      if (!reporte) {
        return res.status(404).json({
          error: 'Reporte no encontrado'
        });
      }

      reporte.estado = 'Solucionado';
      await reporte.save();

      return res.json({
        success: true,
        reporte
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        error: 'Error solucionando reporte'
      });
    }
});

app.use((req, res) => {
  res.status(404).send('Recurso no encontrado');
});