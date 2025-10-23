-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "creatorId" TEXT;

-- CreateTable
CREATE TABLE "UserHiddenConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,

    CONSTRAINT "UserHiddenConversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserHiddenConversation_userId_conversationId_key" ON "UserHiddenConversation"("userId", "conversationId");

-- AddForeignKey
ALTER TABLE "UserHiddenConversation" ADD CONSTRAINT "UserHiddenConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserHiddenConversation" ADD CONSTRAINT "UserHiddenConversation_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
