require('dotenv').config();

const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const { singleValueInput } = require('./middleware/validation');
const errorHandler = require('./middleware/error');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(singleValueInput);

app.get('/', (req, res) => {
  res.json({ success: true, message: 'Online Store API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use(errorHandler);

module.exports = app;
