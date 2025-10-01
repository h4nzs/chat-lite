-- AlterTable
ALTER TABLE "User" ADD COLUMN     "publicKey" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "encryptedSessionKey" TEXT,
ADD COLUMN     "sessionId" TEXT;

-- CreateTable
CREATE TABLE "SessionKey" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "SessionKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionKey_conversationId_idx" ON "SessionKey"("conversationId");

-- CreateIndex
CREATE INDEX "SessionKey_sessionId_idx" ON "SessionKey"("sessionId");

-- CreateIndex
CREATE INDEX "SessionKey_userId_idx" ON "SessionKey"("userId");

-- CreateIndex
CREATE INDEX "Message_sessionId_idx" ON "Message"("sessionId");

-- AddForeignKey
ALTER TABLE "SessionKey" ADD CONSTRAINT "SessionKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;