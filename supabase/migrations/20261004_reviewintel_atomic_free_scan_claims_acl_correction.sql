-- Remove broader default table privileges from the server-only claim writer.
-- The original migration already removed public, anon, and authenticated access.

revoke all privileges
on table public.reviewintel_free_scan_claims
from service_role;

grant select, insert, update, delete
on table public.reviewintel_free_scan_claims
to service_role;
