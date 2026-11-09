import { useState } from 'react'
import './App.css'

const modulos = [
  { id: 'consulta', nombre: 'Consulta de productos', historia: 'HU101' },
  { id: 'gestion', nombre: 'Gestión de productos', historia: 'HU102' },
  { id: 'ventas', nombre: 'Ventas y carrito', historia: 'HU201 y HU202' },
  { id: 'alertas', nombre: 'Alertas de inventario', historia: 'HU301 y HU302' },
  { id: 'reportes', nombre: 'Dashboard y reportes', historia: 'HU401' }
]

const formatoPrecio = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
})

function App() {
  const [moduloActivo, setModuloActivo] = useState('consulta')
  const [busqueda, setBusqueda] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(false)
  const [busquedaRealizada, setBusquedaRealizada] = useState(false)

  const moduloSeleccionado = modulos.find(
    (modulo) => modulo.id === moduloActivo
  )

  // HU101 - Buscar productos reales en PostgreSQL
  const buscarProducto = async (evento) => {
    evento.preventDefault()

    const criterio = busqueda.trim()

    setProductos([])
    setMensaje('')
    setBusquedaRealizada(false)

    if (!criterio || criterio.length > 150) {
      setMensaje('Ingrese un código o nombre válido (máximo 150 caracteres).')
      return
    }

    setCargando(true)

    try {
      const respuesta = await fetch(
        `/api/productos?q=${encodeURIComponent(criterio)}`
      )

      const datos = await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(
          datos.mensaje || 'No fue posible consultar los productos.'
        )
      }

      setProductos(datos.productos)
      setBusquedaRealizada(true)
    } catch (error) {
      setMensaje(
        error instanceof Error
          ? error.message
          : 'No fue posible conectar con el inventario.'
      )
    } finally {
      setCargando(false)
    }
  }

  return (
    <main>
      <h1>MiniCriollos</h1>
      <h2>Sistema de Gestión de Inventario</h2>

      <p>
        Plataforma para administrar productos, inventario,
        ventas, alertas y reportes.
      </p>

      <h3>Módulos del sistema</h3>

      <nav
        aria-label="Módulos de MiniCriollos"
        style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap'
        }}
      >
        {modulos.map((modulo) => (
          <button
            key={modulo.id}
            type="button"
            aria-pressed={moduloActivo === modulo.id}
            onClick={() => setModuloActivo(modulo.id)}
            style={{
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              cursor: 'pointer',
              backgroundColor:
                moduloActivo === modulo.id ? '#2563eb' : '#f1f5f9',
              color:
                moduloActivo === modulo.id ? '#ffffff' : '#334155'
            }}
          >
            {modulo.nombre}
          </button>
        ))}
      </nav>

      <section
        style={{
          marginTop: '24px',
          padding: '20px',
          backgroundColor: '#f1f5f9',
          borderRadius: '10px'
        }}
      >
        <h3>{moduloSeleccionado.nombre}</h3>
        <p>Historia de usuario: {moduloSeleccionado.historia}</p>

        {moduloActivo === 'consulta' ? (
          <>
            <form onSubmit={buscarProducto}>
              <label htmlFor="busqueda-producto">
                Código de barras o nombre del producto
              </label>

              <div style={{
                display: 'flex',
                gap: '10px',
                marginTop: '12px',
                flexWrap: 'wrap'
              }}>
                <input
                  id="busqueda-producto"
                  type="text"
                  value={busqueda}
                  maxLength={150}
                  onChange={(evento) => {
                    setBusqueda(evento.target.value)
                    setMensaje('')
                    setProductos([])
                    setBusquedaRealizada(false)
                  }}
                  placeholder="Ingrese el código o nombre"
                  style={{
                    flex: 1,
                    minWidth: '200px',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1'
                  }}
                />

                <button
                  type="submit"
                  disabled={cargando}
                  style={{
                    padding: '12px 20px',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: cargando ? 'wait' : 'pointer'
                  }}
                >
                  {cargando ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
            </form>

            <div aria-live="polite" role="status">
              {mensaje && <p>{mensaje}</p>}

              {busquedaRealizada && productos.length === 0 && (
                <p>No se encontraron productos.</p>
              )}
            </div>

            {productos.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <h3>Resultados de la búsqueda</h3>

                {productos.map((producto) => (
                  <article
                    key={producto.id}
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '10px',
                      padding: '16px',
                      marginBottom: '12px'
                    }}
                  >
                    <h3>{producto.nombre}</h3>

                    <p>
                      <strong>Código de barras:</strong>{' '}
                      {producto.codigo_barras}
                    </p>

                    <p>
                      <strong>Precio:</strong>{' '}
                      {formatoPrecio.format(Number(producto.precio))}
                    </p>

                    <p>
                      <strong>Existencias:</strong> {producto.stock}
                    </p>

                    <p>
                      <strong>Stock mínimo:</strong>{' '}
                      {producto.stock_minimo}
                    </p>

                    <p>
                      <strong>Vencimiento:</strong>{' '}
                      {producto.fecha_vencimiento
                        ? producto.fecha_vencimiento.slice(0, 10)
                        : 'No registrado'}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </>
        ) : (
          <p>Este módulo está pendiente de implementación.</p>
        )}
      </section>
    </main>
  )
}

export default App
