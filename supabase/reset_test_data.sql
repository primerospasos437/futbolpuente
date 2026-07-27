-- =============================================================================
-- reset_test_data.sql · Limpieza total de datos (dejar DB lista para producción)
-- =============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
--
-- ⚠️ DESTRUCTIVO: borra TODOS los datos de la app (jugadores, grupos, partidos,
--    valoraciones, sesiones, notificaciones, etc.) y los usuarios de Auth.
--    NO borra el esquema (tablas, vistas, RPCs, políticas RLS).
--
-- Uso típico: una sola vez al salir de pruebas, antes de invitar usuarios reales.
-- NO lo corras en un proyecto con datos que quieras conservar.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Tablas públicas de la app (nombres según migraciones schema → 02 → 06–10,
--    14, 24, etc.). CASCADE respeta FKs; RESTART IDENTITY no afecta UUIDs.
-- ---------------------------------------------------------------------------
truncate table
  public.presencias,
  public.valoraciones_f5,
  public.valoraciones_f5_perfil,
  public.valoraciones,
  public.notificaciones,
  public.recuperacion_pin,
  public.jugador_evita_equipo,
  public.convocatorias,
  public.partidos,
  public.equipos,
  public.sesiones,
  public.grupo_miembros,
  public.jugadores,
  public.grupos,
  public.usuarios
restart identity cascade;

-- ---------------------------------------------------------------------------
-- 2. Supabase Auth (signUp en futbolAuth / registro)
--    DELETE cascada hacia identities / sessions / refresh_tokens en Auth.
--    Si el proyecto no usa Auth aún, este bloque simplemente deja 0 filas.
-- ---------------------------------------------------------------------------
delete from auth.users;

commit;

-- ---------------------------------------------------------------------------
-- 3. Verificación rápida (debería dar 0 en todas las filas)
-- ---------------------------------------------------------------------------
select 'usuarios' as tabla, count(*)::bigint as filas from public.usuarios
union all select 'jugadores', count(*) from public.jugadores
union all select 'grupos', count(*) from public.grupos
union all select 'grupo_miembros', count(*) from public.grupo_miembros
union all select 'sesiones', count(*) from public.sesiones
union all select 'valoraciones', count(*) from public.valoraciones
union all select 'valoraciones_f5', count(*) from public.valoraciones_f5
union all select 'valoraciones_f5_perfil', count(*) from public.valoraciones_f5_perfil
union all select 'partidos', count(*) from public.partidos
union all select 'presencias', count(*) from public.presencias
union all select 'convocatorias', count(*) from public.convocatorias
union all select 'equipos', count(*) from public.equipos
union all select 'notificaciones', count(*) from public.notificaciones
union all select 'recuperacion_pin', count(*) from public.recuperacion_pin
union all select 'jugador_evita_equipo', count(*) from public.jugador_evita_equipo
union all select 'auth.users', count(*) from auth.users
order by 1;
