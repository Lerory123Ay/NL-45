const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const NewsletterEmail = sequelize.define('NewsletterEmail', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  country: { type: DataTypes.STRING, allowNull: false },
  createdAt: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
});

module.exports = NewsletterEmail;
