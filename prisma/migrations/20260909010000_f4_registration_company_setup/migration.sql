-- F4 registration/setup is additive. Existing companies retain SALESPUNCH360
-- and every currently available Sales module remains enabled.
CREATE TYPE "CompanyModule" AS ENUM (
  'SALES_CRM', 'ATTENDANCE', 'GPS_TRACKING', 'FOLLOW_UP_TASKS',
  'TARGETS', 'REPORTS', 'INVENTORY', 'ACCOUNTING', 'PROJECTS'
);

ALTER TABLE "companies"
ADD COLUMN "enabledModules" "CompanyModule"[] NOT NULL DEFAULT ARRAY[
  'SALES_CRM'::"CompanyModule", 'ATTENDANCE'::"CompanyModule",
  'GPS_TRACKING'::"CompanyModule", 'FOLLOW_UP_TASKS'::"CompanyModule",
  'TARGETS'::"CompanyModule", 'REPORTS'::"CompanyModule"
];
