const jwt = require('jsonwebtoken');

function authMiddleware(config) {
  return (req, res, next) => {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = header.slice(7);
    try {
      const payload = jwt.verify(token, config.features.auth.jwtSecret);
      req.user = payload;
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

module.exports = { authMiddleware };
