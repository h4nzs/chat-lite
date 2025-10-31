/*
  Warnings:

  - You are about to drop the column `sendReadReceipts` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "sendReadReceipts";
