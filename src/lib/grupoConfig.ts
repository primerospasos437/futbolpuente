import { getToken } from "../api";
import { getSupabase } from "./supabase";
import { isDemoMode } from "./demoMode";

export type DiaSemana = "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado" | "domingo";

export type GrupoModalidad = "f5" | "f7" | "f11" | "ambas";

export type GrupoConfig = {
  grupoId: string;
  nombre: string;
  inviteCode: string | null;
  deporte: string;
  /** False hasta el primer guardado en Configuración del grupo. */
  configurado: boolean;
  diasPartido: DiaSemana[];
  fechasExtra: string[];
  horaPartidoDefault: string;
  anotacionAbreDiasAntes: number;
  anotacionAbreHora: string;
  anotacionCierraHora: string;
  modalidadGrupo: GrupoModalidad;
  cupoMaximo: number;
  cupoListaEspera: number;
  exigePerfilCompleto: boolean;
  exigePerfilF5: boolean;
  minValoracionesPerfil: number;
  complejoHabitual: string;
  notasLista: string;
};

export type GrupoMiembro = {
  membresiaId: string;
  usuarioId: string;
  jugadorId: string;
  rol: "admin" | "miembro" | string;
  esAdmin: boolean;
  joinedAt?: string;
  apodo: string;
  nombreCompleto: string;
};

export const DIAS_SEMANA: { id: DiaSemana; label: string }[] = [
  { id: "lunes", label: "Lunes" },
  { id: "martes", label: "Martes" },
  { id: "miercoles", label: "Miércoles" },
  { id: "jueves", label: "Jueves" },
  { id: "viernes", label: "Viernes" },
  { id: "sabado", label: "Sábado" },
  { id: "domingo", label: "Domingo" },
];

const DEFAULT_CONFIG: GrupoConfig = {
  grupoId: "",
  nombre: "Grupo",
  inviteCode: null,
  deporte: "futbol",
  configurado: false,
  diasPartido: [],
  fechasExtra: [],
  horaPartidoDefault: "21:30",
  anotacionAbreDiasAntes: 7,
  anotacionAbreHora: "22:00",
  anotacionCierraHora: "20:00",
  modalidadGrupo: "ambas",
  cupoMaximo: 14,
  cupoListaEspera: 6,
  exigePerfilCompleto: true,
  exigePerfilF5: true,
  minValoracionesPerfil: 4,
  complejoHabitual: "",
  notasLista: "",
};

function requireToken(): string {
  const t = getToken();
  if (!t) throw new Error("No autorizado");
  return t;
}

function asObj(data: unknown): Record<string, unknown> {
  if (data == null) return {};
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return data as Record<string, unknown>;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter(Boolean);
}

export function mapGrupoConfig(raw: Record<string, unknown>): GrupoConfig {
  const dias = asStringArray(raw.diasPartido ?? raw.dias_partido).map((d) =>
    d === "miércoles" ? "miercoles" : d === "sábado" ? "sabado" : d,
  ) as DiaSemana[];
  return {
    grupoId: String(raw.grupoId ?? raw.grupoid ?? ""),
    nombre: String(raw.nombre ?? ""),
    inviteCode: raw.inviteCode != null ? String(raw.inviteCode) : null,
    deporte: String(raw.deporte ?? "futbol"),
    configurado: Boolean(raw.configurado),
    diasPartido: dias,
    fechasExtra: asStringArray(raw.fechasExtra ?? raw.fechas_extra),
    horaPartidoDefault: String(raw.horaPartidoDefault ?? "21:30"),
    anotacionAbreDiasAntes: Number(raw.anotacionAbreDiasAntes ?? 7),
    anotacionAbreHora: String(raw.anotacionAbreHora ?? "22:00").slice(0, 5),
    anotacionCierraHora: String(raw.anotacionCierraHora ?? "20:00").slice(0, 5),
    modalidadGrupo: (String(raw.modalidadGrupo ?? "ambas") as GrupoModalidad) || "ambas",
    cupoMaximo: Number(raw.cupoMaximo ?? 14),
    cupoListaEspera: Number(raw.cupoListaEspera ?? 6),
    exigePerfilCompleto: Boolean(raw.exigePerfilCompleto ?? true),
    exigePerfilF5: Boolean(raw.exigePerfilF5 ?? true),
    minValoracionesPerfil: Number(raw.minValoracionesPerfil ?? 4),
    complejoHabitual: String(raw.complejoHabitual ?? ""),
    notasLista: String(raw.notasLista ?? ""),
  };
}

export async function grupoConfigGet(): Promise<GrupoConfig> {
  if (isDemoMode()) return { ...DEFAULT_CONFIG, nombre: "Demo · Fútbol Puente", grupoId: "demo-grupo" };
  const token = requireToken();
  const sb = getSupabase();
  const { data, error } = await sb.rpc("grupo_config_get", { p_token: token });
  if (error) throw new Error(error.message);
  return mapGrupoConfig(asObj(data));
}

