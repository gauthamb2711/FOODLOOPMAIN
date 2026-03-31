const express = require('express');
const router = express.Router();
const { getMessages, sendMessage } = require('../controllers/chatController');
const { protect } = require('../middlewares/auth');

router.get('/:partnerId', protect, getMessages);
router.post('/', protect, sendMessage);

module.exports = router;
