-- Phase 3.5: Make User.realmRole nullable (no default AGENT for non-agent/admin users)
-- This ensures only users with verified admin/agent Keycloak roles get a realmRole.

-- Remove default and make nullable
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" DROP NOT NULL;

-- Clear existing AGENT values for users who don't have admin/agent roles
-- Note: We can't know which users had which roles historically, so we leave existing data.
-- Future upserts via ensureUserInDb will correctly set realmRole only for admin/agent users.