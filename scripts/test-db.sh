#!/usr/bin/env bash
# Levanta un Postgres desechable para los tests de RLS (`pnpm test:rls`).
# Requiere Docker. Si ya tienes un Postgres local vacío, basta con definir TEST_DATABASE_URL.
set -euo pipefail

NAME="construfacil-pgtest"
PORT="${TEST_DB_PORT:-54329}"

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "Docker no está disponible. Define TEST_DATABASE_URL apuntando a un Postgres local." >&2
  exit 1
fi

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=postgres -p "127.0.0.1:${PORT}:5432" postgres:17-alpine >/dev/null

echo "Esperando a Postgres..."
until docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; do sleep 0.5; done

echo "Listo. Corre los tests con:"
echo "  TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:${PORT}/postgres pnpm test:rls"
