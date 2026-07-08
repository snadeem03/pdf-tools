const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');

const optionalAuth = (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded.user;
    } catch (err) {
      // Ignored for optional auth
    }
  }
  next();
};

module.exports = optionalAuth;
