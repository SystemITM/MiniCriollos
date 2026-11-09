const express = require('express')
const pool = require('./db')

const app = express()
const PORT = Number(process.env.PORT) || 3002
const HOST = process.env.HOST || '0.0.0.0'
const IVA_RATE = Number(process.env.IVA_RATE ?? 0.19)

app.disable('x-powered-by')
app.use(express.json({ limit: '100kb' }))

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ventas (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
      porcentaje_iva NUMERIC(5,4) NOT NULL CHECK (porcentaje_iva >= 0),
      iva NUMERIC(12,2) NOT NULL CHECK (iva >= 0),
      total NUMERIC(12,2) NOT NULL CHECK (total >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS venta_detalles (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      venta_id BIGINT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
      producto_id BIGINT NOT NULL,
      codigo_barras VARCHAR(50) NOT NULL,
      nombre_producto VARCHAR(150) NOT NULL,
      precio_unitario NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
      cantidad INTEGER NOT NULL CHECK (cantidad > 0),
      subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0)
    );
    CREATE INDEX IF NOT EXISTS idx_ventas_created_at ON ventas (created_at);
    CREATE INDEX IF NOT EXISTS idx_venta_detalles_producto ON venta_detalles (producto_id);
  `)
}

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    return res.json({ servicio: 'sales-service', estado: 'operativo' })
  } catch {
    return res.status(503).json({ servicio: 'sales-service', estado: 'sin conexión a base de datos' })
  }
})

app.get('/api/ventas', async (req, res) => {
  try {
    const sales = await pool.query(
      `SELECT v.id, v.subtotal, v.porcentaje_iva, v.iva, v.total, v.created_at,
         COALESCE(json_agg(json_build_object(
           'producto_id', d.producto_id, 'codigo_barras', d.codigo_barras,
           'nombre', d.nombre_producto, 'precio', d.precio_unitario,
           'cantidad', d.cantidad, 'subtotal', d.subtotal
         )) FILTER (WHERE d.id IS NOT NULL), '[]') AS productos
       FROM ventas v LEFT JOIN venta_detalles d ON d.venta_id = v.id
       GROUP BY v.id ORDER BY v.created_at DESC LIMIT 50`
    )
    return res.json({ ventas: sales.rows })
  } catch (error) {
    console.error('Error al consultar ventas:', error)
    return res.status(500).json({ mensaje: 'No fue posible consultar las ventas.' })
  }
})

// HU201 + HU202: confirma los productos y descuenta stock dentro de la misma transacción.
app.post('/api/ventas', async (req, res) => {
  const rawItems = req.body?.items
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 100) {
    return res.status(400).json({ mensaje: 'Agrega entre 1 y 100 productos al carrito.' })
  }

  if (!Number.isFinite(IVA_RATE) || IVA_RATE < 0 || IVA_RATE > 1) {
    return res.status(500).json({ mensaje: 'La configuración de IVA no es válida.' })
  }

  const quantities = new Map()
  for (const item of rawItems) {
    const id = Number(item?.producto_id)
    const cantidad = Number(item?.cantidad)
    if (!Number.isSafeInteger(id) || id <= 0 || !Number.isInteger(cantidad) || cantidad <= 0) {
      return res.status(400).json({ mensaje: 'Cada producto debe tener un identificador y una cantidad entera válida.' })
    }
    quantities.set(id, (quantities.get(id) || 0) + cantidad)
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const ids = [...quantities.keys()].sort((a, b) => a - b)
    const products = await client.query(
      `SELECT id, codigo_barras, nombre, precio, stock FROM productos
       WHERE id = ANY($1::bigint[]) ORDER BY id FOR UPDATE`,
      [ids]
    )
    if (products.rowCount !== ids.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ mensaje: 'Uno o más productos ya no están disponibles.' })
    }

    const lines = products.rows.map((product) => {
      const cantidad = quantities.get(Number(product.id))
      return { product, cantidad, price: Number(product.precio) }
    })
    const unavailable = lines.find(({ product, cantidad }) => product.stock < cantidad)
    if (unavailable) {
      await client.query('ROLLBACK')
      return res.status(409).json({ mensaje: `Existencias insuficientes para ${unavailable.product.nombre}. Disponibles: ${unavailable.product.stock}.` })
    }

    const subtotalCents = lines.reduce((sum, line) => sum + Math.round(line.price * 100) * line.cantidad, 0)
    const ivaCents = Math.round(subtotalCents * IVA_RATE)
    const totalCents = subtotalCents + ivaCents
    const sale = await client.query(
      `INSERT INTO ventas (subtotal, porcentaje_iva, iva, total)
       VALUES ($1, $2, $3, $4) RETURNING id, subtotal, porcentaje_iva, iva, total, created_at`,
      [subtotalCents / 100, IVA_RATE, ivaCents / 100, totalCents / 100]
    )

    for (const { product, cantidad, price } of lines) {
      const updated = await client.query(
        `UPDATE productos SET stock = stock - $1, updated_at = NOW()
         WHERE id = $2 AND stock >= $1 RETURNING stock`,
        [cantidad, product.id]
      )
      if (!updated.rowCount) throw new Error(`El stock de ${product.nombre} cambió durante la venta.`)
      await client.query(
        `INSERT INTO venta_detalles
         (venta_id, producto_id, codigo_barras, nombre_producto, precio_unitario, cantidad, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [sale.rows[0].id, product.id, product.codigo_barras, product.nombre,
          price, cantidad, Math.round(price * 100) * cantidad / 100]
      )
    }

    await client.query('COMMIT')
    return res.status(201).json({ mensaje: 'Venta registrada y stock actualizado.', venta: sale.rows[0] })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('Error al registrar venta:', error)
    return res.status(500).json({ mensaje: 'No fue posible finalizar la venta.' })
  } finally {
    client.release()
  }
})

async function start() {
  try {
    await ensureSchema()
    app.listen(PORT, HOST, () => console.log(`sales-service escuchando en ${HOST}:${PORT}; IVA ${IVA_RATE * 100}%`))
  } catch (error) {
    console.error('No fue posible iniciar sales-service:', error)
    process.exitCode = 1
  }
}

start()
