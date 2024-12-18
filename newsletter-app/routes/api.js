const express = require('express');
const router = express.Router();
const NewsletterEmail = require('../models/NewsletterEmail');

// Subscribe
router.post('/api/newsletter/subscribe', async (req, res) => {
  const { email } = req.body;
  if (!/\S+@\S+\.\S+/.test(email)) return res.status(400).json({ error: 'Invalid email format' });

  const existing = await NewsletterEmail.findOne({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Email already subscribed' });

  await NewsletterEmail.create({ email });
  res.status(201).json({ message: 'Subscription successful' });
});

// Unsubscribe
router.post('/api/newsletter/unsubscribe', async (req, res) => {
  const { email } = req.body;
  const deleted = await NewsletterEmail.destroy({ where: { email } });
  if (deleted) return res.json({ message: 'Unsubscribed successfully' });
  res.status(404).json({ error: 'Email not found' });
});

module.exports = router;
