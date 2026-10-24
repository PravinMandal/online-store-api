const express = require('express');
const { placeOrder } = require('../controllers/orderController');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const { createOrderRules } = require('../middleware/validation');

const router = express.Router();

router.post('/', requireAuth, requireRole('customer'), createOrderRules, placeOrder);

module.exports = router;
