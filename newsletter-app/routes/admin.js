const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const { Op, Sequelize } = require('sequelize');
const jwt = require('jsonwebtoken');
const NewsletterEmail = require('../models/NewsletterEmail');
const fs = require('fs');
const path = require('path');
const csv = require('csv-writer').createObjectCsvWriter;
require('dotenv').config();

// Add body parsing middleware
router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

// Session Configuration
const authenticateJWT = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.redirect('/login');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
    req.user = decoded;
    next();
  } catch (err) {
    res.clearCookie('token');
    return res.redirect('/login');
  }
};

// Login POST route with JWT
router.post('/login', async (req, res) => {
  try {
    if (req.body.password === process.env.ADMIN_PASSWORD) {
      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: 'admin',
          timestamp: new Date().toISOString()
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { 
          expiresIn: '24h' 
        }
      );

      // Set token in HTTP-only cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      // Redirect to dashboard
      return res.json({
        success: true,
        message: 'Authentication successful',
        redirectUrl: '/dashboard'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during authentication'
    });
  }
});

// Login route
router.get('/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Admin Login</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f0f2f5;
          }
          .login-container {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            width: 300px;
          }
          input {
            width: 100%;
            padding: 10px;
            margin: 10px 0;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
          }
          button {
            width: 100%;
            padding: 10px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
          }
          button:hover {
            background-color: #45a049;
          }
          .error-message {
            color: red;
            margin-top: 10px;
            text-align: center;
            display: none;
          }
        </style>
      </head>
      <body>
        <div class="login-container">
          <h2 style="text-align: center; margin-bottom: 20px;">Admin Login</h2>
          <form id="loginForm" method="post">
            <input 
              type="password" 
              name="password" 
              placeholder="Enter Password" 
              required 
              autocomplete="current-password"
            />
            <button type="submit">Login</button>
          </form>
          <div id="errorMessage" class="error-message"></div>
        </div>

        <script>
          document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const errorMessage = document.getElementById('errorMessage');
            const submitButton = e.target.querySelector('button');
            submitButton.disabled = true;
            
            try {
              const response = await fetch('/login', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  password: e.target.password.value
                })
              });
              
              const data = await response.json();
              
              if (data.success) {
                // Store the token in localStorage if needed
                if (data.token) {
                  localStorage.setItem('authToken', data.token);
                }
                
                // Redirect to dashboard or specified redirect URL
                window.location.href = data.redirectUrl || '/dashboard';
              } else {
                errorMessage.textContent = data.message || 'Invalid credentials';
                errorMessage.style.display = 'block';
                submitButton.disabled = false;
              }
            } catch (error) {
              console.error('Login error:', error);
              errorMessage.textContent = 'An error occurred during login';
              errorMessage.style.display = 'block';
              submitButton.disabled = false;
            }
          });
        </script>
      </body>
    </html>
  `);
});

// Dashboard Route with Enhanced Features
router.get('/dashboard', authenticateJWT, async (req, res) => {
  try {
    // Search and Filtering
    const searchTerm = req.query.search || '';
    const country = req.query.country || '';
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    // Build where conditions
    const whereConditions = {};
    if (searchTerm) {
      whereConditions.email = { [Op.like]: `%${searchTerm}%` };
    }
    if (country) {
      whereConditions.country = country;
    }
    if (startDate && endDate) {
      whereConditions.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    // Fetch unique countries for filter dropdown
    const countries = await NewsletterEmail.findAll({
      attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('country')), 'country']],
      raw: true
    });

    // Fetch paginated and filtered emails
    const { count, rows: emails } = await NewsletterEmail.findAndCountAll({
      where: whereConditions,
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    // Prepare email list for table
    const emailList = emails
      .map(email => `
        <tr>
          <td>
            <input type="checkbox" class="email-checkbox" data-id="${email.id}" />
          </td>
          <td>${email.email}</td>
          <td>${email.country}</td>
          <td>${new Date(email.createdAt).toLocaleDateString()}</td>
          <td>
            <form method="POST" action="/delete-email/${email.id}" style="display:inline;">
              <button type="submit">Delete</button>
            </form>
          </td>
        </tr>
      `)
      .join('');

    // Prepare pagination links
    const totalPages = Math.ceil(count / limit);
    const paginationLinks = Array.from({ length: totalPages }, (_, i) => 
      `<a href="/dashboard?page=${i + 1}&search=${encodeURIComponent(searchTerm)}&country=${encodeURIComponent(country)}&startDate=${startDate}&endDate=${endDate}" ${page === i + 1 ? 'style="font-weight:bold;"' : ''}>${i + 1}</a>`
    ).join(' ');

    // Country dropdown options
    const countryOptions = countries
      .map(c => `<option value="${c.country}">${c.country}</option>`)
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
            .search-container { 
              display: flex; 
              gap: 10px; 
              margin-bottom: 20px; 
              align-items: center; 
            }
            .search-container input, 
            .search-container select { 
              padding: 5px; 
              flex-grow: 1; 
            }
            .pagination a {
              margin: 0 5px;
              text-decoration: none;
              color: black;
            }
            .export-link {
              display: inline-block;
              margin-top: 10px;
              padding: 5px 10px;
              background-color: #4CAF50;
              color: white;
              text-decoration: none;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <h1>Newsletter Dashboard</h1>
          
          <!-- Advanced Search and Filter -->
          <div class="search-container">
            <input 
              type="text" 
              id="searchInput" 
              placeholder="Search emails..." 
              value="${searchTerm}" 
            />
            <select id="countryFilter">
              <option value="">All Countries</option>
              ${countryOptions}
            </select>
            <input 
              type="date" 
              id="startDate" 
              value="${startDate}" 
              placeholder="Start Date" 
            />
            <input 
              type="date" 
              id="endDate" 
              value="${endDate}" 
              placeholder="End Date" 
            />
            <button id="searchButton">Search</button>
            <button id="clearButton">Clear</button>
          </div>

          <!-- Bulk Actions -->
          <div>
            <button id="selectAllBtn">Select All</button>
            <button id="deleteSelectedBtn">Delete Selected</button>
            <a href="/export" class="export-link">Export Emails</a>
            <a href="/logout" style="margin-left: 10px; color: red;">Logout</a>
          </div>

          <!-- Email Table -->
          <table>
            <thead>
              <tr>
                <th>
                  <input type="checkbox" id="masterCheckbox" />
                </th>
                <th>Email</th>
                <th>Country</th>
                <th>Subscription Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="emailTable">
              ${emailList}
            </tbody>
          </table>

          <!-- Pagination -->
          <div class="pagination">
            ${paginationLinks}
          </div>

          <script>
            // Master Checkbox Logic
            const masterCheckbox = document.getElementById('masterCheckbox');
            const emailCheckboxes = document.querySelectorAll('.email-checkbox');

            masterCheckbox.addEventListener('change', (e) => {
              emailCheckboxes.forEach(checkbox => {
                checkbox.checked = e.target.checked;
              });
            });

            // Search and Filter Logic
            document.getElementById('searchButton').addEventListener('click', () => {
              const searchTerm = document.getElementById('searchInput').value;
              const country = document.getElementById('countryFilter').value;
              const startDate = document.getElementById('startDate').value;
              const endDate = document.getElementById('endDate').value;
  
              window.location.href = '/dashboard?search=' + encodeURIComponent(searchTerm) + 
                '&country=' + encodeURIComponent(country) + 
                '&startDate=' + startDate + 
                '&endDate=' + endDate;
            });

            // Clear Search
            document.getElementById('clearButton').addEventListener('click', () => {
              window.location.href = '/dashboard';
            });

            // Delete Selected Emails
            document.getElementById('deleteSelectedBtn').addEventListener('click', async () => {
              const selectedIds = Array.from(emailCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.dataset.id);

              if (selectedIds.length === 0) {
                alert('No emails selected');
                return;
              }

              if (confirm(\`Are you sure you want to delete \${selectedIds.length} email(s)?\`)) {
                try {
                  const response = await fetch('/delete-multiple-emails', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ ids: selectedIds })
                  });

                  if (response.ok) {
                    window.location.reload();
                  } else {
                    const errorData = await response.json();
                    alert(errorData.error || 'Failed to delete emails');
                  }
                } catch (error) {
                  console.error('Delete error:', error);
                  alert('An error occurred while deleting emails');
                }
              }
            });
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Error loading dashboard');
  }
});

// Route to handle multiple email deletion
router.post('/delete-multiple-emails', authenticateJWT, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No email IDs provided' });
    }

    const deleteResult = await NewsletterEmail.destroy({
      where: {
        id: { [Op.in]: ids }
      }
    });

    res.json({ 
      message: `Deleted ${deleteResult} email(s)`,
      deletedCount: deleteResult 
    });
  } catch (error) {
    console.error('Multiple email deletion error:', error);
    res.status(500).json({ error: 'Failed to delete emails' });
  }
});

// Single email deletion route
router.post('/delete-email/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    
    const deleteResult = await NewsletterEmail.destroy({
      where: { id }
    });

    if (deleteResult) {
      res.redirect('/dashboard');
    } else {
      res.status(404).send('Email not found');
    }
  } catch (error) {
    console.error('Single email deletion error:', error);
    res.status(500).send('Error deleting email');
  }
});

// Export Emails Route with Error Handling
router.get('/export-emails', authenticateJWT, async (req, res) => {
  try {
    // Determine export type and filter
    const exportType = req.query.type || 'all';
    const country = req.query.country || null;

    // Prepare export directory
    const exportDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    // Build query conditions
    const whereConditions = country ? { country } : {};

    // Fetch emails based on export type and country
    const emails = await NewsletterEmail.findAll({
      where: whereConditions,
      attributes: ['email', 'country', 'createdAt'],
      raw: true
    });

    if (emails.length === 0) {
      return res.status(404).send('No emails found to export');
    }

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFilename = country 
      ? `newsletter_emails_${country}_${timestamp}` 
      : `newsletter_emails_all_${timestamp}`;

    // Export options
    const exportFormats = {
      txt: () => {
        const filePath = path.join(exportDir, `${baseFilename}.txt`);
        const emailText = emails.map(e => `${e.email},${e.country}`).join('\n');
        fs.writeFileSync(filePath, emailText);
        return filePath;
      },
      csv: () => {
        const filePath = path.join(exportDir, `${baseFilename}.csv`);
        const csvWriter = csv({
          path: filePath,
          header: [
            {id: 'email', title: 'EMAIL'},
            {id: 'country', title: 'COUNTRY'},
            {id: 'createdAt', title: 'SUBSCRIPTION DATE'}
          ]
        });
        
        const csvData = emails.map(email => ({
          email: email.email,
          country: email.country,
          createdAt: new Date(email.createdAt).toISOString()
        }));

        return csvWriter.writeRecords(csvData)
          .then(() => filePath);
      },
      json: () => {
        const filePath = path.join(exportDir, `${baseFilename}.json`);
        const jsonData = JSON.stringify(emails, null, 2);
        fs.writeFileSync(filePath, jsonData);
        return filePath;
      }
    };

    // Determine export format (default to txt)
    const format = req.query.format || 'txt';
    
    if (!exportFormats[format]) {
      return res.status(400).send('Invalid export format');
    }

    const filePath = await exportFormats[format]();

    // Send file for download
    res.download(filePath, path.basename(filePath), (err) => {
      if (err) {
        console.error('Download error:', err);
        return res.status(500).send('Error downloading file');
      }
      
      // Remove file after download
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error('Error removing export file:', unlinkErr);
        }
      });
    });

  } catch (error) {
    console.error('Export emails error:', error);
    res.status(500).send('Error exporting emails');
  }
});

// Export Form Route
router.get('/export', authenticateJWT, async (req, res) => {
  try {
    // Fetch unique countries
    const countries = await NewsletterEmail.findAll({
      attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('country')), 'country']],
      raw: true
    });

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Export Emails</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .export-container {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          }
          select, input {
            width: 100%;
            padding: 10px;
            margin: 10px 0;
            border: 1px solid #ddd;
            border-radius: 4px;
          }
          button {
            width: 100%;
            padding: 10px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
          }
          button:hover {
            background-color: #45a049;
          }
          .back-link {
            display: block;
            margin-top: 15px;
            text-align: center;
            text-decoration: none;
            color: #4CAF50;
          }
          .error-message {
            color: red;
            margin-top: 10px;
            display: none;
          }
        </style>
      </head>
      <body>
        <div class="export-container">
          <h2>Export Newsletter Emails</h2>
          <form id="exportForm" action="/export-emails" method="GET">
            <div>
              <label for="type">Export Type:</label>
              <select name="type" id="type" required>
                <option value="all">All Emails</option>
                <option value="country">By Country</option>
              </select>
            </div>

            <div>
              <label for="country">Country (optional):</label>
              <select name="country" id="country">
                <option value="">Select Country</option>
                ${countries.map(c => `<option value="${c.country}">${c.country}</option>`).join('')}
              </select>
            </div>

            <div>
              <label for="format">Format:</label>
              <select name="format" id="format" required>
                <option value="txt">Text (.txt)</option>
                <option value="csv">CSV (.csv)</option>
                <option value="json">JSON (.json)</option>
              </select>
            </div>

            <button type="submit">Export</button>
          </form>
          <div id="errorMessage" class="error-message"></div>
          <a href="/dashboard" class="back-link">Back to Dashboard</a>
        </div>

        <script>
          document.getElementById('exportForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const errorMessage = document.getElementById('errorMessage');
            const submitButton = form.querySelector('button');
            
            try {
              submitButton.disabled = true;
              const type = form.type.value;
              const country = form.country.value;
              const format = form.format.value;

              // Validate country selection when type is "country"
              if (type === 'country' && !country) {
                throw new Error('Please select a country when exporting by country');
              }

              // Build query string
              const queryParams = new URLSearchParams({
                type,
                format,
                ...(country && { country })
              });

              // Trigger download
              window.location.href = \`/export-emails?\${queryParams.toString()}\`;
            } catch (error) {
              errorMessage.textContent = error.message;
              errorMessage.style.display = 'block';
            } finally {
              submitButton.disabled = false;
            }
          });

          // Show/hide country select based on export type
          document.getElementById('type').addEventListener('change', (e) => {
            const countrySelect = document.getElementById('country');
            countrySelect.required = e.target.value === 'country';
            countrySelect.disabled = e.target.value === 'all';
          });
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Export form error:', error);
    res.status(500).send('Error loading export form');
  }
});

// Logout route
router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

// 404 Route
router.use((req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Page Not Found</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 50px; 
          }
          .container {
            max-width: 500px;
            margin: 0 auto;
            background: #f9f9f9;
            padding: 20px;
            border-radius: 8px;
          }
          a {
            color: #4CAF50;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>404 - Page Not Found</h1>
          <p>The page you are looking for does not exist.</p>
          <p><a href="/dashboard">Return to Dashboard</a></p>
        </div>
      </body>
    </html>
  `);
});

module.exports = router;
