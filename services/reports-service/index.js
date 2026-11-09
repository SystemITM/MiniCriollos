const express = require('express')
const pool = require('./db')

const app = express()
const PORT = Number(process.env.PORT) || 3003
const HOST = process.env.HOST || '0.0.0.0'

app.disable('x-powered-by')

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    return res.json({ servicio: 'reports-service', estado: 'operativo' })
  } catch {
    return res.status(503).json({ servicio: 'reports-service', estado: 'sin conexión a base de datos' })
  }
})

// HU401: ventas del día y del mes, junto con los cinco productos más vendidos.
app.get('/api/reportes/ventas', async (req, res) => {
  try {
    const [daily, monthly, topProducts, history] = await Promise.all([
      pool.query(`SELECT COUNT(*)::integer AS cantidad_ventas,
          COALESCE(SUM(total), 0)::numeric(12,2) AS ingresos
        FROM ventas WHERE created_at >= CURRENT_DATE
          AND created_at < CURRENT_DATE + INTERVAL '1 day'`),
      pool.query(`SELECT COUNT(*)::integer AS cantidad_ventas,
          COALESCE(SUM(total), 0)::numeric(12,2) AS ingresos
        FROM ventas WHERE created_at >= date_trunc('month', CURRENT_DATE)
          AND created_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'`),
      pool.query(`SELECT d.producto_id, d.codigo_barras, d.nombre_producto AS nombre,
          SUM(d.cantidad)::integer AS unidades, SUM(d.subtotal)::numeric(12,2) AS ingresos
        FROM venta_detalles d JOIN ventas v ON v.id = d.venta_id
        WHERE v.created_at >= date_trunc('month', CURRENT_DATE)
          AND v.created_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
        GROUP BY d.producto_id, d.codigo_barras, d.nombre_producto
        ORDER BY unidades DESC, ingresos DESC, nombre ASC LIMIT 5`),
      pool.query(`SELECT date_trunc('day', created_at)::date AS fecha,
          COUNT(*)::integer AS cantidad_ventas,
          SUM(total)::numeric(12,2) AS ingresos
        FROM ventas WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
        GROUP BY date_trunc('day', created_at)::date ORDER BY fecha ASC`)
    ])

    return res.json({
      generado_en: new Date().toISOString(),
      hoy: daily.rows[0],
      mes: monthly.rows[0],
      top_productos: topProducts.rows,
      ultimos_7_dias: history.rows
    })
  } catch (error) {
    console.error('Error al generar reportes:', error)
    return res.status(500).json({ mensaje: 'No fue posible generar el reporte de ventas.' })
  }
})

app.listen(PORT, HOST, () => console.log(`reports-service escuchando en ${HOST}:${PORT}`))
