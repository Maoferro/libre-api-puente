const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Servidor de Monitoreo de Glucosa Activo y Corriendo! 🚀');
});

app.get('/api/glucose', async (req, res) => {
  // Forzamos a que se interpreten estrictamente como texto limpio
  const email = String(process.env.LINKUP_USERNAME).trim();
  const password = String(process.env.LINKUP_PASSWORD).trim();
  
  if (!email || !password || email === 'undefined' || password === 'undefined') {
    return res.status(500).json({ 
      error: "Credenciales inválidas o no configuradas en las variables de Render." 
    });
  }

  try {
    // Autenticación simulando la aplicación oficial de Android al 100%
    const loginResponse = await axios.post(
      'https://api.libreview.ru/llu/auth/login',
      { email: email, password: password },
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.181 Mobile Safari/537.36',
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
      throw new Error("Abbott no devolvió un token válido.");
    }

    // Obtener las conexiones
    const connectionsResponse = await axios.get(
      'https://api.libreview.ru/llu/connections',
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.181 Mobile Safari/537.36',
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
        error: "No se encontraron conexiones. Revisa las invitaciones pendientes." 
      });
    }

    const angelaData = connections[0];
    const currentGlucose = angelaData.glucoseMeasurement;

    if (!currentGlucose) {
      return res.json({
        success: true,
        patientName: `${angelaData.firstName} ${angelaData.lastName}`,
        message: "Conectado, pero el sensor no tiene lecturas nuevas en este instante."
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
    console.error("Error en Abbott:", error.message);
    res.status(500).json({ 
      error: "Error al conectar con LibreLinkUp", 
      details: error.response?.data || error.message 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`==> Servidor activo en puerto ${PORT}`);
});
