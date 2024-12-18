const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const NewsletterEmail = require('../models/NewsletterEmail');
const fs = require('fs');
const path = require('path');
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
router.get('/login', (req, res) =>
  res.send(`
    <form method="post" style="margin: 50px;">
      <input type="password" name="password" placeholder="Enter Password" required />
      <button type="submit">Login</button>
    </form>
  `)
);

router.post('/login', (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) {
    req.session.loggedIn = true;
    return res.redirect('/dashboard');
  }
  res.send('Invalid credentials');
});

// Dashboard Route with UI
router.get('/dashboard', loginRequired, async (req, res) => {
  const emails = await NewsletterEmail.findAll();
  const emailList = emails
    .map((email) => `<tr>
      <td>${email.email}</td>
      <td>
        <form method="POST" action="/delete-email/${email.id}" style="display:inline;">
          <button type="submit">Delete</button>
        </form>
      </td>
    </tr>`)
    .join('');

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Newsletter Dashboard</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
        th { background-color: #f2f2f2; }
        form { margin: 10px 0; }
        button { padding: 5px 10px; }
        input { padding: 5px; margin-right: 10px; }
        #popup { display: none; position: fixed; top: 20%; left: 35%; padding: 20px; background: white; border: 1px solid #ddd; box-shadow: 0 0 10px rgba(0,0,0,0.5); }
        #popup form { display: flex; flex-direction: column; }
      </style>
      <script>
        function openPopup() { document.getElementById('popup').style.display = 'block'; }
        function closePopup() { document.getElementById('popup').style.display = 'none'; }
      </script>
    </head>
    <body>
      <h1>Newsletter Dashboard</h1>
      
      <!-- Add Email Button -->
      <button onclick="openPopup()">Add Email</button>

      <!-- Search Box -->
      <input type="text" id="searchBox" placeholder="Search Emails" onkeyup="searchEmails()" />
      
      <!-- Export Button -->
      <form method="GET" action="/export-emails">
        <button type="submit">Export Emails</button>
      </form>

      <!-- Email Table -->
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="emailTable">
          ${emailList}
        </tbody>
      </table>

      <!-- Add Email Popup -->
      <div id="popup">
        <h3>Add Email</h3>
        <form method="POST" action="/dashboard">
          <input type="email" name="email" placeholder="Enter email" required />
          <button type="submit">Save</button>
        </form>
        <button onclick="closePopup()">Close</button>
      </div>

      <script>
        function searchEmails() {
          const input = document.getElementById('searchBox').value.toLowerCase();
          const rows = document.querySelectorAll('#emailTable tr');
          rows.forEach(row => {
            const email = row.querySelector('td')?.textContent.toLowerCase();
            row.style.display = email && email.includes(input) ? '' : 'none';
          });
        }
      </script>
    </body>
    </html>
  `);
});

// Add Email
router.post('/dashboard', loginRequired, async (req, res) => {
  const { email } = req.body;
  if (!/\S+@\S+\.\S+/.test(email)) return res.status(400).send('Invalid email');
  try {
    await NewsletterEmail.create({ email });
    res.redirect('/dashboard');
  } catch {
    res.send('Email already exists');
  }
});

// Delete Email
router.post('/delete-email/:id', loginRequired, async (req, res) => {
  await NewsletterEmail.destroy({ where: { id: req.params.id } });
  res.redirect('/dashboard');
});

// Export Emails
router.get('/export-emails', loginRequired, async (req, res) => {
  const emails = await NewsletterEmail.findAll();
  const filePath = path.join(__dirname, '../exports/emails.txt');
  const emailText = emails.map(e => e.email).join('\n');

  fs.writeFileSync(filePath, emailText);
  res.download(filePath, 'emails.txt', (err) => {
    if (err) console.error(err);
  });
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;
