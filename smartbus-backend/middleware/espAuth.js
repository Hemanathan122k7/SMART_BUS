const Bus = require('../models/Bus');

/**
 * Middleware to authenticate ESP32 bus devices via API key.
 * Expects header: x-api-key
 * On success, attaches the authenticated bus document to req.bus.
 */
const authenticateESP = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || typeof apiKey !== 'string' || apiKey.length === 0) {
    return res.status(401).json({ error: 'Missing or invalid API key' });
  }

  try {
    const bus = await Bus.findOne({ apiKey });

    if (!bus) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    if (bus.status !== 'active') {
      return res.status(403).json({ error: 'Bus is currently ' + bus.status });
    }

    req.bus = bus;
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

module.exports = { authenticateESP };
