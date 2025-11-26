const express = require('express');
const axios = require('axios');
const router = express.Router();

// ==================================================================
// 1. DOWNLOAD PROXY ROUTE (Fixes 404/403 Errors)
// ==================================================================
router.get('/download/:id', async (req, res) => {
    const { id } = req.params;
    const dbooksUrl = `https://www.dbooks.org/d/${id}`;

    console.log(`📥 Proxying download for book ID: ${id}`);

    try {
        // Fetch the PDF from dBooks as a stream (efficient for memory)
        const response = await axios({
            method: 'get',
            url: dbooksUrl,
            responseType: 'stream', 
            headers: {
                // Mimic a real browser so dBooks doesn't block us
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://www.dbooks.org/' 
            }
        });

        // Set headers to tell the browser this is a PDF file to download
        res.setHeader('Content-Type', response.headers['content-type'] || 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="book-${id}.pdf"`);

        // Pipe the data directly from dBooks to the user
        response.data.pipe(res);

    } catch (error) {
        console.error('❌ Download Proxy Error:', error.message);
        res.status(404).send("Error: Could not download file from source.");
    }
});

// ==================================================================
// 2. SEARCH ROUTE
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
            // CRITICAL CHANGE: Point the download link to YOUR backend proxy
            // The frontend will prepend the API_BASE automatically
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