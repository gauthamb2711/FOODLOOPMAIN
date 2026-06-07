const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) return res.status(401).json({ message: 'Not authorized, user not found' });
      return next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Not authorized' });
  if (roles.includes(req.user.role)) return next();
  return res.status(403).json({ message: 'Not authorized for this role' });
};

const canteenOnly = (req, res, next) => {
  if (req.user && req.user.role === 'canteen') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as a Canteen' });
  }
};

const ngoOnly = (req, res, next) => {
  if (req.user && req.user.role === 'ngo') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an NGO' });
  }
};

module.exports = { protect, requireRole, canteenOnly, ngoOnly };
