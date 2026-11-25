import { createTranslator } from "next-intl";

import type { AppLocale } from "@/i18n/routing";

import en from "../../../../messages/en";
import es from "../../../../messages/es";

const MESSAGES = { es, en } as const;

/** Traductor de correos. Los correos se arman fuera de una página, así que no hay contexto de next-intl. */
export function emailTranslator(locale: AppLocale) {
  return createTranslator({ locale, messages: MESSAGES[locale], namespace: "emails" });
}

export type EmailTranslator = ReturnType<typeof emailTranslator>;
