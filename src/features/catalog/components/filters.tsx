import Form from "next/form";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import type { Department, Municipality } from "@/features/geo/data";

import { activeFilterCount, type HomeFilters } from "../filters";
import { CONSTRUCTION_STATUSES } from "../types";

import { FilterPanel } from "./filter-panel";

type Geo = { departments: Department[]; municipalities: Municipality[] };

function LocationFields({ geo, department, city }: { geo: Geo; department?: number; city?: number }) {
  const t = useTranslations("catalog.filters");
  return (
    <>
      <Field id="filter-department" label={t("department")}>
        <Select id="filter-department" name="department" defaultValue={department ?? ""}>
          <option value="">{t("anyDepartment")}</option>
          {geo.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="filter-city" label={t("city")}>
        <Select id="filter-city" name="city" defaultValue={city ?? ""}>
          <option value="">{t("anyCity")}</option>
          {geo.departments.map((d) => (
            <optgroup key={d.id} label={d.name}>
              {geo.municipalities
                .filter((m) => m.departmentId === d.id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
      </Field>
    </>
  );
}

function PriceFields({ minPrice, maxPrice }: { minPrice?: number; maxPrice?: number }) {
  const t = useTranslations("catalog.filters");
  return (
    <>
      <Field id="filter-min-price" label={t("minPrice")}>
        <Input
          id="filter-min-price"
          name="minPrice"
          type="number"
          inputMode="numeric"
          min={0}
          step={1000}
          defaultValue={minPrice}
        />
      </Field>
      <Field id="filter-max-price" label={t("maxPrice")}>
        <Input
          id="filter-max-price"
          name="maxPrice"
          type="number"
          inputMode="numeric"
          min={0}
          step={1000}
          defaultValue={maxPrice}
        />
      </Field>
    </>
  );
}

function Actions({ clearHref }: { clearHref: string }) {
  const t = useTranslations("catalog.filters");
  return (
    <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-4">
      <Button type="submit" variant="brand">
        {t("apply")}
      </Button>
      <a
        href={clearHref}
        className="inline-flex min-h-11 items-center font-bold text-brand underline underline-offset-4"
      >
        {t("clear")}
      </a>
    </div>
  );
}

export function HomeFiltersForm({
  action,
  filters,
  geo,
}: {
  action: string;
  filters: HomeFilters;
  geo: Geo;
}) {
  const t = useTranslations("catalog");
  const count = activeFilterCount(filters);
  return (
    <FilterPanel summary={count > 0 ? t("filters.titleCount", { count }) : t("filters.title")}>
      <Form action={action} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {filters.view === "map" ? <input type="hidden" name="view" value="map" /> : null}
        <LocationFields geo={geo} department={filters.department} city={filters.city} />
        <PriceFields minPrice={filters.minPrice} maxPrice={filters.maxPrice} />
        <Field id="filter-beds" label={t("filters.beds")}>
          <Select id="filter-beds" name="beds" defaultValue={filters.beds ?? ""}>
            <option value="">{t("filters.any")}</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {t("filters.atLeast", { count: n })}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="filter-baths" label={t("filters.baths")}>
          <Select id="filter-baths" name="baths" defaultValue={filters.baths ?? ""}>
            <option value="">{t("filters.any")}</option>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {t("filters.atLeast", { count: n })}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="filter-status" label={t("filters.status")}>
          <Select id="filter-status" name="status" defaultValue={filters.status ?? ""}>
            <option value="">{t("filters.any")}</option>
            {CONSTRUCTION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`construction.${status}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="filter-min-area" label={t("filters.minAreaHome")}>
          <Input
            id="filter-min-area"
            name="minArea"
            type="number"
            inputMode="numeric"
            min={0}
            step={10}
            defaultValue={filters.minArea}
          />
        </Field>
        <Actions clearHref={action} />
      </Form>
    </FilterPanel>
  );
}
