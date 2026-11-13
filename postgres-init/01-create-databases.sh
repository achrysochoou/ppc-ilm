#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  --set=keycloak_password="$KEYCLOAK_DB_PASSWORD" --set=syncope_password="$SYNCOPE_DB_PASSWORD" <<'SQL'
CREATE USER keycloak WITH PASSWORD :'keycloak_password';
CREATE DATABASE keycloak OWNER keycloak;
CREATE USER syncope WITH PASSWORD :'syncope_password';
CREATE DATABASE syncope OWNER syncope;
SQL
