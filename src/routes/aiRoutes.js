// routes/aiRoutes.js
const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// Route 1: Full Career Analysis
router.post('/analyze-career', aiController.runFullCareerAnalysis);

// Route 2: Specific Company Analysis (The AI Report)
router.post('/analyze-target-company', aiController.runTargetCompanyAnalysis);

// Route 3: Get List of Companies (Fixes the "Only 6 companies" error)
router.get('/companies', aiController.getCompanies);

module.exports = router;