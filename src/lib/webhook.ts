/**
 * HU-30: Webhook al aprobar solicitud.
 * Envía un POST al endpoint configurado en WEBHOOK_URL cuando una solicitud pasa a APPROVED.
 * Fire-and-forget: nunca bloquea la respuesta HTTP ni relanza errores.
 */

export interface WebhookPayload {
  event: "purchase_request.approved";
  timestamp: string;
  data: {
    id: string;
    title: string;
    totalAmount: number;
    costCenter: string;
    companyId: string;
    approvedBy: {
      id: string;
      name: string;
      role: string;
    };
  };
}

/**
 * Envía el webhook de aprobación de forma asíncrona (fire-and-forget).
 * Si WEBHOOK_URL no está configurada, retorna sin hacer nada.
 * Si el envío falla, loguea el error pero NO relanza la excepción.
 */
export async function sendApprovalWebhook(
  request: {
    id: string;
    title: string;
    totalAmount: number | string;
    costCenter: string;
    companyId: string;
  },
  actor: {
    id: string;
    name: string;
    role: string;
  }
): Promise<void> {
  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) return;

  const payload: WebhookPayload = {
    event: "purchase_request.approved",
    timestamp: new Date().toISOString(),
    data: {
      id: request.id,
      title: request.title,
      totalAmount: Number(request.totalAmount),
      costCenter: request.costCenter,
      companyId: request.companyId,
      approvedBy: {
        id: actor.id,
        name: actor.name,
        role: actor.role,
      },
    },
  };

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error("[webhook] Error al enviar webhook de aprobación:", err);
  }
}

