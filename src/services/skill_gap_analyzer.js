require('dotenv').config();
const OpenAI = require('openai');

const client = new OpenAI({
    apiKey: process.env.PERPLEXITY_API_KEY,
    baseURL: 'https://api.perplexity.ai'
});

async function generateGapReport(userProfile, jobsWithSkills) {
    console.log(`\n🔹 STEP 4: Generating Skill Gap Report...`);

    const systemPrompt = `
    You are a Career Strategy AI.
    
    INPUTS:
    1. Candidate Profile (Verified Skills & LeetCode)
    2. List of Real Jobs with Required Skills
    
    TASK:
    Compare the candidate to EACH job. Calculate the skill gap.
    
    OUTPUT JSON:
    {
        "overall_analysis": "Brief summary of market fit",
        "job_analyses": [
            {
                "company": "String",
                "role": "String",
                "job_url": "String", 
                "match_percentage": "String (e.g., 85%)",
                "missing_skills": ["Skill A", "Skill B"],
                "action_plan": "Specific advice to bridge the gap"
            }
        ]
    }
    `;

    const userMessage = `
    CANDIDATE PROFILE: 
    ${JSON.stringify(userProfile)}

    REAL JOBS DATA: 
    ${JSON.stringify(jobsWithSkills)}
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
        console.error("❌ Step 4 Failed:", error.message);
        throw new Error("Failed to generate final report.");
    }
}

module.exports = { generateGapReport };