-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Strategy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parameters" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Strategy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parameters" JSONB,
    "performance" JSONB,
    "modelPath" TEXT,
    "strategyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Agent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Agent_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "episode" INTEGER NOT NULL,
    "totalReward" REAL NOT NULL,
    "steps" INTEGER NOT NULL,
    "winRate" REAL NOT NULL,
    "sharpeRatio" REAL NOT NULL,
    "maxDrawdown" REAL NOT NULL,
    "parameters" JSONB,
    "metrics" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingResult_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LossAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "lossAmount" REAL NOT NULL,
    "lossReason" TEXT NOT NULL,
    "marketConditions" JSONB,
    "agentDecision" JSONB,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "category" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LossAnalysis_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NewsArticle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "source" TEXT,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentiment" REAL,
    "category" TEXT,
    "symbols" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MarketData" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "open" REAL NOT NULL,
    "high" REAL NOT NULL,
    "low" REAL NOT NULL,
    "close" REAL NOT NULL,
    "volume" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Indicator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "atr" REAL,
    "cci" REAL,
    "rsi" REAL,
    "macd" REAL,
    "macdSignal" REAL,
    "macdHistogram" REAL,
    "bbUpper" REAL,
    "bbMiddle" REAL,
    "bbLower" REAL,
    "swingHigh" REAL,
    "swingLow" REAL,
    "bullishEngulfing" BOOLEAN DEFAULT false,
    "bearishEngulfing" BOOLEAN DEFAULT false,
    "doji" BOOLEAN DEFAULT false,
    "sma20" REAL,
    "sma50" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Indicator_timestamp_symbol_timeframe_fkey" FOREIGN KEY ("timestamp", "symbol", "timeframe") REFERENCES "MarketData" ("timestamp", "symbol", "timeframe") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApiConfiguration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "sandbox" BOOLEAN NOT NULL DEFAULT true,
    "rateLimit" INTEGER NOT NULL DEFAULT 1000,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "backtestId" TEXT,
    "symbol" TEXT NOT NULL,
    "exchangeOrderId" TEXT,
    "entryTime" DATETIME NOT NULL,
    "exitTime" DATETIME,
    "entryPrice" REAL NOT NULL,
    "exitPrice" REAL,
    "stopLoss" REAL NOT NULL,
    "takeProfit" REAL NOT NULL,
    "positionSize" REAL NOT NULL,
    "action" TEXT NOT NULL,
    "pnl" REAL,
    "pnlPercent" REAL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Trade_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Trade_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Trade_backtestId_fkey" FOREIGN KEY ("backtestId") REFERENCES "Backtest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Trade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Backtest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "symbol" TEXT NOT NULL,
    "initialBalance" REAL NOT NULL,
    "finalBalance" REAL NOT NULL,
    "totalTrades" INTEGER NOT NULL,
    "winningTrades" INTEGER NOT NULL,
    "losingTrades" INTEGER NOT NULL,
    "winRate" REAL NOT NULL,
    "totalPnl" REAL NOT NULL,
    "maxDrawdown" REAL NOT NULL,
    "sharpeRatio" REAL NOT NULL,
    "profitFactor" REAL NOT NULL,
    "avgWin" REAL NOT NULL,
    "avgLoss" REAL NOT NULL,
    "monthlyPerformance" JSONB,
    "riskMetrics" JSONB,
    "tradeDistribution" JSONB,
    "enhancedMetrics" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Backtest_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Backtest_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "data" JSONB,
    "insights" JSONB,
    "recommendations" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Analysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AILearningData" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "learningType" TEXT NOT NULL,
    "inputData" JSONB,
    "outputData" JSONB,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AILearningData_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CoverageManifest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL DEFAULT 'binance',
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastCoveredTo" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IngestJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "manifestId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "rangeStart" DATETIME NOT NULL,
    "rangeEnd" DATETIME NOT NULL,
    "inserted" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IngestJob_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "CoverageManifest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "runType" TEXT NOT NULL,
    "params" JSONB,
    "metrics" JSONB,
    "artifactPath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PendingOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "exchangeOrderId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "price" REAL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TradePrediction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "features" JSONB,
    "action" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "stopLoss" REAL,
    "takeProfit" REAL,
    "meta" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TradePrediction_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TradePrediction_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeedbackEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "predictionId" TEXT,
    "tradeId" TEXT,
    "outcome" JSONB,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedbackEvent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeedbackEvent_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "TradePrediction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FeedbackEvent_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_MarketDataToNewsArticle" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_MarketDataToNewsArticle_A_fkey" FOREIGN KEY ("A") REFERENCES "MarketData" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_MarketDataToNewsArticle_B_fkey" FOREIGN KEY ("B") REFERENCES "NewsArticle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_strategyId_key" ON "Agent"("strategyId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketData_timestamp_symbol_timeframe_key" ON "MarketData"("timestamp", "symbol", "timeframe");

-- CreateIndex
CREATE UNIQUE INDEX "CoverageManifest_symbol_timeframe_exchangeId_startDate_endDate_key" ON "CoverageManifest"("symbol", "timeframe", "exchangeId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "PendingOrder_exchangeOrderId_key" ON "PendingOrder"("exchangeOrderId");

-- CreateIndex
CREATE INDEX "TradePrediction_agentId_timestamp_idx" ON "TradePrediction"("agentId", "timestamp");

-- CreateIndex
CREATE INDEX "TradePrediction_strategyId_timestamp_idx" ON "TradePrediction"("strategyId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "_MarketDataToNewsArticle_AB_unique" ON "_MarketDataToNewsArticle"("A", "B");

-- CreateIndex
CREATE INDEX "_MarketDataToNewsArticle_B_index" ON "_MarketDataToNewsArticle"("B");
