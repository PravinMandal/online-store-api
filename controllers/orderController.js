const mongoose = require('mongoose');
const Order = require('../models/order');
const Product = require('../models/product');

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function placeOrder(req, res, next) {
  // Values like [2] can pass the item validation, so check the shape again
  // before using them in stock calculations.
  for (const item of req.body.items) {
    if (
      !item ||
      Array.isArray(item) ||
      typeof item.product !== 'string' ||
      !Number.isInteger(item.quantity)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Each item must have a product id and a whole number quantity',
      });
    }
  }

  const ids = req.body.items.map((item) => item.product.toLowerCase());
  if (new Set(ids).size !== ids.length) {
    return res.status(400).json({
      success: false,
      message: 'The same product cannot appear twice in one order',
    });
  }

  const session = await mongoose.startSession();

  try {
    let orderId;

    await session.withTransaction(async () => {
      const products = await Product.find({ _id: { $in: ids } }).session(session);
      const productMap = new Map(products.map((product) => [product._id.toString(), product]));

      const orderItems = [];
      let totalAmount = 0;

      // Check every item before changing any stock.
      for (const item of req.body.items) {
        const product = productMap.get(item.product.toLowerCase());

        if (!product) {
          throw httpError(404, 'Product not found');
        }
        if (!product.isActive) {
          throw httpError(400, `${product.name} is no longer available`);
        }
        if (product.stock < item.quantity) {
          throw httpError(
            400,
            `Only ${product.stock} units of ${product.name} are left in stock`
          );
        }

        orderItems.push({
          product: product._id,
          name: product.name,
          price: product.price,
          quantity: item.quantity,
        });
        totalAmount += product.price * item.quantity;
      }

      for (const item of req.body.items) {
        const product = productMap.get(item.product.toLowerCase());
        product.stock -= item.quantity;
        await product.save({ session });
      }

      const [order] = await Order.create(
        [
          {
            customer: req.user._id,
            items: orderItems,
            totalAmount: Math.round(totalAmount * 100) / 100,
            shippingAddress: req.body.shippingAddress,
          },
        ],
        { session }
      );

      orderId = order._id;
    });

    const order = await Order.findById(orderId).populate('customer', 'name email');
    return res.status(201).json({ success: true, message: 'Order placed', order });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    return next(err);
  } finally {
    await session.endSession();
  }
}

module.exports = { placeOrder };
