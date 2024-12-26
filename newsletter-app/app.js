const express = require('express');
const bodyParser = require('body-parser');
const sequelize = require('./config/db');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SECRET_KEY || 'fallback-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 
  }
}));

// Routes
app.use('/', adminRoutes);
app.use('/', apiRoutes);

// Initialize Database
sequelize.sync().then(() => console.log('Database connected'));

// Start Server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

