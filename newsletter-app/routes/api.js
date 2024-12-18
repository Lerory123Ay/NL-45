const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const NewsletterEmail = require('../models/NewsletterEmail');
require('dotenv').config();

router.use(
  session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: true
  })
);

// Middleware to check login
function loginRequired(req, res, next) {
  if (!req.session.loggedIn) return res.redirect('/login');
  next();
}

// Login route
router.get('/login', (req, res) => res.send('<form method="post"><input type="password" name="password"><input type="submit"></form>'));
router.post('/login', (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) {
    req.session.loggedIn = true;
    return res.redirect('/dashboard');
  }
  res.send('Invalid credentials');
});

// Dashboard
router.get('/dashboard', loginRequired, async (req, res) => {
  const emails = await NewsletterEmail.findAll();
  res.json(emails);
});

// Add email
router.post('/dashboard', loginRequired, async (req, res) => {
  const { email } = req.body;
  if (!/\S+@\S+\.\S+/.test(email)) return res.status(400).send('Invalid email');
  try {
    await NewsletterEmail.create({ email });
    res.send('Email added');
  } catch {
    res.send('Email already exists');
  }
});

// Delete email
router.post('/delete-email/:id', loginRequired, async (req, res) => {
  await NewsletterEmail.destroy({ where: { id: req.params.id } });
  res.send('Email deleted');
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.send('Logged out');
});

module.exports = router;

