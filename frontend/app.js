// ─── CONFIG ──────────────────────────────────────────────────────────────────
const API = '/api';
const SUPABASE_URL = 'https://gvtdvnqvxordraztxkwx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_On0R6UD2iuwqcWgnKQmK8w_3DzBKsuB';

// ─── STATE ───────────────────────────────────────────────────────────────────
let state = {
  ingredients: [],
  products: [],
  sales: [],
  stats: {},
  editingIngredient: null,
  editingProduct: null,
  ingSearch: '',
  prodFilter: '',
  selectedRating: 0,
  activeTab: 'sell'
};

// ─── UTILS ───────────────────────────────────────────────────────────────────
function fmt(n) { return `$${parseFloat(n || 0).toFixed(2)}`; }
function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function pct(val, max) { return max > 0 ? Math.min(100, Math.round((val / max) * 100)) : 0; }
function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
function el(id) { return document.getElementById(id); }

// ─── TOAST ───────────────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const container = el('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast ${type} fade-in`;
  t.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => {
    t.classList.add('toast-out');
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

// ─── API HELPERS ─────────────────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ─── DATA LOADING ─────────────────────────────────────────────────────────────
async function loadAll() {
  try {
    const [ingredients, products, stats, todaySales] = await Promise.all([
      apiFetch('/ingredients'),
      apiFetch('/products'),
      apiFetch('/stats'),
      apiFetch('/sales/today')
    ]);
    state.ingredients = ingredients;
    state.products = products;
    state.stats = stats;
    state.sales = todaySales.sales || [];
    renderAll();
    updateHeroStats();
  } catch (e) {
    toast('Failed to load data: ' + e.message, 'error');
  }
}

async function refreshStats() {
  try {
    const [stats, todaySales] = await Promise.all([
      apiFetch('/stats'),
      apiFetch('/sales/today')
    ]);
    state.stats = stats;
    state.sales = todaySales.sales || [];
    renderStats();
    renderSalesLog();
    updateHeroStats();
  } catch (e) { console.error(e); }
}

// ─── RENDER ALL ──────────────────────────────────────────────────────────────
function renderAll() {
  renderStats();
  renderIngredients();
  renderProducts();
  renderSellPanel();
  renderProfitTable();
  renderSalesLog();
}

// ─── STATS (با بررسی وجود المنت‌ها) ──────────────────────────────────────────────
function renderStats() {
  const s = state.stats;
  const revenueEl = document.getElementById('stat-revenue');
  const profitEl = document.getElementById('stat-profit');
  const costEl = document.getElementById('stat-cost');
  const ordersEl = document.getElementById('stat-orders');
  const lowstockEl = document.getElementById('stat-lowstock');
  const lowstockBadge = document.getElementById('stat-lowstock-badge');
  const marginEl = document.getElementById('stat-margin');
  
  if (revenueEl) revenueEl.textContent = fmt(s.todayRevenue);
  if (profitEl) profitEl.textContent = fmt(s.todayProfit);
  if (costEl) costEl.textContent = fmt(s.todayCost);
  if (ordersEl) ordersEl.textContent = s.todayTransactions || 0;
  if (lowstockEl) lowstockEl.textContent = s.lowStockCount || 0;
  if (lowstockBadge) {
    lowstockBadge.className = `badge ${s.lowStockCount > 0 ? 'badge-danger' : 'badge-success'}`;
    lowstockBadge.textContent = s.lowStockCount > 0 ? 'Alert' : 'OK';
  }
  if (marginEl) {
    const margin = s.todayRevenue > 0 ? ((s.todayProfit / s.todayRevenue) * 100).toFixed(1) : 0;
    marginEl.textContent = `${margin}% margin today`;
  }
}

// ─── HERO STATS ────────────────────────────────────────────────────────────────
function updateHeroStats() {
  const dailyRevenue = document.getElementById('stat-revenue-hero');
  const profitMargin = document.getElementById('stat-margin-hero');
  const itemsSold = document.getElementById('stat-items-hero');
  const revenueTrend = document.getElementById('hero-revenue-trend');
  const marginTrend = document.getElementById('hero-margin-trend');
  const itemsTrend = document.getElementById('hero-items-trend');
  
  if (dailyRevenue) dailyRevenue.textContent = fmt(state.stats.todayRevenue);
  if (itemsSold) itemsSold.textContent = state.stats.todayTransactions || 0;
  if (profitMargin) {
    const margin = state.stats.todayRevenue > 0 ? ((state.stats.todayProfit / state.stats.todayRevenue) * 100).toFixed(1) : 0;
    profitMargin.textContent = `${margin}%`;
  }
  if (revenueTrend) revenueTrend.innerHTML = `💰 ${fmt(state.stats.todayRevenue)} total today`;
  if (marginTrend) {
    const margin = state.stats.todayRevenue > 0 ? ((state.stats.todayProfit / state.stats.todayRevenue) * 100).toFixed(1) : 0;
    marginTrend.innerHTML = `📈 ${margin}% profit margin`;
  }
  if (itemsTrend) itemsTrend.innerHTML = `☕ ${state.stats.todayTransactions || 0} orders today`;
}

// ─── INGREDIENTS ─────────────────────────────────────────────────────────────
function renderIngredients() {
  const filtered = state.ingredients.filter(i =>
    i.name.toLowerCase().includes(state.ingSearch.toLowerCase())
  );
  const tbody = el('ing-tbody');
  if (!tbody) return;
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">🧂</div><p>${state.ingSearch ? 'No results found' : 'No ingredients yet. Add one to get started!'}</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map(ing => {
    const isLow = ing.stock <= ing.threshold;
    const barClass = isLow ? 'low' : (ing.stock <= ing.threshold * 2 ? 'warn' : 'ok');
    return `
    <tr class="${isLow ? 'row-low' : ''}" id="ing-row-${ing.id}">
      <td><span style="font-weight:600">${ing.name}</span></td>
      <td>
        <div class="stock-bar-wrap">
          <div class="stock-bar"><div class="stock-bar-fill ${barClass}" style="width:${pct(ing.stock, ing.stock + ing.threshold * 3)}%"></div></div>
          <span style="font-weight:600;white-space:nowrap">${ing.stock} ${ing.unit}</span>
        </div>
       </td
      <td>${ing.threshold} ${ing.unit}</td
      <td><span class="badge ${isLow ? 'badge-danger' : 'badge-success'}">${isLow ? '⚠ Low' : '✓ OK'}</span></td
      <td>$${(ing.costPerUnit).toFixed(4)}/${ing.unit}</td
      <td>
        <div style="display:flex;gap:.4rem">
          <button class="btn btn-outline btn-xs" onclick="openEditIngredient('${ing.id}')">✏ Edit</button>
          <button class="btn btn-danger btn-xs" onclick="deleteIngredient('${ing.id}')">🗑</button>
        </div>
       </td
    表`;
  }).join('');
  const ingCount = el('ing-count');
  if (ingCount) ingCount.textContent = `${state.ingredients.length} items`;
}

