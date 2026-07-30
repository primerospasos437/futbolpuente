/**
 * Crea en el grupo «prueba2» un partido confirmado SIN resultado
 * para poder ver la planilla «Próxima fecha · datos».
 *
 * Uso: node --env-file=.env scripts/seed-previa-prueba2.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const SEED_TAG = "seed_prueba2_previa";

function nextMartesIso() {
  const d = new Date();
  const day = d.getDay();
  const add = day <= 2 ? 2 - day : 9 - day;
  d.setDate(d.getDate() + add);
  return d.toISOString().slice(0, 10);
}

function slot(j) {
  return { id: j.id, apodo: j.apodo };
}

const { data: grupos, error: gErr } = await sb
  .from("grupos")
  .select("id,nombre")
  .ilike("nombre", "prueba2")
  .order("created_at", { ascending: false })
  .limit(1);
if (gErr) throw gErr;
const grupo = grupos?.[0];
if (!grupo) {
  console.error("No encontré el grupo prueba2");
  process.exit(1);
}

const { data: jugadores, error: jErr } = await sb
  .from("jugadores")
  .select("id,apodo,es_admin")
  .eq("grupo_id", grupo.id);
if (jErr) throw jErr;
if (!jugadores?.length) {
  console.error("No hay jugadores en prueba2");
  process.exit(1);
}

const byApodo = new Map(jugadores.map((j) => [String(j.apodo).toLowerCase(), j]));
const pick = (...names) => {
  const out = [];
  for (const n of names) {
    const j = byApodo.get(n.toLowerCase());
    if (!j) throw new Error(`Falta jugador «${n}» en prueba2`);
    out.push(j);
  }
  return out;
};

// Equipos mezclados para que la previa tenga rachas / duplas / H2H interesantes
const claros = pick("diego", "lucas", "fede", "andres", "tobi");
const oscuros = pick("seba", "mateo", "rami", "nacho", "pablo");
const admin = jugadores.find((j) => j.es_admin) || jugadores[0];

// Borrar seed anterior
const { data: old } = await sb
  .from("partidos")
  .select("id")
  .eq("grupo_id", grupo.id)
  .eq("comentario_partido", SEED_TAG);
if (old?.length) {
  const ids = old.map((p) => p.id);
  await sb.from("presencias").delete().in("partido_id", ids);
  await sb.from("partidos").delete().in("id", ids);
  console.log(`Borrados ${ids.length} partido(s) seed previos`);
}

const fecha = nextMartesIso();
const { data: partido, error: pErr } = await sb
  .from("partidos")
  .insert({
    fecha,
    hora_partido: "21:30",
    equipo_claros: claros.map(slot),
    equipo_oscuros: oscuros.map(slot),
    estado: "pendiente",
    confirmado_admin: true,
    creado_por: admin.id,
    grupo_id: grupo.id,
    goles_claros: null,
    goles_oscuros: null,
    comentario_partido: SEED_TAG,
  })
  .select("id,fecha")
  .single();
if (pErr) throw pErr;

const presencias = [
  ...claros.map((j) => ({
    partido_id: partido.id,
    jugador_id: j.id,
    equipo: "claros",
    estado: "convocado",
  })),
  ...oscuros.map((j) => ({
    partido_id: partido.id,
    jugador_id: j.id,
    equipo: "oscuros",
    estado: "convocado",
  })),
];
const { error: prErr } = await sb.from("presencias").insert(presencias);
if (prErr) throw prErr;

console.log("OK — partido de previa creado");
console.log(`  grupo: ${grupo.nombre} (${grupo.id})`);
console.log(`  fecha: ${partido.fecha} 21:30`);
console.log(`  Claros: ${claros.map((j) => j.apodo).join(", ")}`);
console.log(`  Oscuros: ${oscuros.map((j) => j.apodo).join(", ")}`);
console.log("Abrí Próximos partidos y mirá «Próxima fecha · datos» debajo del VS.");
