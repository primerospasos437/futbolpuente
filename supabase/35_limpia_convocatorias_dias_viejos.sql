-- Limpia anotaciones futuras de días que el admin ya no tiene habilitados.
-- (p. ej. quedaron martes/jueves de cuando el default los metía solos)

delete from public.convocatorias c
using public.grupos g
where c.grupo_id = g.id
  and c.fecha_partido >= (timezone('America/Argentina/Buenos_Aires', now()))::date
  and c.dia is distinct from 'extra'
  and not (c.dia = any (coalesce(g.dias_partido, array[]::text[])));
