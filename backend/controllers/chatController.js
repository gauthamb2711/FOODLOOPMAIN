const Message = require('../models/Message');

// @desc    Get message history between user and partner
// @route   GET /api/chat/:partnerId
// @access  Private
const getMessages = async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { senderId: req.user._id, receiverId: req.params.partnerId },
        { senderId: req.params.partnerId, receiverId: req.user._id }
      ]
    }).sort({ createdAt: 1 });
    
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Save a new message directly via API if WebSocket fails
// @route   POST /api/chat
// @access  Private
const sendMessage = async (req, res) => {
  const { receiverId, text } = req.body;
  
  try {
    const message = await Message.create({
      senderId: req.user._id,
      receiverId,
      text
    });
    
    const io = req.app.get('io');
    if (io) {
      io.to(receiverId.toString()).emit('receive_message', message);
    }
    
    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getMessages, sendMessage };
