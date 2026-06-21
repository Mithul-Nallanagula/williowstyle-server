const express = require('express');
const router = express.Router();
const db = require('../config/db');

// POST contact form submission
router.post('/', async (req, res, next) => {
    try {
        const { name, email, subject, message } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }
        if (!email || !email.trim()) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }
        if (!/\S+@\S+\.\S+/.test(email)) {
            return res.status(400).json({ success: false, message: 'Please enter a valid email' });
        }
        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }

        const messageId = `msg_${Date.now()}`;
        const timestamp = new Date();

        await db.query(
            'INSERT INTO messages (id, name, email, subject, message, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
            [messageId, name, email, subject || 'No Subject', message, timestamp]
        );

        console.log(`[Contact Message Received] ID: ${messageId} from ${name} (${email})`);

        res.status(201).json({
            success: true,
            message: 'Your message has been received successfully',
            data: {
                id: messageId,
                timestamp: timestamp.toISOString()
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
