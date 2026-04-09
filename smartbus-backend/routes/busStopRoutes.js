const express = require('express');
const router = express.Router();
const Bus = require('../models/Bus');
const { getOccupancyStatus } = require('../utils/occupancyStatus');

// ──────────────────────────────────────────────
// GET /api/busstop/status — All active buses (filterable by route/stop)
// Public read-only endpoint for Bus Stop ESP32 displays
// ──────────────────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const { route, stop } = req.query;

    const filter = { status: 'active' };
    if (route) {
      filter.route = route;
    }
    if (stop) {
      filter.stops = stop;
    }

    const buses = await Bus.find(filter)
      .select('busNumber busName route stops capacity currentOccupancy currentStopIndex lastUpdated')
      .lean();

    const busStatus = buses.map((bus) => ({
      busNumber: bus.busNumber,
      busName: bus.busName,
      route: bus.route,
      currentStop: bus.stops[bus.currentStopIndex] || null,
      currentOccupancy: bus.currentOccupancy,
      capacity: bus.capacity,
      occupancyStatus: getOccupancyStatus(bus.currentOccupancy, bus.capacity),
      lastUpdated: bus.lastUpdated,
    }));

    res.json({ buses: busStatus });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bus status' });
  }
});

// ──────────────────────────────────────────────
// GET /api/busstop/status/:busNumber — Single bus status
// Public read-only endpoint for Bus Stop ESP32 displays
// ──────────────────────────────────────────────
router.get('/status/:busNumber', async (req, res) => {
  try {
    const bus = await Bus.findOne({
      busNumber: req.params.busNumber,
      status: 'active',
    })
      .select('busNumber busName route stops capacity currentOccupancy currentStopIndex lastUpdated')
      .lean();

    if (!bus) {
      return res.status(404).json({ error: 'Bus not found or inactive' });
    }

    res.json({
      busNumber: bus.busNumber,
      busName: bus.busName,
      route: bus.route,
      currentStop: bus.stops[bus.currentStopIndex] || null,
      currentOccupancy: bus.currentOccupancy,
      capacity: bus.capacity,
      occupancyStatus: getOccupancyStatus(bus.currentOccupancy, bus.capacity),
      lastUpdated: bus.lastUpdated,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bus status' });
  }
});

module.exports = router;
