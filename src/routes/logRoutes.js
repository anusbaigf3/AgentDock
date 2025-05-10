const express = require('express');
const logController = require('../controllers/logController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All log routes require authentication
router.use(protect);

// Get all logs (with pagination and filters)
router.get('/', logController.getLogs);

// Get logs for a specific agent
router.get('/agent/:agentId', logController.getAgentLogs);

// Get logs for a specific tool
router.get('/tool/:toolId', logController.getToolLogs);

// Get single log entry
router.get('/:id', logController.getLog);

// Delete log (admin only)
router.delete('/:id', authorize('admin'), logController.deleteLog);

// Clear all logs (admin only)
router.delete('/', authorize('admin'), logController.clearLogs);

module.exports = router;
