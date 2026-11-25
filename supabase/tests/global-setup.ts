import { resetTestDatabase } from "./db";

export default async function globalSetup() {
  await resetTestDatabase();
}
