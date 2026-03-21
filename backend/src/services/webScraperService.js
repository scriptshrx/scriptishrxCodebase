const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');

/**
 * Web Scraper Service - Extracts content from websites
 */

const DEFAULT_TIMEOUT = 10000; // 10 seconds
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

/**
 * Find an installed Chromium/Chrome executable
 */
function findChromiumExecutable() {
    const possiblePaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/snap/bin/chromium',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ];

    // Try each possible path
    for (const path of possiblePaths) {
        try {
            execSync(`test -x "${path}"`, { stdio: 'ignore' });
            console.log(`[Web Scraper] Found Chrome/Chromium at: ${path}`);
            return path;
        } catch {
            // Path doesn't exist or not executable
        }
    }

    // Fallback: try using 'which' command on Unix systems
    try {
        const result = execSync('which google-chrome || which chromium-browser || which chromium', {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'ignore']
        }).trim();
        if (result) {
            console.log(`[Web Scraper] Found Chrome/Chromium via which: ${result}`);
            return result;
        }
    } catch {
        // which command failed
    }

    console.warn('[Web Scraper] Could not find Chrome/Chromium executable. Puppeteer will attempt default behavior.');
    return null;
}

/**
 * Scrape website and extract main content
 * Uses Puppeteer for JavaScript-rendered sites (Next.js, React, Vue, etc.)
 */
async function scrapeWebsite(url) {
    let browser = null;
    try {
        console.log(`[Web Scraper] Starting scrape of ${url}`);

        // Validate URL
        const urlObj = new URL(url);
        const finalUrl = urlObj.toString();

        // Launch headless browser to handle JavaScript-rendered content
        console.log('[Web Scraper] Launching headless browser...');
        const launchOptions = {
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        };
        
        // Use system-installed Chrome/Chromium if available
        const chromePath = findChromiumExecutable();
        if (chromePath) {
            launchOptions.executablePath = chromePath;
        }
        
        browser = await puppeteer.launch(launchOptions);

        const page = await browser.newPage();
        
        // Set timeout and user agent
        page.setDefaultNavigationTimeout(DEFAULT_TIMEOUT);
        page.setDefaultTimeout(DEFAULT_TIMEOUT);
        await page.setUserAgent(DEFAULT_USER_AGENT);

        // Navigate to page and wait for content to load
        console.log(`[Web Scraper] Navigating to ${finalUrl}`);
        const response = await page.goto(finalUrl, {
            waitUntil: 'networkidle2',
            timeout: DEFAULT_TIMEOUT
        });

        if (!response || response.status() === 404 || response.status() === 403) {
            throw new Error(`HTTP ${response?.status()}: Page not accessible`);
        }

        // Wait a bit for any async content to render
        await page.waitForTimeout(1000);

        // Get full rendered HTML
        const html = await page.content();
        await browser.close();
        browser = null;

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
        if (browser) {
            await browser.close().catch(() => {});
        }
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
    let browser = null;
    try {
        // Validate URL
        const urlObj = new URL(url);
        const finalUrl = urlObj.toString();

        // Launch headless browser for consistent handling
        const launchOptions = {
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        };
        
        // Use system-installed Chrome/Chromium if available
        const chromePath = findChromiumExecutable();
        if (chromePath) {
            launchOptions.executablePath = chromePath;
        }
        
        browser = await puppeteer.launch(launchOptions);

        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(DEFAULT_TIMEOUT);
        await page.setUserAgent(DEFAULT_USER_AGENT);

        await page.goto(finalUrl, { waitUntil: 'networkidle2', timeout: DEFAULT_TIMEOUT });
        
        // Get rendered HTML
        const html = await page.content();
        await browser.close();
        browser = null;

        const $ = cheerio.load(html);
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
        if (browser) {
            await browser.close().catch(() => {});
        }
        return [];
    }
}

module.exports = {
    scrapeWebsite,
    extractContent,
    extractLinks
};
