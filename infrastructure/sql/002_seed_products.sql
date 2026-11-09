-- Productos ficticios para pruebas de MiniCriollos

INSERT INTO productos (
    codigo_barras,
    nombre,
    precio,
    stock,
    stock_minimo,
    fecha_vencimiento
)
VALUES
(
    '7701234567890',
    'Arepa tradicional',
    3500.00,
    25,
    5,
    CURRENT_DATE + 7
),
(
    '7701234567891',
    'Empanada criolla',
    4500.00,
    3,
    5,
    CURRENT_DATE + 20
),
(
    '7701234567892',
    'Jugo de mora',
    6000.00,
    15,
    4,
    NULL
)
ON CONFLICT (codigo_barras) DO NOTHING;

