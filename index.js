require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import Routes
const userRoutes = require('./src/routes/userRoutes');
const placementRoutes = require('./src/routes/placementRoutes');
const loginRoutes = require('./src/routes/loginRoutes');
const jobRoutes = require('./src/routes/jobRoutes');
const appliedJobsRoutes = require('./src/routes/appliedJobsRoutes');
const projectRoutes = require('./src/routes/projectRoutes');
const leetcodeRoutes = require('./src/routes/leetcodeRoutes'); // Ensure this file exists!
const resumeRoutes = require('./src/routes/resumeRoutes');
const books = require('./src/routes/booksRoutes');
const aiRoutes = require('./src/routes/aiRoutes');

const app = express();
app.use(cors());
app.use(express.json());

// Mount Routes
app.use('/api/signup', userRoutes);
app.use('/api/placement', placementRoutes);
app.use('/api/login', loginRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applied-jobs', appliedJobsRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/leetcode', leetcodeRoutes); // Critical for stats
app.use('/api/resume', resumeRoutes);
app.use('/api/books', books);
app.use('/api/ai', aiRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});