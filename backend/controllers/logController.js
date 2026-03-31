const FoodLog = require('../models/FoodLog');

// @desc    Get all daily logs for the logged-in canteen
// @route   GET /api/logs
// @access  Private (Canteen only)
const getLogs = async (req, res) => {
  try {
    const logs = await FoodLog.find({ canteenId: req.user._id }).sort({ date: -1 });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a daily food log
// @route   POST /api/logs
// @access  Private (Canteen only)
const createLog = async (req, res) => {
  const { date, menuItems, studentFootfall, foodPrepared, foodConsumed } = req.body;
  const surplus = foodPrepared - foodConsumed;
  
  try {
    const log = await FoodLog.create({
      canteenId: req.user._id,
      date, menuItems, studentFootfall, foodPrepared, foodConsumed, surplus
    });

    res.status(201).json(log);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getLogs, createLog };
