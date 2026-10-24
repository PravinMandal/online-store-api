const express = require('express');
const {
  placeOrder,
  getMyOrders,
  getOrder,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
} = require('../controllers/orderController');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const {
  createOrderRules,
  myOrdersRules,
  allOrdersRules,
  updateOrderStatusRules,
  orderIdRules,
} = require('../middleware/validation');

const router = express.Router();

router.post('/', requireAuth, requireRole('customer'), createOrderRules, placeOrder);

// This route must stay above /:id so "my" is not read as an id.
router.get('/my', requireAuth, requireRole('customer'), myOrdersRules, getMyOrders);

router.get('/', requireAuth, requireRole('admin'), allOrdersRules, getAllOrders);
router.get('/:id', requireAuth, orderIdRules, getOrder);
router.patch('/:id/cancel', requireAuth, orderIdRules, cancelOrder);
router.patch(
  '/:id/status',
  requireAuth,
  requireRole('admin'),
  orderIdRules,
  updateOrderStatusRules,
  updateOrderStatus
);

module.exports = router;
