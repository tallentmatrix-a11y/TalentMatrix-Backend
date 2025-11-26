const express = require('express');
const axios = require('axios');
const router = express.Router();

// ==================================================================
// 1. DOWNLOAD HANDLER (FIXED: Uses Redirect to Bypass Blocking)
// ==================================================================
router.get('/download/:id', async (req, res) => {
    const { id } = req.params;

    try {
        console.log(`🔍 Finding download link for Book ID: ${id}`);

        // 1. Ask dBooks API for the file location
        const response = await axios.get(`https://www.dbooks.org/api/book/${id}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const data = response.data;
        
        // 2. Determine the best URL to send the user to
        if (data && data.download_url) {
            console.log(`✅ Redirecting user to PDF: ${data.download_url}`);
            // Redirect the user's browser directly to the PDF.
            // dBooks won't block the user (only servers).
            return res.redirect(data.download_url);
        } 
        
        // 3. Fallback: If no direct PDF link, send them to the book's page
        console.log(`⚠️ No direct PDF found. Redirecting to book page.`);
        return res.redirect(`https://www.dbooks.org/book/${id}`);

    } catch (error) {
        console.error('❌ Error finding link:', error.message);
        // Final Fallback: Just send them to the main page for that ID
        return res.redirect(`https://www.dbooks.org/book/${id}`);
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
            // Keep pointing to OUR backend, which will now handle the redirect
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