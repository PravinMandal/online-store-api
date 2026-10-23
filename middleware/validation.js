const { body, param, query, validationResult } = require('express-validator');

const ORDER_STATUSES = ['placed', 'shipped', 'delivered', 'cancelled'];
const PRODUCT_SORT_FIELDS = ['price', '-price', 'name', '-name', 'createdAt', '-createdAt'];

// express-validator checks every item when a value is an array, so repeated
// query fields could slip through as a list. Scalars should arrive as a single
// value. The items and shippingAddress fields are the exceptions.
const SKIP_FIELDS = ['items', 'shippingAddress'];

function singleValueInput(req, res, next) {
  for (const [key, value] of Object.entries(req.body || {})) {
    if (SKIP_FIELDS.includes(key)) continue;
    if (Array.isArray(value) || (value !== null && typeof value === 'object')) {
      return res.status(400).json({ success: false, message: `${key} must be a single value` });
    }
  }

  for (const [key, value] of Object.entries(req.query || {})) {
    if (Array.isArray(value) || (value !== null && typeof value === 'object')) {
      return res.status(400).json({ success: false, message: `${key} must be a single value` });
    }
  }

  return next();
}

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array({ onlyFirstError: true })[0].msg,
    });
  }
  return next();
}

// new Date("2026-02-30") rolls over to March instead of failing.
function checkDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return date.toISOString().slice(0, 10) === value;
  }
  return true;
}

const registerRules = [
  body('name')
    .isString()
    .withMessage('Name must be a string')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 80 })
    .withMessage('Name cannot exceed 80 characters'),
  body('email')
    .isString()
    .withMessage('Email must be a string')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isString()
    .withMessage('Password must be a string')
    .bail()
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  handleValidation,
];

const loginRules = [
  body('email')
    .isString()
    .withMessage('Email must be a string')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isString()
    .withMessage('Password must be a string')
    .bail()
    .notEmpty()
    .withMessage('Password is required'),
  handleValidation,
];

const productIdParam = param('id').isMongoId().withMessage('Invalid product id');
const orderIdParam = param('id').isMongoId().withMessage('Invalid order id');

const createProductRules = [
  body('name')
    .isString()
    .withMessage('Product name must be a string')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ max: 100 })
    .withMessage('Product name cannot exceed 100 characters'),
  body('description')
    .isString()
    .withMessage('Description must be a string')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),
  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({ min: 0 })
    .withMessage('Price cannot be negative')
    .custom((value) => Number.isFinite(Number(value)))
    .withMessage('Price must be a finite number')
    .toFloat(),
  body('category')
    .isString()
    .withMessage('Category must be a string')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Category is required')
    .isLength({ max: 60 })
    .withMessage('Category cannot exceed 60 characters'),
  body('stock')
    .notEmpty()
    .withMessage('Stock is required')
    .isInt({ min: 0 })
    .withMessage('Stock must be a whole number of 0 or more')
    .toInt(),
  handleValidation,
];

const updateProductRules = [
  body('name')
    .optional()
    .isString()
    .withMessage('Product name must be a string')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Product name cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Product name cannot exceed 100 characters'),
  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Description cannot be empty')
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price cannot be negative')
    .custom((value) => Number.isFinite(Number(value)))
    .withMessage('Price must be a finite number')
    .toFloat(),
  body('category')
    .optional()
    .isString()
    .withMessage('Category must be a string')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Category cannot be empty')
    .isLength({ max: 60 })
    .withMessage('Category cannot exceed 60 characters'),
  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock must be a whole number of 0 or more')
    .toInt(),
  handleValidation,
];

