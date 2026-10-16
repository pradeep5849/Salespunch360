CREATE TABLE "account_report_favourites" (
 "companyId" UUID NOT NULL,
 "userId" UUID NOT NULL,
 "reportKey" VARCHAR(60) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "account_report_favourites_pkey" PRIMARY KEY ("companyId","userId","reportKey"),
 CONSTRAINT "account_report_favourites_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "account_report_favourites_companyId_userId_fkey" FOREIGN KEY ("companyId","userId") REFERENCES "users"("companyId","id") ON DELETE CASCADE ON UPDATE CASCADE
);
