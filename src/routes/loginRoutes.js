// src/routes/loginRoutes.js
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabaseClient');

router.post('/', async (req, res) => {
  try {
    const { Email, Password } = req.body;

    if (!Email || !Password) {
      return res.status(400).json({ error: "Email and Password are required" });
    }

    // 1. Fetch user from Supabase by Email
    const { data: user, error } = await supabase
      .from('students')
      .select('*')
      .eq('email', Email)
      .single(); // .single() expects exactly one row

    // 2. Check if user exists
    if (error || !user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // 3. Check if password matches
    // (Direct comparison because we stored it as plain text in Signup)
    if (user.password !== Password) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // 4. Success! Return user info (exclude password)
    res.status(200).json({
      message: "Login successful",
      user: {
        id: user.id,
        fullname: user.full_name,
        email: user.email,
        rollNumber: user.roll_number
      }
    });

  } catch (err) {
    console.error("Login Error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;