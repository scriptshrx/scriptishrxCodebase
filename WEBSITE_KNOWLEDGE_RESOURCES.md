# Website Link Knowledge Resources - Implementation Guide

## Overview
This feature allows users to attach website links as knowledge resources for voice agents. The backend automatically scrapes the linked websites and makes the content available for voice agents to use during inference.

## What Was Implemented

### 1. Frontend Changes (`/frontend/src/app/dashboard/knowledgeResources/page.tsx`)
- **New State Management**: Added states for website URLs, upload status, and errors
- **New Type**: `KnowledgeWebsite` interface for type safety
- **Website Input Section**: UI for adding website URLs with validation
- **Website List Display**: Shows all added websites with their scraping status
- **Status Polling**: Auto-refreshes website status while scraping is in progress
- **Delete Functionality**: Users can delete website resources

### 2. Backend Database Changes
- **New Schema Model**: `KnowledgeWebsites` table added to Prisma schema
- **Database Migration**: SQL migration file for creating the `knowledge_websites` table
- **Relationships**: Linked websites to KnowledgeBase with cascade delete

### 3. Backend Services

#### Web Scraper Service (`/backend/src/services/webScraperService.js`)
- **Scrapes websites** using axios + cheerio
- **Extracts clean content** from HTML (removes nav, scripts, styles, etc.)
- **Smart content detection**: Tries to find main content area using semantic selectors
- **Link extraction**: Can extract all internal links from a website
- **Error handling**: Graceful handling of unreachable or invalid URLs

#### Knowledge Base Controller Updates
- **`addWebsite()`**: Creates website resource and triggers scraping
- **`listWebsites()`**: Returns all websites for a knowledge base
- **`deleteWebsite()`**: Removes website resources
- **`scrapeAndIngestWebsite()`**: Async background task that scrapes and updates status

#### RAG Service Enhancements (`/backend/src/services/ragService.js`)
- **`searchWebsiteContent()`**: New function for searching scraped website content
- **`getContextForVoice()` Enhanced**: Now searches through:
  1. FAQ/Knowledge Bases
  2. Knowledge Chunks
  3. Website Content
- **Smart context extraction**: Returns relevant excerpts from websites with source attribution

### 4. API Endpoints

```
GET    /api/knowledge-bases/:knowledgeBaseId/websites
       → List all websites for a knowledge base

POST   /api/knowledge-bases/:knowledgeBaseId/websites
       → Add a new website (triggers async scraping)
       Body: { url: "https://example.com" }

DELETE /api/knowledge-bases/:knowledgeBaseId/websites/:websiteId
       → Delete a website resource
```

## How It Works

### Flow Diagram
```
1. User adds website URL → Frontend validates URL
   ↓
2. Request sent to backend → Creates KnowledgeWebsite record with "processing" status
   ↓
3. Response sent immediately (202 Accepted) → Frontend starts polling for status
   ↓
4. Background task starts → Web scraper fetches and parses website
   ↓
5. Content extracted → Stored in database with "completed" or "failed" status
   ↓
6. Voice agent makes request → RAG searches website content
   ↓
7. Relevant context returned → Voice agent includes in response
```

### Voice Agent Integration
When a voice agent processes a customer inquiry:
1. `getContextForVoice()` is called with the query
2. It searches in priority order:
   - FAQs (semantic search)
   - Knowledge Chunks (from uploaded documents)
   - Website Content (keyword matching)
3. First successful match is returned with source attribution
4. Voice agent uses this context to generate responses

## Required Dependencies

The following packages must be installed (already in `package.json`):
```json
{
  "axios": "^1.13.2",
  "cheerio": "^1.0.0-rc.12"
}
```

## Setup Instructions

### 1. Install Dependencies (if not already installed)
```bash
cd backend
npm install axios cheerio
```

### 2. Run Database Migration
```bash
cd backend
npx prisma migrate dev
# OR
npx prisma db push
```

### 3. Restart Backend Server
```bash
npm start
```

## Status Values
- **processing**: Website is currently being scraped
- **completed**: Website successfully scraped and content available
- **failed**: Scraping failed (see error message)

## Important Notes

1. **URL Validation**: Both frontend and backend validate URLs before scraping
2. **Content Extraction**: The scraper intelligently removes navigation, scripts, and styling
3. **Error Handling**: Failed scrapes are logged with error messages shown to user
4. **Async Processing**: Scraping happens in background, doesn't block API response
5. **Tenant Isolation**: All website content is properly tenant-isolated
6. **Source Attribution**: Voice agent context includes website URL and title

## Limitations & Future Improvements

### Current Limitations
- Keyword-based search (not semantic/embedding-based for websites - can be enhanced)
- Single page scraping (doesn't recursively scrape subpages)
- No OCR for images with text
- 10-second timeout per page

### Future Enhancements
1. **Semantic Search**: Generate embeddings for website content for better matching
2. **Multi-page Scraping**: Crawl multiple pages of a domain
3. **Scheduled Updates**: Periodically re-scrape websites to keep content fresh
4. **Custom Selectors**: Allow users to specify content areas for scraping
5. **PDF/Image Handling**: Better handling of PDFs and images in scraped content
6. **Caching**: Cache scraped content to reduce repeated scraping

## Testing

You can test the feature with:
```bash
# Test website scraping
curl -X POST http://localhost:5000/api/knowledge-bases/KB_ID/websites \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# List websites
curl http://localhost:5000/api/knowledge-bases/KB_ID/websites \
  -H "Authorization: Bearer TOKEN"
```

## Troubleshooting

### Website stays in "processing" status
- Check backend logs for scraping errors
- Verify website is accessible and not blocked
- Check for timeout issues (may need to increase timeout)

### No context returned for voice agents
- Verify website has "completed" status
- Check that query terms match website content
- Try searching for exact keywords from the website

### "Invalid URL format" error
- Ensure URL includes protocol (http:// or https://)
- Check for spaces or special characters in URL

## Code References
- **Frontend**: [knowledgeResources/page.tsx](../../frontend/src/app/dashboard/knowledgeResources/page.tsx)
- **Backend Service**: [webScraperService.js](../../backend/src/services/webScraperService.js)
- **Controller**: [knowledgeBaseController.js](../../backend/src/controllers/knowledgeBaseController.js)
- **Routes**: [knowledgeBaseRoutes.js](../../backend/src/routes/knowledgeBaseRoutes.js)
- **RAG Integration**: [ragService.js](../../backend/src/services/ragService.js)
- **Schema**: [schema.prisma](../../backend/prisma/schema.prisma)
- **Migration**: [add_knowledge_websites_table.sql](../../backend/prisma/migrations/add_knowledge_websites_table.sql)
