app.get('/', (req, res) => {
    res.send(`
        <h2>Login</h2>
        <form method="POST" action="/login">
            <input type="password" name="password" placeholder="Enter Admin Password" required />
            <button type="submit">Login</button>
        </form>
    `);
});

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

// Routes
app.use('/', adminRoutes);
app.use('/', apiRoutes);

// Initialize Database
sequelize.sync().then(() => console.log('Database connected'));

// Start Server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

