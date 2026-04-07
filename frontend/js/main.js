const API_URL = '/api';

// State
let token = localStorage.getItem('token') || null;
let user = JSON.parse(localStorage.getItem('user')) || null;
let currentCategory = '';
let cartCount = 0;

// DOM Elements
const views = {
    products: document.getElementById('productsView'),
    cart: document.getElementById('cartView'),
    orders: document.getElementById('ordersView')
};

const elems = {
    loginBtn: document.getElementById('loginBtn'),
    userMenu: document.getElementById('userMenu'),
    userNameDisplay: document.getElementById('userNameDisplay'),
    logoutBtn: document.getElementById('logoutBtn'),
    authModal: document.getElementById('authModal'),
    closeModal: document.querySelector('.close-modal'),
    authForm: document.getElementById('authForm'),
    authToggleText: document.getElementById('authToggleText'),
    authName: document.getElementById('authName'),
    productContainer: document.getElementById('productContainer'),
    cartBtn: document.getElementById('cartBtn'),
    cartCount: document.getElementById('cartCount'),
    cartItemsContainer: document.getElementById('cartItemsContainer'),
    checkoutBtn: document.getElementById('checkoutBtn'),
    logo: document.querySelector('.logo'),
    categoryLinks: document.querySelectorAll('.category-link'),
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    ordersContainer: document.getElementById('ordersContainer')
};

let isRegistering = false;

// Initialization
function init() {
    updateAuthUI();
    fetchProducts();
    if (token) fetchCart();
    setupEventListeners();
}

// Event Listeners
function setupEventListeners() {
    elems.loginBtn.addEventListener('click', () => elems.authModal.classList.add('flex'));
    elems.closeModal.addEventListener('click', () => elems.authModal.classList.remove('flex'));
    
    elems.authToggleText.addEventListener('click', () => {
        isRegistering = !isRegistering;
        elems.authName.classList.toggle('hidden');
        document.querySelector('.auth-left h2').textContent = isRegistering ? 'Register' : 'Login';
        elems.authToggleText.textContent = isRegistering ? 'Existing User? Log in' : 'New to ShopDB? Create an account';
    });

    elems.authForm.addEventListener('submit', handleAuth);
    elems.logoutBtn.addEventListener('click', logout);
    
    elems.logo.addEventListener('click', () => switchView('products'));
    elems.cartBtn.addEventListener('click', () => {
        if (!token) return showToast('Please login to view cart');
        switchView('cart');
        fetchCart();
    });

    elems.checkoutBtn.addEventListener('click', handleCheckout);

    elems.categoryLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            currentCategory = e.target.dataset.category;
            switchView('products');
            fetchProducts();
        });
    });

    elems.searchBtn.addEventListener('click', fetchProducts);
    elems.searchInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') fetchProducts();
    });
}

function switchView(viewName) {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    views[viewName].classList.remove('hidden');
    if(viewName === 'products') window.scrollTo(0,0);
}

function updateAuthUI() {
    if (token && user) {
        elems.loginBtn.classList.add('hidden');
        elems.userMenu.classList.remove('hidden');
        elems.userNameDisplay.textContent = `Hi, ${user.name.split(' ')[0]}`;
        
        // Add Orders button next to user menu if not exists
        if(!document.getElementById('ordersBtn')) {
            const btn = document.createElement('button');
            btn.id = 'ordersBtn';
            btn.className = 'btn text-btn';
            btn.textContent = 'Orders';
            btn.style.marginLeft = '10px';
            btn.onclick = () => { switchView('orders'); fetchOrders(); };
            elems.userMenu.insertBefore(btn, elems.logoutBtn);
        }
    } else {
        elems.loginBtn.classList.remove('hidden');
        elems.userMenu.classList.add('hidden');
        elems.cartCount.textContent = '0';
    }
}

// Auth Handlers
async function handleAuth(e) {
    e.preventDefault();
    const endpoint = isRegistering ? '/auth/register' : '/auth/login';
    const payload = {
        email: document.getElementById('authEmail').value,
        password: document.getElementById('authPassword').value
    };
    if (isRegistering) payload.name = elems.authName.value;

    try {
        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (res.ok) {
            token = data.token;
            user = data.user;
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            elems.authModal.classList.remove('flex');
            updateAuthUI();
            fetchCart();
            showToast('Login successful');
        } else {
            showToast(data.message || 'Authentication failed');
        }
    } catch (error) {
        showToast('Server error');
    }
}

function logout() {
    token = null;
    user = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    updateAuthUI();
    switchView('products');
    showToast('Logged out');
}

// Products
async function fetchProducts() {
    elems.productContainer.innerHTML = '<div class="loading">Loading products...</div>';
    let url = `${API_URL}/products?`;
    if (currentCategory) url += `category=${currentCategory}&`;
    const search = elems.searchInput.value;
    if (search) url += `search=${search}`;

    try {
        const res = await fetch(url);
        const products = await res.json();
        renderProducts(products);
    } catch (error) {
        elems.productContainer.innerHTML = '<div>Error loading products</div>';
    }
}

