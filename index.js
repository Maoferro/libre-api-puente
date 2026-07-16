const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors()); // Permite que Lovable lea los datos sin bloqueos

// La región por defecto. Si estás en Colombia/Latam, suele ser esta. 
// Si falla, prueba cambiar a 'api-us.libreview.io' o 'api-eu.libreview.io'
const BASE_URL = 'https://api.libreview.io'; 

app.get('/api/glucosa', async (req, res) => {
  const email = process.env.LIBRE_EMAIL;
  const password = process.env.LIBRE_PASSWORD;

  if (!email || !password) {
    return res.status(500).json({ error: "Faltan las credenciales en Northflank" });
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
      'version': '4.7.0',
      'product': 'llu.ios'
    };

    // 1. Iniciar sesión
    const authRes = await fetch(`${BASE_URL}/llu/auth/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password })
    });
    const authData = await authRes.json();
    
    if (authData.status !== 0) throw new Error("Error de login. Revisa las credenciales.");
    const token = authData.data.authTicket.token;

    // 2. Obtener el ID del paciente
    const connRes = await fetch(`${BASE_URL}/llu/connections`, {
      headers: { ...headers, 'Authorization': `Bearer ${token}` }
    });
    const connData = await connRes.json();
    const patientId = connData.data[0].patientId;

    // 3. Obtener el nivel de glucosa
    const graphRes = await fetch(`${BASE_URL}/llu/connections/${patientId}/graph`, {
      headers: { ...headers, 'Authorization': `Bearer ${token}` }
    });
    const graphData = await graphRes.json();
    
    // Extraemos la lectura más reciente
    const lecturaActual = graphData.data.connection.glucoseMeasurement;

    // Enviamos el dato limpio a tu app
    res.json({
      glucosa: lecturaActual.Value,
      tendencia: lecturaActual.TrendArrow, // 1=Bajando rápido, 3=Estable, 5=Subiendo rápido
      fecha: lecturaActual.Timestamp
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor puente corriendo en el puerto ${PORT}`);
});
