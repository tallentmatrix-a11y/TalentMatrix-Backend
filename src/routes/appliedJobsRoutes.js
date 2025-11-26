const express = require('express');
const router = express.Router();
const supabase = require('../config/supabaseClient'); // Assuming this path is correct

// POST /api/applied-jobs - Save a new job
router.post('/', async (req, res) => {
    // 1. Input Validation Check (Quick fail if essential data is missing)
    const { student_id, job_title, company_name, job_url, location, posted_date } = req.body;
    if (!student_id || !job_title || !job_url) {
        return res.status(400).json({ error: "Missing required fields: student_id, job_title, and job_url are necessary." });
    }

    try {
        const { data, error } = await supabase
            .from('applied_jobs')
            .insert([
                { student_id, job_title, company_name, job_url, location, posted_date }
            ])
            .select();

        if (error) {
            // Check for PostgreSQL unique constraint violation error (Code 23505)
            if (error.code === '23505') {
                return res.status(409).json({ error: "Job already saved by this student." });
            }
            throw error;
        }

        // Supabase returns an array, so we return the first item
        res.status(201).json({ message: "Job saved successfully", data: data[0] });
    } catch (err) {
        console.error("Error saving job:", err);
        // Catch all other database or server errors
        res.status(500).json({ error: "Internal server error: " + err.message });
    }
});

// GET /api/applied-jobs/:studentId - Get all saved jobs for a student
router.get('/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;

        const { data, error } = await supabase
            .from('applied_jobs')
            .select('*')
            .eq('student_id', studentId);

        if (error) throw error;

        // Return empty array if no data is found, 200 status is appropriate
        res.status(200).json(data || []); 
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch applied jobs: " + err.message });
    }
});

module.exports = router;