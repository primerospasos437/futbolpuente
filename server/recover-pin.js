import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

function sha256Hex(s) {
  return crypto.createHash("sha256").update(String(s), "utf8").digest("hex");
}

function randomSixDigitCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Rutas para solicitar y completar recuperación de PIN vía correo registrado.
 * Requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY. Si RESEND_API_KEY está definida, envía el correo con Resend.
 */
export function registerRecoverPinRoutes(app) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("[recover-pin] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configurados: rutas de recuperación desactivadas.");
    return;
  }
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  app.post("/api/auth/recover-request", async (req, res) => {
    try {
      const email = String(req.body?.email ?? "").trim().toLowerCase();
      const apodo = String(req.body?.apodo ?? "").trim();
      if (!email || !apodo) return res.status(400).json({ error: "Correo y apodo son obligatorios" });

      const { data: u, error: uErr } = await sb.from("usuarios").select("id").ilike("email", email).maybeSingle();
      if (uErr) throw uErr;
      if (!u?.id) {
        res.json({ ok: true });
        return;
      }

      const { data: j, error: jErr } = await sb
        .from("jugadores")
        .select("id, apodo")
        .eq("id", u.id)
        .ilike("apodo", apodo)
        .maybeSingle();
      if (jErr) throw jErr;
      if (!j?.id) {
        res.json({ ok: true });
        return;
      }

      const code = randomSixDigitCode();
      const codigo_hash = sha256Hex(code).toLowerCase();
      const expires_at = new Date(Date.now() + 20 * 60 * 1000).toISOString();

      await sb.from("recuperacion_pin").delete().eq("jugador_id", j.id);
      const { error: insErr } = await sb.from("recuperacion_pin").insert({ jugador_id: j.id, codigo_hash, expires_at });
      if (insErr) throw insErr;

      const apiKey = process.env.RESEND_API_KEY;
      const from = process.env.RESEND_FROM_EMAIL || "Fútbol Grupo <onboarding@resend.dev>";
      if (apiKey) {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: [email],
            subject: "Código para recuperar tu PIN",
            text: `Tu código (válido 20 minutos): ${code}\n\nSi no pediste recuperar el PIN, ignorá este mensaje.`,
          }),
        });
        if (!r.ok) {
          const t = await r.text();
          console.error("[recover-pin] Resend error:", r.status, t);
        }
      } else {
        console.info(`[recover-pin] Código para ${email} / ${apodo}: ${code} (definí RESEND_API_KEY para enviar por mail)`);
      }

      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: String(e.message || e) });
    }
  });

  app.post("/api/auth/recover-confirm", async (req, res) => {
    try {
      const email = String(req.body?.email ?? "").trim().toLowerCase();
      const apodo = String(req.body?.apodo ?? "").trim();
      const code = String(req.body?.code ?? "").trim();
      const newPin = String(req.body?.newPin ?? "").trim();
      if (!email || !apodo || !code || newPin.length < 4) {
        return res.status(400).json({ error: "Datos incompletos (PIN nuevo: mínimo 4 caracteres)" });
      }

      const pin_hash = sha256Hex(newPin).toLowerCase();
      const { data, error } = await sb.rpc("futbol_recuperacion_pin_confirmar", {
        p_email: email,
        p_apodo: apodo,
        p_codigo: code,
        p_pin_hash: pin_hash,
      });
      if (error) return res.status(400).json({ error: error.message });
      res.json(data ?? { ok: true });
    } catch (e) {
      res.status(500).json({ error: String(e.message || e) });
    }
  });
}
