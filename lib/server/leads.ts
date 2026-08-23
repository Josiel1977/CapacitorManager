import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { enforceRateLimit, requestActorHash } from "@/lib/server/rate-limit";

export interface LeadRequestInput {
  nome: string;
  email: string;
  telefone?: string;
  empresa?: string;
  cargo?: string;
  mensagem?: string;
  plano_interesse?: string;
  origem?: string;
  aceite_privacidade?: boolean;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
}[character] || character));

export async function createLeadRequest(request: Request, input: LeadRequestInput) {
  const nome = text(input.nome, 120);
  const email = text(input.email, 180).toLowerCase();
  if (!nome || !emailPattern.test(email)) {
    return { ok: false as const, status: 400, error: "Informe nome e e-mail válidos." };
  }
  if (input.aceite_privacidade !== true) {
    return { ok: false as const, status: 400, error: "É necessário aceitar a Política de Privacidade." };
  }

  const allowed = await enforceRateLimit({
    endpoint: "lead",
    request,
    maxRequests: 3,
    windowSeconds: 600,
  });
  if (!allowed) {
    return { ok: false as const, status: 429, error: "Muitas solicitações. Aguarde alguns minutos." };
  }

  const ipHash = requestActorHash(request);
  const payload = {
    nome,
    email,
    telefone: text(input.telefone, 40) || null,
    empresa: text(input.empresa, 160) || null,
    cargo: text(input.cargo, 100) || null,
    mensagem: text(input.mensagem, 2000) || null,
    plano_interesse: text(input.plano_interesse, 40) || null,
    origem: text(input.origem, 160) || "Site",
    lida: false,
    ip_hash: ipHash,
    user_agent: text(request.headers.get("user-agent"), 300) || null,
    consent_at: new Date().toISOString(),
  };

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("leads").insert(payload);
  if (error) {
    console.error("Falha ao registrar lead:", error);
    return { ok: false as const, status: 500, error: "Não foi possível registrar a solicitação." };
  }

  let notified = false;
  const contactFrom = process.env.CONTACT_FROM_EMAIL?.trim();
  const contactTo = process.env.CONTACT_TO_EMAIL?.trim();
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (resendApiKey && contactFrom && contactTo) {
    try {
      const resend = new Resend(resendApiKey);
      const result = await resend.emails.send({
        from: contactFrom,
        to: [contactTo],
        replyTo: email,
        subject: `Nova solicitação CapacitorManager — ${nome}`,
        html: `<h2>Nova solicitação</h2><p><strong>Nome:</strong> ${escapeHtml(nome)}</p><p><strong>E-mail:</strong> ${escapeHtml(email)}</p><p><strong>Telefone:</strong> ${escapeHtml(payload.telefone || "Não informado")}</p><p><strong>Empresa:</strong> ${escapeHtml(payload.empresa || "Não informada")}</p><p><strong>Plano:</strong> ${escapeHtml(payload.plano_interesse || "Não informado")}</p><p><strong>Mensagem:</strong><br>${escapeHtml(payload.mensagem || "Sem mensagem")}</p>`,
      });
      notified = !result.error;
      if (result.error) console.error("Lead salvo, mas o e-mail falhou:", result.error);
    } catch (notificationError) {
      console.error("Lead salvo, mas a notificação falhou:", notificationError);
    }
  }

  return { ok: true as const, status: 201, notified };
}
