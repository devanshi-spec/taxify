-- Initialize databases for WhatsApp CRM

-- Create Evolution API database
CREATE DATABASE evolution;

-- Create extensions
\c whatsapp_crm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE whatsapp_crm TO postgres;
GRANT ALL PRIVILEGES ON DATABASE evolution TO postgres;
