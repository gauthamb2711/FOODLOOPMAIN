const SurplusFood = require('../models/SurplusFood');

// @desc    Get all active surplus food
// @route   GET /api/surplus
// @access  Private
const getSurplus = async (req, res) => {
  try {
    const surplus = await SurplusFood.find().sort({ createdAt: -1 });
    res.json(surplus);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add new surplus food
// @route   POST /api/surplus
// @access  Private (Canteen only)
const createSurplus = async (req, res) => {
  const { food, quantity, preparedTime, expiryTime, location, lat, lng } = req.body;

  try {
    const pickupCode = Math.floor(100000 + Math.random() * 900000).toString();
    const surplusItem = await SurplusFood.create({
      canteenId: req.user._id,
      canteenName: req.user.organization,
      food, quantity, preparedTime, expiryTime, location, lat, lng,
      status: 'available',
      pickupCode,
      logs: [{ action: 'available', time: new Date(), actor: 'Canteen' }]
    });

    res.status(201).json(surplusItem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update surplus status (Action: request, approve, pickup, handover)
// @route   PUT /api/surplus/:id
// @access  Private
const updateSurplusStatus = async (req, res) => {
  const { status, action, actor, handoverLocation, conditionAtPickup, requestedBy, requestedByName } = req.body;
  
  try {
    const surplus = await SurplusFood.findById(req.params.id);
    if (!surplus) return res.status(404).json({ message: 'Item not found' });

    surplus.status = status;
    
    // Check for unsets explicitly
    if (requestedBy === null) {
       surplus.requestedBy = null;
       surplus.requestedByName = null;
    }
    
    // Additional workflow attributes
    if (status === 'requested') {
      surplus.requestedBy = req.user._id;
      surplus.requestedByName = req.user.organization;
    }
    if (status === 'completed') {
      surplus.completedAt = new Date();
      if (conditionAtPickup) {
        surplus.conditionAtPickup = conditionAtPickup;
        surplus.handoverStatus = 'accepted';
        surplus.handoverTime = new Date();
        surplus.handoverLocation = handoverLocation;
      }
    }

    surplus.logs.push({ action, time: new Date(), actor });
    const updatedSurplus = await surplus.save();
    
    // Emit socket event if connected
    const io = req.app.get('io');
    if (io) io.emit('surplus_updated', updatedSurplus);

    res.json(updatedSurplus);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getSurplus, createSurplus, updateSurplusStatus };
