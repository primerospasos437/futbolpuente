/**
 * Persistencia JSON local (fallback si no hay variables de Supabase).
 */
import { loadDb, saveDb } from "./db.js";

function clonePlayer(p) {
  return {
    ...p,
    profile: { ...p.profile },
  };
}

function rowFromPlayer(p) {
  return {
    fromId: p.fromId,
    toId: p.toId,
    scores: { ...p.scores },
    updatedAt: p.updatedAt,
  };
}

export function createJsonRepository() {
  return {
    mode: "json",

    async apodoExists(apodoNorm) {
      const db = loadDb();
      return db.players.some((x) => x.apodo.toLowerCase() === apodoNorm);
    },

    async findByApodo(apodoNorm) {
      const db = loadDb();
      const p = db.players.find((x) => x.apodo.toLowerCase() === apodoNorm);
      return p ? clonePlayer(p) : null;
    },

    async findById(id) {
      const db = loadDb();
      const p = db.players.find((x) => x.id === id);
      return p ? clonePlayer(p) : null;
    },

    async listPlayers() {
      const db = loadDb();
      return db.players.map(clonePlayer);
    },

    async listPlayersByIds(ids) {
      const set = new Set(ids);
      const db = loadDb();
      return db.players.filter((p) => set.has(p.id)).map(clonePlayer);
    },

    async createPlayer(player) {
      const db = loadDb();
      db.players.push(clonePlayer(player));
      saveDb(db);
      return { id: player.id };
    },

    async updatePlayer(id, patch) {
      const db = loadDb();
      const p = db.players.find((x) => x.id === id);
      if (!p) return null;
      Object.assign(p, patch);
      if (patch.profile) p.profile = { ...patch.profile };
      saveDb(db);
      return clonePlayer(p);
    },

    async ratingsTo(paraId) {
      const db = loadDb();
      return db.ratings.filter((r) => r.toId === paraId).map(rowFromPlayer);
    },

    async findRating(deId, paraId) {
      const db = loadDb();
      const r = db.ratings.find((x) => x.fromId === deId && x.toId === paraId);
      return r ? rowFromPlayer(r) : null;
    },

    async upsertRating(deId, paraId, scores) {
      const db = loadDb();
      const now = new Date().toISOString();
      let r = db.ratings.find((x) => x.fromId === deId && x.toId === paraId);
      if (!r) {
        r = { fromId: deId, toId: paraId, scores: { ...scores }, updatedAt: now };
        db.ratings.push(r);
      } else {
        r.scores = { ...scores };
        r.updatedAt = now;
      }
      saveDb(db);
    },

    async setSession(token, jugadorId) {
      const db = loadDb();
      db.sessions[token] = jugadorId;
      saveDb(db);
    },

    async getJugadorIdFromToken(token) {
      const db = loadDb();
      return db.sessions[token] ?? null;
    },
  };
}
