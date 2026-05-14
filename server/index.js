import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "crypto";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { registerRecoverPinRoutes } from "./recover-pin.js";
import { getRepository } from "./repository.js";
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
/** Tras Cloudflare u otro proxy TLS (p. ej. túnel): req.protocol / IPs reflejan al cliente. */
app.set("trust proxy", 1);
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

function sanitizePosicion(val, fallback = "medio") {
  const s = String(val ?? "").trim();
  return ALLOW_POS.includes(s) ? s : fallback;
}

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

function playerPublic(p, ratingsReceived, viewerId) {
  const profile = normalizeProfile(p.profile);
  const received = ratingsReceived.map((r) => ({ scores: r.scores }));
  const ignoreSelf = p.perfilCompletoCargado === false;
  const fs = finalScore(profile, received, { ignoreSelf });
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
  const repo = getRepository();
  res.json({
    ok: true,
    storage: repo.mode,
  });
});

app.post("/api/players/register", async (req, res) => {
  try {
    const repo = getRepository();
    const body = req.body ?? {};
    const { nombreCompleto, apodo, pin, posicionPreferida, pieDominante, profile } = body;

    if (!nombreCompleto || !apodo || !pin)
      return res.status(400).json({ error: "nombreCompleto, apodo y pin son obligatorios" });

    const apodoNorm = String(apodo).trim().toLowerCase();
    if (await repo.apodoExists(apodoNorm)) return res.status(409).json({ error: "Ese apodo ya está registrado" });

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

    const provisionalId = uuid();
    const player = {
      id: provisionalId,
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

    const { id } = await repo.createPlayer(player);
    const token = uuid();
    await repo.setSession(token, id);

    res.status(201).json({ token, playerId: id });
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.post("/api/session", async (req, res) => {
  try {
    const repo = getRepository();
    const { apodo, pin } = req.body ?? {};
    if (!apodo || !pin) return res.status(400).json({ error: "apodo y pin requeridos" });
    const apodoNorm = String(apodo).trim().toLowerCase();
    const p = await repo.findByApodo(apodoNorm);
    if (!p || p.pinHash !== hashPin(pin)) return res.status(401).json({ error: "Credenciales incorrectas" });
    const token = uuid();
    await repo.setSession(token, p.id);
    res.json({ token, playerId: p.id });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

function requireAuth(handler) {
  return async (/** @type {any} */ req, /** @type {any} */ res) => {
    try {
      const repo = getRepository();
      const token = authHeader(req);
      const playerId = token ? await repo.getJugadorIdFromToken(token) : null;
      if (!playerId) return res.status(401).json({ error: "No autorizado" });
      req.ctx = { repo, playerId, token };
      await handler(req, res);
    } catch (e) {
      res.status(500).json({ error: String(e.message || e) });
    }
  };
}

app.get("/api/me", requireAuth(async (req, res) => {
  const { repo, playerId } = req.ctx;
  const p = await repo.findById(playerId);
  if (!p) return res.status(404).json({ error: "Jugador no encontrado" });
  const received = await repo.ratingsTo(p.id);
  res.json(playerPublic(p, received, playerId));
}));

app.patch("/api/me/profile", requireAuth(async (req, res) => {
  try {
    const { repo, playerId } = req.ctx;
    const p = await repo.findById(playerId);
    if (!p) return res.status(404).json({ error: "Jugador no encontrado" });

    const body = req.body ?? {};
    const { posicionPreferida, pieDominante, profile, nombreCompleto } = body;

    const patch = {};
    if (nombreCompleto !== undefined) patch.nombreCompleto = String(nombreCompleto).trim() || p.nombreCompleto;

    if (posicionPreferida !== undefined) patch.posicionPreferida = sanitizePosicion(posicionPreferida, p.posicionPreferida);

    if (pieDominante !== undefined && ALLOW_PIE.includes(pieDominante)) patch.pieDominante = pieDominante;

    const ficha = sanitizeFicha(body, {
      posicionPreferida: patch.posicionPreferida ?? p.posicionPreferida,
      posicionAlternativa: p.posicionAlternativa ?? p.posicionPreferida,
      fechaNacimiento: p.fechaNacimiento,
      contacto: p.contacto,
      alturaCm: p.alturaCm,
      pesoKg: p.pesoKg,
      historialLesiones: p.historialLesiones,
    });
    patch.fechaNacimiento = ficha.fechaNacimiento;
    patch.contacto = ficha.contacto;
    patch.posicionAlternativa = ficha.posicionAlternativa;
    patch.alturaCm = ficha.alturaCm;
    patch.pesoKg = ficha.pesoKg;
    patch.historialLesiones = ficha.historialLesiones;

    if (profile) patch.profile = sanitizeProfile(profile);

    const updated = await repo.updatePlayer(playerId, patch);
    if (!updated) return res.status(404).json({ error: "Jugador no encontrado" });

    const received = await repo.ratingsTo(playerId);
    res.json(playerPublic(updated, received, playerId));
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
}));

app.get("/api/players", requireAuth(async (req, res) => {
  const { repo, playerId } = req.ctx;
  const players = await repo.listPlayers();
  const list = await Promise.all(
    players.map(async (p) => {
      const received = await repo.ratingsTo(p.id);
      return playerPublic(p, received, playerId);
    }),
  );
  list.sort((a, b) => a.apodo.localeCompare(b.apodo));
  res.json(list);
}));

app.get("/api/players/:id", requireAuth(async (req, res) => {
  const { repo, playerId } = req.ctx;
  const p = await repo.findById(req.params.id);
  if (!p) return res.status(404).json({ error: "No encontrado" });

  const received = await repo.ratingsTo(p.id);
  const peerDetail = peerAverageForPlayer(received.map((r) => ({ scores: r.scores })));
  const myRating = await repo.findRating(playerId, p.id);

  res.json({
    ...playerPublic(p, received, playerId),
    dimensions: PROFILE_DIMS,
    peerByDimension: peerDetail?.byDim ?? {},
    myRating: myRating
      ? { scores: normalizeProfile(myRating.scores), updatedAt: myRating.updatedAt }
      : null,
  });
}));

app.put("/api/players/:id/rating", requireAuth(async (req, res) => {
  try {
    const { repo, playerId } = req.ctx;
    const targetId = req.params.id;
    if (targetId === playerId) return res.status(400).json({ error: "No puedes valorarte a ti mismo" });
    const target = await repo.findById(targetId);
    if (!target) return res.status(404).json({ error: "Jugador no encontrado" });

    const scores = sanitizeProfile(req.body?.scores ?? req.body ?? {});
    await repo.upsertRating(playerId, targetId, scores);

    const received = await repo.ratingsTo(targetId);
    res.json({
      saved: true,
      target: playerPublic(target, received, playerId),
    });
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
}));

app.post("/api/teams/balance", requireAuth(async (req, res) => {
  try {
    const { repo, playerId } = req.ctx;
    const { playerIds } = req.body ?? {};
    const ids = Array.isArray(playerIds) ? playerIds.map(String) : null;
    const all = await repo.listPlayers();
    const selected =
      ids && ids.length ? all.filter((p) => ids.includes(p.id)) : [...all];

    if (selected.length < 4)
      return res.status(400).json({ error: "Selecciona al menos 4 jugadores para armar dos equipos" });

    const withScores = await Promise.all(
      selected.map(async (p) => {
        const profile = normalizeProfile(p.profile);
        const received = await repo.ratingsTo(p.id);
        const fs = finalScore(profile, received.map((r) => ({ scores: r.scores })), {
          ignoreSelf: p.perfilCompletoCargado === false,
        });
        return {
          id: p.id,
          apodo: p.apodo,
          posicionPreferida: p.posicionPreferida,
          score: fs.value,
        };
      }),
    );

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
  } catch (e) {
    const msg = String(e.message || e);
    const code = msg.includes("al menos") ? 400 : 500;
    res.status(code).json({ error: msg });
  }
}));

registerRecoverPinRoutes(app);

if (process.env.NODE_ENV === "production") {
  const dist = join(__dirname, "..", "dist");
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(join(dist, "index.html"));
  });
}

async function start() {
  const repo = getRepository();
  await repo.validateSchema();
  app.listen(PORT, () => {
    console.log(`API fútbol grupo en http://127.0.0.1:${PORT}`);
  });
}

start().catch((e) => {
  console.error("No se pudo iniciar el servidor:", e.message || e);
  console.error(
    "Revisa tu esquema de Supabase y ejecuta la migración de soporte (supabase/02_app_support.sql).",
  );
  process.exit(1);
});
