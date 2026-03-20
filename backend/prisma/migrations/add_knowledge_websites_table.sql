-- Add KnowledgeWebsites table for website-based knowledge resources
CREATE TABLE "knowledge_websites" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "knowledge_base_id" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "title" TEXT,
  "status" TEXT NOT NULL DEFAULT 'processing',
  "scraped_content" TEXT,
  "chunk_count" INTEGER NOT NULL DEFAULT 0,
  "metadata_json" JSONB,
  "error_message" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "knowledge_websites_knowledge_base_id_fkey" 
    FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_base"("id") ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX "knowledge_websites_tenant_id_idx" ON "knowledge_websites"("tenant_id");
CREATE INDEX "knowledge_websites_knowledge_base_id_idx" ON "knowledge_websites"("knowledge_base_id");
CREATE INDEX "knowledge_websites_status_idx" ON "knowledge_websites"("status");

-- Update knowledge_base to include relationship to websites (already done in schema)
