const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const ordersLogPath = path.join(__dirname, '../data/orders.json');

const saveOrder = (orderData) => {
    try {
        const dataDir = path.dirname(ordersLogPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        let orders = [];
        if (fs.existsSync(ordersLogPath)) {
            const raw = fs.readFileSync(ordersLogPath, 'utf8');
            orders = JSON.parse(raw || '[]');
        }
        
        const newOrder = {
            id: `ord_${Date.now()}`,
            timestamp: new Date().toISOString(),
            status: 'Processing',
            ...orderData
        };
        
        orders.push(newOrder);
        fs.writeFileSync(ordersLogPath, JSON.stringify(orders, null, 2), 'utf8');
        return newOrder;
    } catch (error) {
        console.error('Error logging order:', error);
        throw new Error('Failed to save order');
    }
};

// POST checkout/submit order
router.post('/', (req, res) => {
    const { items, customer, paymentMethod, totalAmount } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'Cart items are required' });
    }
    if (!customer || !customer.name || !customer.email || !customer.address) {
        return res.status(400).json({ success: false, message: 'Complete customer details (name, email, address) are required' });
    }

    try {
        const order = saveOrder({
            items,
            customer,
            paymentMethod: paymentMethod || 'Card',
            totalAmount: totalAmount || 0
        });
        
        console.log(`[Order Placed] ID: ${order.id} | Total: ${order.totalAmount} | By: ${customer.name}`);
        
        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            orderId: order.id,
            timestamp: order.timestamp,
            status: order.status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error processing your order.'
        });
    }
});

module.exports = router;
