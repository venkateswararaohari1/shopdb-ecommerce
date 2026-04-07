const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.resolve(__dirname, '../../database/ecommerce.db');
const db = new Database(dbPath, { verbose: console.log });

// Initialize database schema
function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user'
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      description TEXT,
      image TEXT,
      category TEXT,
      rating REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (product_id) REFERENCES products (id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      delivery_address TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );
    
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders (id),
      FOREIGN KEY (product_id) REFERENCES products (id)
    );
  `);

  console.log('Database schema created/verified.');

  // Safely migrate existing databases
  try {
    db.exec('ALTER TABLE orders ADD COLUMN delivery_address TEXT');
  } catch(e) {
    // Column likely already exists
  }

  // Seed Admin User
  const adminCheck = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@store.com');
  if (!adminCheck) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('admin123', salt);
    db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run(
      'Super Admin', 'admin@store.com', hash, 'admin'
    );
    console.log('Admin user created: admin@store.com / admin123');
  }

  // Seed sample products
  const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  if (productCount === 0) {
    const insertProduct = db.prepare('INSERT INTO products (name, price, description, image, category, rating) VALUES (?, ?, ?, ?, ?, ?)');
    const products = [
      ['Wireless Noise-Canceling Headphones', 199.99, 'Premium over-ear headphones with active noise cancellation.', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=500&q=80', 'Electronics', 4.5],
      ['Minimalist Smart Watch', 149.50, 'Sleek smart watch with fitness tracking and heart rate monitor.', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=500&q=80', 'Electronics', 4.2],
      ['Classic Leather Backpack', 85.00, 'Durable genuine leather backpack for daily commute.', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=500&q=80', 'Fashion', 4.7],
      ['Professional DSLR Camera', 899.00, 'Capture stunning photos with this 24.2 MP DSLR camera.', 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=500&q=80', 'Electronics', 4.9],
      ['Ergonomic Office Chair', 245.99, 'Adjustable high-back mesh chair with lumbar support.', 'https://images.unsplash.com/photo-1505843490538-5133c6c7d0e1?auto=format&fit=crop&w=500&q=80', 'Home', 4.1],
      ['Stainless Steel Water Bottle', 24.00, 'Insulated bottle keeps drinks cold for 24 hours.', 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=500&q=80', 'Home', 4.8],
      ['Men Casual Sneakers', 65.00, 'Comfortable and stylish sneakers for everyday wear.', 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=500&q=80', 'Fashion', 4.3],
      ['4K Ultra HD Smart TV', 450.00, '55-inch smart TV with HDR and built-in streaming apps.', 'https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=500&q=80', 'Electronics', 4.6]
    ];
    
    for (const p of products) {
      insertProduct.run(...p);
    }
    console.log('Sample products inserted.');
  }
}

initDB();

module.exports = db;
