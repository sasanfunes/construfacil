import { describe, expect, it } from "vitest";

import en from "./en";
import es from "./es";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? { ...acc, [path]: value } : { ...acc, ...flatten(value, path) };
  }, {});
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)/g)].map((match) => match[1]).sort();

/** Criterio de éxito del proyecto: todo el texto está en español y en inglés. */
describe("traducciones", () => {
  const spanish = flatten(es);
  const english = flatten(en);

  it("español e inglés tienen exactamente las mismas llaves", () => {
    expect(Object.keys(english).sort()).toEqual(Object.keys(spanish).sort());
  });

  it("ningún texto está vacío", () => {
    for (const [key, value] of [...Object.entries(spanish), ...Object.entries(english)]) {
      expect(value.trim(), key).not.toBe("");
    }
  });

  it("las variables ({year}, {name}...) coinciden en ambos idiomas", () => {
    for (const key of Object.keys(spanish)) {
      expect(placeholders(english[key] ?? ""), key).toEqual(placeholders(spanish[key]!));
    }
  });
});
