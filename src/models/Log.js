const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: false
  },
  toolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tool'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['info', 'error', 'warning', 'success'],
    default: 'info'
  },
  action: {
    type: String,
    required: [true, 'Please provide an action description']
  },
  input: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  output: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['started', 'processing', 'completed', 'failed'],
    default: 'started'
  },
  duration: {
    type: Number,
    default: 0 // Duration in milliseconds
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries on common filters
LogSchema.index({ agentId: 1, timestamp: -1 });
LogSchema.index({ userId: 1, timestamp: -1 });
LogSchema.index({ type: 1, timestamp: -1 });

module.exports = mongoose.model('Log', LogSchema);
