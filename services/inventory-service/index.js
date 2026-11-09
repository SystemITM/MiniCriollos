const express = require('express')
const pool = require('./db')

const app = express()
const PORT = Number(process.env.PORT) || 3001
const HOST = process.env.HOST || '0.0.0.0'
const EXPIRY_WINDOW_DAYS = 15

app.disable('x-powered-by')
app.use(express.json({ limit: '100kb' }))

const productFields = `
  id, codigo_barras, nombre, categoria, precio_compra, precio,
  stock, stock_minimo, fecha_vencimiento, created_at, updated_at
`

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function validateProduct(body = {}) {
  const product = {
    codigo_barras: typeof body.codigo_barras === 'string' ? body.codigo_barras.trim() : '',
    nombre: typeof body.nombre === 'string' ? body.nombre.trim() : '',
    categoria: typeof body.categoria === 'string' ? body.categoria.trim() : '',
    precio_compra: body.precio_compra,
    precio: body.precio,
    stock: body.stock,
    stock_minimo: body.stock_minimo ?? 0,
    fecha_vencimiento: body.fecha_vencimiento || null
  }

  if (!product.codigo_barras || product.codigo_barras.length > 50 ||
      !product.nombre || product.nombre.length > 150 ||
      !product.categoria || product.categoria.length > 80) {
    return { error: 'Código, nombre y categoría son obligatorios. Revisa sus longitudes.' }
  }

  for (const field of ['precio_compra', 'precio']) {
    if (typeof product[field] !== 'number' || !Number.isFinite(product[field]) || product[field] < 0) {
      return { error: 'Los precios deben ser números mayores o iguales a cero.' }
    }
  }

  for (const field of ['stock', 'stock_minimo']) {
    if (!Number.isInteger(product[field]) || product[field] < 0) {
      return { error: 'Las unidades y el stock mínimo deben ser enteros mayores o iguales a cero.' }
    }
  }

  if (!product.fecha_vencimiento || !validDate(product.fecha_vencimiento)) {
    return { error: 'La fecha de vencimiento es obligatoria y debe ser válida.' }
  }

  return { product }
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS productos (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      codigo_barras VARCHAR(50) NOT NULL UNIQUE,
      nombre VARCHAR(150) NOT NULL,
      categoria VARCHAR(80) NOT NULL DEFAULT 'General',
      precio_compra NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (precio_compra >= 0),
      precio NUMERIC(12,2) NOT NULL CHECK (precio >= 0),
      stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
      stock_minimo INTEGER NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
      fecha_vencimiento DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE productos ADD COLUMN IF NOT EXISTS categoria VARCHAR(80) NOT NULL DEFAULT 'General';
    ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_compra NUMERIC(12,2) NOT NULL DEFAULT 0;
    CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos (LOWER(nombre));
    CREATE INDEX IF NOT EXISTS idx_productos_vencimiento ON productos (fecha_vencimiento);
  `)

  if (process.env.DEMO_SEED === 'true') {
    await pool.query(`
      INSERT INTO productos
        (codigo_barras, nombre, categoria, precio_compra, precio, stock, stock_minimo, fecha_vencimiento)
      VALUES
        ('7701234567890', 'Arepa tradicional', 'Panadería', 2200, 3500, 25, 5, CURRENT_DATE + 7),
        ('7701234567891', 'Empanada criolla', 'Comidas preparadas', 2800, 4500, 3, 5, CURRENT_DATE + 20),
        ('7701234567892', 'Jugo de mora', 'Bebidas', 3500, 6000, 15, 4, CURRENT_DATE + 60)
      ON CONFLICT (codigo_barras) DO NOTHING
    `)
  }
}

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    return res.status(200).json({ servicio: 'inventory-service', estado: 'operativo' })
  } catch {
    return res.status(503).json({ servicio: 'inventory-service', estado: 'sin conexión a base de datos' })
  }
})

// HU101: el lector USB actúa como teclado y envía el código al campo de búsqueda.
app.get('/api/productos', async (req, res) => {
  const busqueda = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (busqueda.length > 150) {
    return res.status(400).json({ mensaje: 'La búsqueda no puede superar 150 caracteres.' })
  }

  try {
    const resultado = await pool.query(
      `SELECT ${productFields}
       FROM productos
       WHERE $1 = '' OR codigo_barras = $1 OR STRPOS(LOWER(nombre), LOWER($1)) > 0
       ORDER BY nombre ASC LIMIT 100`,
      [busqueda]
    )
    return res.status(200).json({ productos: resultado.rows })
  } catch (error) {
    console.error('Error al consultar productos:', error)
    return res.status(500).json({ mensaje: 'No fue posible consultar los productos.' })
  }
})

// HU102: alta de productos con validación de los campos requeridos.
app.post('/api/productos', async (req, res) => {
  const { product, error } = validateProduct(req.body)
  if (error) return res.status(400).json({ mensaje: error })

  try {
    const result = await pool.query(
      `INSERT INTO productos
       (codigo_barras, nombre, categoria, precio_compra, precio, stock, stock_minimo, fecha_vencimiento)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${productFields}`,
      [product.codigo_barras, product.nombre, product.categoria, product.precio_compra,
        product.precio, product.stock, product.stock_minimo, product.fecha_vencimiento]
    )
    return res.status(201).json({ mensaje: 'Producto registrado correctamente.', producto: result.rows[0] })
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ mensaje: 'Ya existe un producto con ese código de barras.' })
    console.error('Error al registrar producto:', error)
    return res.status(500).json({ mensaje: 'No fue posible registrar el producto.' })
  }
})

app.put('/api/productos/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ mensaje: 'El identificador del producto no es válido.' })
  }
  const { product, error } = validateProduct(req.body)
  if (error) return res.status(400).json({ mensaje: error })

  try {
    const result = await pool.query(
      `UPDATE productos SET codigo_barras = $1, nombre = $2, categoria = $3,
        precio_compra = $4, precio = $5, stock = $6, stock_minimo = $7,
        fecha_vencimiento = $8, updated_at = NOW()
       WHERE id = $9 RETURNING ${productFields}`,
      [product.codigo_barras, product.nombre, product.categoria, product.precio_compra,
        product.precio, product.stock, product.stock_minimo, product.fecha_vencimiento, id]
    )
    if (!result.rowCount) return res.status(404).json({ mensaje: 'El producto no existe.' })
    return res.status(200).json({ mensaje: 'Producto actualizado correctamente.', producto: result.rows[0] })
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ mensaje: 'Ya existe otro producto con ese código de barras.' })
    console.error('Error al actualizar producto:', error)
    return res.status(500).json({ mensaje: 'No fue posible actualizar el producto.' })
  }
})

// HU301: productos con existencias en o por debajo del mínimo configurado.
// HU302: vencimientos dentro de los próximos 15 días.
app.get('/api/alertas', async (req, res) => {
  try {
    const [bajoStock, proximosAVencer, vencidos] = await Promise.all([
      pool.query(`SELECT ${productFields} FROM productos WHERE stock <= stock_minimo ORDER BY stock ASC, nombre ASC`),
      pool.query(`SELECT ${productFields} FROM productos
        WHERE fecha_vencimiento >= CURRENT_DATE
          AND fecha_vencimiento <= CURRENT_DATE + $1::integer
        ORDER BY fecha_vencimiento ASC`, [EXPIRY_WINDOW_DAYS]),
      pool.query(`SELECT ${productFields} FROM productos
        WHERE fecha_vencimiento < CURRENT_DATE ORDER BY fecha_vencimiento ASC`)
    ])
    return res.json({ bajo_stock: bajoStock.rows, proximos_a_vencer: proximosAVencer.rows, vencidos: vencidos.rows })
  } catch (error) {
    console.error('Error al consultar alertas:', error)
    return res.status(500).json({ mensaje: 'No fue posible consultar las alertas.' })
  }
})

async function start() {
  try {
    await ensureSchema()
    app.listen(PORT, HOST, () => console.log(`inventory-service escuchando en ${HOST}:${PORT}`))
  } catch (error) {
    console.error('No fue posible iniciar inventory-service:', error)
    process.exitCode = 1
  }
}

start()
