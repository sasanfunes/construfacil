import { z } from "zod";

/**
 * Zod configurado para este proyecto. Importa `z` desde aquí, nunca desde "zod".
 *
 * `jitless`: por defecto Zod prueba `new Function("")` para compilar validadores más rápidos.
 * La CSP del sitio prohíbe `eval` (y así debe quedarse), así que el navegador registraba una
 * violación de CSP en cada página con formulario. Sin JIT, Zod valida igual, sin intentarlo.
 */
z.config({ jitless: true });

export { z };
