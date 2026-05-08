import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const DB_PATH = join(DATA_DIR, "db.json");

function defaultDb() {
  return {
    players: [],
    ratings: [],
    sessions: {},
  };
}

export function loadDb() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    if (!existsSync(DB_PATH)) {
      const empty = defaultDb();
      writeFileSync(DB_PATH, JSON.stringify(empty, null, 2), "utf8");
      return empty;
    }
    const raw = readFileSync(DB_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      players: parsed.players ?? [],
      ratings: parsed.ratings ?? [],
      sessions: parsed.sessions ?? {},
    };
  } catch {
    return defaultDb();
  }
}

export function saveDb(db) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}
