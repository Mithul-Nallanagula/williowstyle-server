const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// Initialize Database
const dbSetup = require('./config/db-setup');
dbSetup();

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// Static files for images
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// Routes
const productsRouter = require('./routes/products');
const contactRouter = require('./routes/contact');
const ordersRouter = require('./routes/orders');

app.use('/api/products', productsRouter);
app.use('/api/contact', contactRouter);
app.use('/api/orders', ordersRouter);

// Base route
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to WillowStyle API',
        endpoints: {
            products: '/api/products',
            contact: '/api/contact',
            orders: '/api/orders'
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong on the server',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
});

app.listen(PORT, () => {
    console.log(`Server is running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
