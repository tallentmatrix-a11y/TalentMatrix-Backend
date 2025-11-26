const linkedin = require('linkedin-jobs-api');

async function fetchJobsForRoles(suggestedRoles, location = 'India') {
    console.log(`\n🔹 STEP 2: Fetching real LinkedIn jobs for: ${suggestedRoles.join(", ")}...`);

    let allJobs = [];

    // Limit to the first 2 roles to save time/resources
    const rolesToSearch = suggestedRoles.slice(0, 2);

    for (const role of rolesToSearch) {
        const queryOptions = {
            keyword: role,
            location: location,
            dateSincePosted: 'past Month',
            jobType: 'full time',
            remoteFilter: 'remote',
            salary: '100000+',
            experienceLevel: 'entry level',
            limit: '5', // Fetch 5 jobs per role to keep it fast
            page: '0'
        };

        try {
            console.log(`   -> Querying LinkedIn for "${role}"...`);
            const jobs = await linkedin.query(queryOptions);
            
            // Normalize data structure to ensure consistency
            const validJobs = jobs.map(j => ({
                position: j.position,
                company: j.company,
                location: j.location,
                jobUrl: j.jobUrl,
                agoTime: j.agoTime
            }));
            
            allJobs = [...allJobs, ...validJobs];
            
            // Polite delay between queries
            await new Promise(r => setTimeout(r, 1000));
        } catch (error) {
            console.error(`   -> Failed to fetch jobs for ${role}:`, error.message);
        }
    }

    // Remove duplicates based on jobUrl
    const uniqueJobs = Array.from(new Set(allJobs.map(a => a.jobUrl)))
        .map(url => allJobs.find(a => a.jobUrl === url));

    console.log(`   -> Found ${uniqueJobs.length} total unique jobs.`);
    return uniqueJobs;
}

module.exports = { fetchJobsForRoles };