// ─── INGREDIENT MODAL ─────────────────────────────────────────────────────────
function openAddIngredient() {
  state.editingIngredient = null;
  const title = el('ing-modal-title');
  if (title) title.textContent = 'Add Ingredient';
  const nameEl = el('ing-name');
  const stockEl = el('ing-stock');
  const unitEl = el('ing-unit');
  const thresholdEl = el('ing-threshold');
  const costEl = el('ing-cost');
  if (nameEl) nameEl.value = '';
  if (stockEl) stockEl.value = '';
  if (unitEl) unitEl.value = '';
  if (thresholdEl) thresholdEl.value = '';
  if (costEl) costEl.value = '';
  openModal('ing-modal');
}
function openEditIngredient(id) {
  const ing = state.ingredients.find(i => i.id === id);
  if (!ing) return;
  state.editingIngredient = ing;
  const title = el('ing-modal-title');
  if (title) title.textContent = 'Edit Ingredient';
  const nameEl = el('ing-name');
  const stockEl = el('ing-stock');
  const unitEl = el('ing-unit');
  const thresholdEl = el('ing-threshold');
  const costEl = el('ing-cost');
  if (nameEl) nameEl.value = ing.name;
  if (stockEl) stockEl.value = ing.stock;
  if (unitEl) unitEl.value = ing.unit;
  if (thresholdEl) thresholdEl.value = ing.threshold;
  if (costEl) costEl.value = ing.costPerUnit;
  openModal('ing-modal');
}
async function saveIngredient() {
  const body = {
    name: el('ing-name')?.value.trim() || '',
    stock: parseFloat(el('ing-stock')?.value || '0'),
    unit: el('ing-unit')?.value.trim() || '',
    threshold: parseFloat(el('ing-threshold')?.value || '0'),
    costPerUnit: parseFloat(el('ing-cost')?.value || '0')
  };
  if (!body.name || !body.unit || isNaN(body.stock) || isNaN(body.threshold) || isNaN(body.costPerUnit)) {
    toast('Please fill all fields correctly.', 'error'); return;
  }
  try {
    if (state.editingIngredient) {
      const updated = await apiFetch(`/ingredients/${state.editingIngredient.id}`, { method: 'PUT', body });
      const idx = state.ingredients.findIndex(i => i.id === updated.id);
      state.ingredients[idx] = updated;
      toast('Ingredient updated!');
    } else {
      const newIng = await apiFetch('/ingredients', { method: 'POST', body });
      state.ingredients.push(newIng);
      toast('Ingredient added!');
    }
    closeModal('ing-modal');
    renderIngredients();
    renderSellPanel();
    renderProfitTable();
    await refreshStats();
  } catch (e) { toast(e.message, 'error'); }
}
async function deleteIngredient(id) {
  if (!confirm('Delete this ingredient? Make sure it is not used in any recipe.')) return;
  try {
    await apiFetch(`/ingredients/${id}`, { method: 'DELETE' });
    state.ingredients = state.ingredients.filter(i => i.id !== id);
    toast('Ingredient deleted.');
    renderIngredients();
    renderProfitTable();
    await refreshStats();
  } catch (e) { toast(e.message, 'error'); }
}

