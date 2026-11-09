const express = require('express')
const pool = require('./db')

const app = express()

const PORT = Number(process.env.PORT) || 3001
const HOST = process.env.HOST || '127.0.0.1'

app.disable('x-powered-by')
app.use(express.json())

// Verificar el estado del microservicio
app.get('/health', (req, res) => {
  res.status(200).json({
    servicio: 'inventory-service',
    estado: 'operativo',
    mensaje: 'Microservicio de inventario funcionando'
  })
})

// HU101 - Consultar productos
app.get('/api/productos', async (req, res) => {
  const busqueda =
    typeof req.query.q === 'string'
      ? req.query.q.trim()
      : ''

  if (!busqueda || busqueda.length > 150) {
    return res.status(400).json({
      mensaje: 'Ingrese un código o nombre válido (máximo 150 caracteres).'
    })
  }

  try {
    const resultado = await pool.query(
      `SELECT
        id,
        codigo_barras,
        nombre,
        precio,
        stock,
        stock_minimo,
        fecha_vencimiento
       FROM productos
       WHERE codigo_barras = $1
          OR STRPOS(LOWER(nombre), LOWER($1)) > 0
       ORDER BY nombre ASC
       LIMIT 20`,
      [busqueda]
    )

    return res.status(200).json({
      productos: resultado.rows
    })
  } catch (error) {
    console.error('Error al consultar productos:', error)

    return res.status(500).json({
      mensaje: 'No fue posible consultar los productos.'
    })
  }
})

// Iniciar servidor HTTP
app.listen(PORT, HOST, () => {
  console.log(
    `Microservicio de inventario iniciado en http://${HOST}:${PORT}`
  )
})
