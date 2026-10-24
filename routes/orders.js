const express = require('express');
const {
  placeOrder,
  getMyOrders,
  getOrder,
  cancelOrder,
} = require('../controllers/orderController');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const { createOrderRules, myOrdersRules, orderIdRules } = require('../middleware/validation');

const router = express.Router();

router.post('/', requireAuth, requireRole('customer'), createOrderRules, placeOrder);

// This route must stay above /:id so "my" is not read as an id.
router.get('/my', requireAuth, requireRole('customer'), myOrdersRules, getMyOrders);

router.get('/:id', requireAuth, orderIdRules, getOrder);
router.patch('/:id/cancel', requireAuth, orderIdRules, cancelOrder);

module.exports = router;
