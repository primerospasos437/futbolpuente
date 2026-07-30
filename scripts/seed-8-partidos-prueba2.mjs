/**
 * Seed de 8 partidos jugados + 1 previa (sin resultado) en el grupo «prueba2».
 * Arma historial rico para Stats, Duplas, Enfrentamientos y «Próxima fecha · datos».
 *
 * Uso: node --env-file=.env scripts/seed-8-partidos-prueba2.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const TAG_HIST = "seed_prueba2_8p";
const TAG_PREVIA = "seed_prueba2_previa";
const OLD_TAGS = ["seed_prueba2_4p", "seed_prueba2_8p", "seed_prueba2_previa"];

function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

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

const { data: grupo, error: gErr } = await sb
  .from("grupos")
  .select("id,nombre")
  .ilike("nombre", "prueba2")
  .order("created_at", { ascending: false })
  .limit(1)
  .single();
if (gErr || !grupo) {
  console.error("No encontré el grupo prueba2", gErr);
  process.exit(1);
}

const { data: jugadores, error: jErr } = await sb
  .from("jugadores")
  .select("id,apodo,es_admin")
  .eq("grupo_id", grupo.id);
if (jErr || !jugadores?.length) {
  console.error("No hay jugadores en prueba2", jErr);
  process.exit(1);
}

const byApodo = new Map(jugadores.map((j) => [String(j.apodo).toLowerCase(), j]));
const must = (...names) => {
  const out = [];
  for (const n of names) {
    const j = byApodo.get(n.toLowerCase());
    if (!j) throw new Error(`Falta jugador «${n}» en prueba2`);
    out.push(j);
  }
  return out;
};
const admin = jugadores.find((j) => j.es_admin) || jugadores[0];

// Limpiar seeds anteriores (4p, 8p, previa)
const { data: old } = await sb
  .from("partidos")
  .select("id,comentario_partido")
  .eq("grupo_id", grupo.id)
  .in("comentario_partido", OLD_TAGS);
if (old?.length) {
  const ids = old.map((p) => p.id);
  // Dependencias posibles
  await sb.from("partido_votos").delete().in("partido_id", ids).then(() => null).catch(() => null);
  await sb.from("partido_dificultad_votos").delete().in("partido_id", ids).then(() => null).catch(() => null);
  await sb.from("presencias").delete().in("partido_id", ids);
  await sb.from("notificaciones").delete().filter("datos->>partido_id", "in", `(${ids.join(",")})`).then(() => null).catch(() => null);
  await sb.from("partidos").delete().in("id", ids);
  console.log(`Borrados ${ids.length} partido(s) seed previos`);
}

/**
 * 8 partidos 5v5 rotando a los 11 jugadores (juan entra/sale).
 * Diseñados para rachas, duplas buenas/malas, H2H y serie Claros/Oscuros.
 */
const matches = [
  {
    daysAgo: 56,
    claros: ["diego", "lucas", "fede", "andres", "juan"],
    oscuros: ["seba", "mateo", "rami", "nacho", "pablo"],
    gc: 5,
    go: 1,
    mvp: "diego",
    note: "Claros golearon. Diego imparable.",
  },
  {
    daysAgo: 49,
    claros: ["diego", "lucas", "nacho", "tobi", "pablo"],
    oscuros: ["seba", "mateo", "fede", "andres", "rami"],
    gc: 2,
    go: 3,
    mvp: "seba",
    note: "Oscuros remontan. Seba MVP.",
  },
  {
    daysAgo: 42,
    claros: ["diego", "lucas", "fede", "mateo", "juan"],
    oscuros: ["seba", "rami", "nacho", "andres", "tobi"],
    gc: 2,
    go: 2,
    mvp: "lucas",
    note: "Empate peleado.",
  },
  {
    daysAgo: 35,
    claros: ["diego", "lucas", "fede", "rami", "pablo"],
    oscuros: ["seba", "mateo", "nacho", "andres", "juan"],
    gc: 4,
    go: 0,
    mvp: "lucas",
    note: "Claros sin perdon. Lucas+Diego otra vez juntos.",
  },
  {
    daysAgo: 28,
    claros: ["fede", "andres", "tobi", "pablo", "juan"],
    oscuros: ["diego", "lucas", "seba", "mateo", "nacho"],
    gc: 1,
    go: 4,
    mvp: "diego",
    note: "Diego y Lucas del lado Oscuro: otra goleada.",
  },
  {
    daysAgo: 21,
    claros: ["diego", "fede", "nacho", "andres", "rami"],
    oscuros: ["lucas", "seba", "mateo", "tobi", "pablo"],
    gc: 3,
    go: 2,
    mvp: "nacho",
    note: "Claros por la mínima. Nacho decisivo.",
  },
  {
    daysAgo: 14,
    claros: ["diego", "lucas", "andres", "juan", "tobi"],
    oscuros: ["seba", "fede", "mateo", "rami", "pablo"],
    gc: 1,
    go: 1,
    mvp: "fede",
    note: "Otro empate. Serie parecida.",
  },
  {
    daysAgo: 7,
    claros: ["diego", "lucas", "fede", "nacho", "juan"],
    oscuros: ["seba", "mateo", "andres", "rami", "tobi"],
    gc: 4,
    go: 3,
    mvp: "diego",
    note: "Claros cierran la racha. Diego en racha de G.",
  },
];

