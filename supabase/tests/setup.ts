import { afterAll } from "vitest";

import { closePool } from "./helpers";

afterAll(async () => {
  await closePool();
});
