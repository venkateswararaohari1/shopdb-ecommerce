const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

// Process Checkout (Create an order from cart)
router.post('/', authMiddleware, (req, res) => {
  const userId = req.user.userId;
  const { deliveryAddress } = req.body;
  
  try {
    if (!deliveryAddress || deliveryAddress.trim() === '') {
      return res.status(400).json({ message: 'Delivery address is required' });
    }

    // 1. Get user's cart items
    const cartItems = db.prepare(`
      SELECT c.quantity, p.id as product_id, p.price 
      FROM cart_items c
      JOIN products p ON c.product_id = p.id
      WHERE c.user_id = ?
    `).all(userId);

    if (cartItems.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // 2. Calculate total amount
    const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // 3. Use transaction to guarantee all-or-nothing
    const createOrderTransaction = db.transaction((cartItems, total, uId, address) => {
      // Create the order
      const orderResult = db.prepare('INSERT INTO orders (user_id, total_amount, delivery_address) VALUES (?, ?, ?)').run(uId, total, address);
      const orderId = orderResult.lastInsertRowid;

      // Insert order items
      const insertOrderItem = db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)');
      for (const item of cartItems) {
        insertOrderItem.run(orderId, item.product_id, item.quantity, item.price);
      }

      // Clear the user's cart
      db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(uId);

      return orderId;
    });

    const orderId = createOrderTransaction(cartItems, totalAmount, userId, deliveryAddress);

    res.status(201).json({ message: 'Order placed successfully', orderId, totalAmount });
  } catch (error) {
    res.status(500).json({ message: 'Error processing order', error: error.message });
  }
});

// Get user's orders history
router.get('/', authMiddleware, (req, res) => {
  try {
    const userId = req.user.userId;
    const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    
    // For each order, fetch items
    const getOrderItems = db.prepare(`
      SELECT oi.*, p.name, p.image 
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `);

    const ordersWithItems = orders.map(order => ({
      ...order,
      items: getOrderItems.all(order.id)
    }));

    res.json(ordersWithItems);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
});

module.exports = router;
