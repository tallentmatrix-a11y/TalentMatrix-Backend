const express = require('express');
const axios = require('axios');
const router = express.Router();

// ==================================================================
// 1. DOWNLOAD HANDLER (FIXED: Uses Backup Link from Query)
// ==================================================================
router.get('/download/:id', async (req, res) => {
    const { id } = req.params;
    // Get the known working URL from the query string (passed from the search route)
    const backupUrl = req.query.url; 

    try {
        console.log(`🔍 Finding download link for Book ID: ${id}`);

        // 1. Ask dBooks API for the direct PDF link
        const response = await axios.get(`https://www.dbooks.org/api/book/${id}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 5000 // specific timeout so we don't hang too long
        });

        const data = response.data;
        
        // 2. If we found a direct PDF link, send the user there
        if (data && data.download_url) {
            console.log(`✅ Redirecting user to PDF: ${data.download_url}`);
            return res.redirect(data.download_url);
        } 
        
        // 3. FALLBACK: No PDF found. 
        // Instead of guessing the URL, use the 'backupUrl' we passed in.
        console.log(`⚠️ No direct PDF found. Redirecting to book page.`);
        if (backupUrl) {
            return res.redirect(backupUrl);
        } else {
            // Last resort if no backup link exists
            return res.redirect(`https://www.dbooks.org/book/${id}`);
        }

    } catch (error) {
        console.error('❌ Error finding link:', error.message);
        
        // On ANY error (404, Network, etc), use the backup URL
        if (backupUrl) {
            return res.redirect(backupUrl);
        }
        return res.redirect(`https://www.dbooks.org/book/${id}`);
    }
});

// ==================================================================
// 2. SEARCH ROUTE (UPDATED: Attaches Backup URL)
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
            url: book.url, // This is the correct website link
            // CRITICAL UPDATE: We encode the correct website URL into the download link
            // So if the PDF fails, the backend knows exactly where to send the user.
            download: `/api/books/download/${book.id}?url=${encodeURIComponent(book.url)}` 
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