// services/leetcode_service.js
const LEETCODE_QUERY = `
  query userProfile($username: String!) {
    matchedUser(username: $username) {
      submitStats: submitStatsGlobal {
        acSubmissionNum {
          difficulty
          count
          submissions
        }
      }
      tagProblemCounts {
        advanced {
          tagName
          problemsSolved
        }
        intermediate {
          tagName
          problemsSolved
        }
        fundamental {
          tagName
          problemsSolved
        }
      }
    }
  }
`;

exports.fetchLeetCodeData = async (username) => {
    if (!username) return { note: "Username not provided" };

    try {
        const response = await fetch('https://leetcode.com/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Referer': 'https://leetcode.com',
                'User-Agent': 'Mozilla/5.0 (compatible; Node.js)'
            },
            body: JSON.stringify({
                query: LEETCODE_QUERY,
                variables: { username }
            })
        });

        const data = await response.json();

        if (data.errors || !data.data?.matchedUser) {
            return { note: "User not found on LeetCode" };
        }

        const userData = data.data.matchedUser;
        const stats = userData.submitStats?.acSubmissionNum || [];

        const getCount = (diff) => {
            const found = stats.find(s => s.difficulty === diff);
            return found ? found.count : 0;
        };

        const allTopics = [
            ...(userData.tagProblemCounts?.fundamental || []),
            ...(userData.tagProblemCounts?.intermediate || []),
            ...(userData.tagProblemCounts?.advanced || [])
        ].map(t => ({
            topicName: t.tagName,
            solved: t.problemsSolved
        })).sort((a, b) => b.solved - a.solved);

        return {
            username: username,
            total: getCount('All'),
            easy: getCount('Easy'),
            medium: getCount('Medium'),
            hard: getCount('Hard'),
            topics: allTopics
        };

    } catch (err) {
        console.error("LeetCode Service Error:", err.message);
        return { note: "Failed to fetch LeetCode data" };
    }
};