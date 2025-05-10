const express = require('express');
const { body } = require('express-validator');
const toolController = require('../controllers/toolController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All tool routes require authentication
router.use(protect);

// Get all tools
router.get('/', toolController.getTools);

// Get single tool
router.get('/:id', toolController.getTool);

// Create new tool
router.post(
  '/',
  [
    body('name', 'Name is required').notEmpty(),
    body('description', 'Description is required').notEmpty(),
    body('type', 'Type is required').notEmpty(),
    body('endpoint', 'API endpoint is required').notEmpty()
  ],
  toolController.createTool
);

// Update tool
router.put(
  '/:id',
  [
    body('name', 'Name is required').optional().notEmpty(),
    body('description', 'Description is required').optional().notEmpty(),
    body('endpoint', 'API endpoint is required').optional().notEmpty()
  ],
  toolController.updateTool
);

// Delete tool
router.delete('/:id', toolController.deleteTool);

// Execute tool action
router.post(
  '/:id/execute',
  [
    body('action', 'Action is required').notEmpty(),
    body('params', 'Parameters must be an object').optional().isObject()
  ],
  toolController.executeTool
);

// Register tool (activate)
router.post('/:id/register', toolController.registerTool);

// Deregister tool (deactivate)
router.post('/:id/deregister', toolController.deregisterTool);

module.exports = router;
