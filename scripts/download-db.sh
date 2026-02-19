#!/bin/bash
# Download pre-built database for Vercel deployment.
# In production, the database is built by the CI pipeline and stored as an artifact.
# This script is a placeholder for the Vercel buildCommand.

set -euo pipefail

DB_DIR="data"
DB_FILE="$DB_DIR/database.db"

if [ -f "$DB_FILE" ]; then
  echo "Database already exists at $DB_FILE"
  exit 0
fi

echo "WARNING: No pre-built database found. Building from seed data..."

# Ensure data directory exists
mkdir -p "$DB_DIR"

# If we have seed data, build the database
if [ -d "data/seed" ] && [ "$(ls -A data/seed/*.json 2>/dev/null)" ]; then
  npx tsx scripts/build-db.ts
else
  echo "No seed data found. Creating empty database with schema only."
  npx tsx scripts/build-db.ts
fi

echo "Database ready at $DB_FILE"
