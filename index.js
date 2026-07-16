const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

// URL para región de Latinoamérica/Colombia por defecto
const BASE_URL = 'https://api-la.libreview.io'; 

// Función auxiliar para simular datos de glucosa realistas
function generarDatosSimulados() {
  const glucosaSimulada = Math.floor(Math.random() * (140 - 95 + 1)) + 95;
  const tendencias = [3, 4, 3, 2]; // 3=estable, 4=subiendo lento, 2=bajando lento
  const tendenciaSimulada = tendencias[Math.floor(Math.random() * tendencias.length)];
  
  return {
    estado: "simulado",
    mensaje: "Modo simulador activo (Error en login o cuenta vacía). Esperando conexión real.",
    glucosa: glucosaSimulada,
    tendencia: tendenciaSimulada,
    fecha: new Date().toISOString()
  };
}

app.get('/api/glucosa', async (req, res) => {
  const email = process.env.LIBRE_EMAIL;
  const password = process.env.LIBRE_PASSWORD;

  // Si no hay variables configuradas en Render, simulamos para no romper la app
  if (!email || !password) {
    return res.json(generarDatosSimulados());
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
      'version': '4.7.0',
      'product': 'llu.ios'
    };

    // 1. Intentar iniciar sesión en Abbott
    const authRes = await fetch(`${BASE_URL}/llu/auth/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password })
    });
    
    const authData = await authRes.json();
    
    // Si las credenciales fallan, en lugar de dar error, ¡activamos el simulador!
    if (authData.status !== 0) {
      console.log("Login fallido con Abbott. Activando simulador.");
      return res.json(generarDatosSimulados());
    }
    
    const token = authData.data.authTicket.token;

    // 2. Obtener conexiones
    const connRes = await fetch(`${BASE_URL}/llu/connections`, {
      headers: { ...headers, 'Authorization': `Bearer ${token}` }
    });
    const connData = await connRes.json();

    // Si no hay pacientes conectados, activamos el simulador
    if (!connData.data || connData.data.length === 0) {
      console.log("Cuenta vacía sin conexiones. Activando simulador.");
      return res.json(generarDatosSimulados());
    }

    // 3. MODO REAL: Si hay un paciente conectado, leemos sus datos
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
    // Si todo falla (ej. caída de servidores de Abbott), ¡el simulador sale al rescate!
    console.error("Error capturado, rescatando con simulador:", error.message);
    res.json(generarDatosSimulados());
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
