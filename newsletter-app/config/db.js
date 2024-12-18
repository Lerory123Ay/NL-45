const { Sequelize } = require('sequelize');

// Load environment variables
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is missing.');
    process.exit(1);
}

// Initialize Sequelize with SSL options for Heroku PostgreSQL
const sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false, // Allows self-signed certificates (Heroku requirement)
        },
    },
    logging: false, // Disable query logging
});

module.exports = sequelize;
