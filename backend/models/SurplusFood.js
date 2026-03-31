const mongoose = require('mongoose');

const SurplusFoodSchema = new mongoose.Schema({
  canteenId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  canteenName: { type: String, required: true },
  food: { type: String, required: true },
  quantity: { type: Number, required: true },
  preparedTime: { type: String, required: true },
  expiryTime: { type: String, required: true },
  location: { type: String, required: true },
  lat: { type: Number },
  lng: { type: Number },
  status: { 
    type: String, 
    enum: ['available', 'requested', 'approved', 'on_the_way', 'handover_pending', 'completed', 'expired'],
    default: 'available'
  },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  requestedByName: { type: String },
  contact: { type: String },
  pickupTime: { type: String },
  completedAt: { type: Date },
  
  // Digital Handover Fields
  pickupCode: { type: String, required: true },
  handoverStatus: { type: String, enum: ['pending', 'accepted'], default: 'pending' },
  handoverTime: { type: Date },
  handoverLocation: {
    lat: { type: Number },
    lng: { type: Number }
  },
  conditionAtPickup: { type: String, enum: ['good', 'acceptable', 'poor'] },
  
  logs: [{
    action: { type: String },
    time: { type: Date, default: Date.now },
    actor: { type: String }
  }]
}, { timestamps: true });

module.exports = mongoose.model('SurplusFood', SurplusFoodSchema);
