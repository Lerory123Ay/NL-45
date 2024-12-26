const express = require('express');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const sequelize = require('./config/db');
const adminRoutes = require('./routes/admin');
const cors = require('cors');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cookieParser());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// Replace the middleware in app.js (around line 16) with:
app.use((req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
      req.user = decoded;
    } catch (err) {
      // Invalid token - don't set req.user
      res.clearCookie('token'); // Clear invalid cookie
    }
  }
  next();
});

// Routes
app.use('/', adminRoutes);
app.use('/api', apiRoutes);

// Initialize Database
sequelize.sync().then(() => console.log('Database connected'));

// Start Server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

