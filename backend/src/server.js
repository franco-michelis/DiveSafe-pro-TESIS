const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const planificacionesRoutes = require('./routes/planificaciones.routes');
const sitiosRoutes = require('./routes/sitios.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/planificaciones', planificacionesRoutes);
app.use('/api/sitios', sitiosRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mensaje: 'DiveSafe Pro API funcionando' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 DiveSafe Pro API corriendo en http://localhost:${PORT}`);
});
