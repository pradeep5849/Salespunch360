-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectMilestoneStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectAuditEventType" AS ENUM ('PROJECT_CREATED', 'PROJECT_UPDATED', 'PROJECT_MANAGER_CHANGED', 'PROJECT_TEAM_CHANGED', 'PROJECT_STATUS_CHANGED', 'PROJECT_BUDGET_CHANGED', 'BOQ_LINKED', 'MILESTONE_CHANGED', 'TASK_CHANGED', 'DOCUMENT_ADDED', 'PROJECT_CLOSED', 'PROJECT_REOPENED');

-- AlterTable
ALTER TABLE "quotation_documents" ADD COLUMN     "projectId" UUID;

-- AlterTable
ALTER TABLE "commercial_documents" ADD COLUMN     "projectId" UUID;

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "projectNumber" VARCHAR(100) NOT NULL,
    "name" VARCHAR(240) NOT NULL,
    "customerId" UUID NOT NULL,
    "siteName" VARCHAR(240),
    "siteAddress" TEXT,
    "siteContactName" VARCHAR(160),
    "siteContactPhone" VARCHAR(30),
    "projectManagerId" UUID,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "startDate" DATE,
    "targetEndDate" DATE,
    "actualEndDate" DATE,
    "projectValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "handoverDate" DATE,
    "handoverNote" TEXT,
    "closureNote" TEXT,
    "closedById" UUID,
    "closedAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" VARCHAR(80) NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_budget_lines" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "category" VARCHAR(120) NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_budget_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_milestones" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "startDate" DATE,
    "dueDate" DATE,
    "status" "ProjectMilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_tasks" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "milestoneId" UUID,
    "title" VARCHAR(240) NOT NULL,
    "description" TEXT,
    "assigneeUserId" UUID,
    "status" "ProjectTaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "dueDate" DATE,
    "completedAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_documents" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "category" VARCHAR(80) NOT NULL,
    "displayName" VARCHAR(240) NOT NULL,
    "storageKey" VARCHAR(512) NOT NULL,
    "mimeType" VARCHAR(120) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_audit_events" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "eventType" "ProjectAuditEventType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_companyId_status_idx" ON "projects"("companyId", "status");

-- CreateIndex
CREATE INDEX "projects_companyId_branchId_status_idx" ON "projects"("companyId", "branchId", "status");

-- CreateIndex
CREATE INDEX "projects_companyId_customerId_idx" ON "projects"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "projects_companyId_projectManagerId_idx" ON "projects"("companyId", "projectManagerId");

-- CreateIndex
CREATE UNIQUE INDEX "projects_companyId_id_key" ON "projects"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_companyId_branchId_projectNumber_key" ON "projects"("companyId", "branchId", "projectNumber");

-- CreateIndex
CREATE INDEX "project_members_companyId_userId_idx" ON "project_members"("companyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_companyId_id_key" ON "project_members"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_projectId_userId_key" ON "project_members"("projectId", "userId");

-- CreateIndex
CREATE INDEX "project_budget_lines_companyId_projectId_idx" ON "project_budget_lines"("companyId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "project_budget_lines_projectId_position_key" ON "project_budget_lines"("projectId", "position");

-- CreateIndex
CREATE INDEX "project_milestones_companyId_projectId_status_idx" ON "project_milestones"("companyId", "projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "project_milestones_companyId_id_key" ON "project_milestones"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "project_milestones_projectId_position_key" ON "project_milestones"("projectId", "position");

-- CreateIndex
CREATE INDEX "project_tasks_companyId_projectId_status_idx" ON "project_tasks"("companyId", "projectId", "status");

-- CreateIndex
CREATE INDEX "project_tasks_companyId_assigneeUserId_idx" ON "project_tasks"("companyId", "assigneeUserId");

-- CreateIndex
CREATE UNIQUE INDEX "project_tasks_companyId_id_key" ON "project_tasks"("companyId", "id");

-- CreateIndex
CREATE INDEX "project_documents_companyId_projectId_createdAt_idx" ON "project_documents"("companyId", "projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "project_documents_companyId_id_key" ON "project_documents"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "project_documents_companyId_storageKey_key" ON "project_documents"("companyId", "storageKey");

-- CreateIndex
CREATE INDEX "project_audit_events_companyId_projectId_createdAt_idx" ON "project_audit_events"("companyId", "projectId", "createdAt");

-- CreateIndex
CREATE INDEX "quotation_documents_companyId_projectId_idx" ON "quotation_documents"("companyId", "projectId");

-- CreateIndex
CREATE INDEX "commercial_documents_companyId_projectId_idx" ON "commercial_documents"("companyId", "projectId");

-- AddForeignKey
ALTER TABLE "quotation_documents" ADD CONSTRAINT "quotation_documents_companyId_projectId_fkey" FOREIGN KEY ("companyId", "projectId") REFERENCES "projects"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "commercial_documents" ADD CONSTRAINT "commercial_documents_companyId_projectId_fkey" FOREIGN KEY ("companyId", "projectId") REFERENCES "projects"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_companyId_branchId_fkey" FOREIGN KEY ("companyId", "branchId") REFERENCES "branches"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_companyId_customerId_fkey" FOREIGN KEY ("companyId", "customerId") REFERENCES "customers"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_companyId_projectManagerId_fkey" FOREIGN KEY ("companyId", "projectManagerId") REFERENCES "users"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_companyId_createdById_fkey" FOREIGN KEY ("companyId", "createdById") REFERENCES "users"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_companyId_closedById_fkey" FOREIGN KEY ("companyId", "closedById") REFERENCES "users"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_companyId_projectId_fkey" FOREIGN KEY ("companyId", "projectId") REFERENCES "projects"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_companyId_userId_fkey" FOREIGN KEY ("companyId", "userId") REFERENCES "users"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "project_budget_lines" ADD CONSTRAINT "project_budget_lines_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "project_budget_lines" ADD CONSTRAINT "project_budget_lines_companyId_projectId_fkey" FOREIGN KEY ("companyId", "projectId") REFERENCES "projects"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_companyId_projectId_fkey" FOREIGN KEY ("companyId", "projectId") REFERENCES "projects"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_companyId_createdById_fkey" FOREIGN KEY ("companyId", "createdById") REFERENCES "users"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_companyId_projectId_fkey" FOREIGN KEY ("companyId", "projectId") REFERENCES "projects"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_companyId_milestoneId_fkey" FOREIGN KEY ("companyId", "milestoneId") REFERENCES "project_milestones"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_companyId_assigneeUserId_fkey" FOREIGN KEY ("companyId", "assigneeUserId") REFERENCES "users"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_companyId_createdById_fkey" FOREIGN KEY ("companyId", "createdById") REFERENCES "users"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_companyId_projectId_fkey" FOREIGN KEY ("companyId", "projectId") REFERENCES "projects"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_companyId_uploadedById_fkey" FOREIGN KEY ("companyId", "uploadedById") REFERENCES "users"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "project_audit_events" ADD CONSTRAINT "project_audit_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "project_audit_events" ADD CONSTRAINT "project_audit_events_companyId_projectId_fkey" FOREIGN KEY ("companyId", "projectId") REFERENCES "projects"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "project_audit_events" ADD CONSTRAINT "project_audit_events_companyId_actorUserId_fkey" FOREIGN KEY ("companyId", "actorUserId") REFERENCES "users"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

