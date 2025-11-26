const express = require('express');
const router = express.Router();
const linkedin = require('linkedin-jobs-api');


// Endpoint: GET /api/jobs
// Accepts query params: query, location, level
router.get('/', async (req, res) => {
  try {
    // 1. Extract & Default Parameters
    const query = req.query.query || 'Software Engineer';
    const location = req.query.location || 'India';
    const level = req.query.level || 'entry level'; // options: internship, entry level, associate, senior, director, executive
    
    console.log(`🔍 LinkedIn Search: Role="${query}" | Loc="${location}" | Level="${level}"`);

    // 2. Configure LinkedIn Query Options
    const queryOptions = {
      keyword: query,
      location: location,
      dateSincePosted: 'past Month', // Fetches jobs posted in the last month
      jobType: 'full time',
      remoteFilter: 'remote', // You can make this dynamic if needed
      salary: '100000+',
      experienceLevel: level,
      limit: '20', 
      page: '0'
    };

    // 3. Fetch Data
    const jobs = await linkedin.query(queryOptions);

    // 4. Handle Empty Results
    if (!jobs || jobs.length === 0) {
        return res.status(200).json([]);
    }

    // 5. Return Jobs
    res.status(200).json(jobs);

  } catch (err) {
    console.error("❌ Job Fetch Error:", err.message);
    res.status(500).json({ error: "Failed to fetch jobs from LinkedIn. Please try again." });
  }
});

module.exports = router;