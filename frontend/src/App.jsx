import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

const modules = [
  { id: 'consulta', label: 'Consultar productos', story: 'HU101', icon: '⌕' },
  { id: 'gestion', label: 'Productos', story: 'HU102', icon: '▦' },
  { id: 'ventas', label: 'Punto de venta', story: 'HU201 · HU202', icon: '$' },
  { id: 'alertas', label: 'Alertas', story: 'HU301 · HU302', icon: '!' },
  { id: 'reportes', label: 'Reportes', story: 'HU401', icon: '▥' },
]

const IVA_RATE = Number(import.meta.env.VITE_IVA_RATE || '0.19')
const todayLabel = new Date().toLocaleDateString('es-CO', {
  day: 'numeric', month: 'long', year: 'numeric',
})
const money = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
})

const emptyProduct = () => ({
  codigo_barras: '', nombre: '', categoria: '', precio_compra: '', precio: '',
  stock: '', stock_minimo: '0', fecha_vencimiento: '',
})

async function request(url, options) {
  let response
  try {
    response = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    })
  } catch {
    throw new Error('No fue posible conectar con el servicio. Revisa que los contenedores estén activos.')
  }
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.mensaje || 'No fue posible completar la solicitud.')
  return payload
}

function ProductForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial)
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const submit = (event) => {
    event.preventDefault()
    onSave({
      ...form,
      precio_compra: Number(form.precio_compra),
      precio: Number(form.precio),
      stock: Number(form.stock),
      stock_minimo: Number(form.stock_minimo),
    })
  }

  return (
    <form className="product-form" onSubmit={submit}>
      <div className="section-heading">
        <div><span className="eyebrow">{initial.id ? 'ACTUALIZAR' : 'NUEVO REGISTRO'}</span>
          <h3>{initial.id ? 'Editar producto' : 'Agregar producto'}</h3></div>
        {onCancel && <button type="button" className="button button-quiet" onClick={onCancel}>Cancelar</button>}
      </div>
      <div className="form-grid">
        <label>Código de barras<input required maxLength="50" value={form.codigo_barras} onChange={(e) => set('codigo_barras', e.target.value)} placeholder="Escanea o escribe el código" /></label>
        <label>Nombre del producto<input required maxLength="150" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Ej. Arepa tradicional" /></label>
        <label>Categoría<input required maxLength="80" value={form.categoria} onChange={(e) => set('categoria', e.target.value)} placeholder="Ej. Panadería" /></label>
        <label>Precio de compra<input required type="number" min="0" step="0.01" value={form.precio_compra} onChange={(e) => set('precio_compra', e.target.value)} /></label>
        <label>Precio de venta<input required type="number" min="0" step="0.01" value={form.precio} onChange={(e) => set('precio', e.target.value)} /></label>
        <label>Unidades disponibles<input required type="number" min="0" step="1" value={form.stock} onChange={(e) => set('stock', e.target.value)} /></label>
        <label>Stock mínimo<input required type="number" min="0" step="1" value={form.stock_minimo} onChange={(e) => set('stock_minimo', e.target.value)} /></label>
        <label>Fecha de vencimiento<input required type="date" value={form.fecha_vencimiento?.slice(0, 10) || ''} onChange={(e) => set('fecha_vencimiento', e.target.value)} /></label>
      </div>
      <div className="form-actions"><button className="button button-primary" disabled={saving}>{saving ? 'Guardando…' : initial.id ? 'Guardar cambios' : 'Registrar producto'}</button></div>
    </form>
  )
}

