const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const app = express();
const PORT = process.env.PORT || 3000;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});


mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('MongoDB conectado');

    await crearUsuariosIniciales();

    app.listen(PORT, () => {
      console.log(`ITrack server escuchando en http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Error conectando a MongoDB:', err);
  });

// MODELOS MONGODB

const activoSchema = new mongoose.Schema({
  categoria: String,
  tipo: String,
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
  problema: String,
  descripcion: String,
  fecha: String,
  estado: {
    type: String,
    default: 'Pendiente'
  }
});

const authUserSchema = new mongoose.Schema({
  username: String,
  nombre: String,
  role: String,
  passwordHash: String
});

const Activo = mongoose.model('Activo', activoSchema);
const Usuario = mongoose.model('Usuario', usuarioSchema);
const Area = mongoose.model('Area', areaSchema);
const Mantenimiento = mongoose.model('Mantenimiento', mantenimientoSchema);
const Reporte = mongoose.model('Reporte', reporteSchema);
const AuthUser = mongoose.model('AuthUser', authUserSchema);

app.use(express.json());
app.use(session({
  secret: 'itrack-secret-key-2026',
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
        passwordHash: bcrypt.hashSync('Admin1234', 10)
      },
      {
        username: 'tecnico',
        nombre: 'Técnico ITrack',
        role: 'technician',
        passwordHash: bcrypt.hashSync('Tech1234', 10)
      },
      {
        username: 'usuario',
        nombre: 'Usuario ITrack',
        role: 'user',
        passwordHash: bcrypt.hashSync('User1234', 10)
      }
    ]);

    console.log('Usuarios iniciales creados');
  }
}

//crearUsuariosIniciales();
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

app.post('/api/register', async (req, res) => {
  try {
    const { username, password, nombre } = req.body;

    if (!username || !password || !nombre) {
      return res.status(400).json({
        error: 'Todos los campos son obligatorios'
      });
    }

    const usuarioExistente = await AuthUser.findOne({
      username: username.toLowerCase()
    });

    if (usuarioExistente) {
      return res.status(409).json({
        error: 'El nombre de usuario ya existe'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const nuevoUsuario = new AuthUser({
      username: username.toLowerCase(),
      nombre,
      role: 'user',
      passwordHash
    });

    await nuevoUsuario.save();

    console.log('Usuario registrado:', nuevoUsuario);

    req.session.user = {
      id: nuevoUsuario._id,
      username: nuevoUsuario.username,
      nombre: nuevoUsuario.nombre,
      role: nuevoUsuario.role
    };

    res.status(201).json({
      user: req.session.user
    });

  } catch (error) {
    console.error('ERROR REGISTER:', error);

    res.status(500).json({
      error: 'No se pudo registrar'
    });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await AuthUser.findOne({
      username: username.toLowerCase()
    });

    if (!user) {
      return res.status(401).json({
        error: 'Credenciales inválidas'
      });
    }

    const passwordValid = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordValid) {
      return res.status(401).json({
        error: 'Credenciales inválidas'
      });
    }

    req.session.user = {
      id: user._id,
      username: user.username,
      nombre: user.nombre,
      role: user.role
    };

    res.json({
      user: req.session.user
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Error al iniciar sesión'
    });
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

app.get('/api/activos', requireAuth, async (req, res) => {
  try {
    const tipo = req.query.tipo;

    let activos;

    if (tipo) {
      activos = await Activo.find({
        categoria: new RegExp(tipo, 'i')
      });
    } else {
      activos = await Activo.find();
    }

    res.json(activos);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Error obteniendo activos'
    });
  }
});


app.get('/api/usuarios', requireAuth, async (req, res) => {
  try {
    const usuarios = await Usuario.find();
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({
      error: 'Error cargando usuarios'
    });
  }
});

app.get('/api/areas', requireAuth, async (req, res) => {
  try {
    const areas = await Area.find();
    res.json(areas);
  } catch (error) {
    res.status(500).json({
      error: 'Error cargando áreas'
    });
  }
});

app.get('/api/mantenimientos', requireAuth, async (req, res) => {
  try {
    const mantenimientos = await Mantenimiento.find();
    res.json(mantenimientos);
  } catch (error) {
    res.status(500).json({
      error: 'Error cargando mantenimientos'
    });
  }
});

app.get('/api/admin/users',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const users = await AuthUser.find().select('-passwordHash');
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: 'Error cargando usuarios admin' });
    }
  }
);

app.delete('/api/admin/users/:id',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {

    try {
      const { id } = req.params;

      // Evitar borrar al admin principal
      const user = await AuthUser.findById(id);

      if (!user) {
        return res.status(404).json({
          error: 'Usuario no encontrado'
        });
      }

      if (user.username === 'admin') {
        return res.status(403).json({
          error: 'No puedes eliminar el admin principal'
        });
      }

      await AuthUser.findByIdAndDelete(id);

      res.json({
        success: true,
        message: 'Usuario eliminado'
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: 'No se pudo eliminar el usuario'
      });
    }
});

// ACTIVOS

app.get('/api/activos', requireAuth, async (req, res) => {
  try {
    const tipo = req.query.tipo;

    let activos;

    if (tipo) {
      activos = await Activo.find({
        categoria: new RegExp(tipo, 'i')
      });
    } else {
      activos = await Activo.find();
    }

    res.json(activos);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Error obteniendo activos'
    });
  }
});

app.post('/api/activos', requireAuth, async (req, res) => {
  try {
    const nuevoActivo = await Activo.create(req.body);

    res.status(201).json(nuevoActivo);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Error creando activo'
    });
  }
});

app.put('/api/activos/:id',
  requireAuth,
  requireRole('admin', 'technician'),
  async (req, res) => {
    try {

      const actualizado =
        await Activo.findByIdAndUpdate(
          req.params.id,
          req.body,
          { new: true }
        );

      if (!actualizado) {
        return res.status(404).json({
          error: 'Activo no encontrado'
        });
      }

      res.json(actualizado);

    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: 'Error actualizando activo'
      });
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
    const totalComputadoras = await Activo.countDocuments({
      categoria: 'Computadora'
    });

    const totalImpresoras = await Activo.countDocuments({
      categoria: 'Impresora'
    });

    const totalSwitches = await Activo.countDocuments({
      categoria: 'Switch'
    });

    const totalUsuarios = await Usuario.countDocuments();
    const totalAreas = await Area.countDocuments();
    const totalMantenimientos = await Mantenimiento.countDocuments();

    const activosMantenimiento = await Activo.countDocuments({
      estado: /mantenimiento/i
    });

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
    res.status(500).json({
      error: 'Error al cargar dashboard'
    });
  }
});



app.post('/api/usuarios', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const nuevoUsuario = await Usuario.create(req.body);
    res.status(201).json(nuevoUsuario);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.post('/api/areas', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const nuevaArea = await Area.create(req.body);
    res.status(201).json(nuevaArea);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.post('/api/mantenimientos',
  requireAuth,
  requireRole('admin', 'technician', 'user'),
  async (req, res) => {

    try {
      const nuevoMantenimiento =
        await Mantenimiento.create(req.body);

      res.status(201).json(nuevoMantenimiento);

    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
});

app.put('/api/activos/:id', requireAuth, requireRole('admin', 'technician'), async (req, res) => {
  try {
    const activo = await Activo.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!activo) {
      return res.status(404).json({ error: 'Activo no encontrado' });
    }

    res.json(activo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/usuarios/:id', requireAuth, requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  const index = usuarios.findIndex(item => item.id === id);
  if (index === -1) return res.status(404).json({ error: 'Usuario no encontrado' });
  const deleted = usuarios.splice(index, 1);
  res.json(deleted[0]);
});

app.delete('/api/areas/:id', requireAuth, requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  const index = areas.findIndex(item => item.id === id);
  if (index === -1) return res.status(404).json({ error: 'Área no encontrada' });
  const deleted = areas.splice(index, 1);
  res.json(deleted[0]);
});

app.delete('/api/mantenimientos/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const index = mantenimientos.findIndex(item => item.id === id);
  if (index === -1) return res.status(404).json({ error: 'Mantenimiento no encontrado' });
  const deleted = mantenimientos.splice(index, 1);
  res.json(deleted[0]);
});

app.get('/api/test-email', async (req, res) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: 'Prueba de correo ITrack',
      html: '<h1>Si ves esto, el correo funciona ✅</h1>'
    });

    res.json({ message: 'Correo enviado' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error enviando correo' });
  }
});

app.post('/api/reportes',
  requireAuth,
  async (req, res) => {

    try {

      const nuevoReporte =
        await Reporte.create({
          activoId: req.body.activoId,
          equipo: req.body.equipo,
          problema: req.body.problema,
          descripcion: req.body.descripcion,
          usuario: req.session.user.nombre,
          fecha: new Date().toLocaleDateString(),
          estado: 'Pendiente'
        });


        console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "OK" : "FALTA");
await sendMail(
  process.env.EMAIL_USER, // correo admin
  "🔴 Nuevo reporte de máquina - ITrack",
  `
  <h2>Nuevo reporte recibido</h2>

  <p><b>Equipo:</b> ${req.body.equipo}</p>
  <p><b>Problema:</b> ${req.body.problema}</p>
  <p><b>Descripción:</b> ${req.body.descripcion}</p>
  <p><b>Usuario:</b> ${req.session.user.nombre}</p>
  <p><b>Fecha:</b> ${new Date().toLocaleString()}</p>
  `
);

      res.status(201).json(nuevoReporte);

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error: 'Error creando reporte'
      });
    }
});

app.get('/api/reportes',
  requireAuth,
  async (req, res) => {

    try {

      const reportes =
        await Reporte.find();

      res.json(reportes);

    } catch (error) {

      res.status(500).json({
        error: 'Error cargando reportes'
      });
    }
});



app.use((req, res) => {
  res.status(404).send('Recurso no encontrado');
});

const sendMail = require("./mailer");
sendMail(
  "al222411625@gmail.com",
  "Prueba ITrack",
  "<h1>Correo funcionando 🚀</h1>"
);
