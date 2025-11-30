require('dotenv').config();
const OpenAI = require('openai');

const client = new OpenAI({
    apiKey: process.env.PERPLEXITY_API_KEY,
    baseURL: 'https://api.perplexity.ai'
});

async function scrapeJobSkills(jobList) {
    console.log(`\n🔹 STEP 3: Analyzing detailed skill requirements for ${jobList.length} jobs...`);
    
    const results = [];

    for (const job of jobList) {
        console.log(`   -> Scraper: Analyzing ${job.position} at ${job.company}`);

        const systemPrompt = `
        You are a Job Data Extractor.
        
        TASK:
        1. Access this Job URL: ${job.jobUrl}
        2. If blocked, SEARCH for "${job.position} at ${job.company} requirements".
        3. Extract the list of specific technical skills required.
        
        OUTPUT JSON ONLY:
        {
            "required_skills": ["Skill A", "Skill B", "Skill C"],
            "experience_summary": "Short string"
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

            const cleanJson = response.choices[0].message.content.replace(/```json|```/g, '').trim();
            const data = JSON.parse(cleanJson);
            
            // Merge the new skill data with the original job info
            results.push({ 
                ...job, 
                tech_stack: data.required_skills, // Map to standardized name
                experience_summary: data.experience_summary 
            });

        } catch (error) {
            console.error(`   -> Failed to analyze ${job.company}: ${error.message}`);
        }
        
        // Delay to prevent rate limits
        await new Promise(r => setTimeout(r, 1500));
    }

    return results;
}

module.exports = { scrapeJobSkills };