const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const productsFilePath = path.join(__dirname, '../data/products.json');

// Helper function to read products from JSON file
const readProductsFile = () => {
    try {
        const fileContent = fs.readFileSync(productsFilePath, 'utf8');
        return JSON.parse(fileContent);
    } catch (error) {
        console.error('Error reading products file:', error);
        return [];
    }
};

// GET all products (with optional filtering by category)
router.get('/', (req, res) => {
    const products = readProductsFile();
    const { category, search } = req.query;
    let filteredProducts = [...products];

    if (category && category !== 'All Products') {
        filteredProducts = filteredProducts.filter(
            p => p.category.toLowerCase() === category.toLowerCase()
        );
    }

    if (search) {
        filteredProducts = filteredProducts.filter(
            p => p.name.toLowerCase().includes(search.toLowerCase()) || 
                 p.description.toLowerCase().includes(search.toLowerCase())
        );
    }

    res.json({
        success: true,
        count: filteredProducts.length,
        data: filteredProducts
    });
});

// GET all distinct categories
router.get('/categories', (req, res) => {
    const products = readProductsFile();
    const categories = ['All Products', ...new Set(products.map(p => p.category))];
    res.json({
        success: true,
        data: categories
    });
});

// GET single product by ID
router.get('/:id', (req, res) => {
    const products = readProductsFile();
    const productId = parseInt(req.params.id);
    const product = products.find(p => p.id === productId);

    if (!product) {
        return res.status(404).json({
            success: false,
            message: `Product with ID ${productId} not found`
        });
    }

    res.json({
        success: true,
        data: product
    });
});

module.exports = router;
