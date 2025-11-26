const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdf = require('pdf-extraction');
const fs = require('fs');


const upload = multer({ dest: 'uploads/' });

// --- 1. Define Skill Categories & Keywords ---
// This dictionary maps categories to the keywords that belong in them.
const SKILL_DICTIONARY = {
    "Languages and Databases": [
        "c", "c++", "java", "python", "html", "css", "javascript", "typescript",
        "sql", "mysql", "mongodb", "sqlite", "postgresql", "nosql", "oracle", "pl/sql", "bash"
    ],
    "Frameworks": [
        "react.js", "react", "node.js", "node", "express", "express.js", "next.js",
        "angular", "vue", "vue.js", "django", "flask", "spring", "spring boot", "bootstrap", "tailwind"
    ],
    "Tools and Technologies": [
        "git", "github", "gitlab", "docker", "kubernetes", "aws", "azure", "gcp",
        "jenkins", "jira", "postman", "microsoft word", "powerpoint", "excel",
        "vs code", "staruml", "rational rose", "linux", "unix"
    ]
};

// --- 2. Helper Functions ---

function fixHyphenSplits(str) {
    if (!str) return str;
    return str.replace(/-\s*\n\s*/g, '');
}

function extractSection(text, sectionTitle, nextSectionTitles) {
    const lowerText = text.toLowerCase();
    const lowerTitle = sectionTitle.toLowerCase();
    const startIndex = lowerText.indexOf(lowerTitle);
    if (startIndex === -1) return null;

    const contentStartIndex = startIndex + sectionTitle.length;
    let endIndex = lowerText.length;

    for (const nextTitle of nextSectionTitles) {
        const nextIndex = lowerText.indexOf(nextTitle.toLowerCase(), contentStartIndex);
        if (nextIndex !== -1 && nextIndex < endIndex) {
            endIndex = nextIndex;
        }
    }
    return text.substring(contentStartIndex, endIndex).trim();
}

// --- 3. Smart Categorizer ---
function categorizeSkills(rawText) {
    const foundSkills = {
        "Languages and Databases": new Set(),
        "Frameworks": new Set(),
        "Tools and Technologies": new Set()
    };

    // Normalize text for searching (lowercase, remove special chars)
    const normalizedText = rawText.toLowerCase().replace(/[^a-z0-9\s.+\-#]/g, " ");
    
    // Check against dictionary
    for (const [category, keywords] of Object.entries(SKILL_DICTIONARY)) {
        for (const keyword of keywords) {
            // Regex to match whole words (e.g., ensure "Java" doesn't match "Javascript")
            // We escape special chars like + (C++) or . (Node.js)
            const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
            
            if (regex.test(normalizedText)) {
                // Use the formatted keyword from the dictionary (or capitalize nicely)
                // For simplicity, we store the keyword as it appeared in our dictionary list, 
                // but you might want a separate "display map" for capitalization (e.g. "node.js" -> "Node.js")
                
                // Simple capitalization helper
                const displaySkill = keyword
                    .split(' ')
                    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(' ')
                    .replace('Sql', 'SQL') // manual fixes
                    .replace('Css', 'CSS')
                    .replace('Html', 'HTML');

                foundSkills[category].add(displaySkill);
            }
        }
    }

    // Convert Sets to Arrays
    return {
        "Languages and Databases": Array.from(foundSkills["Languages and Databases"]),
        "Frameworks": Array.from(foundSkills["Frameworks"]),
        "Tools and Technologies": Array.from(foundSkills["Tools and Technologies"])
    };
}

// --- 4. Main Route ---

router.post('/extract', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filePath = req.file.path;

    try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdf(dataBuffer);
        let rawText = data.text || '';

        // Headers to isolate specific sections
        const allHeaders = [
            'EDUCATION', 'EXPERIENCE', 'PROJECTS', 'CERTIFICATIONS',
            'DECLARATION', 'TECHNICAL SKILLS', 'SKILLS', 'CORE COMPETENCIES'
        ];

        // 1. Extract just the skills section text to avoid false positives from other sections
        let skillsText = extractSection(rawText, 'TECHNICAL SKILLS', allHeaders);
        if (!skillsText) skillsText = extractSection(rawText, 'SKILLS', allHeaders);
        if (!skillsText) skillsText = rawText; // Fallback: Search entire resume if no section found

        skillsText = fixHyphenSplits(skillsText);

        // 2. Categorize
        const categorizedSkills = categorizeSkills(skillsText);

        fs.unlinkSync(filePath);

        res.json({
            success: true,
            skills: categorizedSkills
        });

    } catch (error) {
        console.error('Processing Error:', error);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ error: 'Failed to parse PDF' });
    }
});

module.exports = router;