const mongoose = require('mongoose');

const FoodLogSchema = new mongoose.Schema({
  canteenId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true },
  menuItems: { type: String, required: true },
  studentFootfall: { type: Number, required: true },
  foodPrepared: { type: Number, required: true },
  foodConsumed: { type: Number, required: true },
  surplus: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('FoodLog', FoodLogSchema);
