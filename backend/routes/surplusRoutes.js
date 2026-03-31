const express = require('express');
const router = express.Router();
const { getSurplus, createSurplus, updateSurplusStatus } = require('../controllers/surplusController');
const { protect, canteenOnly } = require('../middlewares/auth');

router.route('/')
  .get(protect, getSurplus)
  .post(protect, canteenOnly, createSurplus);

router.route('/:id').put(protect, updateSurplusStatus);

module.exports = router;
