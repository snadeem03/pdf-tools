const jwt = require('jsonwebtoken');

const optionalAuth = (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_for_local_dev');
      req.user = decoded.user;
    } catch (err) {
      // Ignored for optional auth
    }
  }
  next();
};

module.exports = optionalAuth;
