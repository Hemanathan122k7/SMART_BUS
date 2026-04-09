const express = require('express');
const router = express.Router();
const Bus = require('../models/Bus');

// GET all buses
router.get('/', async (req, res) => {
  try {
    const buses = await Bus.find()
      .select('-apiKey')
      .populate('operator');
    res.json(buses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single bus by ID
router.get('/:id', async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id)
      .select('-apiKey')
      .populate('operator');
    if (!bus) {
      return res.status(404).json({ error: 'Bus not found' });
    }
    res.json(bus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create new bus — auto-generates API key
router.post('/', async (req, res) => {
  try {
    const apiKey = Bus.generateApiKey();
    const bus = new Bus({ ...req.body, apiKey });
    await bus.save();

    res.status(201).json({
      success: true,
      bus: {
        _id: bus._id,
        busNumber: bus.busNumber,
        busName: bus.busName,
        route: bus.route,
        capacity: bus.capacity,
        status: bus.status,
      },
      apiKey,
      message: 'Bus created. Store the API key securely — it will not be shown again.',
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST regenerate API key for an existing bus
router.post('/:id/regenerate-key', async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) {
      return res.status(404).json({ error: 'Bus not found' });
    }

    const newApiKey = Bus.generateApiKey();
    bus.apiKey = newApiKey;
    await bus.save();

    res.json({
      success: true,
      busNumber: bus.busNumber,
      apiKey: newApiKey,
      message: 'API key regenerated. Store it securely — it will not be shown again.',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update bus
router.put('/:id', async (req, res) => {
  try {
    const bus = await Bus.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!bus) {
      return res.status(404).json({ error: 'Bus not found' });
    }
    res.json(bus);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH update bus location and occupancy
router.patch('/:id/location', async (req, res) => {
  try {
    const { latitude, longitude, currentOccupancy } = req.body;
    const bus = await Bus.findByIdAndUpdate(
      req.params.id,
      {
        location: { latitude, longitude },
        currentOccupancy,
        lastUpdated: Date.now(),
      },
      { new: true }
    );
    if (!bus) {
      return res.status(404).json({ error: 'Bus not found' });
    }
    res.json(bus);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE bus
router.delete('/:id', async (req, res) => {
  try {
    const bus = await Bus.findByIdAndDelete(req.params.id);
    if (!bus) {
      return res.status(404).json({ error: 'Bus not found' });
    }
    res.json({ message: 'Bus deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
