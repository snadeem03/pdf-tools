const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const History = sequelize.define('History', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  toolName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  fileName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  fileSize: {
    type: DataTypes.INTEGER, // Bytes
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'success', // success, failed
  },
});

// A user has many history records
User.hasMany(History, { foreignKey: 'userId', onDelete: 'CASCADE' });
History.belongsTo(User, { foreignKey: 'userId' });

module.exports = History;
