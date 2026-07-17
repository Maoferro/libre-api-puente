const express = require('express');
const axios = require('axios');
const app = express();

// Middleware para entender formato JSON si lo necesitas después
app.use(express.json());

// 1. Ruta de prueba para verificar que el servidor esté vivo en internet
app.get('/', (req, res) => {
  res.send('Servidor de Monitoreo de Glucosa Activo y Corriendo! 🚀');
});

// 2. La ruta que consulta la glucosa real de Ángela en LibreLinkUp
app.get('/api/glucose', async (req, res) => {
  const email = process.env.LINKUP_USERNAME;
  const password = process.env.LINKUP_PASSWORD;
  
  if (!email || !password) {
    return res.status(500).json({ 
      error: "Faltan las variables de entorno LINKUP_USERNAME o LINKUP_PASSWORD en Render." 
    });
  }

  try {
    // Autenticación con los servidores de LibreLinkUp
    const loginResponse = await axios.post(
      'https://api.libreview.io/llu/auth/login',
      { email, password },
      {
        headers: {
          'version': '4.7.0',
          'product': 'llu.android',
          'Content-Type': 'application/json',
        }
      }
    );

    const token = loginResponse.data?.data?.authTicket?.token;
    if (!token) {
      throw new Error("No se pudo obtener el token de autenticación de Abbott.");
    }

    // Consulta de las conexiones vinculadas (donde está Ángela)
    const connectionsResponse = await axios.get(
      'https://api.libreview.io/llu/connections',
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'version': '4.7.0',
          'product': 'llu.android',
        }
      }
    );

    const connections = connectionsResponse.data?.data;
    if (!connections || connections.length === 0) {
      return res.status(404).json({ 
        error: "No se encontraron conexiones activas. Asegúrate de aceptar la invitación de Ángela en LibreLinkUp." 
      });
    }

    // Extraemos la información del paciente
    const angelaData = connections[0];
    const currentGlucose = angelaData.glucoseMeasurement;

    res.json({
      success: true,
      patientName: `${angelaData.firstName} ${angelaData.lastName}`,
      glucose: currentGlucose.Value, // Nivel de azúcar real
      trend: currentGlucose.TrendArrow, // Flecha de tendencia
      timestamp: currentGlucose.Timestamp
    });

  } catch (error) {
    console.error("Error conectando con la API de Abbott:", error.message);
    res.status(500).json({ 
      error: "Error al conectar con LibreLinkUp", 
      details: error.response?.data || error.message 
    });
  }
});

// 3. El puerto mágico: Render le inyecta el puerto aquí automáticamente.
// Si no hay puerto de Render, usa el 3000 por defecto de forma local.
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`==> Servidor activo y escuchando en el puerto ${PORT}`);
});