// ─── PRODUCTS ────────────────────────────────────────────────────────────────
function calcProductCost(product) {
  return product.recipe.reduce((sum, r) => {
    const ing = state.ingredients.find(i => i.id === r.ingredientId);
    return sum + (ing ? ing.costPerUnit * r.amount : 0);
  }, 0);
}

function renderProducts() {
  const search = state.prodFilter.toLowerCase();
  const filtered = state.products.filter(p =>
    p.name.toLowerCase().includes(search)
  );
  const tbody = el('prod-tbody');
  if (!tbody) return;
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">☕</div><p>${state.prodFilter ? 'No results found' : 'No products yet. Add one!'}</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map(prod => {
    const cost = calcProductCost(prod);
    const profit = prod.price - cost;
    const margin = prod.price > 0 ? ((profit / prod.price) * 100).toFixed(1) : 0;
    const recipe = prod.recipe.map(r => {
      const ing = state.ingredients.find(i => i.id === r.ingredientId);
      return ing ? `<span class="tag">${ing.name}: ${r.amount}${ing.unit}</span>` : '';
    }).join('');
    return `
    <tr id="prod-row-${prod.id}">
      <td><span style="font-weight:600">${prod.name}</span></td>
      <td style="font-weight:700">${fmt(prod.price)}</td
      <td style="color:var(--red-600)">${fmt(cost)}</td
      <td style="color:var(--green-600);font-weight:700">${fmt(profit)}</td
      <td>
        <div class="profit-bar-wrap">
          <div class="profit-bar"><div class="profit-bar-fill" style="width:${margin}%"></div></div>
          <span class="margin-text">${margin}%</span>
        </div>
       </td
      <td><div style="max-width:260px;flex-wrap:wrap;display:flex">${recipe}</div></td
      <td>
        <div style="display:flex;gap:.4rem">
          <button class="btn btn-outline btn-xs" onclick="openEditProduct('${prod.id}')">✏ Edit</button>
          <button class="btn btn-danger btn-xs" onclick="deleteProduct('${prod.id}')">🗑</button>
        </div>
       </td
    表`;
  }).join('');
  const prodCount = el('prod-count');
  if (prodCount) prodCount.textContent = `${state.products.length} items`;
}

