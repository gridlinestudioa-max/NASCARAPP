-- Regenerate every existing league's invite code as a short, human-typeable
-- 6-character code (see src/lib/inviteCode.ts for the app-side generator
-- new leagues use going forward). This is a pure data migration — the
-- "inviteCode" column's shape/constraints (TEXT, UNIQUE, NOT NULL) don't
-- change; Prisma's old @default(cuid()) was applied client-side, not as a
-- real Postgres column default, so there's no DDL to drop here.
DO $$
DECLARE
  league_row RECORD;
  new_code TEXT;
  alphabet TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- excludes 0/O and 1/I/L
  i INT;
BEGIN
  FOR league_row IN SELECT id FROM "League" LOOP
    LOOP
      new_code := '';
      FOR i IN 1..6 LOOP
        new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "League" WHERE "inviteCode" = new_code);
    END LOOP;
    UPDATE "League" SET "inviteCode" = new_code WHERE id = league_row.id;
  END LOOP;
END $$;
