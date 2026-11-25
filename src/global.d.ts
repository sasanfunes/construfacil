import type messages from "../messages/es";
import type { routing } from "@/i18n/routing";

declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    // El español es la fuente de verdad de las llaves. Un test comprueba que el inglés tenga las mismas.
    Messages: typeof messages;
  }
}
