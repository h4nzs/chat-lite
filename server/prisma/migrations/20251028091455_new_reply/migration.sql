-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "replied_to_id" TEXT;

-- CreateIndex
CREATE INDEX "Message_replied_to_id_idx" ON "Message"("replied_to_id");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_replied_to_id_fkey" FOREIGN KEY ("replied_to_id") REFERENCES "Message"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
