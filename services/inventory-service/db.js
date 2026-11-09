
const { Pool } = require('pg')
const path = require('node:path')
const dotenv = require('dotenv')

// Cargar credenciales locales de PostgreSQL
dotenv.config({
  path: path.resolve(__dirname, '../../infrastructure/.env')
})

// Verificar que existan las variables necesarias
const variablesRequeridas = [
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DB'
]

for (const variable of variablesRequeridas) {
  if (!process.env[variable]) {
    throw new Error(
      `Falta configurar la variable de entorno: ${variable}`
    )
  }
}

// Configuración de las conexiones a PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  options: '-c timezone=America/Bogota',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
})

module.exports = pool
