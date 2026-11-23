-- A callback is a shared Call task, with its original timestamp retained.
ALTER TABLE "follow_up_tasks" ADD COLUMN "callbackAt" TIMESTAMP(3), ADD COLUMN "callbackCallId" UUID;
CREATE UNIQUE INDEX "follow_up_tasks_callbackCallId_key" ON "follow_up_tasks"("callbackCallId");
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_callback_pair_check" CHECK (("callbackAt" IS NULL) = ("callbackCallId" IS NULL));
-- Preserve the existing pending queue, without resurrecting callbacks superseded by a later call.
INSERT INTO "follow_up_tasks" (id,"companyId","branchId","leadId","assignedUserId","createdByUserId","dueDate",notes,status,"callbackAt","callbackCallId","createdAt","updatedAt")
SELECT gen_random_uuid(),c."companyId",l."branchId",c."leadId",c."callbackAssigneeUserId",c."callerUserId",
 ((c."nextCallbackAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date,
 '[[SP360_FOLLOW_UP:CALL]]' || CASE WHEN coalesce(c.notes,'')='' THEN '' ELSE E'\n'||left(c.notes,1975) END,
 'PENDING',c."nextCallbackAt",c.id,c."createdAt",CURRENT_TIMESTAMP
FROM "lead_calls" c JOIN leads l ON l.id=c."leadId" AND l."companyId"=c."companyId"
JOIN users u ON u.id=c."callbackAssigneeUserId" AND u."companyId"=c."companyId"
WHERE NOT EXISTS (SELECT 1 FROM follow_up_tasks existing WHERE existing."callbackCallId"=c.id)
AND c.result='CALL_BACK' AND c."nextCallbackAt" IS NOT NULL AND l."branchId" IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM "lead_calls" n WHERE n."companyId"=c."companyId" AND n."leadId"=c."leadId" AND n."callerUserId"=c."callbackAssigneeUserId" AND n."calledAt">c."calledAt");

UPDATE leads l SET "followUpAt"=(SELECT min(t."dueDate") FROM follow_up_tasks t WHERE t."leadId"=l.id AND t.status='PENDING')
WHERE EXISTS (SELECT 1 FROM follow_up_tasks t WHERE t."leadId"=l.id AND t."callbackCallId" IS NOT NULL);
