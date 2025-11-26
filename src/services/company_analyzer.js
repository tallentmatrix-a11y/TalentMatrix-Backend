require('dotenv').config();
const OpenAI = require('openai');
const { analyzeProfile } = require('./career_task'); // Reuse profile analyzer
const COMPANIES_LIST = require('../data/targetCompanies'); // Import your data

const client = new OpenAI({
    apiKey: process.env.PERPLEXITY_API_KEY,
    baseURL: 'https://api.perplexity.ai'
});

async function analyzeCompanyFit(username, resumeUrl, targetCompanyName) {
    console.log(`🚀 Analyzing fit for ${targetCompanyName}...`);

    // 1. Get User Profile
    const userProfile = await analyzeProfile(username, resumeUrl);
    
    // 2. Get Company Data from your local file
    const targetCompany = COMPANIES_LIST.find(c => c.company === targetCompanyName);
    
    if (!targetCompany) {
        throw new Error(`Company '${targetCompanyName}' not found in backend database.`);
    }

    // 3. AI Comparison
    const systemPrompt = `
    You are a Senior Technical Recruiter at ${targetCompanyName}.
    
    INPUT:
    1. Candidate Profile (Skills, LeetCode score)
    2. Job Requirements (Skills for ${targetCompany.role})
    
    TASK:
    Analyze the candidate specifically for THIS company.
    Generate a structured roadmap to get hired.
    
    OUTPUT JSON ONLY:
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

    const userMessage = `
    CANDIDATE: 
    ${JSON.stringify(userProfile)}

    TARGET ROLE: 
    ${JSON.stringify(targetCompany)}
    `;

    try {
        const response = await client.chat.completions.create({
            model: 'sonar-pro',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ]
        });

        const cleanJson = response.choices[0].message.content.replace(/```json|```/g, '').trim();
        return JSON.parse(cleanJson);

    } catch (error) {
        console.error("❌ Company Analysis Failed:", error);
        throw new Error("AI processing failed.");
    }
}

module.exports = { analyzeCompanyFit };