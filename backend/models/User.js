const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, sparse: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['canteen', 'ngo'], required: true },
  organization: { type: String, required: true },
  location: { type: String },
  capacity: { type: Number },
  reg_no: { type: String },
  ngoType: { type: String },
  phone: { type: String },
  address: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
}, { timestamps: true });

// Hash password before saving
UserSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
