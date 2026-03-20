// backend/src/services/ragService.js
/**
 * Enhanced RAG Service with Semantic Search
 * Features:
 * - OpenAI embeddings for semantic similarity
 * - Tenant-specific FAQ retrieval
 * - Cosine similarity matching
 * - Fallback to keyword search
 */

const OpenAI = require('openai');
const prisma = require('../lib/prisma');

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// In-memory embedding cache (per tenant)
const embeddingCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Default FAQs (fallback if tenant has none)
const defaultFaqs = [
  {
    question: "Services & Pricing",
    answer: "Here's a simple overview of our main services and their prices:\n\n**Wellness Lounge — $49.99 for 2 hours**\nRelax, enjoy refreshments, use fast WiFi, and charge your devices in a comfortable travel-friendly space.\n\n**Luggage Drop-Off — $4.99 per hour**\nSafe and secure short-term luggage storage so you can explore Chicago hands-free.\n\n**Hourly Workspace — $24.99 per hour**\nA quiet private desk with fast WiFi, and plenty of power outlets.",
    keywords: ['services', 'pricing', 'cost', 'how much', 'lounge', 'luggage', 'workspace']
  },
  {
    question: "Booking & Contact",
    answer: "To book an appointment, you can email us at **info@scriptishrx.net** or call us at **+1 (872) 873-2880**. We'll be happy to assist you with scheduling!",
    keywords: ['book', 'appointment', 'contact', 'email', 'phone', 'schedule']
  },
  {
    question: "Office Location",
    answer: "Our office is located at **111 N Wabash Ave, Chicago, IL 60602** — in the Garland Building, downtown Chicago.",
    keywords: ['location', 'address', 'where', 'directions']
  }
];

/**
 * Generate embedding for a text using OpenAI
 */
async function generateEmbedding(text) {
  if (!openai) return null;

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float'
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('[RAG] Embedding generation error:', error.message);
    return null;
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Get FAQs for a tenant (from database or defaults)
 */
async function getTenantFaqs(tenantId) {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { aiConfig: true, name: true }
    });

    const aiConfig = tenant?.aiConfig || {};
    const faqs = aiConfig.faqs || [];

    if (faqs.length > 0) {
      return { faqs, businessName: tenant.name };
    }

    return { faqs: defaultFaqs, businessName: tenant?.name || 'the business' };
  } catch (error) {
    console.error('[RAG] Error fetching tenant FAQs:', error);
    return { faqs: defaultFaqs, businessName: 'the business' };
  }
}

/**
 * Get or generate embeddings for FAQs
 */
async function getFaqEmbeddings(tenantId, faqs) {
  const cacheKey = tenantId || 'default';
  const cached = embeddingCache.get(cacheKey);

  // Check cache validity
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.embeddings;
  }

  // Generate embeddings for all FAQs
  const embeddings = [];
  for (const faq of faqs) {
    const text = `${faq.question}: ${faq.answer}`;
    const embedding = await generateEmbedding(text);
    embeddings.push({
      faq,
      embedding,
      text
    });
  }

  // Cache the embeddings
  embeddingCache.set(cacheKey, {
    embeddings,
    timestamp: Date.now()
  });

  return embeddings;
}

/**
 * Semantic search for relevant FAQs
 */
async function semanticSearch(query, tenantId, topK = 3) {
  const { faqs, businessName } = await getTenantFaqs(tenantId);

  if (!openai || faqs.length === 0) {
    return { results: [], businessName };
  }

  // Get query embedding
  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding) {
    return { results: [], businessName };
  }

  // Get FAQ embeddings
  const faqEmbeddings = await getFaqEmbeddings(tenantId, faqs);

  // Calculate similarities
  const scored = faqEmbeddings
    .filter(item => item.embedding)
    .map(item => ({
      faq: item.faq,
      score: cosineSimilarity(queryEmbedding, item.embedding)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // Filter by threshold
  const threshold = 0.3;
  const results = scored.filter(item => item.score >= threshold);

  return { results, businessName };
}

/**
 * Search tenant knowledge chunks using pgvector similarity
 */
async function searchKnowledgeChunks(query, tenantId, topK = 3) {
  if (!openai) return [];
  try {
    const queryEmbedding = await generateEmbedding(query);
    if (!queryEmbedding) return [];

    const rows = await prisma.$queryRaw`
      SELECT id, content, chunk_index
      FROM knowledge_chunks
      WHERE tenant_id = ${tenantId}
      ORDER BY embedding <#> ${queryEmbedding}::vector
      LIMIT ${topK}
    `;
    return rows;
  } catch (err) {
    console.error('[RAG] knowledge chunk search error', err.message);
    return [];
  }
}

module.exports = {
  query,
  semanticSearch,
  keywordSearch,
  searchKnowledgeChunks
};

/**
 * Keyword-based search (fallback)
 */
async function keywordSearch(query, tenantId) {
  const { faqs, businessName } = await getTenantFaqs(tenantId);
  const lowerQuery = query.toLowerCase();

  const results = faqs.filter(faq => {
    const keywords = faq.keywords || [];
    return keywords.some(kw => lowerQuery.includes(kw.toLowerCase())) ||
      faq.question?.toLowerCase().includes(lowerQuery) ||
      faq.answer?.toLowerCase().includes(lowerQuery);
  });

  return { results: results.map(faq => ({ faq, score: 0.5 })), businessName };
}

/**
 * Main query function - combines semantic and keyword search
 */
async function query(userMessage, tenantId = null) {
  if (!userMessage) return null;

  const { faqs, businessName } = await getTenantFaqs(tenantId);

  // Build system context
  let systemContext = `You are the AI Assistant for ${businessName}, a helpful, humble, and polite virtual assistant.
Your goal is to assist users with services, booking, location, directions, and general inquiries.

**Instructions:**
- Answer based on the Knowledge Base when possible.
- If asked something outside your knowledge, politely offer to connect them with a human agent.
- Be kind, humble, polite, and professional.
- Do NOT make up services or prices not provided.
`;

  // Try semantic search first against FAQ entries
  let searchResults = [];
  if (openai) {
    const semantic = await semanticSearch(userMessage, tenantId, 3);
    searchResults = semantic.results;
  }

  // also try searching any uploaded knowledge chunks (same embedding)
  let chunkResults = [];
  try {
    chunkResults = await searchKnowledgeChunks(userMessage, tenantId, 3);
  } catch (e) {
    console.warn('[RAG] chunk search failed:', e.message);
  }

  // if there are chunk results we will surface them separately later

  // Fallback to keyword search if no faq matches
  if (searchResults.length === 0) {
    const keyword = await keywordSearch(userMessage, tenantId);
    searchResults = keyword.results;
  }

  // Build context from search results and chunk results (chunks get precedence)
  if (chunkResults && chunkResults.length > 0) {
    systemContext += `\n**Relevant Document Snippets:**\n`;
    chunkResults.forEach(r => {
      systemContext += `- ${r.content}\n\n`;
    });
  }

  if (searchResults.length > 0) {
    systemContext += `\n**Relevant Knowledge (FAQs):**\n`;
    searchResults.forEach(({ faq, score }) => {
      systemContext += `- **${faq.question}**: ${faq.answer}\n\n`;
    });
  } else if (!(chunkResults && chunkResults.length > 0)) {
    // Include all FAQs if no specific match anywhere
    systemContext += `\n**Knowledge Base:**\n`;
    faqs.forEach(faq => {
      systemContext += `- **${faq.question}**: ${faq.answer}\n\n`;
    });
  }

  // Generate response with OpenAI
  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: systemContext },
          { role: "user", content: userMessage }
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      const answer = completion.choices[0]?.message?.content;
      if (answer) return answer;

    } catch (error) {
      console.error("[RAG] OpenAI Error:", error.message);
    }
  }

  // Keyword fallback response
  if (searchResults.length > 0) {
    return searchResults[0].faq.answer + "\n\n*(Automated Reply)*";
  }

  return `I'm sorry, I couldn't find a specific answer to that. Please contact us at info@scriptishrx.net or call +1 (872) 873-2880 for assistance.`;
}

