const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getUsers, seedUsers } = require('../controllers/authController');
const { protect } = require('../middlewares/auth');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/seed', seedUsers);
router.get('/users', protect, getUsers);

module.exports = router;
