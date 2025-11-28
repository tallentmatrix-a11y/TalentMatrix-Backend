require('dotenv').config();
const pdfExtraction = require('pdf-extraction');
const OpenAI = require('openai');
const { fetchLeetCodeData } = require('./leetcode_service'); 

const client = new OpenAI({
    apiKey: process.env.PERPLEXITY_API_KEY,
    baseURL: 'https://api.perplexity.ai'
});

// --- Helper: Extract Text from URL ---
async function extractResumeText(resumeUrl) {
    try {
        const cleanUrl = resumeUrl.trim();
        
        // 👇 DEBUG: Check if the key exists (Don't log the full key for security)
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceKey) {
            throw new Error("❌ MISSING ENV VAR: SUPABASE_SERVICE_ROLE_KEY is undefined in .env file.");
        }
        console.log(`🔑 Service Key found (Length: ${serviceKey.length}). Downloading resume...`);
        console.log(`📄 Downloading from: '${cleanUrl}'`);

        const response = await fetch(cleanUrl, {
            headers: {
                'Authorization': `Bearer ${serviceKey}` 
            }
        });

        if (!response.ok) {
            // Log the status text to debug 401/404 issues
            throw new Error(`Failed to download. Status: ${response.status} ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const pdfBuffer = Buffer.from(arrayBuffer);
        const data = await pdfExtraction(pdfBuffer);
        return data.text.slice(0, 15000);
    } catch (error) {
        console.error(`❌ PDF Error: ${error.message}`);
        throw new Error("Could not read resume file.");
    }
}

// --- CORE AI ANALYZER ---
async function runAIAnalysis(resumeText, leetcodeData = null) {
    const systemPrompt = `
    You are an expert Technical Recruiter and Career Coach.
    Analyze the provided Resume Text ${leetcodeData ? "and LeetCode Stats" : ""}.

    TASK:
    1. Summarize the candidate's profile in 1-2 sentences.
    2. Extract technical skills and categorize them exactly into: "Languages and Databases", "Frameworks", "Tools and Technologies".
    3. Suggest 3-5 specific Job Roles this candidate is best suited for.
    ${leetcodeData ? "4. Assess their DSA/Coding capability based on LeetCode stats." : ""}

    OUTPUT JSON STRUCTURE ONLY (No markdown):
    {
        "candidate_summary": "String",
        "skills": {
            "Languages and Databases": ["Skill A", "Skill B"],
            "Frameworks": ["Skill C", "Skill D"],
            "Tools and Technologies": ["Skill E", "Skill F"]
        },
        "suggested_job_roles": ["Role 1", "Role 2", "Role 3"],
        "leetcode_level": "String (e.g., Intermediate, Advanced) - or null if no stats"
    }
    `;

    const userMessage = `
    RESUME TEXT: 
    ${resumeText}

    ${leetcodeData ? `LEETCODE STATS: ${JSON.stringify(leetcodeData)}` : "LeetCode Data: Not linked"}
    `;

    try {
        const response = await client.chat.completions.create({
            model: 'sonar-pro', 
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ]
        });

        const rawContent = response.choices[0].message.content;
        
        // 👇 FIX 2: Robust Regex JSON Extraction
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            console.error("⚠️ AI Parsing Failed. Raw Output:", rawContent);
            throw new Error("AI response did not contain valid JSON.");
        }

        return JSON.parse(jsonMatch[0]);

    } catch (error) {
        console.error("❌ AI Analysis Error:", error.message);
        throw new Error("AI failed to process the resume.");
    }
}

// --- EXPORT 1: Analyze Profile (URL + LeetCode) ---
async function analyzeProfile(username, resumeUrl) {
    console.log(`\n🔹 Analyzing Profile for ${username}...`);
    
    const [leetcodeData, resumeText] = await Promise.all([
        fetchLeetCodeData(username), 
        extractResumeText(resumeUrl)
    ]);
    
    return await runAIAnalysis(resumeText, leetcodeData);
}

// --- EXPORT 2: Analyze Raw Text (File Upload) ---
async function analyzeRawResume(resumeText) {
    console.log(`\n🔹 Analyzing Uploaded Resume File...`);
    return await runAIAnalysis(resumeText, null);
}

module.exports = { analyzeProfile, analyzeRawResume };