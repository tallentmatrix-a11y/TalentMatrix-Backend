const express = require('express');
const router = express.Router();
const supabase = require('../config/supabaseClient');

// GET /api/projects/:studentId - Fetch all manual projects
router.get('/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { data, error } = await supabase
      .from('student_projects')
      .select('*')
      .eq('student_id', studentId);

    if (error) throw error;
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects - Add a new project
router.post('/', async (req, res) => {
  try {
    const { studentId, title, link, tags, description } = req.body;
    
    const { data, error } = await supabase
      .from('student_projects')
      .insert([{ student_id: studentId, title, link, tags, description }])
      .select();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:projectId - Delete a project
router.delete('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { error } = await supabase
      .from('student_projects')
      .delete()
      .eq('id', projectId);

    if (error) throw error;
    res.status(200).json({ message: "Project deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;