// ─── PRODUCT MODAL ────────────────────────────────────────────────────────────
let recipeRows = [];
function openAddProduct() {
  state.editingProduct = null;
  const title = el('prod-modal-title');
  if (title) title.textContent = 'Add Product';
  const nameEl = el('prod-name');
  const priceEl = el('prod-price');
  if (nameEl) nameEl.value = '';
  if (priceEl) priceEl.value = '';
  recipeRows = [];
  renderRecipeRows();
  openModal('prod-modal');
}
function openEditProduct(id) {
  const prod = state.products.find(p => p.id === id);
  if (!prod) return;
  state.editingProduct = prod;
  const title = el('prod-modal-title');
  if (title) title.textContent = 'Edit Product';
  const nameEl = el('prod-name');
  const priceEl = el('prod-price');
  if (nameEl) nameEl.value = prod.name;
  if (priceEl) priceEl.value = prod.price;
  recipeRows = prod.recipe.map(r => ({ ingredientId: r.ingredientId, amount: r.amount }));
  renderRecipeRows();
  openModal('prod-modal');
}
function renderRecipeRows() {
  const container = el('recipe-rows');
  if (!container) return;
  container.innerHTML = recipeRows.map((row, idx) => `
    <div class="recipe-row">
      <select class="form-control" onchange="recipeRows[${idx}].ingredientId=this.value">
        <option value="">-- Select Ingredient --</option>
        ${state.ingredients.map(i =>
          `<option value="${i.id}" ${i.id === row.ingredientId ? 'selected' : ''}>${i.name} (${i.unit})</option>`
        ).join('')}
      </select>
      <input type="number" class="form-control" placeholder="Amount" min="0.01" step="0.01"
        value="${row.amount || ''}" onchange="recipeRows[${idx}].amount=parseFloat(this.value)" style="width:90px">
      <button type="button" class="recipe-remove" onclick="removeRecipeRow(${idx})">×</button>
    </div>
  `).join('');
}
function addRecipeRow() {
  recipeRows.push({ ingredientId: '', amount: 0 });
  renderRecipeRows();
}
function removeRecipeRow(idx) {
  recipeRows.splice(idx, 1);
  renderRecipeRows();
}
async function saveProduct() {
  const name = el('prod-name')?.value.trim() || '';
  const price = parseFloat(el('prod-price')?.value || '0');
  if (!name || isNaN(price) || price <= 0) {
    toast('Please enter a valid name and price.', 'error'); return;
  }
  if (recipeRows.length === 0) {
    toast('Please add at least one ingredient to the recipe.', 'error'); return;
  }
  for (const r of recipeRows) {
    if (!r.ingredientId || !r.amount || r.amount <= 0) {
      toast('Each recipe item needs an ingredient and amount.', 'error'); return;
    }
  }
  const body = { name, price, recipe: recipeRows };
  try {
    if (state.editingProduct) {
      const updated = await apiFetch(`/products/${state.editingProduct.id}`, { method: 'PUT', body });
      const idx = state.products.findIndex(p => p.id === updated.id);
      state.products[idx] = updated;
      toast('Product updated!');
    } else {
      const newProd = await apiFetch('/products', { method: 'POST', body });
      state.products.push(newProd);
      toast('Product added!');
    }
    closeModal('prod-modal');
    renderProducts();
    renderSellPanel();
    renderProfitTable();
  } catch (e) { toast(e.message, 'error'); }
}
async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  try {
    await apiFetch(`/products/${id}`, { method: 'DELETE' });
    state.products = state.products.filter(p => p.id !== id);
    toast('Product deleted.');
    renderProducts();
    renderSellPanel();
    renderProfitTable();
  } catch (e) { toast(e.message, 'error'); }
}

