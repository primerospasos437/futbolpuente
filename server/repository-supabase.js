import { createClient } from "@supabase/supabase-js";

function mapRowToPlayer(r) {
  if (!r) return null;
  return {
    id: r.id,
    nombreCompleto: r.nombre_completo,
    apodo: r.apodo,
    pinHash: r.pin_hash,
    posicionPreferida: r.posicion_preferida,
    posicionAlternativa: r.posicion_alternativa,
    pieDominante: r.pie_dominante,
    fechaNacimiento: r.fecha_nacimiento ?? "",
    contacto: r.contacto ?? "",
    alturaCm: r.altura_cm,
    pesoKg: r.peso_kg != null ? Number(r.peso_kg) : null,
    historialLesiones: r.historial_lesiones ?? "",
    profile: typeof r.perfil_scores === "object" && r.perfil_scores ? r.perfil_scores : {},
    createdAt: r.created_at ?? r.updated_at ?? new Date().toISOString(),
  };
}

function mapRatingRow(v) {
  return {
    fromId: v.de_jugador_id,
    toId: v.para_jugador_id,
    scores: v.puntajes ?? {},
    updatedAt: v.updated_at,
  };
}

export function createSupabaseRepository(url, serviceRoleKey) {
  const sb = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  async function assertReadable(table, columns) {
    const { error } = await sb.from(table).select(columns).limit(1);
    if (error) throw new Error(`[schema] ${table}: ${error.message}`);
  }

  return {
    mode: "supabase",
    client: sb,

    async validateSchema() {
      const checks = [
        ["usuarios", "id"],
        [
          "jugadores",
          [
            "id",
            "apodo",
            "pin_hash",
            "nombre_completo",
            "posicion_preferida",
            "posicion_alternativa",
            "pie_dominante",
            "fecha_nacimiento",
            "contacto",
            "altura_cm",
            "peso_kg",
            "historial_lesiones",
            "perfil_scores",
            "created_at",
            "updated_at",
          ].join(","),
        ],
        ["valoraciones", "de_jugador_id,para_jugador_id,puntajes,updated_at"],
        ["sesiones", "token,jugador_id,created_at"],
      ];
      for (const [table, columns] of checks) {
        await assertReadable(table, columns);
      }
    },

    async apodoExists(apodoNorm) {
      const p = await this.findByApodo(apodoNorm);
      return p != null;
    },

    async findByApodo(apodoNorm) {
      const { data, error } = await sb
        .from("jugadores")
        .select("*")
        .ilike("apodo", apodoNorm.trim())
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      if (String(data.apodo).trim().toLowerCase() !== apodoNorm) return null;
      return mapRowToPlayer(data);
    },

    async findById(id) {
      const { data, error } = await sb.from("jugadores").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return mapRowToPlayer(data);
    },

    async listPlayers() {
      const { data, error } = await sb.from("jugadores").select("*").order("apodo", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapRowToPlayer);
    },

    async listPlayersByIds(ids) {
      if (!ids.length) return [];
      const { data, error } = await sb.from("jugadores").select("*").in("id", ids);
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapRowToPlayer);
    },

    /**
     * Crea usuario + jugador en una transacción vía RPC no disponible: dos inserts.
     * Si falla el segundo, queda usuario huérfano (poco frecuente); podés limpiar a mano.
     */
    async createPlayer(player) {
      const { data: u, error: eu } = await sb.from("usuarios").insert({}).select("id").single();
      if (eu) throw new Error(eu.message);
      const id = u.id;

      const row = {
        id,
        apodo: player.apodo,
        pin_hash: player.pinHash,
        nombre_completo: player.nombreCompleto,
        posicion_preferida: player.posicionPreferida,
        posicion_alternativa: player.posicionAlternativa,
        pie_dominante: player.pieDominante,
        fecha_nacimiento: player.fechaNacimiento ?? "",
        contacto: player.contacto ?? "",
        altura_cm: player.alturaCm,
        peso_kg: player.pesoKg,
        historial_lesiones: player.historialLesiones ?? "",
        perfil_scores: player.profile,
      };

      const { error: ej } = await sb.from("jugadores").insert(row);
      if (ej) {
        await sb.from("usuarios").delete().eq("id", id);
        throw new Error(ej.message);
      }
      return { id };
    },

    async updatePlayer(id, patch) {
      const row = {};
      if (patch.nombreCompleto !== undefined) row.nombre_completo = patch.nombreCompleto;
      if (patch.posicionPreferida !== undefined) row.posicion_preferida = patch.posicionPreferida;
      if (patch.posicionAlternativa !== undefined) row.posicion_alternativa = patch.posicionAlternativa;
      if (patch.pieDominante !== undefined) row.pie_dominante = patch.pieDominante;
      if (patch.fechaNacimiento !== undefined) row.fecha_nacimiento = patch.fechaNacimiento;
      if (patch.contacto !== undefined) row.contacto = patch.contacto;
      if (patch.alturaCm !== undefined) row.altura_cm = patch.alturaCm;
      if (patch.pesoKg !== undefined) row.peso_kg = patch.pesoKg;
      if (patch.historialLesiones !== undefined) row.historial_lesiones = patch.historialLesiones;
      if (patch.profile !== undefined) row.perfil_scores = patch.profile;

      const { data, error } = await sb.from("jugadores").update(row).eq("id", id).select("*").maybeSingle();
      if (error) throw new Error(error.message);
      return mapRowToPlayer(data);
    },

    async ratingsTo(paraId) {
      const { data, error } = await sb.from("valoraciones").select("*").eq("para_jugador_id", paraId);
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapRatingRow);
    },

    async findRating(deId, paraId) {
      const { data, error } = await sb
        .from("valoraciones")
        .select("*")
        .eq("de_jugador_id", deId)
        .eq("para_jugador_id", paraId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapRatingRow(data) : null;
    },

    async upsertRating(deId, paraId, scores) {
      const now = new Date().toISOString();
      const { error } = await sb.from("valoraciones").upsert(
        {
          de_jugador_id: deId,
          para_jugador_id: paraId,
          puntajes: scores,
          updated_at: now,
        },
        { onConflict: "de_jugador_id,para_jugador_id" },
      );
      if (error) throw new Error(error.message);
    },

    async setSession(token, jugadorId) {
      const { error } = await sb.from("sesiones").upsert(
        { token, jugador_id: jugadorId, created_at: new Date().toISOString() },
        { onConflict: "token" },
      );
      if (error) throw new Error(error.message);
    },

    async getJugadorIdFromToken(token) {
      const { data, error } = await sb.from("sesiones").select("jugador_id").eq("token", token).maybeSingle();
      if (error) throw new Error(error.message);
      return data?.jugador_id ?? null;
    },
  };
}
