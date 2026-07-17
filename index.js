const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// 1. Ruta de prueba principal
app.get('/', (req, res) => {
  res.send('Servidor de Monitoreo de Glucosa Activo y Corriendo! 🚀');
});

// 2. Ruta para obtener la glucosa en tiempo real
app.get('/api/glucose', async (req, res) => {
  // Lee las variables que acabas de configurar en Render
  const email = process.env.LINKUP_USERNAME;
  const password = process.env.LINKUP_PASSWORD;
  
  if (!email || !password) {
    return res.status(500).json({ 
      error: "Faltan las variables de entorno LINKUP_USERNAME o LINKUP_PASSWORD en Render." 
    });
  }

  try {
    // Autenticación usando el servidor regional fuera de EE.UU. (.ru)
    const loginResponse = await axios.post(
      'https://api.libreview.ru/llu/auth/login',
      { email, password },
      {
        headers: {
          'version': '4.7.0',
          'product': 'llu.android',
          'Content-Type': 'application/json',
          'Accept-Locale': 'es-CO',
          'Region': 'co'
        }
      }
    );

    const token = loginResponse.data?.data?.authTicket?.token;
    if (!token) {
      throw new Error("No se pudo obtener el token de autenticación de Abbott.");
    }

    // Obtener las conexiones autorizadas (Ángela)
    const connectionsResponse = await axios.get(
      'https://api.libreview.ru/llu/connections',
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'version': '4.7.0',
          'product': 'llu.android',
          'Accept-Locale': 'es-CO',
          'Region': 'co'
        }
      }
    );

    const connections = connectionsResponse.data?.data;
    if (!connections || connections.length === 0) {
      return res.status(404).json({ 
        error: "No se encontraron conexiones. Asegúrate de aceptar la invitación en LibreLinkUp." 
      });
    }

    // Extraemos la información en tiempo real de Ángela
    const angelaData = connections[0];
    const currentGlucose = angelaData.glucoseMeasurement;

    if (!currentGlucose) {
      return res.json({
        success: true,
        patientName: `${angelaData.firstName} ${angelaData.lastName}`,
        message: "Paciente conectado con éxito, pero no hay lecturas de sensor recientes en este momento."
      });
    }

    res.json({
      success: true,
      patientName: `${angelaData.firstName} ${angelaData.lastName}`,
      glucose: currentGlucose.Value,
      trend: currentGlucose.TrendArrow,
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

// 3. Puerto asignado dinámicamente por Render
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`==> Servidor activo y escuchando en el puerto ${PORT}`);
});
