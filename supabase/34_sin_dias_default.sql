-- Los días de partido los elige el admin: sin Martes/Jueves por defecto.

alter table public.grupos
  alter column dias_partido set default '{}'::text[];

comment on column public.grupos.dias_partido is
  'Días semanales de partido (elegidos por el admin). Vacío hasta configurar.';

-- Grupos aún no configurados: limpiar el default histórico martes/jueves
update public.grupos
set dias_partido = '{}'::text[]
where not coalesce(configurado, false)
  and dias_partido = array['martes','jueves']::text[];

-- hora_partido_default es text; anotacion_*_hora pueden ser time o text según migraciones.
-- Cast a text evita COALESCE text/time (error 42804).
create or replace function public._grupo_config_to_json(g public.grupos)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'grupoId', g.id,
    'nombre', g.nombre,
    'inviteCode', g.invite_code,
    'deporte', coalesce(g.deporte, 'futbol'),
    'configurado', coalesce(g.configurado, false),
    'diasPartido', to_jsonb(coalesce(g.dias_partido, array[]::text[])),
    'fechasExtra', to_jsonb(coalesce(g.fechas_extra, array[]::date[])),
    'horaPartidoDefault', left(coalesce(nullif(trim(g.hora_partido_default::text), ''), '21:30'), 5),
    'anotacionAbreDiasAntes', coalesce(g.anotacion_abre_dias_antes, 7),
    'anotacionAbreHora', left(coalesce(nullif(trim(g.anotacion_abre_hora::text), ''), '22:00'), 5),
    'anotacionCierraHora', left(coalesce(nullif(trim(g.anotacion_cierra_hora::text), ''), '20:00'), 5),
    'modalidadGrupo', coalesce(g.modalidad_grupo, 'ambas'),
    'cupoMaximo', coalesce(g.cupo_maximo, 14),
    'cupoListaEspera', coalesce(g.cupo_lista_espera, 6),
    'exigePerfilCompleto', coalesce(g.exige_perfil_completo, true),
    'exigePerfilF5', coalesce(g.exige_perfil_f5, true),
    'minValoracionesPerfil', coalesce(g.min_valoraciones_perfil, 4),
    'complejoHabitual', coalesce(g.complejo_habitual, ''),
    'notasLista', coalesce(g.notas_lista, '')
  );
$$;
