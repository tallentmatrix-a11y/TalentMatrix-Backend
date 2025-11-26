const express = require('express');
const axios = require('axios');
const router = express.Router();

// ==================================================================
// 1. DOWNLOAD PROXY ROUTE (UPDATED: 2-Step Fetch)
// ==================================================================
router.get('/download/:id', async (req, res) => {
    const { id } = req.params;

    try {
        console.log(`🔍 Resolving download link for Book ID: ${id}`);

        // STEP 1: Get Book Details to find the Real PDF URL
        // We cannot guess the PDF link; we must ask the API for it.
        const detailsResponse = await axios.get(`https://www.dbooks.org/api/book/${id}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        // Check if we got a valid download link
        const downloadUrl = detailsResponse.data?.download_url;
        
        if (!downloadUrl) {
            console.error('❌ No download URL found in API response');
            return res.status(404).send("Error: This book does not have a valid PDF link.");
        }

        console.log(`📥 Found PDF Link: ${downloadUrl}`);
        console.log(`🚀 Starting Stream...`);

        // STEP 2: Stream the Real PDF URL
        const pdfResponse = await axios({
            method: 'get',
            url: downloadUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://www.dbooks.org/' // Tells server we came from their site
            }
        });

        // Set headers so the browser knows it's a file download
        res.setHeader('Content-Type', 'application/pdf');
        // Clean the title to prevent header errors
        const safeTitle = (detailsResponse.data.title || `book-${id}`).replace(/[^a-zA-Z0-9 ]/g, "");
        res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.pdf"`);

        // Pipe the PDF stream to the user
        pdfResponse.data.pipe(res);

    } catch (error) {
        console.error('❌ Download Proxy Error:', error.message);
        // If the specific PDF server is down or blocks us
        res.status(404).send("Error: Could not download file from source. The provider may be blocking requests.");
    }
});

// ==================================================================
// 2. SEARCH ROUTE (Unchanged logic, just ensure consistency)
// ==================================================================
router.get('/', async (req, res) => {
    const { query } = req.query;

    if (!query) {
        return res.status(400).json({ error: 'Query parameter is required' });
    }

    try {
        console.log(`📚 Fetching dBooks for: "${query}"`);

        const response = await axios.get(`https://www.dbooks.org/api/search/${encodeURIComponent(query)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
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
            // Point to OUR backend proxy
            download: `/api/books/download/${book.id}` 
        }));

        res.json({
            status: 'ok',
            source: 'dBooks',
            books: formattedBooks
        });

    } catch (error) {
        console.error('❌ dBooks API Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch books.' });
    }
});

module.exports = router;