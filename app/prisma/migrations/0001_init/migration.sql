-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."CompetitionStatus" AS ENUM ('LOBBY', 'RUNNING', 'FINISHED');

-- CreateEnum
CREATE TYPE "public"."Side" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "public"."OrderType" AS ENUM ('LIMIT', 'MARKET');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('OPEN', 'PARTIAL', 'FILLED', 'CANCELLED', 'UNFILLED');

-- CreateEnum
CREATE TYPE "public"."Reliability" AS ENUM ('ACCURATE', 'INCOMPLETE', 'OUTDATED', 'MISLEADING');

-- CreateEnum
CREATE TYPE "public"."Direction" AS ENUM ('UP', 'DOWN');

-- CreateTable
CREATE TABLE "public"."Competition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "public"."CompetitionStatus" NOT NULL DEFAULT 'LOBBY',
    "scenarioVersion" TEXT NOT NULL,
    "scenarioHash" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Team" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "sessionToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Stock" (
    "competitionId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startPriceCents" INTEGER NOT NULL,
    "volatility" TEXT NOT NULL,

    CONSTRAINT "Stock_pkey" PRIMARY KEY ("competitionId","ticker")
);

-- CreateTable
CREATE TABLE "public"."Round" (
    "competitionId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "hiddenState" TEXT NOT NULL,
    "fundamentals" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "voidedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("competitionId","number")
);

-- CreateTable
CREATE TABLE "public"."PublicNewsItem" (
    "id" SERIAL NOT NULL,
    "competitionId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "PublicNewsItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PrivateSignal" (
    "competitionId" TEXT NOT NULL,
    "signalKey" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "ticker" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "reliability" "public"."Reliability" NOT NULL,
    "impliedDirection" INTEGER NOT NULL,
    "targetRound" INTEGER NOT NULL,
    "groups" TEXT[],
    "truth" TEXT NOT NULL,

    CONSTRAINT "PrivateSignal_pkey" PRIMARY KEY ("competitionId","signalKey")
);

-- CreateTable
CREATE TABLE "public"."ResearchAction" (
    "id" SERIAL NOT NULL,
    "competitionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "researchKey" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Forecast" (
    "competitionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "ticker" TEXT NOT NULL,
    "direction" "public"."Direction" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Forecast_pkey" PRIMARY KEY ("competitionId","teamId","roundNumber")
);

-- CreateTable
CREATE TABLE "public"."Order" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "side" "public"."Side" NOT NULL,
    "type" "public"."OrderType" NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "filled" INTEGER NOT NULL,
    "status" "public"."OrderStatus" NOT NULL,
    "seq" INTEGER NOT NULL,
    "clientOrderId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TradeExecution" (
    "competitionId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "ticker" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "buyTeamId" TEXT NOT NULL,
    "sellTeamId" TEXT NOT NULL,
    "buyOrderId" TEXT NOT NULL,
    "sellOrderId" TEXT NOT NULL,
    "aggressor" "public"."Side" NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL,
    "voided" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TradeExecution_pkey" PRIMARY KEY ("competitionId","id")
);

-- CreateTable
CREATE TABLE "public"."Holding" (
    "competitionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "shares" INTEGER NOT NULL,
    "avgCostCents" DOUBLE PRECISION NOT NULL,
    "realizedCents" DOUBLE PRECISION NOT NULL,
    "asOfRound" INTEGER NOT NULL,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("competitionId","teamId","ticker")
);

-- CreateTable
CREATE TABLE "public"."PortfolioSnapshot" (
    "competitionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "cashCents" INTEGER NOT NULL,
    "holdingsValueCents" INTEGER NOT NULL,
    "equityCents" INTEGER NOT NULL,
    "realizedCents" INTEGER NOT NULL,
    "unrealizedCents" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "PortfolioSnapshot_pkey" PRIMARY KEY ("competitionId","teamId","roundNumber")
);

-- CreateTable
CREATE TABLE "public"."MarketEvent" (
    "id" SERIAL NOT NULL,
    "competitionId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "ticker" TEXT,
    "kind" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "competitionId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("competitionId","seq")
);

-- CreateTable
CREATE TABLE "public"."EngineCommand" (
    "competitionId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EngineCommand_pkey" PRIMARY KEY ("competitionId","seq")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_competitionId_number_key" ON "public"."Team"("competitionId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Team_competitionId_code_key" ON "public"."Team"("competitionId", "code");

-- CreateIndex
CREATE INDEX "PublicNewsItem_competitionId_roundNumber_idx" ON "public"."PublicNewsItem"("competitionId", "roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchAction_competitionId_teamId_researchKey_key" ON "public"."ResearchAction"("competitionId", "teamId", "researchKey");

-- CreateIndex
CREATE INDEX "Order_competitionId_teamId_idx" ON "public"."Order"("competitionId", "teamId");

-- CreateIndex
CREATE INDEX "Order_competitionId_ticker_status_idx" ON "public"."Order"("competitionId", "ticker", "status");

-- CreateIndex
CREATE INDEX "TradeExecution_competitionId_roundNumber_ticker_idx" ON "public"."TradeExecution"("competitionId", "roundNumber", "ticker");

-- CreateIndex
CREATE INDEX "MarketEvent_competitionId_roundNumber_idx" ON "public"."MarketEvent"("competitionId", "roundNumber");

-- AddForeignKey
ALTER TABLE "public"."Team" ADD CONSTRAINT "Team_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "public"."Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Stock" ADD CONSTRAINT "Stock_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "public"."Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Round" ADD CONSTRAINT "Round_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "public"."Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PublicNewsItem" ADD CONSTRAINT "PublicNewsItem_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "public"."Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrivateSignal" ADD CONSTRAINT "PrivateSignal_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "public"."Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchAction" ADD CONSTRAINT "ResearchAction_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "public"."Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchAction" ADD CONSTRAINT "ResearchAction_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Forecast" ADD CONSTRAINT "Forecast_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "public"."Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Forecast" ADD CONSTRAINT "Forecast_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "public"."Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TradeExecution" ADD CONSTRAINT "TradeExecution_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "public"."Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Holding" ADD CONSTRAINT "Holding_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "public"."Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Holding" ADD CONSTRAINT "Holding_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PortfolioSnapshot" ADD CONSTRAINT "PortfolioSnapshot_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "public"."Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PortfolioSnapshot" ADD CONSTRAINT "PortfolioSnapshot_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketEvent" ADD CONSTRAINT "MarketEvent_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "public"."Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "public"."Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EngineCommand" ADD CONSTRAINT "EngineCommand_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "public"."Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

