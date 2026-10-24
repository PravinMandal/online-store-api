const mongoose = require('mongoose');
const Order = require('../models/order');
const Product = require('../models/product');

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function cancelMessage(status) {
  if (status === 'shipped') {
    return 'This order has already been shipped and cannot be cancelled';
  }
  if (status === 'delivered') {
    return 'This order has already been delivered and cannot be cancelled';
  }
  return 'This order has already been cancelled';
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

async function getMyOrders(req, res, next) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const filter = { customer: req.user._id };
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const [data, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('items.product', 'name price isActive stock'),
      Order.countDocuments(filter),
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

async function getOrder(req, res, next) {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name email')
      .populate('items.product', 'name price isActive stock');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const customerId = order.customer && order.customer._id ? order.customer._id : null;
    const isOwner = customerId && customerId.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You can only view your own orders' });
    }

    return res.json({ success: true, message: 'Order fetched', order });
  } catch (err) {
    return next(err);
  }
}

async function cancelOrder(req, res, next) {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(req.params.id).session(session);

      if (!order) {
        throw httpError(404, 'Order not found');
      }
      if (order.customer.toString() !== req.user._id.toString()) {
        throw httpError(403, 'You can only cancel your own orders');
      }
      if (order.status !== 'placed') {
        throw httpError(409, cancelMessage(order.status));
      }

      // Put the stock back before marking the order as cancelled.
      for (const item of order.items) {
        await Product.updateOne(
          { _id: item.product },
          { $inc: { stock: item.quantity } },
          { session }
        );
      }

      order.status = 'cancelled';
      await order.save({ session });
    });

    const order = await Order.findById(req.params.id).populate('customer', 'name email');
    return res.json({ success: true, message: 'Order cancelled', order });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    return next(err);
  } finally {
    await session.endSession();
  }
}

async function getAllOrders(req, res, next) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.customer) {
      filter.customer = req.query.customer;
    }

    const [data, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('customer', 'name email'),
      Order.countDocuments(filter),
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

async function updateOrderStatus(req, res, next) {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const nextStatus = { placed: 'shipped', shipped: 'delivered' };
    const expected = nextStatus[order.status];

    if (!expected) {
      return res.status(400).json({
        success: false,
        message: `A ${order.status} order cannot be updated`,
      });
    }
    if (req.body.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Orders can only be cancelled by the customer',
      });
    }
    if (req.body.status !== expected) {
      return res.status(400).json({
        success: false,
        message: `Order status can only move from ${order.status} to ${expected}`,
      });
    }

    // Only update if the status is still the one we checked. This stops a
    // status change from overwriting a cancellation that happened meanwhile.
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, status: order.status },
      { $set: { status: req.body.status } },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(409).json({
        success: false,
        message: 'Order status changed. Please refresh and try again',
      });
    }

    return res.json({ success: true, message: 'Order status updated', order: updated });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  placeOrder,
  getMyOrders,
  getOrder,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
};
