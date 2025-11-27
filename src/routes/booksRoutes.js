const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const router = express.Router();

// Browser headers to prevent blocking
const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5'
};

// ==================================================================
// 1. ACCESS HANDLER (Enhanced Scraping)
// ==================================================================
router.get('/access/:id', async (req, res) => {
    const { id } = req.params;
    const backupUrl = req.query.url; 

    // Prevent caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    console.log(`🚀 Request for Book ID: ${id}`);

    try {
        // 1. Get the landing page URL from the API
        const apiResponse = await axios.get(`https://www.dbooks.org/api/book/${id}`, {
            headers: BROWSER_HEADERS,
            timeout: 3000
        });

        const initialLink = apiResponse.data?.download_url;

        // 2. If we have a link, inspect it
        if (initialLink) {
            // Case A: It is already a PDF
            if (initialLink.toLowerCase().endsWith('.pdf')) {
                return res.redirect(initialLink);
            }

            console.log(`🔍 Scraping page: ${initialLink}`);
            
            try {
                // Fetch the HTML of the landing page
                const pageResponse = await axios.get(initialLink, { headers: BROWSER_HEADERS });
                const $ = cheerio.load(pageResponse.data);
                
                let realPdfLink = null;

                // --- STRATEGY 1: Look for explicit .pdf links ---
                realPdfLink = $('a[href$=".pdf"]').attr('href');

                // --- STRATEGY 2: Look for dBooks specific "/d/" download links ---
                // (This usually fixes the issue you are seeing)
                if (!realPdfLink) {
                    realPdfLink = $('a[href*="/d/"]').attr('href'); 
                }

                // --- STRATEGY 3: Look for the big "Free Download" button by text ---
                if (!realPdfLink) {
                    // Finds <a> tags containing the word "Download" (case insensitive)
                    realPdfLink = $('a:contains("Download")').attr('href') || $('a:contains("download")').attr('href');
                }

                // Fix Relative Links (e.g., convert "/d/123" to "https://dbooks.org/d/123")
                if (realPdfLink) {
                    if (!realPdfLink.startsWith('http')) {
                        const baseUrl = new URL(initialLink).origin;
                        realPdfLink = `${baseUrl}${realPdfLink.startsWith('/') ? '' : '/'}${realPdfLink}`;
                    }
                    console.log(`🎉 Found Real Link: ${realPdfLink}`);
                    return res.redirect(realPdfLink);
                } 

                console.log(`⚠️ Scraper couldn't find a button. Fallback to page.`);
                return res.redirect(initialLink);

            } catch (scrapeError) {
                console.error(`⚠️ Scraping error. Fallback to page.`);
                return res.redirect(initialLink);
            }
        } 
        
        // 3. Fallback
        if (backupUrl) return res.redirect(backupUrl);
        return res.redirect(`https://www.dbooks.org/book/${id}`);

    } catch (error) {
        console.error('❌ Main Error:', error.message);
        if (backupUrl) return res.redirect(backupUrl);
        return res.redirect(`https://www.dbooks.org/book/${id}`);
    }
});

// ==================================================================
// 2. SEARCH ROUTE (Unchanged)
// ==================================================================
router.get('/', async (req, res) => {
    const { query } = req.query;
    if (!query) return res.status(400).json({ error: 'Query parameter is required' });

    try {
        const response = await axios.get(`https://www.dbooks.org/api/search/${encodeURIComponent(query)}`, {
            headers: BROWSER_HEADERS
        });

        if (response.data.status !== 'ok' || !response.data.books) {
            return res.json({ status: 'ok', books: [] });
        }

        const formattedBooks = response.data.books.slice(0, 12).map(book => ({
            id: book.id,
            title: book.title,
            subtitle: book.subtitle || 'Tech Book',
            description: book.description || `Title: ${book.title}. Author: ${book.authors}.`,
            authors: book.authors,
            image: book.image,
            url: book.url,
            download: `/api/books/access/${book.id}?url=${encodeURIComponent(book.url)}` 
        }));

        res.json({ status: 'ok', source: 'dBooks', books: formattedBooks });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch books.' });
    }
});

module.exports = router;