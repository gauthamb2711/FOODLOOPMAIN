const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['canteen', 'ngo'], required: true },
  organization: { type: String, required: true },
  reg_no: { type: String },
  status: { type: String },
});

const User = mongoose.model('User', UserSchema);

async function run() {
  try {
    console.log('Connecting to:', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('demo123', salt);

    const email = 'chinmayi.b2706@gmail.com';
    const reg_no = 'NGO123';

    await User.findOneAndUpdate(
      { email },
      { 
        name: 'Chinmayi NGO', 
        password: hashedPassword,
        role: 'ngo',
        organization: 'Community Relief NGO',
        reg_no: reg_no,
        status: 'approved'
      },
      { upsert: true, new: true }
    );

    console.log(`User ${email} ensured in DB!`);
    console.log(`Email/RegNo: ${email} or ${reg_no}`);
    console.log(`Password: demo123`);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
