const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio'); // New library for scraping
const router = express.Router();

// Helper: specific headers to look like a real browser
const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5'
};

// ==================================================================
// 1. ACCESS HANDLER (Now with Auto-Scraping)
// ==================================================================
router.get('/access/:id', async (req, res) => {
    const { id } = req.params;
    const backupUrl = req.query.url; 

    // Force browser to treat this as a fresh redirect
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    console.log(`🚀 Request for Book ID: ${id}`);

    try {
        // 1. Ask dBooks API for the download location
        const apiResponse = await axios.get(`https://www.dbooks.org/api/book/${id}`, {
            headers: BROWSER_HEADERS,
            timeout: 3000
        });

        const initialLink = apiResponse.data?.download_url;

        // 2. If we got a link, let's check if it's a DIRECT PDF or a Webpage
        if (initialLink) {
            // Case A: It's already a PDF (ends in .pdf) -> Redirect immediately
            if (initialLink.toLowerCase().endsWith('.pdf')) {
                console.log(`✅ Direct PDF detected: ${initialLink}`);
                return res.redirect(initialLink);
            }

            // Case B: It's a Webpage (like it-ebooks.dev) -> We must DIG deeper
            console.log(`🔍 Link is a webpage (${initialLink}). Scraping for PDF...`);
            
            try {
                // Fetch the HTML of that landing page
                const pageResponse = await axios.get(initialLink, { headers: BROWSER_HEADERS });
                
                // Load HTML into Cheerio
                const $ = cheerio.load(pageResponse.data);
                
                // Look for any link that ends in .pdf
                // This selector finds <a href="..."> where href ends with .pdf
                let realPdfLink = $('a[href$=".pdf"]').attr('href');

                // Sometimes links are relative (e.g., "/files/book.pdf"), so we fix them
                if (realPdfLink && !realPdfLink.startsWith('http')) {
                    const baseUrl = new URL(initialLink).origin;
                    realPdfLink = `${baseUrl}${realPdfLink.startsWith('/') ? '' : '/'}${realPdfLink}`;
                }

                if (realPdfLink) {
                    console.log(`🎉 Found Real PDF Link: ${realPdfLink}`);
                    return res.redirect(realPdfLink);
                } else {
                    console.log(`⚠️ Scraped page but couldn't find a .pdf link. Using landing page.`);
                    return res.redirect(initialLink);
                }

            } catch (scrapeError) {
                console.error(`⚠️ Scraping failed: ${scrapeError.message}. Fallback to landing page.`);
                return res.redirect(initialLink);
            }
        } 
        
        // 3. Fallback if API returned nothing
        console.log(`⚠️ No link in API. Using backup.`);
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