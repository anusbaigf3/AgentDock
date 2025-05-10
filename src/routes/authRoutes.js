const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Register a new user
router.post(
  '/register',
  [
    body('name', 'Name is required').notEmpty(),
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Password must be at least 6 characters').isLength({ min: 6 })
  ],
  authController.register
);

// Login user
router.post(
  '/login',
  [
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Password is required').exists()
  ],
  authController.login
);

// Get current user profile
router.get('/me', protect, authController.getMe);

// Update user details
router.put('/updatedetails', protect, authController.updateDetails);

// Update password
router.put(
  '/updatepassword',
  [
    body('currentPassword', 'Current password is required').notEmpty(),
    body('newPassword', 'New password must be at least 6 characters').isLength({ min: 6 })
  ],
  protect,
  authController.updatePassword
);

module.exports = router;
