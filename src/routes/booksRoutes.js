const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const router = express.Router();

// ==================================================================
// CONFIGURATION
// ==================================================================
const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.dbooks.org/'
};

// ==================================================================
// 1. ACCESS HANDLER
// ==================================================================
router.get('/access/:id', async (req, res) => {
    const { id } = req.params;
    const backupUrl = req.query.url; 

    // Prevent caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    console.log(`🚀 Request for Book ID: ${id}`);

    try {
        // 1. Get the book details from API
        const apiResponse = await axios.get(`https://www.dbooks.org/api/book/${id}`, {
            headers: BROWSER_HEADERS,
            timeout: 3000
        });

        const initialLink = apiResponse.data?.download_url;

        if (initialLink) {
            // Case A: It's already a PDF
            if (initialLink.toLowerCase().endsWith('.pdf')) {
                return res.redirect(initialLink);
            }

            console.log(`🔍 Scraping page: ${initialLink}`);
            
            try {
                // 2. Fetch the Webpage (The one with the Blue Button)
                const pageResponse = await axios.get(initialLink, { headers: BROWSER_HEADERS });
                const $ = cheerio.load(pageResponse.data);
                
                let realPdfLink = null;

                // --- IMPROVED SCRAPING STRATEGIES ---
                
                // Strategy 1: The specific "Blue Button" class usually used by dBooks
                const primaryButton = $('.btn-primary').attr('href');
                if (primaryButton && primaryButton.includes('/d/')) {
                    realPdfLink = primaryButton;
                }

                // Strategy 2: Any link containing "/d/" (standard download path)
                if (!realPdfLink) {
                    realPdfLink = $('a[href*="/d/"]').attr('href');
                }

                // Strategy 3: Text content "Download"
                if (!realPdfLink) {
                     realPdfLink = $('a:contains("Free Download")').attr('href');
                }

                // --- RESULT HANDLER ---
                if (realPdfLink) {
                    // Fix relative URLs (e.g. "/d/123")
                    if (!realPdfLink.startsWith('http')) {
                        const baseUrl = new URL(initialLink).origin;
                        realPdfLink = `${baseUrl}${realPdfLink.startsWith('/') ? '' : '/'}${realPdfLink}`;
                    }
                    console.log(`🎉 Found Automatic Link: ${realPdfLink}`);
                    return res.redirect(realPdfLink);
                } 

                console.log(`⚠️ Link hidden. Fallback to Book Page.`);
                // IMPORTANT: Redirect to the page (Image 2) instead of 404
                return res.redirect(initialLink);

            } catch (scrapeError) {
                console.error(`⚠️ Scraping failed. Fallback to Book Page.`);
                return res.redirect(initialLink);
            }
        } 
        
        // Fallback for missing API data
        if (backupUrl) return res.redirect(backupUrl);
        return res.redirect(`https://www.dbooks.org/book/${id}`);

    } catch (error) {
        console.error('❌ Main Error:', error.message);
        // Safety Net: Never show 404. Send to the page or backup.
        if (backupUrl) return res.redirect(backupUrl);
        return res.redirect(`https://www.dbooks.org/book/${id}`);
    }
});

// ==================================================================
// 2. SEARCH ROUTE
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
            // Point to our /access/ route
            download: `/api/books/access/${book.id}?url=${encodeURIComponent(book.url)}` 
        }));

        res.json({ status: 'ok', source: 'dBooks', books: formattedBooks });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch books.' });
    }
});

module.exports = router;