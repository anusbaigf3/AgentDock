const express = require('express');
const { body } = require('express-validator');
const agentController = require('../controllers/agentController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All agent routes require authentication
router.use(protect);

// Get all agents
router.get('/', agentController.getAgents);

// Get single agent
router.get('/:id', agentController.getAgent);

// Create new agent
router.post(
  '/',
  [
    body('name', 'Name is required').notEmpty(),
    body('description', 'Description is required').notEmpty(),
    body('type', 'Type is required').notEmpty(),
    body('code', 'Code implementation is required').notEmpty()
  ],
  agentController.createAgent
);

// Update agent
router.put(
  '/:id',
  [
    body('name', 'Name is required').optional().notEmpty(),
    body('description', 'Description is required').optional().notEmpty(),
    body('code', 'Code implementation is required').optional().notEmpty()
  ],
  agentController.updateAgent
);

// Delete agent
router.delete('/:id', agentController.deleteAgent);

// Process query with agent
router.post(
  '/:id/query',
  [
    body('query', 'Query is required').notEmpty()
  ],
  agentController.processQuery
);

// Register agent (activate)
router.post('/:id/register', agentController.registerAgent);

// Deregister agent (deactivate)
router.post('/:id/deregister', agentController.deregisterAgent);

module.exports = router;
