import express from "express";
import cors from "cors";
import crypto from "crypto";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadDb, saveDb } from "./db.js";
import {
  PROFILE_DIMS,
  normalizeProfile,
  defaultProfileScores,
  finalScore,
  peerAverageForPlayer,
  profileAverage,
} from "./scores.js";
import { balanceTwoTeams } from "./teams.js";

const PORT = Number(process.env.PORT) || 3001;
const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

const ALLOW_POS = ["portero", "defensa", "medio", "delantero"];
const ALLOW_PIE = ["derecho", "izquierdo", "ambos"];

function uuid() {
  return crypto.randomUUID();
}

function hashPin(pin) {
  return crypto.createHash("sha256").update(String(pin), "utf8").digest("hex");
}

function authHeader(req) {
  const h = req.headers.authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

function getSessionPlayerId(db, token) {
  if (!token) return null;
  return db.sessions[token] ?? null;
}

function sanitizePosicion(val, fallback = "medio") {
  const s = String(val ?? "").trim();
  return ALLOW_POS.includes(s) ? s : fallback;
}

/** Validación estricta del cuerpo con las 18 dimensiones 1–10 */
function sanitizeProfile(body) {
  const out = {};
  for (const dim of PROFILE_DIMS) {
    const n = Number(body?.[dim]);
    if (!Number.isFinite(n)) throw new Error(`Falta o es inválido: ${dim}`);
    const v = Math.round(n);
    if (v < 1 || v > 10) throw new Error(`${dim} debe estar entre 1 y 10`);
    out[dim] = v;
  }
  return out;
}

function sanitizeFicha(body = {}, defaults = {}) {
  const fechaNacimiento =
    body.fechaNacimiento !== undefined
      ? String(body.fechaNacimiento).trim().slice(0, 32)
      : (defaults.fechaNacimiento ?? "");
  const contacto =
    body.contacto !== undefined ? String(body.contacto).trim().slice(0, 240) : (defaults.contacto ?? "");

  const posPrincipal = sanitizePosicion(defaults.posicionPreferida, "medio");
  const posicionAlternativa = sanitizePosicion(
    body.posicionAlternativa !== undefined ? body.posicionAlternativa : defaults.posicionAlternativa,
    posPrincipal,
  );

  let alturaCm = defaults.alturaCm ?? null;
  if (body.alturaCm !== undefined && body.alturaCm !== null && String(body.alturaCm).trim() !== "") {
    const h = Number(body.alturaCm);
    if (!Number.isFinite(h) || h < 120 || h > 230) throw new Error("Altura (cm): número entre 120 y 230, o vacío");
    alturaCm = Math.round(h);
  }

  let pesoKg = defaults.pesoKg ?? null;
  if (body.pesoKg !== undefined && body.pesoKg !== null && String(body.pesoKg).trim() !== "") {
    const w = Number(body.pesoKg);
    if (!Number.isFinite(w) || w < 35 || w > 160) throw new Error("Peso (kg): número entre 35 y 160, o vacío");
    pesoKg = Math.round(w * 10) / 10;
  }

  const historialLesiones =
    body.historialLesiones !== undefined
      ? String(body.historialLesiones).trim().slice(0, 4000)
      : (defaults.historialLesiones ?? "");

  return { fechaNacimiento, contacto, posicionAlternativa, alturaCm, pesoKg, historialLesiones };
}

function ratingsForPlayer(db, playerId) {
  return db.ratings.filter((r) => r.toId === playerId);
}

function playerPublic(p, db, viewerId) {
  const profile = normalizeProfile(p.profile);
  const received = ratingsForPlayer(db, p.id);
  const fs = finalScore(profile, received);
  const peer = peerAverageForPlayer(received);

  const showInjury = viewerId === p.id;

  return {
    id: p.id,
    nombreCompleto: p.nombreCompleto,
    apodo: p.apodo,
    posicionPreferida: p.posicionPreferida,
    posicionAlternativa: p.posicionAlternativa ?? p.posicionPreferida,
    pieDominante: p.pieDominante,
    profile,
    ficha: {
      fechaNacimiento: p.fechaNacimiento ?? "",
      contacto: p.contacto ?? "",
      posicionAlternativa: p.posicionAlternativa ?? p.posicionPreferida,
      alturaCm: p.alturaCm ?? null,
      pesoKg: p.pesoKg ?? null,
      historialLesiones: showInjury ? (p.historialLesiones ?? "") : null,
    },
    profileAverage: profileAverage(profile),
    peerAverage: peer?.overall,
    peerCount: peer?.count ?? 0,
    finalScore: fs.value,
    finalBreakdown: {
      selfAvg: fs.selfAvg,
      peerAvg: fs.peerAvg,
      peerCount: fs.peerCount,
    },
    createdAt: p.createdAt,
    isSelf: viewerId === p.id,
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/players/register", (req, res) => {
  try {
    const db = loadDb();
    const body = req.body ?? {};
    const { nombreCompleto, apodo, pin, posicionPreferida, pieDominante, profile } = body;

    if (!nombreCompleto || !apodo || !pin)
      return res.status(400).json({ error: "nombreCompleto, apodo y pin son obligatorios" });

    const apodoNorm = String(apodo).trim().toLowerCase();
    if (db.players.some((x) => x.apodo.toLowerCase() === apodoNorm))
      return res.status(409).json({ error: "Ese apodo ya está registrado" });

    const pos = sanitizePosicion(posicionPreferida, "medio");
    const pie = ALLOW_PIE.includes(pieDominante) ? pieDominante : "derecho";

    const prof =
      profile && typeof profile === "object" && Object.keys(profile).length
        ? sanitizeProfile(profile)
        : defaultProfileScores();

    const ficha = sanitizeFicha(body, {
      posicionPreferida: pos,
      posicionAlternativa: pos,
      fechaNacimiento: "",
      contacto: "",
      alturaCm: null,
      pesoKg: null,
      historialLesiones: "",
    });

    const id = uuid();
    const player = {
      id,
      nombreCompleto: String(nombreCompleto).trim(),
      apodo: String(apodo).trim(),
      pinHash: hashPin(pin),
      posicionPreferida: pos,
      posicionAlternativa: ficha.posicionAlternativa,
      pieDominante: pie,
      fechaNacimiento: ficha.fechaNacimiento,
      contacto: ficha.contacto,
      alturaCm: ficha.alturaCm,
      pesoKg: ficha.pesoKg,
      historialLesiones: ficha.historialLesiones,
      profile: prof,
      createdAt: new Date().toISOString(),
    };

    db.players.push(player);
    const token = uuid();
    db.sessions[token] = id;
    saveDb(db);
    res.status(201).json({ token, playerId: id });
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.post("/api/session", (req, res) => {
  const db = loadDb();
  const { apodo, pin } = req.body ?? {};
  if (!apodo || !pin) return res.status(400).json({ error: "apodo y pin requeridos" });
  const apodoNorm = String(apodo).trim().toLowerCase();
  const p = db.players.find((x) => x.apodo.toLowerCase() === apodoNorm);
  if (!p || p.pinHash !== hashPin(pin)) return res.status(401).json({ error: "Credenciales incorrectas" });
  const token = uuid();
  db.sessions[token] = p.id;
  saveDb(db);
  res.json({ token, playerId: p.id });
});

app.use((req, res, next) => {
  const db = loadDb();
  const token = authHeader(req);
  const pid = getSessionPlayerId(db, token);
  if (!pid) return res.status(401).json({ error: "No autorizado" });
  req.ctx = { db, playerId: pid, token };
  next();
});

app.get("/api/me", (req, res) => {
  const { db, playerId } = req.ctx;
  const p = db.players.find((x) => x.id === playerId);
  if (!p) return res.status(404).json({ error: "Jugador no encontrado" });
  res.json(playerPublic(p, db, playerId));
});

app.patch("/api/me/profile", (req, res) => {
  try {
    const { db, playerId } = req.ctx;
    const p = db.players.find((x) => x.id === playerId);
    if (!p) return res.status(404).json({ error: "Jugador no encontrado" });

    const body = req.body ?? {};
    const { posicionPreferida, pieDominante, profile, nombreCompleto } = body;

    if (nombreCompleto !== undefined) p.nombreCompleto = String(nombreCompleto).trim() || p.nombreCompleto;

    if (posicionPreferida !== undefined) p.posicionPreferida = sanitizePosicion(posicionPreferida, p.posicionPreferida);

    if (pieDominante !== undefined && ALLOW_PIE.includes(pieDominante)) p.pieDominante = pieDominante;

    const ficha = sanitizeFicha(body, {
      posicionPreferida: p.posicionPreferida,
      posicionAlternativa: p.posicionAlternativa ?? p.posicionPreferida,
      fechaNacimiento: p.fechaNacimiento,
      contacto: p.contacto,
      alturaCm: p.alturaCm,
      pesoKg: p.pesoKg,
      historialLesiones: p.historialLesiones,
    });
    p.fechaNacimiento = ficha.fechaNacimiento;
    p.contacto = ficha.contacto;
    p.posicionAlternativa = ficha.posicionAlternativa;
    p.alturaCm = ficha.alturaCm;
    p.pesoKg = ficha.pesoKg;
    p.historialLesiones = ficha.historialLesiones;

    if (profile) p.profile = sanitizeProfile(profile);

    saveDb(db);
    res.json(playerPublic(p, db, playerId));
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.get("/api/players", (req, res) => {
  const { db, playerId } = req.ctx;
  const list = db.players.map((p) => playerPublic(p, db, playerId)).sort((a, b) => a.apodo.localeCompare(b.apodo));
  res.json(list);
});

app.get("/api/players/:id", (req, res) => {
  const { db, playerId } = req.ctx;
  const p = db.players.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: "No encontrado" });

  const received = ratingsForPlayer(db, p.id);
  const peerDetail = peerAverageForPlayer(received);
  const myRating = db.ratings.find((r) => r.fromId === playerId && r.toId === p.id);

  res.json({
    ...playerPublic(p, db, playerId),
    dimensions: PROFILE_DIMS,
    peerByDimension: peerDetail?.byDim ?? {},
    myRating: myRating
      ? { scores: normalizeProfile(myRating.scores), updatedAt: myRating.updatedAt }
      : null,
  });
});

app.put("/api/players/:id/rating", (req, res) => {
  try {
    const { db, playerId } = req.ctx;
    const targetId = req.params.id;
    if (targetId === playerId) return res.status(400).json({ error: "No puedes valorarte a ti mismo" });
    const target = db.players.find((x) => x.id === targetId);
    if (!target) return res.status(404).json({ error: "Jugador no encontrado" });

    const scores = sanitizeProfile(req.body?.scores ?? req.body ?? {});
    let row = db.ratings.find((r) => r.fromId === playerId && r.toId === targetId);
    const now = new Date().toISOString();
    if (!row) {
      row = { fromId: playerId, toId: targetId, scores, updatedAt: now };
      db.ratings.push(row);
    } else {
      row.scores = scores;
      row.updatedAt = now;
    }
    saveDb(db);
    res.json({
      saved: true,
      target: playerPublic(target, db, playerId),
    });
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.post("/api/teams/balance", (req, res) => {
  const { db, playerId } = req.ctx;
  const { playerIds } = req.body ?? {};
  const ids = Array.isArray(playerIds) ? playerIds.map(String) : null;
  const selected =
    ids && ids.length ? db.players.filter((p) => ids.includes(p.id)) : [...db.players];

  if (selected.length < 4)
    return res.status(400).json({ error: "Selecciona al menos 4 jugadores para armar dos equipos" });

  const withScores = selected.map((p) => {
    const profile = normalizeProfile(p.profile);
    const received = ratingsForPlayer(db, p.id);
    const fs = finalScore(profile, received);
    return {
      id: p.id,
      apodo: p.apodo,
      posicionPreferida: p.posicionPreferida,
      score: fs.value,
    };
  });

  const { teamA, teamB, diff } = balanceTwoTeams(withScores);
  const sum = (arr) => arr.reduce((s, x) => s + x.score, 0);

  res.json({
    teamA,
    teamB,
    sumA: sum(teamA),
    sumB: sum(teamB),
    difference: diff,
    pickedBy: playerId,
    generatedAt: new Date().toISOString(),
  });
});

if (process.env.NODE_ENV === "production") {
  const dist = join(__dirname, "..", "dist");
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(join(dist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`API fútbol grupo en http://127.0.0.1:${PORT}`);
});
