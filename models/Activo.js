const mongoose = require('mongoose');

const activoSchema = new mongoose.Schema({
  categoria: {
    type: String,
    required: true
  },
  tipo: {
    type: String,
    required: true
  },
  marca: {
    type: String,
    required: true
  },
  serial: {
    type: String,
    required: true
  },
  estado: {
    type: String,
    required: true
  },
  area: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Activo', activoSchema);