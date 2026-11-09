CREATE TABLE IF NOT EXISTS productos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    codigo_barras VARCHAR(50) NOT NULL UNIQUE,

    nombre VARCHAR(150) NOT NULL,

    precio NUMERIC(12,2) NOT NULL
        CHECK (precio >= 0),

    stock INTEGER NOT NULL DEFAULT 0
        CHECK (stock >= 0),

    stock_minimo INTEGER NOT NULL DEFAULT 0
        CHECK (stock_minimo >= 0),

    fecha_vencimiento DATE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
