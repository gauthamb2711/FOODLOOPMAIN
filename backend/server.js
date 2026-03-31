const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // For development, allow all origins
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

const { MongoMemoryServer } = require('mongodb-memory-server');

// Database Connection with Zero-Config Fallback
const connectDB = async () => {
  try {
    // Attempt connecting to the user's local MongoDB first
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 2000 });
    console.log('MongoDB connected successfully (Local Daemon/Atlas)');
  } catch (err) {
    console.warn('Local MongoDB offline. Booting Zero-Config Database (MemoryServer)...');
    try {
      const mongoServer = await MongoMemoryServer.create();
      const uri = mongoServer.getUri();
      await mongoose.connect(uri);
      console.log('Zero-Config MongoDB (In-Memory) connected successfully!');
      console.log(`Database acts as a fully compliant Mongoose backend.`);
    } catch (memErr) {
      console.error('Failed to boot Memory Server:', memErr);
    }
  }
};
connectDB();

// Socket.io Setup
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  // Join a room based on userId to receive direct messages
  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined room`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Make io accessible to routes
app.set('io', io);

// Routes
const authRoutes = require('./routes/authRoutes');
const surplusRoutes = require('./routes/surplusRoutes');
const logRoutes = require('./routes/logRoutes');
const chatRoutes = require('./routes/chatRoutes');
const aiRoutes = require('./routes/aiRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/surplus', surplusRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/ai', aiRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'API is running' }));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
