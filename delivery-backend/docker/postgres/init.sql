-- Runs automatically on first PostgreSQL container start
-- Grants full privileges to delivery_user on the public schema

ALTER USER delivery_user WITH SUPERUSER CREATEDB CREATEROLE;
GRANT ALL PRIVILEGES ON DATABASE delivery_db TO delivery_user;
GRANT ALL ON SCHEMA public TO delivery_user;
ALTER SCHEMA public OWNER TO delivery_user;
