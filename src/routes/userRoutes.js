const express = require('express');
const router = express.Router();
const multer = require('multer'); // Required for file handling
const fs = require('fs');       // Required for file system access
const supabase = require('../config/supabaseClient');

// Configure Multer to save files temporarily
const upload = multer({ dest: 'uploads/' });

// ---------------------------------------------------------
// 1. CREATE USER (Signup)
// Endpoint: POST /api/signup
// ---------------------------------------------------------
router.post('/', async (req, res) => {
  try {
    const { FullName, Email, Password } = req.body;

    // Create User in DB
    const { data, error } = await supabase
      .from('students')
      .insert([
        { 
          full_name: FullName, 
          email: Email, 
          password: Password // Note: In production, hash this password!
        }
      ])
      .select()
      .single();

    if (error) throw error;

    // Return the new User ID to Frontend
    res.status(201).json({ 
      user: { 
        id: data.id, 
        fullname: data.full_name, 
        email: data.email 
      } 
    });

  } catch (err) {
    console.error("Signup Error:", err.message);
    res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------
// 2. GET USER PROFILE
// Endpoint: GET /api/signup/:id
// ---------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    res.status(200).json(data);
  } catch (err) {
    console.error("Fetch Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------
// 3. UPDATE USER PROFILE (Text Fields)
// Endpoint: PUT /api/signup/:id
// ---------------------------------------------------------
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body; 

    if (!id) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Update the specific user row with the new data
    const { data, error } = await supabase
      .from('students')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ message: "Profile updated successfully", data });

  } catch (err) {
    console.error("Update Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------
// 4. UPDATE RESUME (Upload New & Delete Old)
// Endpoint: PUT /api/signup/:id/resume
// ---------------------------------------------------------
router.put('/:id/resume', upload.single('resume'), async (req, res) => {
  const filePath = req.file ? req.file.path : null;
  const { id } = req.params;

  if (!filePath) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    // 1. Fetch the user's CURRENT resume URL from DB
    const { data: userData, error: fetchError } = await supabase
      .from('students')
      .select('resume_url')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // 2. If an old resume exists, DELETE it from Storage
    if (userData && userData.resume_url) {
      const oldUrl = userData.resume_url;
      
      // Parse the path from the URL. 
      const urlParts = oldUrl.split('/resumes/'); 
      
      if (urlParts.length > 1) {
        const oldPath = urlParts[1]; 
        
        const { error: deleteError } = await supabase.storage
          .from('resumes')
          .remove([oldPath]);
          
        if (deleteError) {
             console.warn("Warning: Could not delete old resume from bucket:", deleteError.message);
        } else {
             console.log("Old resume deleted successfully:", oldPath);
        }
      }
    }

    // 3. UPLOAD the NEW Resume
    const fileContent = fs.readFileSync(filePath);
    const timestamp = Date.now();
    const fileName = `${id}_resume_${timestamp}.pdf`; 

    const { error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(fileName, fileContent, {
        contentType: 'application/pdf',
        upsert: true 
      });

    if (uploadError) throw uploadError;

    // 4. Get Public URL
    const { data: urlData } = supabase.storage
      .from('resumes')
      .getPublicUrl(fileName);

    const newResumeUrl = urlData.publicUrl;

    // 5. UPDATE Database with new URL
    const { data: updateData, error: dbUpdateError } = await supabase
      .from('students')
      .update({ resume_url: newResumeUrl })
      .eq('id', id)
      .select()
      .single();

    if (dbUpdateError) throw dbUpdateError;

    // Cleanup local file
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({ 
      message: "Resume updated successfully", 
      resumeUrl: newResumeUrl 
    });

  } catch (err) {
    console.error("Resume Update Error:", err);
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); // Cleanup on error
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------
// 5. UPDATE PROFILE IMAGE (Upload New & Delete Old)
// Endpoint: PUT /api/signup/:id/profile-image
// ---------------------------------------------------------
router.put('/:id/profile-image', upload.single('profileImage'), async (req, res) => {
  const filePath = req.file ? req.file.path : null;
  const { id } = req.params;

  // 1. Validation
  if (!filePath) {
    return res.status(400).json({ error: "No image file uploaded" });
  }

  try {
    // 2. Fetch the user's CURRENT profile image URL to delete it later
    const { data: userData, error: fetchError } = await supabase
      .from('students')
      .select('profile_image_url') 
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // 3. If an old image exists, DELETE it from 'profile_images' bucket
    if (userData && userData.profile_image_url) {
      const oldUrl = userData.profile_image_url;
      
      const urlParts = oldUrl.split('/profile_images/');
      
      if (urlParts.length > 1) {
        const oldPath = urlParts[1];
        
        const { error: deleteError } = await supabase.storage
          .from('profile_images') 
          .remove([oldPath]);
          
        if (deleteError) {
           console.warn("Warning: Could not delete old image:", deleteError.message);
        }
      }
    }

    // 4. UPLOAD the NEW Image
    const fileContent = fs.readFileSync(filePath);
    const timestamp = Date.now();
    const fileName = `${id}_profile_${timestamp}_${req.file.originalname}`; 

    const { error: uploadError } = await supabase.storage
      .from('profile_images') 
      .upload(fileName, fileContent, {
        contentType: req.file.mimetype, 
        upsert: true 
      });

    if (uploadError) throw uploadError;

    // 5. Get Public URL
    const { data: urlData } = supabase.storage
      .from('profile_images')
      .getPublicUrl(fileName);

    const newImageUrl = urlData.publicUrl;

    // 6. UPDATE Database with new URL
    const { data: updateData, error: dbUpdateError } = await supabase
      .from('students')
      .update({ profile_image_url: newImageUrl }) 
      .eq('id', id)
      .select()
      .single();

    if (dbUpdateError) throw dbUpdateError;

    // Cleanup local file
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({ 
      message: "Profile image updated successfully", 
      imageUrl: newImageUrl 
    });

  } catch (err) {
    console.error("Profile Image Update Error:", err);
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); // Cleanup
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
//           SKILLS ENDPOINTS
// ==========================================

// 6. ADD SKILL
// Endpoint: POST /api/signup/skills
router.post('/skills', async (req, res) => {
  const { student_id, skill_name, proficiency, tags } = req.body;

  if (!student_id || !skill_name) {
    return res.status(400).json({ error: 'Student ID and Skill Name are required' });
  }

  try {
    const { data, error } = await supabase
      .from('skills')
      .insert([{ student_id, skill_name, proficiency, tags }])
      .select();

    if (error) throw error;
    // Return the created skill (so frontend gets the new ID)
    res.status(201).json(data[0]);
  } catch (error) {
    console.error("Add Skill Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 7. GET SKILLS for a Student
// Endpoint: GET /api/signup/:id/skills
router.get('/:id/skills', async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('skills')
      .select('*')
      .eq('student_id', id);

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    console.error("Get Skills Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 8. DELETE SKILL
// Endpoint: DELETE /api/signup/skills/:id
router.delete('/skills/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('skills')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.status(200).json({ message: 'Skill deleted successfully' });
  } catch (error) {
    console.error("Delete Skill Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
//           PROJECTS ENDPOINTS
// ==========================================

// 9. ADD PROJECT
// Endpoint: POST /api/signup/projects
router.post('/projects', async (req, res) => {
  const { student_id, title, description, link, tags } = req.body;

  if (!student_id || !title) {
    return res.status(400).json({ error: 'Student ID and Project Title are required' });
  }

  try {
    const { data, error } = await supabase
      .from('projects')
      .insert([{ student_id, title, description, link, tags }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error("Add Project Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 10. GET PROJECTS for a Student
// Endpoint: GET /api/signup/projects/:student_id
router.get('/projects/:student_id', async (req, res) => {
  const { student_id } = req.params;

  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('student_id', student_id)
      .order('created_at', { ascending: false }); // Optional: sort by newest

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    console.error("Get Projects Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 11. DELETE PROJECT
// Endpoint: DELETE /api/signup/projects/:id
router.delete('/projects/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.status(200).json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error("Delete Project Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
//           APPLIED JOBS ENDPOINTS
// ==========================================

// 12. SAVE JOB
// Endpoint: POST /api/signup/applied-jobs
router.post('/applied-jobs', async (req, res) => {
  // Ensure your frontend sends 'student_id' in the body!
  const { student_id, job_url, job_title, company, status } = req.body;

  try {
    const { data, error } = await supabase
      .from('applied_jobs')
      .insert([{ student_id, job_url, job_title, company, status }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error("Save Job Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;