// ─── SELL PANEL ──────────────────────────────────────────────────────────────
function renderSellPanel() {
  const container = el('sell-grid');
  if (!container) return;
  if (state.products.length === 0) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">☕</div><p>No products yet. Add products to start selling.</p></div>`;
    return;
  }
  container.innerHTML = state.products.map(prod => {
    const cost = calcProductCost(prod);
    const profit = prod.price - cost;
    const canSell = prod.recipe.every(r => {
      const ing = state.ingredients.find(i => i.id === r.ingredientId);
      return ing && ing.stock >= r.amount;
    });
    return `
    <div class="sell-card ${!canSell ? 'out-of-stock' : ''}" style="${!canSell ? 'opacity:.6' : ''}">
      <div class="sell-card-name">${prod.name}</div>
      <div class="sell-card-price">${fmt(prod.price)}</div>
      <div class="sell-card-meta">
        Cost: ${fmt(cost)} · Profit: <span style="color:var(--green-600);font-weight:700">${fmt(profit)}</span>
        ${!canSell ? '<br><span style="color:var(--red-500);font-weight:700">⚠ Out of stock</span>' : ''}
      </div>
      <div class="sell-card-actions">
        <input type="number" class="qty-input" id="qty-${prod.id}" value="1" min="1" max="99">
        <button class="sell-btn" onclick="sellProduct('${prod.id}')" ${!canSell ? 'disabled' : ''}>
          ☕ Sell
        </button>
      </div>
    </div>`;
  }).join('');
}

async function sellProduct(productId) {
  const qtyInput = el(`qty-${productId}`);
  const quantity = parseInt(qtyInput ? qtyInput.value : 1) || 1;
  const btn = qtyInput ? qtyInput.parentElement.querySelector('.sell-btn') : null;
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  try {
    const result = await apiFetch('/sell', { method: 'POST', body: { productId, quantity } });
    state.ingredients = result.updatedIngredients;
    state.sales.unshift(result.sale);
    renderIngredients();
    renderSellPanel();
    renderProfitTable();
    renderSalesLog();
    await refreshStats();
    const prod = state.products.find(p => p.id === productId);
    toast(`Sold ${quantity}x ${prod ? prod.name : 'item'} — Revenue: ${fmt(result.sale.revenue)}`, 'success');
    const row = el(`prod-row-${productId}`);
    if (row) { row.classList.add('tr-highlight'); setTimeout(() => row.classList.remove('tr-highlight'), 900); }
  } catch (e) {
    toast(e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '☕ Sell'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '☕ Sell'; }
  }
}

// ─── PROFIT TABLE ────────────────────────────────────────────────────────────
function renderProfitTable() {
  const tbody = el('profit-tbody');
  if (!tbody) return;
  if (state.products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">📊</div><p>No products to analyze.</p></div></td></tr>`;
    return;
  }
  const sorted = [...state.products].sort((a, b) => {
    const pa = a.price - calcProductCost(a);
    const pb = b.price - calcProductCost(b);
    return pb - pa;
  });
  tbody.innerHTML = sorted.map((prod, i) => {
    const cost = calcProductCost(prod);
    const profit = prod.price - cost;
    const margin = prod.price > 0 ? ((profit / prod.price) * 100).toFixed(1) : 0;
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
    return `
    <table>
      <td><span style="font-weight:600">${medal} ${prod.name}</span></td>
      <td style="font-weight:700">${fmt(prod.price)}</td
      <td style="color:var(--red-600)">${fmt(cost)}</td
      <td style="color:var(--green-600);font-weight:700">${fmt(profit)}</td
      <td>
        <div class="profit-bar-wrap">
          <div class="profit-bar"><div class="profit-bar-fill" style="width:${margin}%"></div></div>
          <span class="margin-text">${margin}%</span>
        </div>
       </td
    表`;
  }).join('');
}

