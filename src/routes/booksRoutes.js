const express = require('express');
const axios = require('axios');
const router = express.Router();
// Endpoint: GET /api/books?query=...
router.get('/', async (req, res) => {
    const { query } = req.query;

    if (!query) {
        return res.status(400).json({ error: 'Query parameter is required' });
    }

    try {
        console.log(`📚 Fetching dBooks for: "${query}"`);

        // 1. Request to dBooks API
        // CRITICAL: The 'User-Agent' header tricks dBooks into thinking we are a browser.
        // Without this, you will get a 403 Forbidden error.
        const response = await axios.get(`https://www.dbooks.org/api/search/${encodeURIComponent(query)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        // 2. Validate Response
        if (response.data.status !== 'ok' || !response.data.books) {
            return res.json({ status: 'ok', books: [] }); // Return empty list instead of error
        }

        // 3. Transform Data
        const formattedBooks = response.data.books.slice(0, 12).map(book => ({
            id: book.id,
            title: book.title,
            subtitle: book.subtitle || 'Tech Book',
            // Create a fallback description since search results often lack it
            description: book.description || `Title: ${book.title}. Author: ${book.authors}. This book is available for free download.`,
            authors: book.authors,
            image: book.image,
            url: book.url,
            // Construct the direct download link
            download: `https://www.dbooks.org/d/${book.id}` 
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