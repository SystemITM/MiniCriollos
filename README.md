# MiniCriollos — Gestión de Inventario

Aplicación web para consultar y administrar productos, registrar ventas, generar alertas y revisar los ingresos de una tienda. Proyecto de la asignatura Metodologías de Desarrollo de Sistemas de Información.

## Historias cubiertas

| Sprint | Historia | Flujo disponible |
| --- | --- | --- |
| 1 — Consulta de productos | HU101 | Búsqueda por código de barras o nombre. Un lector USB tipo teclado puede escribir el código y enviar Enter. |
| 2 — Gestión de productos | HU102 | Registro y edición con código, nombre, categoría, precio de compra y venta, existencias, mínimo y vencimiento. |
| 3 — Ventas y alertas | HU201, HU202 | Carrito con subtotal, IVA, total y confirmación transaccional que descuenta stock. Alertas de stock bajo y vencimiento en 15 días. |
| 4 — Dashboard y reportes | HU401 | Ingresos diarios y mensuales, ventas por día, top cinco productos y exportación CSV compatible con Excel o impresión a PDF. |
| 4 — Calidad | RNF01, RNF02 | Navegación adaptable, mensajes de error visibles y explicaciones junto a los formularios. |

## Arquitectura local

- `frontend`: React y Vite en `http://localhost:5173`.
- `inventory-service`: productos, inventario y alertas en el puerto `3001`.
- `sales-service`: carrito confirmado y registro de ventas en el puerto `3002`.
- `reports-service`: agregaciones para el dashboard en el puerto `3003`.
- `postgres`: persistencia relacional en el puerto `5432`.

Para la demostración local los servicios comparten una base PostgreSQL. La confirmación de una venta y la disminución de existencias ocurren dentro de una transacción de base de datos. La base existente recibe `categoria` y `precio_compra` con cambios compatibles al iniciar el servicio de inventario.

## Inicio con Docker Desktop

1. Copia `infrastructure/.env.example` como `infrastructure/.env` y define una contraseña local.
2. Desde la raíz del repositorio, ejecuta en PowerShell:

   ```powershell
   docker compose --env-file infrastructure/.env -f infrastructure/compose.yaml up --build -d
   ```

3. Abre `http://localhost:5173`.
4. Revisa los contenedores y su estado:

   ```powershell
   docker compose --env-file infrastructure/.env -f infrastructure/compose.yaml ps
   ```

5. Para ver los registros:

   ```powershell
   docker compose --env-file infrastructure/.env -f infrastructure/compose.yaml logs -f
   ```

6. Para detener los contenedores sin borrar los datos de PostgreSQL:

   ```powershell
   docker compose --env-file infrastructure/.env -f infrastructure/compose.yaml down
   ```

El primer inicio agrega productos ficticios de demostración. Se insertan solo si el código de barras aún no existe. Para borrar datos y comenzar de nuevo, ejecuta `docker compose --env-file infrastructure/.env -f infrastructure/compose.yaml down -v`; esto elimina el volumen persistente de la base de datos.

## Reglas de la demo

- El IVA inicial es 19 % y se configura con `IVA_RATE` en `infrastructure/.env`; la misma tasa se incluye en la pantalla y el servicio. Si se cambia, reconstruye los contenedores con `--build`.
- Los reportes usan la zona horaria `America/Bogota` para agrupar correctamente las ventas del día y del mes.
- Las alertas de vencimiento muestran productos vencidos y los que vencen desde hoy hasta los próximos 15 días.
- El archivo de exportación es CSV con separador punto y coma, que puede abrirse en Excel. La opción de impresión permite guardar el reporte como PDF desde el navegador.
- Para el lector USB no hace falta instalar un SDK si funciona como teclado: el lector debe enviar Enter al terminar el código.

## CI/CD en GitHub Actions

`.github/workflows/ci-cd.yml` ejecuta lint, compilación del frontend y revisión sintáctica de los servicios en los pull requests y pushes a `main`/`master`. Para un push publica cuatro imágenes versionadas por commit y la etiqueta `latest` en GitHub Container Registry (GHCR), usando `GITHUB_TOKEN`; no requiere créditos de AWS Academy. Las imágenes GHCR pueden quedar privadas según la configuración del repositorio.

## Datos y servicios

- El esquema y los datos iniciales de productos se describen en `infrastructure/sql`.
- Los servicios inicializan sus tablas e índices al arrancar y exponen `GET /health`.
- Las rutas de la aplicación se enrutan mediante el proxy de Vite al servicio correspondiente.
