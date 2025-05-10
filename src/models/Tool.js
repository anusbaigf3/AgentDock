const mongoose = require('mongoose');

const ToolSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a tool name'],
    trim: true,
    unique: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  description: {
    type: String,
    required: [true, 'Please provide a description'],
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  type: {
    type: String,
    required: [true, 'Please specify tool type'],
    enum: ['github', 'slack', 'jira', 'shopify', 'speech', 'custom'],
    default: 'custom'
  },
  endpoint: {
    type: String,
    required: [true, 'Please provide API endpoint']
  },
  authType: {
    type: String,
    enum: ['none', 'apiKey', 'oauth', 'basic', 'bearer'],
    default: 'none'
  },
  authConfig: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  parameters: [{
    name: String,
    description: String,
    type: {
      type: String,
      enum: ['string', 'number', 'boolean', 'object', 'array'],
      default: 'string'
    },
    required: {
      type: Boolean,
      default: false
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Middleware to update the 'updatedAt' field on save
ToolSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Tool', ToolSchema);
