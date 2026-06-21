const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const messagesLogPath = path.join(__dirname, '../data/messages.json');

// Helper to ensure data directory and file exists
const saveMessage = (messageData) => {
    try {
        const dataDir = path.dirname(messagesLogPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        let messages = [];
        if (fs.existsSync(messagesLogPath)) {
            const raw = fs.readFileSync(messagesLogPath, 'utf8');
            messages = JSON.parse(raw || '[]');
        }
        
        const newMessage = {
            id: `msg_${Date.now()}`,
            timestamp: new Date().toISOString(),
            ...messageData
        };
        
        messages.push(newMessage);
        fs.writeFileSync(messagesLogPath, JSON.stringify(messages, null, 2), 'utf8');
        return newMessage;
    } catch (error) {
        console.error('Error logging contact message:', error);
        throw new Error('Failed to save message');
    }
};

// POST contact form submission
router.post('/', (req, res) => {
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

    try {
        const saved = saveMessage({ name, email, subject: subject || 'No Subject', message });
        console.log(`[Contact Message Received] ID: ${saved.id} from ${name} (${email})`);
        
        res.status(201).json({
            success: true,
            message: 'Your message has been received successfully',
            data: {
                id: saved.id,
                timestamp: saved.timestamp
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error processing your message. Please try again later.'
        });
    }
});

module.exports = router;
