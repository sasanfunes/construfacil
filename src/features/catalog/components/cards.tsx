import { Bath, BedDouble, Car, Ruler } from "lucide-react";
import { useTranslations } from "next-intl";

import { ExampleBadge } from "@/components/shared/example-badge";
import { Price } from "@/components/shared/price";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";

import type { Home, HouseModel, Lot } from "../types";

import { HouseIllustration } from "./illustrations";

type Place = { municipality: string; department: string };

function Fact({ icon: Icon, children }: { icon: typeof Bath; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon aria-hidden="true" className="size-4 text-brand" />
      {children}
    </span>
  );
}

export function HomeStatusBadges({
  home,
}: {
  home: Pick<Home, "constructionStatus" | "listingStatus" | "isExample">;
}) {
  const t = useTranslations("catalog");
  return (
    <div className="flex flex-wrap gap-2">
      {home.listingStatus === "reserved" ? (
        <Badge variant="brand">{t("listing.reserved")}</Badge>
      ) : (
        <Badge variant={home.constructionStatus === "ready" ? "success" : "accent"}>
          {t(`construction.${home.constructionStatus}`)}
        </Badge>
      )}
      {home.isExample ? <ExampleBadge /> : null}
    </div>
  );
}

export function HomeCard({
  home,
  place,
  locale,
  usdToHnl,
}: {
  home: Home;
  place: Place;
  locale: AppLocale;
  usdToHnl: number;
}) {
  const t = useTranslations("catalog");
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-lg">
      <HouseIllustration
        seed={home.slug}
        floors={home.floors}
        withCarport={home.features.includes("carport") || home.features.includes("covered_garage")}
        className="aspect-[16/10] w-full"
      />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <HomeStatusBadges home={home} />
        <h3 className="text-xl">
          <Link
            href={{ pathname: "/homes/[slug]", params: { slug: home.slug } }}
            className="after:absolute after:inset-0"
          >
            {home.title[locale]}
          </Link>
        </h3>
        <p className="text-muted-foreground">{t("place", place)}</p>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold text-muted-foreground">
          <Fact icon={BedDouble}>{t("facts.bedrooms", { count: home.bedrooms })}</Fact>
          <Fact icon={Bath}>{t("facts.bathrooms", { count: home.bathrooms })}</Fact>
          <Fact icon={Ruler}>
            {t("facts.area", { value: formatNumber(home.constructionAreaM2, locale) })}
          </Fact>
          {home.parkingSpaces > 0 ? (
            <Fact icon={Car}>{t("facts.parking", { count: home.parkingSpaces })}</Fact>
          ) : null}
        </p>
        <Price usdCents={home.priceUsdCents} usdToHnl={usdToHnl} className="mt-auto pt-2" />
      </div>
    </article>
  );
}

export function LotLegalBadge({ legalStatus }: { legalStatus: Lot["legalStatus"] }) {
  const t = useTranslations("catalog");
  return (
    <Badge variant={legalStatus === "full_title" ? "success" : "neutral"}>{t(`legal.${legalStatus}`)}</Badge>
  );
}

export function ModelCard({
  model,
  locale,
  fromUsdCents,
  usdToHnl,
}: {
  model: HouseModel;
  locale: AppLocale;
  fromUsdCents: number | null;
  usdToHnl: number;
}) {
  const t = useTranslations("catalog");
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-lg">
      <HouseIllustration
        seed={model.slug}
        floors={model.floors}
        withCarport={model.floorPlan.some((r) => r.room === "carport")}
        className="aspect-[16/10] w-full"
      />
      <div className="flex flex-1 flex-col gap-3 p-5">
        {model.isExample ? <ExampleBadge className="self-start" /> : null}
        <h3 className="text-xl">
          <Link
            href={{ pathname: "/build/models/[slug]", params: { slug: model.slug } }}
            className="after:absolute after:inset-0"
          >
            {model.name[locale]}
          </Link>
        </h3>
        <p className="text-muted-foreground">{model.summary[locale]}</p>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold text-muted-foreground">
          <Fact icon={BedDouble}>{t("facts.bedrooms", { count: model.bedrooms })}</Fact>
          <Fact icon={Bath}>{t("facts.bathrooms", { count: model.bathrooms })}</Fact>
          <Fact icon={Ruler}>{t("facts.area", { value: formatNumber(model.areaM2, locale) })}</Fact>
        </p>
        {fromUsdCents !== null ? (
          <div className="mt-auto flex flex-col pt-2">
            <span className="text-sm font-bold text-muted-foreground">{t("models.from")}</span>
            <Price usdCents={fromUsdCents} usdToHnl={usdToHnl} />
          </div>
        ) : null}
      </div>
    </article>
  );
}
