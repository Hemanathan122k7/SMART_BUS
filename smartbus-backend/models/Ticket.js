const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  ticketNumber: {
    type: String,
    required: true,
    unique: true,
  },
  passengerName: {
    type: String,
    required: true,
  },
  passengerPhone: {
    type: String,
  },
  busId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    required: true,
  },
  route: {
    type: String,
    required: true,
  },
  fromStop: {
    type: String,
    required: true,
  },
  toStop: {
    type: String,
    required: true,
  },
  fare: {
    type: Number,
    required: true,
  },
  seatNumber: {
    type: String,
  },
  status: {
    type: String,
    enum: ['booked', 'confirmed', 'cancelled', 'completed'],
    default: 'booked',
  },
  bookingDate: {
    type: Date,
    default: Date.now,
  },
  travelDate: {
    type: Date,
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded'],
    default: 'pending',
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Ticket', ticketSchema);
