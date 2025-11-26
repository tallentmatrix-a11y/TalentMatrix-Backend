// src/routes/leetcodeRoutes.js
const express = require('express');
const router = express.Router();
// Import the shared service
const { fetchLeetCodeData } = require('../services/leetcode_service'); 

router.get('/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const data = await fetchLeetCodeData(username);
        
        if (data.note) {
            // If the service returned a "note" (error/missing), send 404
            return res.status(404).json({ error: data.note });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;