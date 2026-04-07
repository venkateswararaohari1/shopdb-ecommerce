const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

// Get current user's cart
router.get('/', authMiddleware, (req, res) => {
  try {
    const userId = req.user.userId;
    const cartItems = db.prepare(`
      SELECT c.id as cart_item_id, c.quantity, p.* 
      FROM cart_items c
      JOIN products p ON c.product_id = p.id
      WHERE c.user_id = ?
    `).all(userId);
    res.json(cartItems);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cart', error: error.message });
  }
});

// Add item to cart
router.post('/', authMiddleware, (req, res) => {
  try {
    const userId = req.user.userId;
    const { productId, quantity = 1 } = req.body;

    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    // Check if product exists
    const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
    if (!product) {
       return res.status(404).json({ message: 'Product not found' });
    }

    // Check if item already in cart
    const existingItem = db.prepare('SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ?').get(userId, productId);

    if (existingItem) {
      // Update quantity
      const newQty = existingItem.quantity + quantity;
      db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(newQty, existingItem.id);
    } else {
      // Insert new item
      db.prepare('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)').run(userId, productId, quantity);
    }

    res.status(201).json({ message: 'Product added to cart successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error adding to cart', error: error.message });
  }
});

// Update cart item quantity
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const userId = req.user.userId;
    const cartItemId = req.params.id;
    const { quantity } = req.body;

    if (quantity < 1) {
       return res.status(400).json({ message: 'Quantity must be at least 1' });
    }

    const result = db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?').run(quantity, cartItemId, userId);
    if (result.changes === 0) {
       return res.status(404).json({ message: 'Cart item not found or unauthorized' });
    }

    res.json({ message: 'Cart updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating cart', error: error.message });
  }
});

// Remove item from cart
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const userId = req.user.userId;
    const cartItemId = req.params.id;

    const result = db.prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ?').run(cartItemId, userId);
    
    if (result.changes === 0) {
       return res.status(404).json({ message: 'Cart item not found or unauthorized' });
    }

    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    res.status(500).json({ message: 'Error removing from cart', error: error.message });
  }
});

module.exports = router;
