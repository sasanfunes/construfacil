import { describe, expect, it } from "vitest";

import en from "./en";
import es from "./es";

type Tree = Record<string, unknown>;

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") result[path] = value;
    // Las listas se comparan elemento por elemento: deben tener el mismo largo en ambos idiomas.
    else if (Array.isArray(value)) Object.assign(result, flatten(Object.fromEntries(value.entries()), path));
    else if (value && typeof value === "object") Object.assign(result, flatten(value as Tree, path));
  }
  return result;
}

// Variables ICU: {name} o {count, plural, …}. No cuenta el texto de las opciones ({# casa}).
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)(?=[,}])/g)].map((match) => match[1]).sort();

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
