ALTER TABLE "Attachment" ADD COLUMN "clientId" TEXT;

CREATE UNIQUE INDEX "Attachment_uploaderId_clientId_key"
ON "Attachment"("uploaderId", "clientId");
