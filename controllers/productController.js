const Product = require('../models/product');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function createProduct(req, res, next) {
  try {
    const { name, description, price, category, stock } = req.body;

    const product = await Product.create({
      name: name.trim(),
      description: description.trim(),
      price,
      category: category.trim(),
      stock,
    });

    return res.status(201).json({ success: true, message: 'Product created', product });
  } catch (err) {
    return next(err);
  }
}

async function getProducts(req, res, next) {
  try {
    const { search, category, sort = '-createdAt' } = req.query;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const filter = { isActive: true };

    if (search) {
      filter.name = new RegExp(escapeRegex(search.trim()), 'i');
    }
    if (category) {
      filter.category = new RegExp(`^${escapeRegex(category.trim())}$`, 'i');
    }
    if (req.query.minPrice !== undefined || req.query.maxPrice !== undefined) {
      filter.price = {};
      if (req.query.minPrice !== undefined) {
        filter.price.$gte = Number(req.query.minPrice);
      }
      if (req.query.maxPrice !== undefined) {
        filter.price.$lte = Number(req.query.maxPrice);
      }
    }
    if (req.query.inStock === 'true') {
      filter.stock = { $gt: 0 };
    }
    if (req.query.inStock === 'false') {
      filter.stock = 0;
    }

    const sortField = sort.startsWith('-') ? sort.slice(1) : sort;
    const sortOrder = sort.startsWith('-') ? -1 : 1;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Product.find(filter)
        .sort({ [sortField]: sortOrder, _id: -1 })
        .skip(skip)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      count: data.length,
      data,
    });
  } catch (err) {
    return next(err);
  }
}

async function getProduct(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || !product.isActive) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    return res.json({ success: true, message: 'Product fetched', product });
  } catch (err) {
    return next(err);
  }
}

async function updateProduct(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || !product.isActive) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const allowed = ['name', 'description', 'price', 'category', 'stock'];
    const updates = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    Object.assign(product, updates);
    await product.save();

    return res.json({ success: true, message: 'Product updated', product });
  } catch (err) {
    return next(err);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || !product.isActive) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    product.isActive = false;
    await product.save();

    return res.json({ success: true, message: 'Product deleted', product });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
};
