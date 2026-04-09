const mongoose = require('mongoose');

const operatorSchema = new mongoose.Schema({
  operatorId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  phone: {
    type: String,
    required: true,
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
  },
  licenseNumber: {
    type: String,
    required: true,
  },
  licenseExpiry: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
  },
  assignedBuses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
  }],
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0,
  },
  totalTrips: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Operator', operatorSchema);
