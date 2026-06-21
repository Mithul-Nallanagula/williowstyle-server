const db = require('./db');
const fs = require('fs');
const path = require('path');

const initializeDatabase = async () => {
    try {
        console.log('[Database] Checking tables...');

        // 1. Create Products Table
        await db.query(`
            CREATE TABLE IF NOT EXISTS products (
                id INT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                category VARCHAR(100) NOT NULL,
                price VARCHAR(50) NOT NULL,
                price_value DECIMAL(10, 2) NOT NULL,
                image VARCHAR(255) NOT NULL,
                tag VARCHAR(50),
                description TEXT
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 2. Create Messages Table
        await db.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id VARCHAR(100) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                subject VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                timestamp DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 3. Create Orders Table
        await db.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id VARCHAR(100) PRIMARY KEY,
                razorpay_order_id VARCHAR(150) UNIQUE,
                receipt VARCHAR(150),
                customer_name VARCHAR(255) NOT NULL,
                customer_email VARCHAR(255) NOT NULL,
                customer_address TEXT NOT NULL,
                total_amount_usd DECIMAL(10, 2) NOT NULL,
                total_amount_inr DECIMAL(10, 2) NOT NULL,
                payment_method VARCHAR(50) NOT NULL,
                status VARCHAR(50) NOT NULL,
                payment_id VARCHAR(150),
                payment_signature VARCHAR(255),
                timestamp DATETIME NOT NULL,
                updated_at DATETIME
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 4. Create Order Items Table
        await db.query(`
            CREATE TABLE IF NOT EXISTS order_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id VARCHAR(100) NOT NULL,
                product_id INT NOT NULL,
                quantity INT NOT NULL,
                price_usd DECIMAL(10, 2) NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        console.log('[Database] Tables verified/created successfully.');

        // 5. Seed Products if empty
        const [rows] = await db.query('SELECT COUNT(*) as count FROM products');
        if (rows[0].count === 0) {
            console.log('[Database] Seeding products...');
            const productsPath = path.join(__dirname, '../data/products.json');
            
            if (fs.existsSync(productsPath)) {
                const rawData = fs.readFileSync(productsPath, 'utf8');
                const products = JSON.parse(rawData);
                
                for (const p of products) {
                    await db.query(
                        'INSERT INTO products (id, name, category, price, price_value, image, tag, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [p.id, p.name, p.category, p.price, p.price_value, p.image, p.tag, p.description]
                    );
                }
                console.log(`[Database] Seeded ${products.length} products successfully.`);
            } else {
                console.warn('[Database] Seed data not found at data/products.json');
            }
        } else {
            console.log('[Database] Products table already contains data. Seeding skipped.');
        }

    } catch (error) {
        console.error('[Database] Initialization error:', error);
        process.exit(1);
    }
};

module.exports = initializeDatabase;