// ─── SALES LOG ───────────────────────────────────────────────────────────────
function renderSalesLog() {
  const container = el('sales-log');
  if (!container) return;
  if (state.sales.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>No sales today yet.</p></div>`;
    return;
  }
  container.innerHTML = state.sales.slice(0, 30).map((s, i) => `
    <div class="sale-item ${i === 0 ? 'new-sale' : ''}">
      <div class="sale-dot"></div>
      <div class="sale-info">
        <div class="sale-name">${s.productName} ×${s.quantity}</div>
        <div class="sale-time">${fmtDate(s.timestamp)} · ${fmtTime(s.timestamp)} · Profit: ${fmt(s.profit)}</div>
      </div>
      <div class="sale-amount">${fmt(s.revenue)}</div>
    </div>
  `).join('');
}

// ─── MODALS ───────────────────────────────────────────────────────────────────
function openModal(id) {
  const overlay = el(id);
  if (overlay) {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}
function closeModal(id) {
  const overlay = el(id);
  if (overlay) {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
}
// Close on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});
// Close on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => {
      m.classList.remove('open');
      document.body.style.overflow = '';
    });
  }
});

// ─── NAVIGATION ──────────────────────────────────────────────────────────────
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const sec = el('section-' + name);
  if (sec) sec.classList.add('active');
  const lnk = el('nav-' + name);
  if (lnk) lnk.classList.add('active');
  if (name === 'dashboard') loadAll();
  if (name === 'landing') loadAll();
  window.scrollTo(0, 0);
}

// ─── FEEDBACK ─────────────────────────────────────────────────────────────────
function setRating(n) {
  state.selectedRating = n;
  document.querySelectorAll('.star').forEach((s, i) => {
    s.classList.toggle('active', i < n);
  });
}

async function submitFeedback() {
  const name = el('fb-name')?.value.trim() || '';
  const message = el('fb-message')?.value.trim() || '';
  const rating = state.selectedRating;
  if (!name) { toast('Please enter your name.', 'error'); return; }
  if (!rating) { toast('Please select a rating.', 'error'); return; }
  if (!message) { toast('Please write a message.', 'error'); return; }
  const btn = el('fb-submit');
  if (btn) btn.disabled = true;
  if (btn) btn.textContent = 'Sending...';
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/feedback`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ name, rating, message })
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || 'Supabase error');
    }
    toast('Thank you for your feedback! ☕', 'success');
    const nameEl = el('fb-name');
    const messageEl = el('fb-message');
    if (nameEl) nameEl.value = '';
    if (messageEl) messageEl.value = '';
    setRating(0);
  } catch (e) {
    toast('Failed to send feedback: ' + e.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
    if (btn) btn.textContent = 'Submit Feedback';
  }
}

// ─── SEARCH / FILTER ─────────────────────────────────────────────────────────
const debouncedIngSearch = debounce(v => { state.ingSearch = v; renderIngredients(); }, 250);
const debouncedProdFilter = debounce(v => { state.prodFilter = v; renderProducts(); }, 250);

// ─── DASHBOARD TABS ───────────────────────────────────────────────────────────
function setDashTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const tabBtn = el('tab-' + tab);
  if (tabBtn) tabBtn.classList.add('active');
  ['sell', 'ingredients', 'products', 'profit', 'sales'].forEach(t => {
    const panel = el('dash-panel-' + t);
    if (panel) panel.style.display = t === tab ? 'block' : 'none';
  });
}

// ─── LIVE CLOCK ──────────────────────────────────────────────────────────────
function updateClock() {
  const c = el('live-clock');
  if (c) c.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  showSection('landing');
  setInterval(updateClock, 1000);
  updateClock();
  setDashTab('sell');
});
window.showSection = showSection;
window.loadAll = loadAll;
window.setDashTab = setDashTab;
window.openAddIngredient = openAddIngredient;
window.saveIngredient = saveIngredient;
window.openAddProduct = openAddProduct;
window.saveProduct = saveProduct;
window.sellProduct = sellProduct;
window.submitFeedback = submitFeedback;
window.setRating = setRating;
window.closeModal = closeModal;
window.openModal = openModal;
window.deleteIngredient = deleteIngredient;
window.deleteProduct = deleteProduct;
window.refreshStats = refreshStats;
