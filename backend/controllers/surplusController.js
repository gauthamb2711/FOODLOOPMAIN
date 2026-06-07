const SurplusFood = require('../models/SurplusFood');

const isObjectIdEqual = (a, b) => String(a) === String(b);

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
    if (!req.user) return res.status(401).json({ message: "User session expired" });
    
    const pickupCode = Math.floor(100000 + Math.random() * 900000).toString();
    const surplusItem = await SurplusFood.create({
      canteenId: req.user._id,
      canteenName: req.user.organization || req.user.name || "Canteen",
      food, quantity, preparedTime, expiryTime, location, lat, lng,
      status: 'available',
      pickupCode,
      logs: [{ action: 'available', time: new Date(), actor: 'Canteen' }]
    });

    // Instant broadcast
    const io = req.app.get('io');
    if (io) io.emit('surplus_updated', surplusItem);

    res.status(201).json(surplusItem);
  } catch (error) {
    console.error("🔴 [BACKEND ERROR] Failed to create surplus:", error);
    res.status(500).json({ message: error.message || "Failed to create surplus listing" });
  }
};

// @desc    Update surplus status (Action: request, approve, pickup, handover)
// @route   PUT /api/surplus/:id
// @access  Private
const updateSurplusStatus = async (req, res) => {
  const { status, handoverLocation, conditionAtPickup, requestedBy } = req.body;
  
  try {
    const surplus = await SurplusFood.findById(req.params.id);
    if (!surplus) return res.status(404).json({ message: 'Item not found' });

    const role = req.user?.role;
    if (!role) return res.status(401).json({ message: 'Not authorized' });

    // Prevent cross-tenant updates by other canteens
    if (role === 'canteen' && !isObjectIdEqual(surplus.canteenId, req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to modify this item' });
    }

    const nextStatus = status;
    if (!nextStatus) return res.status(400).json({ message: 'Missing status' });
    if (nextStatus === surplus.status) {
      return res.json(surplus);
    }
    
    // Check for unsets explicitly
    if (requestedBy === null) {
       surplus.requestedBy = null;
       surplus.requestedByName = null;
    }
    
    // Enforce allowed transitions server-side (do not trust client-provided actor/action)
    const now = new Date();
    const isNgo = role === 'ngo';
    const isCanteen = role === 'canteen';

    const ensureRequestedByMe = () => {
      if (!surplus.requestedBy) return false;
      return isObjectIdEqual(surplus.requestedBy, req.user._id);
    };

    // NGO actions
    if (isNgo) {
      if (nextStatus === 'requested') {
        if (surplus.status !== 'available') {
          return res.status(400).json({ message: 'Item is not available for request' });
        }
        surplus.requestedBy = req.user._id;
        surplus.requestedByName = req.user.organization;
      } else {
        if (!ensureRequestedByMe()) {
          return res.status(403).json({ message: 'Not authorized to update this item' });
        }
        const allowedNgoStatuses = new Set(['on_the_way', 'handover_pending', 'completed']);
        if (!allowedNgoStatuses.has(nextStatus)) {
          return res.status(403).json({ message: 'Not authorized for this action' });
        }
        if (nextStatus === 'completed') {
          surplus.completedAt = now;
          if (conditionAtPickup) {
            surplus.conditionAtPickup = conditionAtPickup;
            surplus.handoverStatus = 'accepted';
            surplus.handoverTime = now;
            surplus.handoverLocation = handoverLocation;
          }
        }
      }
    }

    // Canteen actions
    if (isCanteen) {
      const allowedCanteenStatuses = new Set(['approved', 'available', 'expired']);
      if (!allowedCanteenStatuses.has(nextStatus)) {
        return res.status(403).json({ message: 'Not authorized for this action' });
      }
      if (nextStatus === 'approved') {
        if (surplus.status !== 'requested') {
          return res.status(400).json({ message: 'Only requested items can be approved' });
        }
      }
    }

    surplus.status = nextStatus;
    surplus.logs.push({
      action: nextStatus,
      time: now,
      actor: isNgo ? 'NGO' : 'Canteen',
    });
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
