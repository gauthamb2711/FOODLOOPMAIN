const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

const normalizeRole = (role) => {
  if (!role) return role;
  const r = String(role).toLowerCase();
  // Compatibility: treat "hotel" as the existing "canteen" role in this codebase
  if (r === 'hotel') return 'canteen';
  return r;
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  const { name, email, password, role, organization, location, reg_no, capacity } = req.body;
  const normalizedRole = normalizeRole(role);

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const allowedRoles = new Set(['canteen', 'ngo']);
    if (!allowedRoles.has(normalizedRole)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: normalizedRole,
      organization,
      location,
      reg_no,
      capacity,
      status: normalizedRole === 'ngo' ? 'approved' : 'approved' // Assuming auto-approve for now
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        organization: user.organization,
        location: user.location,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    // Handle MongoDB duplicate key error (code 11000) for any unique field
    if (error.code === 11000 && error.keyPattern) {
      const fields = Object.keys(error.keyPattern);
      // Show a user-friendly message for any duplicate unique field
      return res.status(400).json({
        message: `A user with this ${fields.join(' and ')} already exists.`
      });
    }
    // Hide raw error details from user, show generic message
    res.status(500).json({ message: 'An error occurred. Please try again later.' });
  }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({
      $or: [
        { email: email },
        { reg_no: email }
      ]
    });

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        organization: user.organization,
        location: user.location,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Seed developer accounts
// @route   GET /api/auth/seed
// @access  Public (Dev only)
const seedUsers = async (req, res) => {
  try {
    const canteenEmail = 'demo-canteen@foodloop.com';
    const ngoEmail = 'demo-ngo@foodloop.com';

    let canteen = await User.findOne({ email: canteenEmail });
    if (!canteen) {
      canteen = await User.create({
        name: 'Demo Canteen Admin',
        email: canteenEmail,
        password: 'demo123',
        role: 'canteen',
        organization: 'Canteen Demo Org',
        location: 'Mumbai Central',
        status: 'approved'
      });
    }

    let ngo = await User.findOne({ email: ngoEmail });
    if (!ngo) {
      ngo = await User.create({
        name: 'Demo NGO Admin',
        email: ngoEmail,
        password: 'demo123',
        role: 'ngo',
        reg_no: 'NGO999',
        organization: 'NGO Demo Org',
        location: 'Mumbai South',
        status: 'approved'
      });
    }

    res.json({
      message: 'Seeding successful or users already exist',
      canteen: canteen.email,
      ngo: ngo.email
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all users (for reports/messages)
// @route   GET /api/auth/users
// @access  Private
const getUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { registerUser, loginUser, getUsers, seedUsers };
