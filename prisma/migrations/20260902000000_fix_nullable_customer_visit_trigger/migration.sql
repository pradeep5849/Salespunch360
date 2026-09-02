CREATE OR REPLACE FUNCTION validate_customer_visit_tenant()
RETURNS trigger AS $$
DECLARE
  user_company UUID;
  customer_company UUID;
  attendance_company UUID;
  attendance_user UUID;
BEGIN
  SELECT "companyId"
  INTO user_company
  FROM "users"
  WHERE "id" = NEW."userId";

  IF user_company IS DISTINCT FROM NEW."companyId" THEN
    RAISE EXCEPTION 'visit tenant mismatch';
  END IF;

  IF NEW."customerId" IS NOT NULL THEN
    SELECT "companyId"
    INTO customer_company
    FROM "customers"
    WHERE "id" = NEW."customerId";

    IF customer_company IS DISTINCT FROM NEW."companyId" THEN
      RAISE EXCEPTION 'visit tenant mismatch';
    END IF;
  END IF;

  IF NEW."attendanceId" IS NOT NULL THEN
    SELECT "companyId", "userId"
    INTO attendance_company, attendance_user
    FROM "attendances"
    WHERE "id" = NEW."attendanceId";

    IF attendance_company IS DISTINCT FROM NEW."companyId"
       OR attendance_user IS DISTINCT FROM NEW."userId"
    THEN
      RAISE EXCEPTION 'visit attendance ownership mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
