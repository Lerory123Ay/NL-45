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
