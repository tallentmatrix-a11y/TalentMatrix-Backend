require('dotenv').config();
const OpenAI = require('openai');

const client = new OpenAI({
    apiKey: process.env.PERPLEXITY_API_KEY,
    baseURL: 'https://api.perplexity.ai'
});

// ... inside services/job_scraper.js

async function scrapeJobSkills(jobList) {
    console.log(`\n🔹 STEP 3: Analyzing detailed skill requirements for ${jobList.length} jobs...`);
    
    const results = [];

    for (const job of jobList) {
        console.log(`   -> Scraper: Analyzing ${job.position} at ${job.company}`);

        const systemPrompt = `
        You are a Data Extraction API. You DO NOT converse. You ONLY output JSON.

        TASK:
        1. Attempt to access the Job URL: ${job.jobUrl}
        2. If the URL is blocked or inaccessible (which is common for LinkedIn), DO NOT APOLOGIZE.
        3. Instead, perform a SEARCH for the job role "${job.position}" at company "${job.company}" to infer the likely skills.
        4. If no data is found, return generic skills for this role title.

        OUTPUT FORMAT:
        Strict JSON only. No "Here is the data", no markdown, no conversational filler.

        {
            "required_skills": ["Skill A", "Skill B", "Skill C"],
            "experience_summary": "Short summary of requirements"
        }
        `;

        try {
            const response = await client.chat.completions.create({
                model: 'sonar-pro',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: "Extract skills." }
                ]
            });

            const content = response.choices[0].message.content;
            const jsonMatch = content.match(/\{[\s\S]*\}/);

            if (!jsonMatch) {
                console.warn(`      ⚠️ No JSON found for ${job.company}. Output: "${content.substring(0, 50)}..."`);
                continue; // Skip this job, don't crash
            }

            const data = JSON.parse(jsonMatch[0]);
            
            results.push({ 
                ...job, 
                tech_stack: data.required_skills, 
                experience_summary: data.experience_summary 
            });

        } catch (error) {
            console.error(`   -> Failed to analyze ${job.company}: ${error.message}`);
        }
        
        // 1.5 second delay to be polite to the API
        await new Promise(r => setTimeout(r, 1500));
    }

    return results;
}

module.exports = { scrapeJobSkills };