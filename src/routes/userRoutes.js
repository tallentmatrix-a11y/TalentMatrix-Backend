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
      // Assumption: URL structure is .../resumes/[filename]
      const urlParts = oldUrl.split('/resumes/'); 
      
      if (urlParts.length > 1) {
        const oldPath = urlParts[1]; // Get the path after the bucket name
        
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
    const fileName = `${id}_resume_${timestamp}.pdf`; // Unique name to prevent cache issues

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

module.exports = router;