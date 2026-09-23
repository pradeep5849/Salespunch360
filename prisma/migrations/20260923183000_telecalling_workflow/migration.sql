CREATE TABLE "lead_calls" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "leadId" UUID NOT NULL,
  "callerUserId" UUID NOT NULL,
  "result" VARCHAR(40) NOT NULL,
  "notes" VARCHAR(2000),
  "calledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextCallbackAt" TIMESTAMP(3),
  "callbackAssigneeUserId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_calls_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lead_calls_company_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "lead_calls_lead_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "lead_calls_caller_fkey" FOREIGN KEY ("callerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "lead_calls_callback_assignee_fkey" FOREIGN KEY ("callbackAssigneeUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT "lead_calls_result_check" CHECK ("result" IN ('CONNECTED','NO_ANSWER','BUSY','NOT_REACHABLE','WRONG_NUMBER','CALL_BACK','NOT_INTERESTED','INTERESTED','WANTS_VISIT','WANTS_QUOTATION')),
  CONSTRAINT "lead_calls_callback_check" CHECK (("result" <> 'CALL_BACK') OR "nextCallbackAt" IS NOT NULL)
);
CREATE INDEX "lead_calls_company_lead_called_idx" ON "lead_calls"("companyId","leadId","calledAt" DESC);
CREATE INDEX "lead_calls_callback_queue_idx" ON "lead_calls"("companyId","callbackAssigneeUserId","nextCallbackAt") WHERE "nextCallbackAt" IS NOT NULL;

CREATE TABLE "lead_sales_actions" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "leadId" UUID NOT NULL,
  "leadCallId" UUID NOT NULL,
  "assignedUserId" UUID NOT NULL,
  "createdByUserId" UUID NOT NULL,
  "trigger" VARCHAR(40) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  "acknowledgedAt" TIMESTAMP(3),
  "actionedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_sales_actions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lead_sales_actions_call_key" UNIQUE ("leadCallId"),
  CONSTRAINT "lead_sales_actions_company_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "lead_sales_actions_lead_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "lead_sales_actions_call_fkey" FOREIGN KEY ("leadCallId") REFERENCES "lead_calls"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "lead_sales_actions_assignee_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "lead_sales_actions_creator_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "lead_sales_actions_trigger_check" CHECK ("trigger" IN ('INTERESTED','WANTS_VISIT','WANTS_QUOTATION')),
  CONSTRAINT "lead_sales_actions_status_check" CHECK ("status" IN ('PENDING','ACKNOWLEDGED','ACTION_TAKEN'))
);
CREATE INDEX "lead_sales_actions_assignee_status_idx" ON "lead_sales_actions"("companyId","assignedUserId","status","createdAt" DESC);
CREATE INDEX "lead_sales_actions_company_status_idx" ON "lead_sales_actions"("companyId","status","createdAt" DESC);

CREATE TABLE "telecaller_subscriptions" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  "billingPeriod" VARCHAR(16) NOT NULL,
  "seats" INTEGER NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "sourceOrderId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "telecaller_subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "telecaller_subscriptions_order_key" UNIQUE ("sourceOrderId"),
  CONSTRAINT "telecaller_subscriptions_company_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "telecaller_subscriptions_order_fkey" FOREIGN KEY ("sourceOrderId") REFERENCES "billing_orders"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "telecaller_subscriptions_status_check" CHECK ("status" IN ('ACTIVE','EXPIRED','CANCELLED')),
  CONSTRAINT "telecaller_subscriptions_period_check" CHECK ("billingPeriod" IN ('SIX_MONTH','YEARLY')),
  CONSTRAINT "telecaller_subscriptions_seats_check" CHECK ("seats" >= 0)
);
CREATE INDEX "telecaller_subscriptions_company_active_idx" ON "telecaller_subscriptions"("companyId","status","endsAt" DESC);

CREATE TABLE "telecaller_billing_orders" (
  "billingOrderId" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "addedSeats" INTEGER NOT NULL,
  "targetSeats" INTEGER NOT NULL,
  "unitPrice" DECIMAL(18,2) NOT NULL,
  "coTermStartsAt" TIMESTAMP(3) NOT NULL,
  "coTermEndsAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "telecaller_billing_orders_pkey" PRIMARY KEY ("billingOrderId"),
  CONSTRAINT "telecaller_billing_orders_order_fkey" FOREIGN KEY ("billingOrderId") REFERENCES "billing_orders"("id") ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT "telecaller_billing_orders_company_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "telecaller_billing_orders_seat_check" CHECK ("addedSeats" > 0 AND "targetSeats" >= "addedSeats")
);
CREATE INDEX "telecaller_billing_orders_company_idx" ON "telecaller_billing_orders"("companyId","createdAt" DESC);
