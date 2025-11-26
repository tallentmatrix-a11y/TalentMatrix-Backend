const express = require('express');
const axios = require('axios');
const router = express.Router();

// ==================================================================
// 1. ACCESS HANDLER (Renamed to break browser cache)
// ==================================================================
// We changed '/download/:id' to '/access/:id' to fix the "Blue Screen"
router.get('/access/:id', async (req, res) => {
    const { id } = req.params;
    const backupUrl = req.query.url; 

    // Prevent browser caching for this redirect
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    try {
        console.log(`🔍 Resolving link for Book ID: ${id}`);

        // OPTIMIZATION: If the ID is very long (like 3319324284), it's often not in the API.
        // Skip straight to the website to make it faster.
        if (id.length > 8 && backupUrl) {
             console.log(`⏩ ID is long, skipping API check. Redirecting to backup.`);
             return res.redirect(backupUrl);
        }

        // 1. Try to get a direct PDF link from dBooks API
        const response = await axios.get(`https://www.dbooks.org/api/book/${id}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 3000 // 3 second timeout
        });

        const data = response.data;
        
        // 2. If API gives a PDF link, go there
        if (data && data.download_url) {
            console.log(`✅ Redirecting to PDF: ${data.download_url}`);
            return res.redirect(data.download_url);
        } 
        
        // 3. Fallback to the website page
        console.log(`⚠️ No PDF in API. Using fallback.`);
        if (backupUrl) return res.redirect(backupUrl);
        return res.redirect(`https://www.dbooks.org/book/${id}`);

    } catch (error) {
        console.error('❌ Redirect Error:', error.message);
        
        // On any error, strictly redirect to the backup URL
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
        console.log(`📚 Fetching dBooks for: "${query}"`);

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
            // CRITICAL UPDATE: Updated to point to '/api/books/access/'
            download: `/api/books/access/${book.id}?url=${encodeURIComponent(book.url)}` 
        }));

        res.json({ status: 'ok', source: 'dBooks', books: formattedBooks });

    } catch (error) {
        console.error('❌ dBooks API Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch books.' });
    }
});

module.exports = router;