async function insertFinished(m) {
  const claros = must(...m.claros);
  const oscuros = must(...m.oscuros);
  const mvp = byApodo.get(m.mvp.toLowerCase());
  const { data: partido, error } = await sb
    .from("partidos")
    .insert({
      fecha: daysAgoIso(m.daysAgo),
      hora_partido: "21:30",
      equipo_claros: claros.map(slot),
      equipo_oscuros: oscuros.map(slot),
      estado: "jugado",
      confirmado_admin: true,
      creado_por: admin.id,
      grupo_id: grupo.id,
      goles_claros: m.gc,
      goles_oscuros: m.go,
      mvp_jugador_id: mvp?.id ?? null,
      comentario_partido: TAG_HIST,
      resultado_cargado_at: new Date().toISOString(),
    })
    .select("id,fecha")
    .single();
  if (error) throw error;

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
  return partido;
}

console.log(`Insertando ${matches.length} partidos jugados…`);
for (const m of matches) {
  const p = await insertFinished(m);
  console.log(
    `  ${p.fecha}  Claros ${m.gc}-${m.go} Oscuros  MVP ${m.mvp}  (${m.claros.join("/") } vs ${m.oscuros.join("/")})`,
  );
}

// Previa próxima: equipos con historial cruzado interesante
const previaClaros = must("diego", "lucas", "fede", "nacho", "juan");
const previaOscuros = must("seba", "mateo", "andres", "rami", "tobi");
const { data: previa, error: prevErr } = await sb
  .from("partidos")
  .insert({
    fecha: nextMartesIso(),
    hora_partido: "21:30",
    equipo_claros: previaClaros.map(slot),
    equipo_oscuros: previaOscuros.map(slot),
    estado: "pendiente",
    confirmado_admin: true,
    creado_por: admin.id,
    grupo_id: grupo.id,
    goles_claros: null,
    goles_oscuros: null,
    comentario_partido: TAG_PREVIA,
  })
  .select("id,fecha")
  .single();
if (prevErr) throw prevErr;

const prevPres = [
  ...previaClaros.map((j) => ({
    partido_id: previa.id,
    jugador_id: j.id,
    equipo: "claros",
    estado: "convocado",
  })),
  ...previaOscuros.map((j) => ({
    partido_id: previa.id,
    jugador_id: j.id,
    equipo: "oscuros",
    estado: "convocado",
  })),
];
const { error: ppErr } = await sb.from("presencias").insert(prevPres);
if (ppErr) throw ppErr;

console.log("");
console.log("OK — seed completo en prueba2");
console.log(`  ${matches.length} partidos jugados (tag ${TAG_HIST})`);
console.log(`  1 previa ${previa.fecha} 21:30 (tag ${TAG_PREVIA})`);
console.log(`  Claros previa: ${previaClaros.map((j) => j.apodo).join(", ")}`);
console.log(`  Oscuros previa: ${previaOscuros.map((j) => j.apodo).join(", ")}`);
console.log("Recargá Stats y Próximos partidos (Ctrl+F5).");