/**
 * Get context for voice agent (returns structured data)
 */
async function getContextForVoice(query, tenantId) {
  try {
    // First try semantic search on FAQs and knowledge chunks
    const { results, businessName } = await semanticSearch(query, tenantId, 2);

    if (results.length > 0) {
      return {
        found: true,
        answer: results[0].faq.answer,
        confidence: results[0].score,
        source: 'knowledge_base'
      };
    }

    // If no FAQ results, try searching knowledge chunks
    const chunks = await searchKnowledgeChunks(query, tenantId, 2);
    if (chunks.length > 0) {
      return {
        found: true,
        answer: chunks[0].content,
        confidence: 0.7,
        source: 'knowledge_chunks'
      };
    }

    // If still no results, try searching website content
    const websiteContext = await searchWebsiteContent(query, tenantId, 2);
    if (websiteContext.found) {
      return websiteContext;
    }

    return {
      found: false,
      message: 'No specific information found',
      source: 'none'
    };
  } catch (err) {
    console.error('[RAG] getContextForVoice error:', err.message);
    return {
      found: false,
      message: 'Error retrieving context',
      source: 'none'
    };
  }
}

/**
 * Search website content for relevant information
 */
async function searchWebsiteContent(query, tenantId, topK = 2) {
  try {
    // Get all websites for the tenant with completed scraping
    const websites = await prisma.knowledgeWebsites.findMany({
      where: {
        tenantId,
        status: 'completed',
        scrapedContent: { not: null }
      }
    });

    if (websites.length === 0) {
      return { found: false };
    }

    // Simple content search - look for keyword matches in scraped content
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 2);

    let bestMatch = null;
    let bestScore = 0;

    for (const website of websites) {
      const contentLower = (website.scrapedContent || '').toLowerCase();
      
      // Score based on how many query terms appear in content
      let score = 0;
      let contextMatch = '';

      for (const term of queryTerms) {
        const matches = contentLower.split(term).length - 1;
        score += matches;
      }

      // If we found matches, extract relevant context
      if (score > 0) {
        // Find a sentence or paragraph that contains at least one query term
        const sentences = (website.scrapedContent || '').split(/[.!?]\s+/);
        for (const sentence of sentences) {
          if (queryTerms.some(term => sentence.toLowerCase().includes(term))) {
            contextMatch = sentence.trim();
            break;
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = {
            content: contextMatch || website.scrapedContent.substring(0, 500),
            url: website.url,
            title: website.title
          };
        }
      }
    }

    if (bestMatch && bestScore > 0) {
      return {
        found: true,
        answer: bestMatch.content,
        url: bestMatch.url,
        title: bestMatch.title,
        confidence: Math.min(bestScore / queryTerms.length, 1),
        source: 'website'
      };
    }

    return { found: false };
  } catch (err) {
    console.error('[RAG] searchWebsiteContent error:', err.message);
    return { found: false };
  }
}

/**
 * Clear embedding cache for a tenant (call after FAQ updates)
 */
function clearCache(tenantId) {
  if (tenantId) {
    embeddingCache.delete(tenantId);
  } else {
    embeddingCache.clear();
  }
}

module.exports = {
  query,
  semanticSearch,
  keywordSearch,
  searchKnowledgeChunks,
  getContextForVoice,
  searchWebsiteContent,
  generateEmbedding,
  clearCache,
  getTenantFaqs
};
