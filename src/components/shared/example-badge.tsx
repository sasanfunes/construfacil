import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";

/** Marca visible para contenido de ejemplo: nunca debe pasar por real. */
export function ExampleBadge({ className }: { className?: string }) {
  const t = useTranslations("common");
  return (
    <Badge variant="warning" className={className}>
      {t("example")}
    </Badge>
  );
}
