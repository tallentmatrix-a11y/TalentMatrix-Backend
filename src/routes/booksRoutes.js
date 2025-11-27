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
// 1. ACCESS HANDLER (Aggressive Mode)
// ==================================================================
router.get('/access/:id', async (req, res) => {
    const { id } = req.params;
    
    // 1. Construct the Direct Download Link manually
    // Most dBooks downloads follow this exact pattern: https://www.dbooks.org/d/ID
    const forcedDownloadLink = `https://www.dbooks.org/d/${id}`;

    // Prevent caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    console.log(`🚀 Request for Book ID: ${id}`);

    try {
        // 2. Ask dBooks API for details (just to check if it exists)
        const apiResponse = await axios.get(`https://www.dbooks.org/api/book/${id}`, {
            headers: BROWSER_HEADERS,
            timeout: 2500
        });

        const initialLink = apiResponse.data?.download_url;

        // 3. If we have a link, try to find a BETTER one via scraping
        if (initialLink) {
            // If it's already a PDF, go there
            if (initialLink.toLowerCase().endsWith('.pdf')) {
                return res.redirect(initialLink);
            }

            console.log(`🔍 Scraping page for better link...`);
            
            try {
                const pageResponse = await axios.get(initialLink, { headers: BROWSER_HEADERS });
                const $ = cheerio.load(pageResponse.data);
                
                let realPdfLink = null;

                // STRATEGY: Look for the specific 'href' that contains /d/
                // This is the link behind the "Free Download" button
                realPdfLink = $('a[href*="/d/"]').attr('href'); 
                
                if (!realPdfLink) {
                     realPdfLink = $('a[href$=".pdf"]').attr('href');
                }

                // If found, clean it up and use it
                if (realPdfLink) {
                    if (!realPdfLink.startsWith('http')) {
                        const baseUrl = new URL(initialLink).origin;
                        realPdfLink = `${baseUrl}${realPdfLink.startsWith('/') ? '' : '/'}${realPdfLink}`;
                    }
                    console.log(`🎉 Found Real Link via Scraper: ${realPdfLink}`);
                    return res.redirect(realPdfLink);
                } 

            } catch (scrapeError) {
                console.log(`⚠️ Scraping failed. Moving to Forced Download.`);
            }
        } 
        
        // 4. AGGRESSIVE FALLBACK (The Fix)
        // If scraping failed or found nothing, DO NOT send to the book page.
        // Send them to the direct download endpoint instead.
        console.log(`⚡ Scraper empty. Forcing Direct Download: ${forcedDownloadLink}`);
        return res.redirect(forcedDownloadLink);

    } catch (error) {
        console.error('❌ Error:', error.message);
        // Even on error, try the forced link. It's better than nothing.
        return res.redirect(forcedDownloadLink);
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
            // Point to our aggressive access route
            download: `/api/books/access/${book.id}` 
        }));

        res.json({ status: 'ok', source: 'dBooks', books: formattedBooks });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch books.' });
    }
});

module.exports = router;