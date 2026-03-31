const express = require('express');
const router = express.Router();
const { generateInsights } = require('../controllers/aiController');
const { protect, canteenOnly } = require('../middlewares/auth');

router.post('/predict', protect, canteenOnly, generateInsights);

module.exports = router;
