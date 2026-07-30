/**
 * Completa las valoraciones F11 (perfil completo) y F5 (perfil) de todos
 * los jugadores de un grupo hacia todos los demás jugadores del mismo
 * grupo, para poder probar el ranking, promedios y badges sin tener que
 * cargar cada valoración a mano desde la UI.
 *
 * Uso:
 *   node --env-file=.env scripts/seed-valoraciones-todos.mjs [nombreGrupo]
 *
 * Por defecto usa el grupo "prueba2".
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const nombreGrupo = process.argv[2] || "prueba2";

const F11_DIMENSIONS = [
  "controlPrimerToque",
  "pase",
  "regate1v1",
  "remateFinalizacion",
  "juegoAereo",
  "posicionamiento",
  "visionJuego",
  "movimientosSinBalon",
  "tomaDecisiones",
  "comprensionTactica",
  "velocidadAceleracion",
  "resistencia",
  "fuerzaPotencia",
  "agilidadCoordinacion",
  "fortalezaMental",
  "actitudDisciplina",
  "espirituEquipo",
  "motivacion",
];

const F5_DIMENSIONS = ["pulmon", "pegada", "pase", "quite", "compromiso"];

/** Entero 1-5 con sesgo hacia el centro (3-4), para que no quede todo parejo. */
function randScore() {
  const r = Math.random();
  if (r < 0.05) return 1;
  if (r < 0.2) return 2;
  if (r < 0.55) return 3;
  if (r < 0.85) return 4;
  return 5;
}

function buildScores(dims) {
  const o = {};
  for (const d of dims) o[d] = randScore();
  return o;
}

const { data: grupos, error: gErr } = await sb
  .from("grupos")
  .select("id,nombre")
  .ilike("nombre", nombreGrupo)
  .order("created_at", { ascending: false })
  .limit(1);
if (gErr) throw gErr;
const grupo = grupos?.[0];
if (!grupo) {
  console.error(`No encontré el grupo «${nombreGrupo}»`);
  process.exit(1);
}

const { data: jugadores, error: jErr } = await sb
  .from("jugadores")
  .select("id,apodo")
  .eq("grupo_id", grupo.id);
if (jErr) throw jErr;
if (!jugadores?.length) {
  console.error(`No hay jugadores en «${grupo.nombre}»`);
  process.exit(1);
}

console.log(`Grupo: ${grupo.nombre} (${jugadores.length} jugadores)`);
console.log(`Jugadores: ${jugadores.map((j) => j.apodo).join(", ")}`);

const now = new Date().toISOString();
const filasF11 = [];
const filasF5 = [];

for (const de of jugadores) {
  for (const para of jugadores) {
    if (de.id === para.id) continue;
    filasF11.push({
      de_jugador_id: de.id,
      para_jugador_id: para.id,
      puntajes: buildScores(F11_DIMENSIONS),
      updated_at: now,
    });
    filasF5.push({
      de_jugador_id: de.id,
      para_jugador_id: para.id,
      puntajes: buildScores(F5_DIMENSIONS),
      updated_at: now,
    });
  }
}

console.log(`Insertando ${filasF11.length} valoraciones F11...`);
const { error: f11Err } = await sb
  .from("valoraciones")
  .upsert(filasF11, { onConflict: "de_jugador_id,para_jugador_id" });
if (f11Err) throw f11Err;

console.log(`Insertando ${filasF5.length} valoraciones F5 (perfil)...`);
const { error: f5Err } = await sb
  .from("valoraciones_f5_perfil")
  .upsert(filasF5, { onConflict: "de_jugador_id,para_jugador_id" });
if (f5Err) throw f5Err;

console.log("OK — todos los jugadores se valoraron entre sí (F11 y F5 perfil).");
console.log("Refrescá la app: los badges F11/F5 de Home y los promedios ya deberían verse completos.");
