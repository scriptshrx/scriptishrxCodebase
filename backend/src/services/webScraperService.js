const cheerio = require('cheerio');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

/**
 * Web Scraper Service - Extracts content from websites
 */

const DEFAULT_TIMEOUT = 10000; // 10 seconds
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

/**
 * Get launch options for Puppeteer, compatible with cloud/serverless environments
 */
async function getLaunchOptions() {
    const executablePath = await chromium.executablePath();
    return {
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath,
        headless: chromium.headless,
    };
}

/**
 * Scrape website and extract main content
 * Uses Puppeteer for JavaScript-rendered sites (Next.js, React, Vue, etc.)
 */
async function scrapeWebsite(url) {
    let browser = null;
    try {
        console.log(`[Web Scraper] Starting scrape of ${url}`);

        const urlObj = new URL(url);
        const finalUrl = urlObj.toString();

        console.log('[Web Scraper] Launching headless browser...');
        const launchOptions = await getLaunchOptions();
        browser = await puppeteer.launch(launchOptions);

        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(DEFAULT_TIMEOUT);
        page.setDefaultTimeout(DEFAULT_TIMEOUT);
        await page.setUserAgent(DEFAULT_USER_AGENT);

        console.log(`[Web Scraper] Navigating to ${finalUrl}`);
        const response = await page.goto(finalUrl, {
            waitUntil: 'networkidle2',
            timeout: DEFAULT_TIMEOUT
        });

        if (!response || response.status() === 404 || response.status() === 403) {
            throw new Error(`HTTP ${response?.status()}: Page not accessible`);
        }

        await page.waitForTimeout(1000);

        const html = await page.content();
        await browser.close();
        browser = null;

        const $ = cheerio.load(html);

        let title = $('title').text().trim() || $('meta[property="og:title"]').attr('content') || '';
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
    $('script, style, meta, link, noscript, iframe, svg').remove();
    $('.nav, .navbar, .navigation, footer, .footer, .sidebar, .advertisement, .ads, .comment').remove();

    let content = '';

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

    if (!content) {
        content = $('body').html() || '';
    }

    let text = cheerio.load(content).text();
    text = text
        .replace(/\r\n/g, '\n')
        .replace(/\n\s*\n/g, '\n')
        .replace(/\s{2,}/g, ' ')
        .trim();

    return text;
}

/*
 * Extract links from a website
 */
async function extractLinks(url) {
    let browser = null;
    try {
        const urlObj = new URL(url);
        const finalUrl = urlObj.toString();

        const launchOptions = await getLaunchOptions();
        browser = await puppeteer.launch(launchOptions);

        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(DEFAULT_TIMEOUT);
        await page.setUserAgent(DEFAULT_USER_AGENT);

        await page.goto(finalUrl, { waitUntil: 'networkidle2', timeout: DEFAULT_TIMEOUT });

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
                if (new URL(absoluteUrl).hostname === baseUrl.hostname) {
                    links.push(absoluteUrl);
                }
            } catch {
                // Invalid URL, skip
            }
        });

        return [...new Set(links)];
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