function App() {
  const [active, setActive] = useState('consulta')
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState([])
  const [searchResults, setSearchResults] = useState(null)
  const [alerts, setAlerts] = useState(null)
  const [report, setReport] = useState(null)
  const [cart, setCart] = useState([])
  const [editing, setEditing] = useState(null)
  const [notice, setNotice] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const showError = (error) => setNotice({ type: 'error', text: error.message || 'Ocurrió un error inesperado.' })
  const loadProducts = useCallback(async () => {
    const data = await request('/api/productos')
    setProducts(data.productos)
    return data.productos
  }, [])

  useEffect(() => {
    let activeEffect = true
    request('/api/productos')
      .then((data) => { if (activeEffect) setProducts(data.productos) })
      .catch((error) => { if (activeEffect) showError(error) })
    return () => { activeEffect = false }
  }, [])

  const changeModule = async (module) => {
    setActive(module)
    setNotice(null)
    if (module === 'gestion' || module === 'ventas') {
      setLoading(true)
      try { await loadProducts() } catch (error) { showError(error) } finally { setLoading(false) }
    }
    if (module === 'alertas') {
      setLoading(true)
      try { setAlerts(await request('/api/alertas')) } catch (error) { showError(error) } finally { setLoading(false) }
    }
    if (module === 'reportes') {
      setLoading(true)
      try { setReport(await request('/api/reportes/ventas')) } catch (error) { showError(error) } finally { setLoading(false) }
    }
  }

  const search = async (event) => {
    event.preventDefault()
    const term = query.trim()
    if (!term) { setNotice({ type: 'error', text: 'Ingresa o escanea un código de barras o escribe el nombre del producto.' }); return }
    setLoading(true)
    setNotice(null)
    try {
      const data = await request(`/api/productos?q=${encodeURIComponent(term)}`)
      setSearchResults(data.productos)
      if (!data.productos.length) setNotice({ type: 'info', text: 'No encontramos productos con ese código o nombre.' })
    } catch (error) { showError(error) } finally { setLoading(false) }
  }

  const saveProduct = async (body) => {
    setSaving(true)
    setNotice(null)
    try {
      const url = editing?.id ? `/api/productos/${editing.id}` : '/api/productos'
      const data = await request(url, { method: editing?.id ? 'PUT' : 'POST', body: JSON.stringify(body) })
      setNotice({ type: 'success', text: data.mensaje })
      setEditing(null)
      await loadProducts()
    } catch (error) { showError(error) } finally { setSaving(false) }
  }

  const cartSubtotal = useMemo(() => cart.reduce((sum, item) => sum + Number(item.precio) * item.cantidad, 0), [cart])
  const cartTax = Math.round(cartSubtotal * IVA_RATE * 100) / 100

  const addToCart = (product) => {
    if (Number(product.stock) < 1) { setNotice({ type: 'error', text: `${product.nombre} no tiene existencias disponibles.` }); return }
    const found = cart.find((item) => item.id === product.id)
    if (found && found.cantidad >= Number(product.stock)) {
      setNotice({ type: 'error', text: `No hay suficientes existencias de ${product.nombre}.` })
      return
    }
    setCart(found
      ? cart.map((item) => item.id === product.id ? { ...item, cantidad: item.cantidad + 1 } : item)
      : [...cart, { ...product, cantidad: 1 }])
    setNotice(null)
  }

  const setCartQuantity = (id, quantity) => {
    const product = products.find((item) => item.id === id)
    const amount = Math.max(1, Number(quantity) || 1)
    if (product && amount > Number(product.stock)) {
      setNotice({ type: 'error', text: `Solo hay ${product.stock} unidades disponibles.` })
      return
    }
    setCart((current) => current.map((item) => item.id === id ? { ...item, cantidad: amount } : item))
  }

  const checkout = async () => {
    if (!cart.length) { setNotice({ type: 'error', text: 'Agrega al menos un producto antes de finalizar la venta.' }); return }
    setSaving(true)
    setNotice(null)
    try {
      const data = await request('/api/ventas', {
        method: 'POST',
        body: JSON.stringify({ items: cart.map(({ id, cantidad }) => ({ producto_id: id, cantidad })) }),
      })
      setCart([])
      await loadProducts()
      setNotice({ type: 'success', text: `${data.mensaje} Total: ${money.format(Number(data.venta.total))}` })
    } catch (error) { showError(error) } finally { setSaving(false) }
  }

  const exportCsv = () => {
    if (!report) return
    const rows = [
      ['MiniCriollos - Reporte de ventas'],
      ['Indicador', 'Valor'],
      ['Ingresos de hoy', report.hoy.ingresos],
      ['Ventas de hoy', report.hoy.cantidad_ventas],
      ['Ingresos del mes', report.mes.ingresos],
      ['Ventas del mes', report.mes.cantidad_ventas],
      [],
      ['Top productos del mes', 'Código', 'Unidades', 'Ingresos'],
      ...report.top_productos.map((item) => [item.nombre, item.codigo_barras, item.unidades, item.ingresos]),
    ]
    const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(';')).join('\r\n')}`
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `minicriollos-reporte-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const title = modules.find((item) => item.id === active)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#inicio" onClick={() => setActive('consulta')}>
          <span className="brand-mark">MC</span><span><strong>MiniCriollos</strong><small>Gestión de inventario</small></span>
        </a>
        <p className="nav-caption">MENÚ PRINCIPAL</p>
        <nav aria-label="Módulos del sistema">
          {modules.map((module) => (
            <button key={module.id} type="button" className={`nav-item ${active === module.id ? 'selected' : ''}`} aria-current={active === module.id ? 'page' : undefined} onClick={() => changeModule(module.id)}>
              <span className="nav-icon" aria-hidden="true">{module.icon}</span><span>{module.label}<small>{module.story}</small></span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer"><span className="status-dot" /> Sistema listo para operar</div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div><span className="eyebrow">MINICRIOLLOS / {title.story}</span><h1>{title.label}</h1></div><div className="today-label">Punto de venta<br /><strong>{todayLabel}</strong></div></header>
        {notice && <div className={`notice notice-${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}><span aria-hidden="true">{notice.type === 'error' ? '!' : notice.type === 'success' ? '✓' : 'i'}</span>{notice.text}<button type="button" aria-label="Cerrar mensaje" onClick={() => setNotice(null)}>×</button></div>}
        {loading && <div className="loading-line" role="status">Actualizando información…</div>}

        {active === 'consulta' && <section className="content-card">
          <div className="section-heading"><div><span className="eyebrow">BÚSQUEDA RÁPIDA · HU101</span><h2>Encuentra un producto</h2><p>Escanea el código con el lector USB o escríbelo para ver precio y existencias.</p></div><span className="badge">Lector USB compatible</span></div>
          <form className="search-form" onSubmit={search}><label className="sr-only" htmlFor="product-search">Código de barras o nombre</label><span className="search-icon" aria-hidden="true">⌕</span><input id="product-search" autoFocus value={query} onChange={(e) => { setQuery(e.target.value); setSearchResults(null); setNotice(null) }} placeholder="Escanea o escribe el nombre del producto" maxLength="150" /><button className="button button-primary" disabled={loading}>Buscar producto</button></form>
          {searchResults && <div className="product-grid">{searchResults.map((product) => <ProductCard key={product.id} product={product} />)}</div>}
        </section>}

        {active === 'gestion' && <section className="content-card">
          <ProductForm key={editing?.id || 'new'} initial={editing || emptyProduct()} onSave={saveProduct} onCancel={editing ? () => setEditing(null) : null} saving={saving} />
          <div className="section-heading list-heading"><div><span className="eyebrow">INVENTARIO ACTUAL</span><h2>Productos registrados <span className="count-badge">{products.length}</span></h2></div><button className="button button-quiet" onClick={() => loadProducts().catch(showError)}>Actualizar lista</button></div>
          <ProductTable products={products} onEdit={(product) => { setEditing({ ...product, precio: String(product.precio), precio_compra: String(product.precio_compra), stock: String(product.stock), stock_minimo: String(product.stock_minimo), fecha_vencimiento: product.fecha_vencimiento?.slice(0, 10) || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
        </section>}

        {active === 'ventas' && <section className="content-card">
          <div className="section-heading"><div><span className="eyebrow">VENTA · HU201 + HU202</span><h2>Agrega productos a la venta</h2><p>El stock se valida y descuenta al confirmar la operación.</p></div><span className="badge">IVA demo: 19 %</span></div>
          <div className="search-form compact-search"><label className="sr-only" htmlFor="sale-search">Filtrar productos</label><span className="search-icon">⌕</span><input id="sale-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtra por nombre o código de barras" /></div>
          <div className="product-grid">{products.filter((item) => !query.trim() || `${item.nombre} ${item.codigo_barras}`.toLowerCase().includes(query.trim().toLowerCase())).map((product) => <ProductCard key={product.id} product={product} onAdd={() => addToCart(product)} showAdd />)}</div>
          <div className="cart-panel"><div className="section-heading"><div><span className="eyebrow">PUNTO DE VENTA</span><h2>Carrito <span className="count-badge">{cart.reduce((sum, item) => sum + item.cantidad, 0)}</span></h2></div></div>
            {!cart.length ? <p className="empty-state">Selecciona productos para iniciar la venta.</p> : <div className="table-scroll"><table><thead><tr><th>Producto</th><th>Precio</th><th>Cantidad</th><th>Subtotal</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{cart.map((item) => <tr key={item.id}><td>{item.nombre}<small className="table-subtext">{item.codigo_barras}</small></td><td>{money.format(Number(item.precio))}</td><td><input className="quantity-input" type="number" min="1" max={item.stock} value={item.cantidad} aria-label={`Cantidad de ${item.nombre}`} onChange={(e) => setCartQuantity(item.id, e.target.value)} /></td><td>{money.format(Number(item.precio) * item.cantidad)}</td><td><button className="text-button danger-text" onClick={() => setCart((current) => current.filter((line) => line.id !== item.id))}>Quitar</button></td></tr>)}</tbody></table></div>}
          <div className="cart-total"><div><span>Subtotal</span><strong>{money.format(cartSubtotal)}</strong></div><div><span>IVA ({IVA_RATE * 100} %)</span><strong>{money.format(cartTax)}</strong></div><div className="grand-total"><span>Total a pagar</span><strong>{money.format(cartSubtotal + cartTax)}</strong></div><button className="button button-primary" disabled={!cart.length || saving} onClick={checkout}>{saving ? 'Procesando…' : 'Confirmar venta'}</button><small>El IVA es una regla inicial de demostración y está configurable en el servicio.</small></div>
          </div>
        </section>}

        {active === 'alertas' && <section className="content-card">
          <div className="section-heading"><div><span className="eyebrow">CONTROL PREVENTIVO · HU301 + HU302</span><h2>Atiende lo que requiere acción</h2><p>El sistema revisa el stock mínimo y los vencimientos de los próximos 15 días.</p></div><button className="button button-quiet" onClick={() => request('/api/alertas').then(setAlerts).catch(showError)}>Actualizar</button></div>
          {alerts && <div className="alert-groups"><AlertGroup title="Stock bajo o agotado" description="Existencias menores o iguales al mínimo configurado" products={alerts.bajo_stock} kind="danger" empty="No hay productos por debajo del mínimo." /><AlertGroup title="Próximos a vencer" description="Fecha de vencimiento dentro de los siguientes 15 días" products={alerts.proximos_a_vencer} kind="warning" empty="No hay vencimientos próximos." /><AlertGroup title="Vencidos" description="Productos cuya fecha de vencimiento ya pasó" products={alerts.vencidos} kind="danger" empty="No hay productos vencidos." /></div>}
        </section>}

        {active === 'reportes' && <section className="content-card report-content">
          <div className="section-heading"><div><span className="eyebrow">RESULTADOS DE VENTA · HU401</span><h2>Resumen del negocio</h2><p>Ingresos del día y del mes, junto con los productos con mayor rotación.</p></div><div className="report-actions"><button className="button button-quiet" onClick={() => request('/api/reportes/ventas').then(setReport).catch(showError)}>Actualizar</button><button className="button button-primary" disabled={!report} onClick={exportCsv}>Exportar Excel (CSV)</button><button className="button button-quiet" disabled={!report} onClick={() => window.print()}>Imprimir / PDF</button></div></div>
          {report && <><div className="metric-grid"><Metric title="Ingresos de hoy" value={money.format(Number(report.hoy.ingresos))} detail={`${report.hoy.cantidad_ventas} ventas`} /><Metric title="Ingresos del mes" value={money.format(Number(report.mes.ingresos))} detail={`${report.mes.cantidad_ventas} ventas`} /><Metric title="Productos en Top 5" value={String(report.top_productos.length)} detail="Ordenados por unidades vendidas" /></div>
            <div className="report-columns"><section className="report-panel"><div className="section-heading"><div><span className="eyebrow">ROTACIÓN DEL MES</span><h3>Los cinco más vendidos</h3></div></div>{report.top_productos.length ? <div className="table-scroll"><table><thead><tr><th>Producto</th><th>Unidades</th><th>Ingresos</th></tr></thead><tbody>{report.top_productos.map((product) => <tr key={product.producto_id}><td>{product.nombre}<small className="table-subtext">{product.codigo_barras}</small></td><td>{product.unidades}</td><td>{money.format(Number(product.ingresos))}</td></tr>)}</tbody></table></div> : <p className="empty-state">Aún no hay ventas registradas este mes.</p>}</section>
              <section className="report-panel"><div className="section-heading"><div><span className="eyebrow">ÚLTIMOS 7 DÍAS</span><h3>Ingresos por día</h3></div></div><div className="bar-chart" role="img" aria-label="Gráfico de ingresos de los últimos siete días">{report.ultimos_7_dias.map((day) => { const max = Math.max(...report.ultimos_7_dias.map((d) => Number(d.ingresos)), 1); return <div className="bar-column" key={day.fecha}><strong>{money.format(Number(day.ingresos))}</strong><span style={{ height: `${Math.max(5, Number(day.ingresos) / max * 100)}%` }} /><small>{new Date(`${day.fecha.slice(0, 10)}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' })}</small></div> })}{!report.ultimos_7_dias.length && <p className="empty-state">Los ingresos aparecerán cuando registres ventas.</p>}</div></section></div>
          </>}
        </section>}
        <footer className="page-footer">MiniCriollos · Gestión de inventario <span>Metodologías de Desarrollo de SI</span></footer>
      </main>
    </div>
  )
}

function ProductCard({ product, onAdd, showAdd }) {
  return <article className="product-card"><div className="product-card-top"><span className="category-chip">{product.categoria || 'General'}</span><span className={`stock-tag ${Number(product.stock) <= Number(product.stock_minimo) ? 'stock-low' : ''}`}>{product.stock} uds.</span></div><h3>{product.nombre}</h3><small className="table-subtext">{product.codigo_barras}</small><div className="product-card-bottom"><strong>{money.format(Number(product.precio))}</strong>{showAdd && <button className="button button-small button-primary" onClick={onAdd}>Agregar</button>}</div></article>
}

function ProductTable({ products, onEdit }) {
  if (!products.length) return <p className="empty-state">Todavía no hay productos. Usa el formulario para registrar el primero.</p>
  return <div className="table-scroll"><table><thead><tr><th>Producto</th><th>Código</th><th>Compra / venta</th><th>Stock</th><th>Vence</th><th>Acción</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><strong>{product.nombre}</strong><small className="table-subtext">{product.categoria}</small></td><td>{product.codigo_barras}</td><td>{money.format(Number(product.precio_compra))} / {money.format(Number(product.precio))}</td><td><span className={`stock-tag ${Number(product.stock) <= Number(product.stock_minimo) ? 'stock-low' : ''}`}>{product.stock} / mín. {product.stock_minimo}</span></td><td>{product.fecha_vencimiento?.slice(0, 10)}</td><td><button className="text-button" onClick={() => onEdit(product)}>Editar</button></td></tr>)}</tbody></table></div>
}

function AlertGroup({ title, description, products: items, kind, empty }) {
  return <section className={`alert-group alert-${kind}`}><div className="section-heading"><div><h3>{title} <span className="count-badge">{items?.length || 0}</span></h3><p>{description}</p></div></div>{!items?.length ? <p className="empty-state">{empty}</p> : <div className="table-scroll"><table><thead><tr><th>Producto</th><th>Existencias</th><th>Fecha</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.nombre}<small className="table-subtext">{item.codigo_barras}</small></td><td>{item.stock} <small className="table-subtext">(mín. {item.stock_minimo})</small></td><td>{item.fecha_vencimiento?.slice(0, 10) || '—'}</td></tr>)}</tbody></table></div>}</section>
}

function Metric({ title, value, detail }) {
  return <article className="metric-card"><span>{title}</span><strong>{value}</strong><small>{detail}</small></article>
}

export default App
