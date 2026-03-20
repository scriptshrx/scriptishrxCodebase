const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Web Scraper Service - Extracts content from websites
 */

const DEFAULT_TIMEOUT = 10000; // 10 seconds
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

/**
 * Scrape website and extract main content
 */
async function scrapeWebsite(url) {
    try {
        console.log(`[Web Scraper] Starting scrape of ${url}`);

        // Validate URL
        const urlObj = new URL(url);
        const finalUrl = urlObj.toString();

        // Fetch page with timeout
        const response = await axios.get(finalUrl, {
            headers: {
                'User-Agent': DEFAULT_USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            },
            timeout: DEFAULT_TIMEOUT,
            maxRedirects: 5,
            validateStatus: (status) => status >= 200 && status < 500
        });

        if (response.status === 404 || response.status === 403) {
            throw new Error(`HTTP ${response.status}: Page not accessible`);
        }

        const html = response.data;

        // Parse HTML and extract content
        const $ = cheerio.load(html);
        
        // Extract title
        let title = $('title').text().trim() || $('meta[property="og:title"]').attr('content') || '';

        // Extract main content
        const content = extractContent($);

        console.log(`[Web Scraper] Successfully scraped ${url}, extracted ${content.length} characters`);

        return {
            success: true,
            title,
            url: finalUrl,
            content,
            contentLength: content.length
        };
    } catch (err) {
        console.error(`[Web Scraper] Error scraping ${url}:`, err.message);
        throw new Error(`Failed to scrape website: ${err.message}`);
    }
}

/**
 * Extract main content from cheerio-parsed HTML
 */
function extractContent($) {
    // Remove script, style, and other non-visible elements
    $('script, style, meta, link, noscript, iframe, svg').remove();

    // Remove common navigation/footer elements
    $('.nav, .navbar, .navigation, footer, .footer, .sidebar, .advertisement, .ads, .comment').remove();

    // Try to find main content area
    let content = '';

    // Priority order for content extraction
    const selectors = [
        'main',
        'article',
        '[role="main"]',
        '.main-content',
        '.content',
        '.post',
        '.entry',
        '#content'
    ];

    for (const selector of selectors) {
        const found = $(selector).first();
        if (found.length && found.text().trim().length > 100) {
            content = found.html() || '';
            break;
        }
    }

    // Fallback to body if no suitable container found
    if (!content) {
        content = $('body').html() || '';
    }

    // Convert HTML to plain text
    let text = cheerio.load(content).text();

    // Clean up whitespace
    text = text
        .replace(/\r\n/g, '\n')
        .replace(/\n\s*\n/g, '\n')
        .replace(/\s{2,}/g, ' ')
        .trim();

    return text;
}

/**
 * Extract links from a website
 */
async function extractLinks(url) {
    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': DEFAULT_USER_AGENT },
            timeout: DEFAULT_TIMEOUT,
            maxRedirects: 5
        });

        const $ = cheerio.load(response.data);
        const baseUrl = new URL(url);
        const links = [];

        $('a[href]').each((_, el) => {
            let href = $(el).attr('href');
            if (!href) return;

            try {
                const absoluteUrl = new URL(href, baseUrl).toString();
                // Only include links from same domain
                if (new URL(absoluteUrl).hostname === baseUrl.hostname) {
                    links.push(absoluteUrl);
                }
            } catch {
                // Invalid URL, skip
            }
        });

        return [...new Set(links)]; // Remove duplicates
    } catch (err) {
        console.error(`[Web Scraper] Error extracting links from ${url}:`, err.message);
        return [];
    }
}

module.exports = {
    scrapeWebsite,
    extractContent,
    extractLinks
};
