const express = require('express');
const axios = require('axios');
const router = express.Router();

// ==================================================================
// 1. ACCESS HANDLER (The Fix)
// ==================================================================
router.get('/access/:id', async (req, res) => {
    const { id } = req.params;
    const backupUrl = req.query.url; 

    // 1. Force Browser to treat this as a Redirect, not a File
    res.setHeader('Content-Type', 'text/html'); // Explicitly say "This is not a PDF"
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    console.log(`🚀 Request for Book ID: ${id}`);

    // 2. SAFETY CHECK: If ID is long (like your 1492072508), skip API entirely.
    // The blue screen happens because the API hangs on these long IDs.
    if (id.length > 8 && backupUrl) {
         console.log(`⏩ Long ID detected. Redirecting immediately to backup.`);
         return res.redirect(backupUrl);
    }

    try {
        // 3. Try to find a direct PDF link
        const response = await axios.get(`https://www.dbooks.org/api/book/${id}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 2000 // Short timeout
        });

        const data = response.data;
        
        if (data && data.download_url) {
            return res.redirect(data.download_url);
        } 
        
        // 4. Fallback if no PDF found
        if (backupUrl) return res.redirect(backupUrl);
        return res.redirect(`https://www.dbooks.org/book/${id}`);

    } catch (error) {
        console.error('❌ Error or Timeout:', error.message);
        // 5. Emergency Exit: Always redirect to the website
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
            headers: { 'User-Agent': 'Mozilla/5.0' }
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
            // Ensure this points to /access/
            download: `/api/books/access/${book.id}?url=${encodeURIComponent(book.url)}` 
        }));

        res.json({ status: 'ok', source: 'dBooks', books: formattedBooks });

    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch books.' });
    }
});

module.exports = router;