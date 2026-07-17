const express = require('express');
const axios = require('axios'); // Asegúrate de tener axios instalado
const app = express();

// Ruta para obtener la glucosa real de Ángela
app.get('/api/glucose', async (req, res) => {
  // 1. Jalamos tus credenciales seguras de Render
  const email = process.env.LINKUP_USERNAME;
  const password = process.env.LINKUP_PASSWORD;
  
  if (!email || !password) {
    return res.status(500).json({ 
      error: "Faltan las variables de entorno LINKUP_USERNAME o LINKUP_PASSWORD en Render." 
    });
  }

  try {
    // 2. Iniciamos sesión en los servidores de Abbott (LibreLinkUp)
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

    // 3. Consultamos las conexiones autorizadas (Donde ya debe aparecer Ángela)
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
        error: "No se encontraron conexiones. Asegúrate de aceptar la invitación de Ángela en LibreLinkUp." 
      });
    }

    // 4. Tomamos el dato en tiempo real de Ángela (primera conexión activa)
    const angelaData = connections[0];
    const currentGlucose = angelaData.glucoseMeasurement;

    // 5. Enviamos la respuesta limpia con los datos reales
    res.json({
      success: true,
      patientName: `${angelaData.firstName} ${angelaData.lastName}`,
      glucose: currentGlucose.Value, // El valor real (ej. 115)
      trend: currentGlucose.TrendArrow, // La flecha de tendencia
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
