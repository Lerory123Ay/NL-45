const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
app.use(cookieParser());
const sequelize = require('./config/db');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use((req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
      req.user = decoded;
    } catch (err) {
      // Invalid token - don't set req.user
    }
  }
  next();
});

// Routes
app.use('/', adminRoutes);
app.use('/', apiRoutes);

// Initialize Database
sequelize.sync().then(() => console.log('Database connected'));

// Start Server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

