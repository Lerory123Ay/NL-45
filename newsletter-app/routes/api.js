const express = require('express');
const router = express.Router();
const NewsletterEmail = require('../models/NewsletterEmail');
const validator = require('validator');

// Subscribe
router.post('/newsletter/subscribe', async (req, res) => {
  const { email, country } = req.body;

  // Validate email format
  if (!validator.isEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Validate country (ensure it's not empty or just whitespace)
  if (!country || country.trim() === '') {
    return res.status(400).json({ error: 'Country is required' });
  }

  // Check if email already exists
  const existing = await NewsletterEmail.findOne({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'Email already subscribed' });
  }

  // Create new newsletter subscription
  await NewsletterEmail.create({ 
    email, 
    country: country.trim() 
  });

  res.status(201).json({ message: 'Subscription successful' });
});

// Unsubscribe
router.post('/newsletter/unsubscribe', async (req, res) => {
  const { email } = req.body;
  const deleted = await NewsletterEmail.destroy({ where: { email } });
  if (deleted) return res.json({ message: 'Unsubscribed successfully' });
  res.status(404).json({ error: 'Email not found' });
});

module.exports = router;
