INSERT INTO "billing_prices" ("id","role","period","amount","currency","effectiveFrom","createdAt")
SELECT gen_random_uuid(),'ACCOUNT_PACKAGE'::"BillingRole",'YEARLY'::"BillingPeriod",700.00,'INR',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "billing_prices" WHERE "role"='ACCOUNT_PACKAGE'::"BillingRole" AND "period"='YEARLY'::"BillingPeriod" AND "currency"='INR' AND "effectiveUntil" IS NULL);
