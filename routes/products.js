const express = require('express');
const {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const {
  createProductRules,
  updateProductRules,
  listProductsRules,
  productIdRules,
} = require('../middleware/validation');

const router = express.Router();

router.get('/', listProductsRules, getProducts);
router.post('/', requireAuth, requireRole('admin'), createProductRules, createProduct);
router.get('/:id', productIdRules, getProduct);
router.put(
  '/:id',
  requireAuth,
  requireRole('admin'),
  productIdRules,
  updateProductRules,
  updateProduct
);
router.delete('/:id', requireAuth, requireRole('admin'), productIdRules, deleteProduct);

module.exports = router;