const listProductsRules = [
  query('search')
    .optional()
    .isString()
    .withMessage('Search must be a string')
    .bail()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search is too long'),
  query('category')
    .optional()
    .isString()
    .withMessage('Category must be a string')
    .bail()
    .trim()
    .isLength({ max: 60 })
    .withMessage('Category is too long'),
  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum price must be 0 or more')
    .custom((value) => Number.isFinite(Number(value)))
    .withMessage('Minimum price must be a finite number'),
  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum price must be 0 or more')
    .custom((value) => Number.isFinite(Number(value)))
    .withMessage('Maximum price must be a finite number')
    .custom((value, { req }) => {
      if (req.query.minPrice !== undefined && Number(req.query.minPrice) > Number(value)) {
        throw new Error('minPrice cannot be greater than maxPrice');
      }
      return true;
    }),
  query('inStock')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('inStock must be true or false'),
  query('sort')
    .optional()
    .isString()
    .withMessage('Sort must be a string')
    .bail()
    .isIn(PRODUCT_SORT_FIELDS)
    .withMessage(`Sort must be one of: ${PRODUCT_SORT_FIELDS.join(', ')}`),
  query('page')
    .optional()
    .isInt({ min: 1, max: 100000 })
    .withMessage('Page must be between 1 and 100000'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidation,
];

const createOrderRules = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Items must be an array with at least one item'),
  body('items.*.product')
    .isString()
    .withMessage('Product id must be a string')
    .bail()
    .isMongoId()
    .withMessage('Invalid product id'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be a whole number of at least 1')
    .toInt(),
  body('shippingAddress').isObject().withMessage('Shipping address is required'),
  body('shippingAddress.street')
    .isString()
    .withMessage('Street must be a string')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Street is required')
    .isLength({ max: 200 })
    .withMessage('Street cannot exceed 200 characters'),
  body('shippingAddress.city')
    .isString()
    .withMessage('City must be a string')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('City is required')
    .isLength({ max: 100 })
    .withMessage('City cannot exceed 100 characters'),
  body('shippingAddress.pincode')
    .isString()
    .withMessage('Pincode must be a string')
    .bail()
    .trim()
    .matches(/^\d{6}$/)
    .withMessage('Pincode must be exactly 6 digits'),
  handleValidation,
];

const myOrdersRules = [
  query('status')
    .optional()
    .isString()
    .withMessage('Status must be a string')
    .bail()
    .isIn(ORDER_STATUSES)
    .withMessage('Status must be placed, shipped, delivered or cancelled'),
  query('page')
    .optional()
    .isInt({ min: 1, max: 100000 })
    .withMessage('Page must be between 1 and 100000'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidation,
];

const allOrdersRules = [
  query('status')
    .optional()
    .isString()
    .withMessage('Status must be a string')
    .bail()
    .isIn(ORDER_STATUSES)
    .withMessage('Status must be placed, shipped, delivered or cancelled'),
  query('customer')
    .optional()
    .isMongoId()
    .withMessage('Invalid customer id'),
  query('page')
    .optional()
    .isInt({ min: 1, max: 100000 })
    .withMessage('Page must be between 1 and 100000'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidation,
];

const updateOrderStatusRules = [
  orderIdParam,
  body('status')
    .isString()
    .withMessage('Status must be a string')
    .bail()
    .notEmpty()
    .withMessage('Status is required')
    .isIn(ORDER_STATUSES)
    .withMessage('Status must be placed, shipped, delivered or cancelled'),
  handleValidation,
];

const summaryRules = [
  query('from')
    .optional()
    .isISO8601({ strict: true })
    .withMessage('From date must be a valid date, like 2026-01-01')
    .bail()
    .custom((value) => {
      if (!checkDate(value)) {
        throw new Error('From date must be a valid date, like 2026-01-01');
      }
      return true;
    }),
  query('to')
    .optional()
    .isISO8601({ strict: true })
    .withMessage('To date must be a valid date, like 2026-01-31')
    .bail()
    .custom((value) => {
      if (!checkDate(value)) {
        throw new Error('To date must be a valid date, like 2026-01-31');
      }
      return true;
    })
    .custom((value, { req }) => {
      if (req.query.from !== undefined && new Date(req.query.from) > new Date(value)) {
        throw new Error('From date cannot be after to date');
      }
      return true;
    }),
  handleValidation,
];

const productIdRules = [productIdParam, handleValidation];
const orderIdRules = [orderIdParam, handleValidation];

module.exports = {
  ORDER_STATUSES,
  PRODUCT_SORT_FIELDS,
  singleValueInput,
  registerRules,
  loginRules,
  createProductRules,
  updateProductRules,
  listProductsRules,
  createOrderRules,
  myOrdersRules,
  allOrdersRules,
  updateOrderStatusRules,
  summaryRules,
  productIdRules,
  orderIdRules,
};
