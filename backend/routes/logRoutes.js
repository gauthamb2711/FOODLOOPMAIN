const express = require('express');
const router = express.Router();
const { getLogs, createLog } = require('../controllers/logController');
const { protect, canteenOnly } = require('../middlewares/auth');

router.route('/')
  .get(protect, canteenOnly, getLogs)
  .post(protect, canteenOnly, createLog);

module.exports = router;
