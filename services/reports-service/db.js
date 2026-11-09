const { Pool } = require('pg')
const path = require('node:path')
require('dotenv').config({ path: path.resolve(__dirname, '../../infrastructure/.env') })

module.exports = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  options: '-c timezone=America/Bogota',
  max: 5,
  connectionTimeoutMillis: 5000
})
