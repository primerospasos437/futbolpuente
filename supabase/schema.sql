-- Fútbol Grupo · esquema para Supabase (PostgreSQL)
-- Ejecutá esto en: Supabase Dashboard → SQL Editor → New query → Run

-- UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. USUARIOS: fila base de cuenta (1:1 con jugador).
-- Si más adelante usás Supabase Auth, podés igualar usuarios.id = auth.uid().
-- ---------------------------------------------------------------------------
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE usuarios IS 'Cuenta interna del sistema; cada jugador tiene un usuario asociado (mismo id).';

-- ---------------------------------------------------------------------------
-- 2. JUGADORES: ficha deportiva + perfil_scores (las 18 dimensiones en JSON).
-- ---------------------------------------------------------------------------
CREATE TABLE jugadores (
  id UUID PRIMARY KEY REFERENCES usuarios (id) ON DELETE CASCADE,

  apodo TEXT NOT NULL,
  pin_hash TEXT NOT NULL,

  nombre_completo TEXT NOT NULL,
  posicion_preferida TEXT NOT NULL DEFAULT 'medio'
    CHECK (posicion_preferida IN ('portero', 'defensa', 'medio', 'delantero')),
  posicion_alternativa TEXT NOT NULL DEFAULT 'medio'
    CHECK (posicion_alternativa IN ('portero', 'defensa', 'medio', 'delantero')),
  pie_dominante TEXT NOT NULL DEFAULT 'derecho'
    CHECK (pie_dominante IN ('derecho', 'izquierdo', 'ambos')),

  fecha_nacimiento TEXT NOT NULL DEFAULT '',
  contacto TEXT NOT NULL DEFAULT '',

  altura_cm INTEGER CHECK (altura_cm IS NULL OR (altura_cm BETWEEN 120 AND 230)),
  peso_kg NUMERIC(5, 1) CHECK (peso_kg IS NULL OR (peso_kg BETWEEN 35 AND 160)),

  historial_lesiones TEXT NOT NULL DEFAULT '',

  -- Objeto JSON con las 18 claves numéricas 1–10 (valida la app backend)
  perfil_scores JSONB NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX jugadores_apodo_lower ON jugadores (lower(trim(apodo)));

COMMENT ON COLUMN jugadores.historial_lesiones IS 'Solo debe mostrarse al propio jugador en la API.';

CREATE OR REPLACE FUNCTION set_jugadores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_jugadores_updated_at
  BEFORE UPDATE ON jugadores
  FOR EACH ROW
  EXECUTE PROCEDURE set_jugadores_updated_at();

-- ---------------------------------------------------------------------------
-- 3. VALORACIONES: una fila por par (valorador → valorado)
-- ---------------------------------------------------------------------------
CREATE TABLE valoraciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  de_jugador_id UUID NOT NULL REFERENCES jugadores (id) ON DELETE CASCADE,
  para_jugador_id UUID NOT NULL REFERENCES jugadores (id) ON DELETE CASCADE,

  puntajes JSONB NOT NULL DEFAULT '{}',

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (de_jugador_id, para_jugador_id),
  CHECK (de_jugador_id <> para_jugador_id)
);

CREATE INDEX idx_valoraciones_para ON valoraciones (para_jugador_id);

-- ---------------------------------------------------------------------------
-- 4. SESIONES: tokens Bearer emitidos por el backend (PIN / registro).
-- Opcional: limpiá filas viejas con un cron o borrá al hacer logout masivo.
-- ---------------------------------------------------------------------------
CREATE TABLE sesiones (
  token TEXT PRIMARY KEY,
  jugador_id UUID NOT NULL REFERENCES jugadores (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sesiones_jugador ON sesiones (jugador_id);

-- ---------------------------------------------------------------------------
-- 5. EQUIPOS: partidos/armados guardados (resultado JSON del balanceador).
-- ---------------------------------------------------------------------------
CREATE TABLE equipos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  nombre TEXT NOT NULL DEFAULT '',

  creado_por_jugador_id UUID REFERENCES jugadores (id) ON DELETE SET NULL,

  -- Ej.: { teamA, teamB, sumA, sumB, difference, generatedAt, playerIds }
  resultado JSONB NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE equipos IS 'Lineups guardados (equipo A / B y metadatos).';

-- ---------------------------------------------------------------------------
-- Row Level Security (RLS)
-- El backend debe usar SUPABASE_SERVICE_ROLE_KEY (rol service_role bypass RLS).
-- Sin políticas públicas = anon/authenticated NO acceden por defecto si usás ese rol.
-- ---------------------------------------------------------------------------
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE jugadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE valoraciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipos ENABLE ROW LEVEL SECURITY;

-- No definimos políticas para anon/authenticated: solo tu API Node con service role.
