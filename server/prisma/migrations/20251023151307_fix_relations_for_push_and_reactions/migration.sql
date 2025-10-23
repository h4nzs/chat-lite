/*
  Warnings:

  - You are about to drop the column `pushSubscription` on the `User` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "SessionKey" DROP CONSTRAINT "SessionKey_userId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "pushSubscription";

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "Conversation_createdAt_idx" ON "Conversation"("createdAt");

-- CreateIndex
CREATE INDEX "Conversation_isGroup_idx" ON "Conversation"("isGroup");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE INDEX "MessageReaction_emoji_idx" ON "MessageReaction"("emoji");

-- CreateIndex
CREATE INDEX "MessageReaction_createdAt_idx" ON "MessageReaction"("createdAt");

-- CreateIndex
CREATE INDEX "MessageStatus_status_idx" ON "MessageStatus"("status");

-- CreateIndex
CREATE INDEX "MessageStatus_updatedAt_idx" ON "MessageStatus"("updatedAt");

-- CreateIndex
CREATE INDEX "Participant_joinedAt_idx" ON "Participant"("joinedAt");

-- CreateIndex
CREATE INDEX "Participant_lastReadMsgId_idx" ON "Participant"("lastReadMsgId");

-- CreateIndex
CREATE INDEX "RefreshToken_jti_idx" ON "RefreshToken"("jti");

-- CreateIndex
CREATE INDEX "RefreshToken_revokedAt_idx" ON "RefreshToken"("revokedAt");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
