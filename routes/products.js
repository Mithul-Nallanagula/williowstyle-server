const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET all products (with optional filtering by category & search)
router.get('/', async (req, res, next) => {
    try {
        const { category, search } = req.query;
        let query = 'SELECT * FROM products WHERE 1=1';
        const params = [];

        if (category && category !== 'All Products') {
            query += ' AND LOWER(category) = LOWER(?)';
            params.push(category);
        }

        if (search) {
            query += ' AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ?)';
            const searchParam = `%${search.toLowerCase()}%`;
            params.push(searchParam, searchParam);
        }

        const [products] = await db.query(query, params);

        res.json({
            success: true,
            count: products.length,
            data: products
        });
    } catch (error) {
        next(error);
    }
});

// GET all distinct categories
router.get('/categories', async (req, res, next) => {
    try {
        const [rows] = await db.query('SELECT DISTINCT category FROM products');
        const categories = ['All Products', ...rows.map(r => r.category)];
        
        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        next(error);
    }
});

// GET single product by ID
router.get('/:id', async (req, res, next) => {
    try {
        const productId = parseInt(req.params.id);
        const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [productId]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Product with ID ${productId} not found`
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
