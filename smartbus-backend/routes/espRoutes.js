const express = require('express');
const router = express.Router();
const Bus = require('../models/Bus');
const { authenticateESP } = require('../middleware/espAuth');
const { getOccupancyStatus } = require('../utils/occupancyStatus');

// ──────────────────────────────────────────────
// POST /api/esp/update — Bus ESP32 sends passenger data
// Requires x-api-key header for authentication
// ──────────────────────────────────────────────
router.post('/update', authenticateESP, async (req, res) => {
  try {
    const bus = req.bus;
    const { passengersIn, passengersOut, doorAlert } = req.body;

    // Validate numeric inputs
    const pIn = Number(passengersIn) || 0;
    const pOut = Number(passengersOut) || 0;

    if (pIn < 0 || pOut < 0) {
      return res.status(400).json({ error: 'Passenger counts cannot be negative' });
    }

    if (!Number.isInteger(pIn) || !Number.isInteger(pOut)) {
      return res.status(400).json({ error: 'Passenger counts must be integers' });
    }

    // Calculate new occupancy with safety bounds
    let newOccupancy = bus.currentOccupancy + pIn - pOut;

    // Clamp: prevent negative occupancy
    if (newOccupancy < 0) {
      newOccupancy = 0;
    }

    // Clamp: prevent exceeding total capacity
    if (newOccupancy > bus.capacity) {
      newOccupancy = bus.capacity;
    }

    // Update and save
    bus.currentOccupancy = newOccupancy;
    bus.lastUpdated = Date.now();
    await bus.save();

    res.json({
      success: true,
      busNumber: bus.busNumber,
      occupancy: bus.currentOccupancy,
      capacity: bus.capacity,
      occupancyStatus: getOccupancyStatus(bus.currentOccupancy, bus.capacity),
      doorAlert: doorAlert || false,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update bus data' });
  }
});

// ──────────────────────────────────────────────
// GET /api/esp/config — ESP32 fetches its own bus configuration at startup
// Requires x-api-key header for authentication
// ──────────────────────────────────────────────
router.get('/config', authenticateESP, async (req, res) => {
  try {
    const bus = req.bus;
    res.json({
      busNumber: bus.busNumber,
      route: bus.route,
      stops: bus.stops,
      capacity: bus.capacity,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

module.exports = router;
