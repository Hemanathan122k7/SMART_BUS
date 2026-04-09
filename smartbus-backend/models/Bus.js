const mongoose = require('mongoose');
const crypto = require('crypto');

const busSchema = new mongoose.Schema({
  busNumber: {
    type: String,
    required: true,
    unique: true,
  },

  busName: {
    type: String,
    required: true,
  },

  apiKey: {
    type: String,
    unique: true,
    sparse: true,
  },

  route: {
    type: String,
    required: true,
  },

  // Ordered list of stops (Example: ["A", "A1", "A2", "B"])
  stops: [{
    type: String,
    required: true,
  }],

  // Total capacity (seating + standing)
  capacity: {
    type: Number,
    required: true,
  },

  seatingCapacity: {
    type: Number,
    required: true,
  },

  standingCapacity: {
    type: Number,
    required: true,
  },

  currentOccupancy: {
    type: Number,
    default: 0,
  },

  // Index of current stop in stops array
  currentStopIndex: {
    type: Number,
    default: 0,
  },

  operator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Operator',
  },

  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active',
  },

  location: {
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
  },

  lastUpdated: {
    type: Date,
    default: Date.now,
  },

}, {
  timestamps: true,
});

// Static method to generate a secure API key
busSchema.statics.generateApiKey = function () {
  return crypto.randomBytes(32).toString('hex');
};

module.exports = mongoose.model('Bus', busSchema);