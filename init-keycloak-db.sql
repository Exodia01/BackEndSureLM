-- Initialize Keycloak database
-- NOTE: This file is used by docker-compose.keycloak.yml (DEPRECATED).
-- The primary setup uses docker-compose.yml which shares the surelm_0 database.
-- If you need to run the legacy Keycloak, set POSTGRES_PASSWORD env var
-- and update this file or use the POSTGRES_PASSWORD env var passed to the container.

CREATE DATABASE keycloak;

-- Create admin user
-- WARNING: The password below is a placeholder. For the primary docker-compose.yml,
-- the Keycloak admin password is set via KEYCLOAK_ADMIN_PASSWORD env var.
-- For this legacy file, update the password before first run or create the user manually.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'admin') THEN
        CREATE USER admin WITH PASSWORD 'CHANGE_ME_BEFORE_FIRST_RUN';
    END IF;
END $$;

GRANT ALL PRIVILEGES ON DATABASE keycloak TO admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin;
