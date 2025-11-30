require('dotenv').config();
const OpenAI = require('openai');

// --- IMPORT ALL SERVICES ---
const { analyzeProfile } = require('../services/career_task');
const { fetchJobsForRoles } = require('../services/job_search_service');
const { scrapeJobSkills } = require('../services/job_scraper');
const { generateGapReport } = require('../services/skill_gap_analyzer');

// Import Data
const COMPANIES_LIST = require('../data/targetCompanies'); 

const client = new OpenAI({
    apiKey: process.env.PERPLEXITY_API_KEY,
    baseURL: 'https://api.perplexity.ai'
});

// --- 1. FULL CAREER ANALYSIS (Recommendation Engine) ---
exports.runFullCareerAnalysis = async (req, res) => {
    try {
        // 👇 FIX 1: Extract leetcodeUsername from request
        const { username, leetcodeUsername, resumeUrl } = req.body;

        // Validation
        if (!resumeUrl) {
            return res.status(400).json({ success: false, error: "Resume URL is missing." });
        }

        console.log(`🚀 Starting Full Career Analysis for: ${username}`);
        console.log(`   -> LeetCode Handle: ${leetcodeUsername || "Not provided (Using username)"}`);

        // 👇 FIX 2: Pass leetcodeUsername to analyzeProfile
        const userProfile = await analyzeProfile(leetcodeUsername || username, resumeUrl);
        
        // STEP 2: Find Real Jobs on LinkedIn
        const suggestedRoles = userProfile.suggested_job_roles && userProfile.suggested_job_roles.length > 0 
            ? userProfile.suggested_job_roles 
            : ["Software Engineer"];
            
        console.log("   -> Searching jobs for roles:", suggestedRoles);
        const realJobs = await fetchJobsForRoles(suggestedRoles, 'India');

        if (!realJobs || realJobs.length === 0) {
            return res.json({ 
                success: true, 
                message: "No relevant jobs found to analyze.", 
                user_summary: userProfile,
                report: null 
            });
        }

        // STEP 3: Scrape Skills for these Real Jobs
        const jobsWithSkills = await scrapeJobSkills(realJobs);

        // STEP 4: Gap Analysis (Compare User vs Jobs)
        const finalReport = await generateGapReport(userProfile, jobsWithSkills);

        // Send Success Response
        res.json({
            success: true,
            user_summary: userProfile,
            jobs_found_count: jobsWithSkills.length,
            analysis: finalReport
        });

    } catch (error) {
        console.error("❌ Full Analysis Failed:", error.message);
        res.status(500).json({ success: false, error: error.message || "Internal Server Error" });
    }
};

// --- 2. TARGET COMPANY ANALYSIS ---
exports.runTargetCompanyAnalysis = async (req, res) => {
    try {
        // 👇 FIX 3: Extract leetcodeUsername here too
        const { username, leetcodeUsername, resumeUrl, companyName } = req.body;

        if (!resumeUrl || !companyName) {
            return res.status(400).json({ success: false, error: "Missing resume URL or company name." });
        }

        console.log(`🎯 Starting Target Analysis for: ${companyName}`);
        console.log(`   -> LeetCode Handle: ${leetcodeUsername || "Not provided"}`);

        // 👇 FIX 4: Pass leetcodeUsername to analyzeProfile
        const userProfile = await analyzeProfile(leetcodeUsername || username, resumeUrl);
        
        // 2. Get Company Data from local file
        const targetCompany = COMPANIES_LIST.find(c => c.company === companyName);
        
        if (!targetCompany) {
            return res.status(404).json({ success: false, error: "Company not found in database." });
        }

        // 3. AI Comparison
        const systemPrompt = `
        You are a Senior Technical Recruiter at ${companyName}.
        
        INPUT:
        1. Candidate Profile: ${JSON.stringify(userProfile)}
        2. Job Requirements: ${JSON.stringify(targetCompany)}
        
        TASK:
        Analyze the candidate specifically for THIS company.
        Generate a structured roadmap to get hired.
        
        OUTPUT JSON ONLY (No markdown):
        {
            "match_percentage": "String (e.g. 75%)",
            "missing_skills": ["Skill A", "Skill B"],
            "advice": "Specific advice for cracking interviews at this company",
            "roadmap": [
                { "step": "Week 1-2", "action": "What to study" },
                { "step": "Week 3-4", "action": "What to build/practice" },
                { "step": "Final Prep", "action": "Mock interviews/System Design" }
            ]
        }
        `;

        const response = await client.chat.completions.create({
            model: 'sonar-pro',
            messages: [
                { role: 'system', content: "You are a helpful career coach." },
                { role: 'user', content: systemPrompt }
            ]
        });

        const cleanJson = response.choices[0].message.content.replace(/```json|```/g, '').trim();
        const analysisData = JSON.parse(cleanJson);

        res.json({
            success: true,
            data: analysisData
        });

    } catch (error) {
        console.error("❌ Target Analysis Failed:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

// --- 3. GET COMPANY LIST ---
exports.getCompanies = (req, res) => {
    try {
        res.status(200).json({ success: true, data: COMPANIES_LIST });
    } catch (error) {
        res.status(500).json({ success: false, error: "Failed to fetch companies" });
    }
};