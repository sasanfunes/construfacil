import "server-only";

import { render, toPlainText } from "@react-email/render";
import type { ReactElement } from "react";
import { Resend } from "resend";

import { isProductionDeploy } from "@/lib/env";
import { getServerEnv } from "@/lib/env.server";

let client: Resend | undefined;

/**
 * Envía un correo con Resend. Sin Resend configurado (solo fuera de producción) no envía:
 * deja una línea en la consola con el asunto, nunca con la dirección ni el contenido.
 */
export async function sendEmail({
  to,
  subject,
  element,
  replyTo,
}: {
  to: string;
  subject: string;
  element: ReactElement;
  replyTo?: string;
}): Promise<"sent" | "skipped"> {
  const html = await render(element);
  const text = toPlainText(html);
  const env = getServerEnv();

  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    if (isProductionDeploy()) throw new Error("Resend no está configurado en producción.");
    console.info(`[correo] sin enviar (Resend no configurado): "${subject}" (${text.length} caracteres)`);
    return "skipped";
  }

  client ??= new Resend(env.RESEND_API_KEY);
  const { error } = await client.emails.send({ from: env.EMAIL_FROM, to, subject, html, text, replyTo });
  if (error) throw new Error(`Resend rechazó el correo: ${error.name}`);
  return "sent";
}
