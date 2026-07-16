const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

// URL para región de Latinoamérica/Colombia por defecto
const BASE_URL = 'https://api-la.libreview.io'; 

app.get('/api/glucosa', async (req, res) => {
  const email = process.env.LIBRE_EMAIL;
  const password = process.env.LIBRE_PASSWORD;

  if (!email || !password) {
    return res.status(500).json({ error: "Faltan las credenciales en Render" });
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
      'version': '4.7.0',
      'product': 'llu.ios'
    };

    // 1. Intentar iniciar sesión
    const authRes = await fetch(`${BASE_URL}/llu/auth/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password })
    });
    const authData = await authRes.json();
    
    if (authData.status !== 0) {
      return res.status(401).json({ error: "No se pudo iniciar sesión. Revisa las variables en Render." });
    }
    
    const token = authData.data.authTicket.token;

    // 2. Obtener conexiones
    const connRes = await fetch(`${BASE_URL}/llu/connections`, {
      headers: { ...headers, 'Authorization': `Bearer ${token}` }
    });
    const connData = await connRes.json();

    // ==========================================
    // 🤖 MODO SIMULADOR INTELIGENTE (AUTOMÁTICO)
    // ==========================================
    if (!connData.data || connData.data.length === 0) {
      // Generamos un número aleatorio entre 95 y 140 mg/dL para que veas datos reales en Lovable
      const glucosaSimulada = Math.floor(Math.random() * (140 - 95 + 1)) + 95;
      
      // Flecha de tendencia aleatoria (3 = estable, 4 = subiendo lento, 2 = bajando lento)
      const tendencias = [3, 4, 3, 2];
      const tendenciaSimulada = tendencias[Math.floor(Math.random() * tendencias.length)];

      return res.json({
        estado: "simulado",
        mensaje: "Modo de prueba activo. Esperando conexión de Ángela.",
        glucosa: glucosaSimulada,
        tendencia: tendenciaSimulada,
        fecha: new Date().toISOString()
      });
    }

    // ==========================================
    // 🟢 MODO REAL (Se activa solo al recibir al paciente)
    // ==========================================
    const patientId = connData.data[0].patientId;
    const graphRes = await fetch(`${BASE_URL}/llu/connections/${patientId}/graph`, {
      headers: { ...headers, 'Authorization': `Bearer ${token}` }
    });
    const graphData = await graphRes.json();
    
    const lecturaActual = graphData.data.connection.glucoseMeasurement;

    res.json({
      estado: "real",
      glucosa: lecturaActual.Value,
      tendencia: lecturaActual.TrendArrow,
      fecha: lecturaActual.Timestamp
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error interno del servidor puente" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