function renderProducts(products) {
    if (products.length === 0) {
        elems.productContainer.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 40px;">No products found.</div>';
        return;
    }
    
    elems.productContainer.innerHTML = products.map(p => `
        <div class="product-card">
            <div class="prod-img-container">
                <img src="${p.image}" alt="${p.name}">
            </div>
            <div class="prod-name" title="${p.name}">${p.name}</div>
            <div class="prod-rating">${p.rating} <i class="fas fa-star" style="font-size:10px;"></i></div>
            <div class="prod-price">$${p.price.toFixed(2)}</div>
            <button class="add-to-cart-btn" onclick="addToCart(${p.id})">Add to Cart</button>
        </div>
    `).join('');
}

// Cart
async function addToCart(productId) {
    if (!token) return elems.authModal.classList.add('flex');
    
    try {
        const res = await fetch(`${API_URL}/cart`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ productId, quantity: 1 })
        });
        if (res.ok) {
            showToast('Added to cart');
            fetchCart();
        } else {
            showToast('Failed to add to cart');
        }
    } catch (error) {
         showToast('Error adding item');
    }
}

async function fetchCart() {
    try {
        const res = await fetch(`${API_URL}/cart`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const cartItems = await res.json();
            renderCart(cartItems);
        }
    } catch (error) {
        console.error('Error fetching cart', error);
    }
}

function renderCart(items) {
    cartCount = items.reduce((acc, i) => acc + i.quantity, 0);
    elems.cartCount.textContent = cartCount;
    document.getElementById('cartViewCount').textContent = cartCount;
    document.getElementById('summaryItemCount').textContent = cartCount;

    if (items.length === 0) {
        elems.cartItemsContainer.innerHTML = '<div style="padding:40px; text-align:center;">Your cart is empty.</div>';
        updateCartSummary(0);
        return;
    }

    let total = 0;
    elems.cartItemsContainer.innerHTML = items.map(item => {
        total += item.price * item.quantity;
        return `
        <div class="cart-item">
            <img src="${item.image}" alt="${item.name}" class="cart-item-img">
            <div class="cart-item-details">
                <div class="cart-item-title">${item.name}</div>
                <div class="cart-item-price">$${item.price.toFixed(2)}</div>
                <div class="cart-item-actions">
                    <button class="qty-btn" onclick="updateQty(${item.cart_item_id}, ${item.quantity - 1})">-</button>
                    <input type="text" class="qty-input" value="${item.quantity}" readonly>
                    <button class="qty-btn" onclick="updateQty(${item.cart_item_id}, ${item.quantity + 1})">+</button>
                    <button class="remove-btn" style="margin-left:auto;" onclick="removeFromCart(${item.cart_item_id})">Remove</button>
                </div>
            </div>
        </div>
    `}).join('');
    
    updateCartSummary(total);
}

function updateCartSummary(total) {
    const totalStr = `$${total.toFixed(2)}`;
    document.getElementById('summaryTotal').textContent = totalStr;
    document.getElementById('summaryFinalTotal').textContent = totalStr;
    elems.checkoutBtn.disabled = total === 0;
}

async function updateQty(cartItemId, newQty) {
    if (newQty < 1) return removeFromCart(cartItemId);
    await fetch(`${API_URL}/cart/${cartItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ quantity: newQty })
    });
    fetchCart();
}

async function removeFromCart(cartItemId) {
    await fetch(`${API_URL}/cart/${cartItemId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    showToast('Item removed');
    fetchCart();
}

async function handleCheckout() {
    const deliveryAddress = document.getElementById('deliveryAddress').value.trim();
    if (!deliveryAddress) {
        return showToast('Delivery address is required!');
    }

    try {
        const res = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ deliveryAddress })
        });
        if (res.ok) {
            showToast('Order Placed Successfully!');
            document.getElementById('deliveryAddress').value = '';
            fetchCart();
            switchView('orders');
            fetchOrders();
        } else {
            const data = await res.json();
            showToast(data.message || 'Checkout failed');
        }
    } catch (e) {
        showToast('Checkout Error');
    }
}

// Orders
async function fetchOrders() {
    elems.ordersContainer.innerHTML = '<div class="loading">Loading orders...</div>';
    try {
        const res = await fetch(`${API_URL}/orders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const orders = await res.json();
            renderOrders(orders);
        }
    } catch (e) {
        elems.ordersContainer.innerHTML = 'Error loading orders.';
    }
}

function renderOrders(orders) {
    if (orders.length === 0) {
        elems.ordersContainer.innerHTML = '<div style="padding:40px; text-align:center;">No orders found.</div>';
        return;
    }

    elems.ordersContainer.innerHTML = orders.map(o => `
        <div class="order-card">
            <div class="order-header">
                <span>Order #${o.id}</span>
                <span>Date: ${new Date(o.created_at).toLocaleDateString()}</span>
                <span>Total: $${o.total_amount.toFixed(2)}</span>
                <span style="color:var(--green); text-transform:uppercase;">${o.status}</span>
            </div>
            <div style="font-size: 14px; margin-bottom: 20px; color: var(--text-secondary);">
                <strong>Delivery Address:</strong><br/>
                ${o.delivery_address ? o.delivery_address.replace(/\n/g, '<br/>') : 'No address provided'}
            </div>
            <div class="order-items">
                ${o.items.map(i => `
                    <div class="order-item-row">
                        <img src="${i.image}" alt="">
                        <div>
                            <div>${i.name}</div>
                            <div style="color:var(--text-light); font-size:14px;">Qty: ${i.quantity} x $${i.price.toFixed(2)}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}


// Utils
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Start
init();
