const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI no está configurado en .env');
  process.exit(1);
}

const emailsFile = './emails.json';
let mapping;
try {
  mapping = require(emailsFile);
} catch (err) {
  console.error(`No se pudo leer ${emailsFile}. Crea un archivo JSON con el formato {"username":"email@dominio"}`);
  process.exit(1);
}

const authUserSchema = new mongoose.Schema({ username: String, email: String });
const AuthUser = mongoose.model('AuthUser', authUserSchema);

async function run() {
  await mongoose.connect(uri);
  console.log('Conectado a MongoDB');

  for (const [username, email] of Object.entries(mapping)) {
    const u = await AuthUser.findOne({ username: username.toLowerCase() });
    if (!u) {
      console.log(`Usuario no encontrado: ${username}`);
      continue;
    }
    u.email = email.toLowerCase();
    await u.save();
    console.log(`Actualizado ${username} -> ${email}`);
  }

  await mongoose.disconnect();
  console.log('Finalizado');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
