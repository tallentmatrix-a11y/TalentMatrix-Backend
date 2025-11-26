const express = require('express');
const multer = require('multer');
const supabase = require('../config/supabaseClient');
const router = express.Router();

// Configure Multer (RAM Storage)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Endpoint: POST /api/placement
router.post('/', upload.fields([{ name: 'resumeUpload' }, { name: 'imageUpload' }]), async (req, res) => {
  try {
    const { userId, RollNumber, Year, Semester, ...otherData } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const updates = {
      roll_number: RollNumber,
      current_year: Year,
      current_semester: Semester,
      gpa_sem_1: otherData.gpa_sem_1 || null,
      gpa_sem_2: otherData.gpa_sem_2 || null,
      gpa_sem_3: otherData.gpa_sem_3 || null,
      gpa_sem_4: otherData.gpa_sem_4 || null,
      gpa_sem_5: otherData.gpa_sem_5 || null,
      gpa_sem_6: otherData.gpa_sem_6 || null,
      gpa_sem_7: otherData.gpa_sem_7 || null,
      gpa_sem_8: otherData.gpa_sem_8 || null,
    };

    // --- Upload Resume ---
    if (req.files['resumeUpload'] && req.files['resumeUpload'][0]) {
      const file = req.files['resumeUpload'][0];
      const filePath = `public/${userId}_resume_${Date.now()}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, file.buffer, { contentType: 'application/pdf' });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('resumes')
        .getPublicUrl(filePath);
        
      updates.resume_url = urlData.publicUrl;
    }

    // --- Upload Image ---
    if (req.files['imageUpload'] && req.files['imageUpload'][0]) {
      const file = req.files['imageUpload'][0];
      const fileExt = file.mimetype.split('/')[1] || 'jpg';
      const filePath = `public/${userId}_avatar_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profile_images')
        .upload(filePath, file.buffer, { contentType: file.mimetype });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('profile_images')
        .getPublicUrl(filePath);

      updates.profile_image_url = urlData.publicUrl;
    }

    // --- Update DB ---
    const { data, error } = await supabase
      .from('students')
      .update(updates)
      .eq('id', userId)
      .select();

    if (error) throw error;

    res.status(200).json({ message: "Profile completed successfully", data });

  } catch (err) {
    console.error("Placement Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;