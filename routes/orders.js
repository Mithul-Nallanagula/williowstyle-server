const express = require('express');
const router = express.Router();
const db = require('../config/db');
const crypto = require('crypto');
const Razorpay = require('razorpay');

// Initialize Razorpay client
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// POST checkout/submit order (creates Razorpay order & stores order draft in database)
router.post('/', async (req, res, next) => {
    const { items, customer, paymentMethod } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'Cart items are required' });
    }
    if (!customer || !customer.name || !customer.email || !customer.address) {
        return res.status(400).json({ success: false, message: 'Complete customer details (name, email, address) are required' });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Calculate total amount from database to prevent client side manipulation
        let calculatedTotalUSD = 0;
        
        for (const item of items) {
            const [productRows] = await connection.query('SELECT price_value FROM products WHERE id = ?', [item.id]);
            if (productRows.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ 
                    success: false, 
                    message: `Product with ID ${item.id} not found in catalog` 
                });
            }
            calculatedTotalUSD += productRows[0].price_value * (item.quantity || 1);
        }

        // Mock conversion rate: 1 USD = 83 INR (for Razorpay domestic integration)
        const calculatedTotalINR = Math.round(calculatedTotalUSD * 83);
        const amountInPaise = calculatedTotalINR * 100;

        if (amountInPaise <= 0) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ success: false, message: 'Invalid order total' });
        }

        // 2. Generate Razorpay Order
        const receipt = `receipt_${Date.now()}`;
        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: receipt
        };

        const razorpayOrder = await razorpay.orders.create(options);

        // 3. Save order details in MySQL database using transaction
        const orderId = `ord_${Date.now()}`;
        const timestamp = new Date();

        await connection.query(
            `INSERT INTO orders (id, razorpay_order_id, receipt, customer_name, customer_email, customer_address, total_amount_usd, total_amount_inr, payment_method, status, timestamp) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                orderId,
                razorpayOrder.id,
                receipt,
                customer.name,
                customer.email,
                customer.address,
                calculatedTotalUSD,
                calculatedTotalINR,
                paymentMethod || 'Razorpay',
                'Pending Payment',
                timestamp
            ]
        );

        // 4. Save individual items in order_items table
        for (const item of items) {
            const [productRows] = await connection.query('SELECT price_value FROM products WHERE id = ?', [item.id]);
            const priceUsd = productRows[0].price_value;

            await connection.query(
                `INSERT INTO order_items (order_id, product_id, quantity, price_usd) 
                 VALUES (?, ?, ?, ?)`,
                [orderId, item.id, item.quantity || 1, priceUsd]
            );
        }

        // Commit transaction and release connection
        await connection.commit();
        connection.release();

        console.log(`[Razorpay Order Created] ID: ${orderId} | RzpID: ${razorpayOrder.id} | Total: ₹${calculatedTotalINR} | By: ${customer.name}`);

        res.status(201).json({
            success: true,
            message: 'Razorpay order created successfully',
            orderId: orderId,
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            key_id: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        // Rollback on failure
        await connection.rollback();
        connection.release();
        console.error('Error creating checkout order:', error);
        res.status(500).json({
            success: false,
            message: 'Server error creating checkout order. Please check Razorpay configuration.'
        });
    }
});

// POST verify payment signature
router.post('/verify', async (req, res, next) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({
            success: false,
            message: 'Payment verification parameters are missing'
        });
    }

    try {
        // Calculate HMAC SHA-256 signature matching
        const text = razorpay_order_id + "|" + razorpay_payment_id;
        const generated_signature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(text)
            .digest('hex');

        const timestamp = new Date();

        if (generated_signature === razorpay_signature) {
            // Payment verified! Update status to Paid
            const [result] = await db.query(
                `UPDATE orders 
                 SET status = 'Paid', payment_id = ?, payment_signature = ?, updated_at = ? 
                 WHERE razorpay_order_id = ?`,
                [razorpay_payment_id, razorpay_signature, timestamp, razorpay_order_id]
            );

            if (result.affectedRows === 0) {
                console.warn(`[Payment Warning] Signature verified but order not found in db. RzpID: ${razorpay_order_id}`);
            } else {
                console.log(`[Payment Verified] RzpID: ${razorpay_order_id} | PaymentID: ${razorpay_payment_id}`);
            }

            // Retrieve updated order details
            const [orderRows] = await db.query('SELECT * FROM orders WHERE razorpay_order_id = ?', [razorpay_order_id]);

            res.json({
                success: true,
                message: 'Payment verified and captured successfully',
                data: orderRows[0]
            });
        } else {
            console.warn(`[Payment Verification Failed] Signature mismatch for RzpID: ${razorpay_order_id}`);
            
            await db.query(
                `UPDATE orders 
                 SET status = 'Failed', payment_id = ?, updated_at = ? 
                 WHERE razorpay_order_id = ?`,
                [razorpay_payment_id, timestamp, razorpay_order_id]
            );

            res.status(400).json({
                success: false,
                message: 'Invalid payment signature. Verification failed.'
            });
        }
    } catch (error) {
        next(error);
    }
});

module.exports = router;