export async function grupoConfigSet(body: Partial<GrupoConfig>): Promise<GrupoConfig> {
  if (isDemoMode()) return { ...DEFAULT_CONFIG, ...body, grupoId: "demo-grupo" };
  const token = requireToken();
  const sb = getSupabase();
  const payload: Record<string, unknown> = {};
  if (body.nombre != null) payload.nombre = body.nombre;
  if (body.diasPartido != null) payload.diasPartido = body.diasPartido;
  if (body.fechasExtra != null) payload.fechasExtra = body.fechasExtra;
  if (body.horaPartidoDefault != null) payload.horaPartidoDefault = body.horaPartidoDefault;
  if (body.anotacionAbreDiasAntes != null) payload.anotacionAbreDiasAntes = body.anotacionAbreDiasAntes;
  if (body.anotacionAbreHora != null) payload.anotacionAbreHora = body.anotacionAbreHora;
  if (body.anotacionCierraHora != null) payload.anotacionCierraHora = body.anotacionCierraHora;
  if (body.modalidadGrupo != null) payload.modalidadGrupo = body.modalidadGrupo;
  if (body.cupoMaximo != null) payload.cupoMaximo = body.cupoMaximo;
  if (body.cupoListaEspera != null) payload.cupoListaEspera = body.cupoListaEspera;
  if (body.exigePerfilCompleto != null) payload.exigePerfilCompleto = body.exigePerfilCompleto;
  if (body.exigePerfilF5 != null) payload.exigePerfilF5 = body.exigePerfilF5;
  if (body.minValoracionesPerfil != null) payload.minValoracionesPerfil = body.minValoracionesPerfil;
  if (body.complejoHabitual != null) payload.complejoHabitual = body.complejoHabitual;
  if (body.notasLista != null) payload.notasLista = body.notasLista;

  const { data, error } = await sb.rpc("grupo_config_set", { p_token: token, p_body: payload });
  if (error) throw new Error(error.message);
  return mapGrupoConfig(asObj(data));
}

export async function grupoMiembrosListar(): Promise<GrupoMiembro[]> {
  if (isDemoMode()) return [];
  const token = requireToken();
  const sb = getSupabase();
  const { data, error } = await sb.rpc("grupo_miembros_listar", { p_token: token });
  if (error) throw new Error(error.message);
  const arr = Array.isArray(data) ? data : typeof data === "string" ? JSON.parse(data) : [];
  if (!Array.isArray(arr)) return [];
  return (arr as Record<string, unknown>[]).map((r) => ({
    membresiaId: String(r.membresiaId ?? ""),
    usuarioId: String(r.usuarioId ?? ""),
    jugadorId: String(r.jugadorId ?? ""),
    rol: String(r.rol ?? "miembro"),
    esAdmin: Boolean(r.esAdmin ?? r.rol === "admin"),
    joinedAt: r.joinedAt != null ? String(r.joinedAt) : undefined,
    apodo: String(r.apodo ?? ""),
    nombreCompleto: String(r.nombreCompleto ?? ""),
  }));
}

export async function grupoMiembroSetRol(jugadorId: string, rol: "admin" | "miembro"): Promise<void> {
  if (isDemoMode()) return;
  const token = requireToken();
  const sb = getSupabase();
  const { error } = await sb.rpc("grupo_miembro_set_rol", {
    p_token: token,
    p_jugador_id: jugadorId,
    p_rol: rol,
  });
  if (error) throw new Error(error.message);
}

/** Próxima fecha ISO (YYYY-MM-DD) para un día de semana, zona Argentina. */
export function nextMatchIsoForDia(dia: DiaSemana | "extra", timeZone = "America/Argentina/Buenos_Aires"): string {
  const wantEn: Record<string, string> = {
    domingo: "Sunday",
    lunes: "Monday",
    martes: "Tuesday",
    miercoles: "Wednesday",
    jueves: "Thursday",
    viernes: "Friday",
    sabado: "Saturday",
  };
  const want = wantEn[dia];
  if (!want) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }
  for (let i = 0; i < 21; i++) {
    const d = new Date(Date.now() + i * 86400000);
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(d);
    if (weekday === want) {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
    }
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function labelDia(dia: string): string {
  const found = DIAS_SEMANA.find((d) => d.id === dia);
  if (found) return found.label;
  if (dia === "extra") return "Fecha especial";
  return dia;
}

const WEEKDAY_EN_TO_ES: Record<string, DiaSemana> = {
  Sunday: "domingo",
  Monday: "lunes",
  Tuesday: "martes",
  Wednesday: "miercoles",
  Thursday: "jueves",
  Friday: "viernes",
  Saturday: "sabado",
};

/** Día de semana (ES) de una fecha ISO YYYY-MM-DD en la zona dada. */
export function diaSemanaFromIso(fecha: string, timeZone = "America/Argentina/Buenos_Aires"): DiaSemana | null {
  const [y, m, d] = fecha.split("-").map(Number);
  if (!y || !m || !d) return null;
  // Mediodía UTC ≈ tarde en AR; evita bordes de medianoche
  const probe = new Date(Date.UTC(y, m - 1, d, 15, 0, 0));
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(probe);
  return WEEKDAY_EN_TO_ES[weekday] ?? null;
}

/** Hoy (YYYY-MM-DD) en zona Argentina. */
export function todayIsoInTz(timeZone = "America/Argentina/Buenos_Aires"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Fecha de partido visible en «Próximos»: hoy o futuro, y alineada a días/extras del grupo.
 */
export function fechaCoincideConCalendarioGrupo(
  fecha: string,
  cfg: Pick<GrupoConfig, "configurado" | "diasPartido" | "fechasExtra"> | null,
  timeZone = "America/Argentina/Buenos_Aires",
): boolean {
  if (!cfg?.configurado) return false;
  const today = todayIsoInTz(timeZone);
  if (fecha < today) return false;
  if ((cfg.fechasExtra ?? []).includes(fecha)) return true;
  const dias = cfg.diasPartido ?? [];
  if (dias.length === 0) return false;
  const w = diaSemanaFromIso(fecha, timeZone);
  return w != null && dias.includes(w);
}
