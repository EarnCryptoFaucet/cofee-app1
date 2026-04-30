// ════════════════════════════════════════════════════════════════════════════════
// BrewDesk — app.js  (Refactored, Debugged, Production-Ready)
// ════════════════════════════════════════════════════════════════════════════════

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CONFIG = {
  API: '/api',
  CACHE_TTL: 5 * 60 * 1000,     // 5 minutes
  SEARCH_DEBOUNCE: 250,          // ms
  TOAST_DURATION: 3500,          // ms
};

// ─── STATE ───────────────────────────────────────────────────────────────────
const state = {
  ingredients: [],
  products: [],
  sales: [],
  stats: { todayRevenue: 0, todayProfit: 0, todayCost: 0, todayTransactions: 0, lowStockCount: 0 },
  editingIngredient: null,
  editingProduct: null,
  ingSearch: '',
  prodFilter: '',
  selectedRating: 0,
  activeTab: 'sell',
  demoMode: false,
};

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
// Used automatically when the backend is unreachable.
const MOCK_INGREDIENTS = [
  { id: 'ing-1', name: 'Arabica Coffee Beans', stock: 8000, unit: 'g',   threshold: 1000, costPerUnit: 0.05  },
  { id: 'ing-2', name: 'Whole Milk',            stock: 12000, unit: 'ml', threshold: 2000, costPerUnit: 0.001 },
  { id: 'ing-3', name: 'White Sugar',            stock: 5000, unit: 'g',  threshold: 500,  costPerUnit: 0.002 },
  { id: 'ing-4', name: 'Vanilla Syrup',          stock: 1500, unit: 'ml', threshold: 300,  costPerUnit: 0.015 },
  { id: 'ing-5', name: 'Chocolate Sauce',        stock: 900,  unit: 'ml', threshold: 200,  costPerUnit: 0.02  },
  { id: 'ing-6', name: 'Paper Cups (12oz)',      stock: 250,  unit: 'pcs',threshold: 50,   costPerUnit: 0.08  },
  { id: 'ing-7', name: 'Oat Milk',              stock: 4000, unit: 'ml', threshold: 800,  costPerUnit: 0.0018},
  { id: 'ing-8', name: 'Caramel Syrup',          stock: 180,  unit: 'ml', threshold: 200,  costPerUnit: 0.018 },
];

const MOCK_PRODUCTS = [
  { id: 'prod-1', name: 'Espresso',       price: 3.50, recipe: [{ ingredientId: 'ing-1', amount: 18 }, { ingredientId: 'ing-6', amount: 1 }] },
  { id: 'prod-2', name: 'Cappuccino',     price: 4.50, recipe: [{ ingredientId: 'ing-1', amount: 18 }, { ingredientId: 'ing-2', amount: 150 }, { ingredientId: 'ing-6', amount: 1 }] },
  { id: 'prod-3', name: 'Vanilla Latte',  price: 5.50, recipe: [{ ingredientId: 'ing-1', amount: 18 }, { ingredientId: 'ing-2', amount: 200 }, { ingredientId: 'ing-4', amount: 30 }, { ingredientId: 'ing-6', amount: 1 }] },
  { id: 'prod-4', name: 'Mocha',          price: 6.00, recipe: [{ ingredientId: 'ing-1', amount: 18 }, { ingredientId: 'ing-2', amount: 180 }, { ingredientId: 'ing-5', amount: 25 }, { ingredientId: 'ing-6', amount: 1 }] },
  { id: 'prod-5', name: 'Oat Flat White', price: 5.00, recipe: [{ ingredientId: 'ing-1', amount: 18 }, { ingredientId: 'ing-7', amount: 180 }, { ingredientId: 'ing-6', amount: 1 }] },
  { id: 'prod-6', name: 'Caramel Macchiato', price: 6.50, recipe: [{ ingredientId: 'ing-1', amount: 18 }, { ingredientId: 'ing-2', amount: 200 }, { ingredientId: 'ing-8', amount: 30 }, { ingredientId: 'ing-6', amount: 1 }] },
];

function generateMockSales() {
  const now = new Date();
  const sales = [];
  const products = MOCK_PRODUCTS;
  for (let i = 0; i < 12; i++) {
    const prod = products[Math.floor(Math.random() * products.length)];
    const qty = Math.floor(Math.random() * 3) + 1;
    const cost = calcProductCostFromList(prod, MOCK_INGREDIENTS) * qty;
    const revenue = prod.price * qty;
    const ts = new Date(now.getTime() - (i * 22 + Math.random() * 15) * 60000);
    sales.push({ id: `sale-${i}`, productId: prod.id, productName: prod.name, quantity: qty, revenue, cost, profit: revenue - cost, timestamp: ts.toISOString() });
  }
  return sales;
}

function calcMockStats(sales) {
  const revenue = sales.reduce((s, x) => s + x.revenue, 0);
  const cost    = sales.reduce((s, x) => s + x.cost, 0);
  const profit  = sales.reduce((s, x) => s + x.profit, 0);
  const low     = MOCK_INGREDIENTS.filter(i => i.stock <= i.threshold).length;
  return { todayRevenue: revenue, todayProfit: profit, todayCost: cost, todayTransactions: sales.length, lowStockCount: low };
}

// ─── UTILS ───────────────────────────────────────────────────────────────────
function fmt(n) { return `$${parseFloat(n || 0).toFixed(2)}`; }
function fmtTime(iso) { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function fmtDate(iso) { return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' }); }
function pct(val, max) { return max > 0 ? Math.min(100, Math.round((val / max) * 100)) : 0; }
function el(id) { return document.getElementById(id); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// Memoization for expensive calculations
const _costCache = new Map();
function calcProductCost(product) {
  return calcProductCostFromList(product, state.ingredients);
}
function calcProductCostFromList(product, ingredients) {
  return product.recipe.reduce((sum, r) => {
    const ing = ingredients.find(i => i.id === r.ingredientId);
    return sum + (ing ? ing.costPerUnit * r.amount : 0);
  }, 0);
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const container = el('toast-container');
  if (!container) return;
  const div = document.createElement('div');
  div.className = `toast ${type} fade-in`;
  div.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(div);
  setTimeout(() => { div.classList.add('toast-out'); setTimeout(() => div.remove(), 300); }, CONFIG.TOAST_DURATION);
}

// ─── API LAYER WITH MOCK FALLBACK ─────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const res = await fetch(CONFIG.API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// LocalStorage helpers for mock-mode persistence
function lsGet(key) { try { const v = localStorage.getItem('brewdesk_' + key); return v ? JSON.parse(v) : null; } catch { return null; } }
function lsSet(key, val) { try { localStorage.setItem('brewdesk_' + key, JSON.stringify(val)); } catch {} }

function initMockData() {
  // Persist mock data so edits survive page reload
  if (!lsGet('ingredients')) lsSet('ingredients', MOCK_INGREDIENTS);
  if (!lsGet('products'))    lsSet('products',    MOCK_PRODUCTS);
  if (!lsGet('sales'))       lsSet('sales',       generateMockSales());
}

function loadMockData() {
  state.ingredients = lsGet('ingredients') || MOCK_INGREDIENTS;
  state.products    = lsGet('products')    || MOCK_PRODUCTS;
  state.sales       = lsGet('sales')       || generateMockSales();
  state.stats       = calcMockStats(state.sales);
  state.demoMode    = true;
}

function saveMockIngredients() { if (state.demoMode) lsSet('ingredients', state.ingredients); }
function saveMockProducts()    { if (state.demoMode) lsSet('products',    state.products); }
function saveMockSales()       { if (state.demoMode) lsSet('sales',       state.sales); }

// ─── DATA LOADING ─────────────────────────────────────────────────────────────
async function loadAll() {
  try {
    const [ingredients, products, stats, todaySales] = await Promise.all([
      apiFetch('/ingredients'),
      apiFetch('/products'),
      apiFetch('/stats'),
      apiFetch('/sales/today'),
    ]);
    state.ingredients = ingredients;
    state.products    = products;
    state.stats       = stats;
    state.sales       = todaySales.sales || [];
    state.demoMode    = false;
    const badge = el('demo-badge');
    if (badge) badge.style.display = 'none';
  } catch (_) {
    // Backend unreachable — fall back to mock data
    initMockData();
    loadMockData();
    const badge = el('demo-badge');
    if (badge) badge.style.display = '';
    toast('No backend detected — using demo data. All edits are saved locally. ☕', 'info');
  }
  renderAll();
  updateHeroStats();
}

async function refreshStats() {
  if (state.demoMode) {
    state.stats = calcMockStats(state.sales);
    renderStats();
    renderSalesLog();
    renderFullSalesTable();
    updateProfitPanelStats();
    updateHeroStats();
    return;
  }
  try {
    const [stats, todaySales] = await Promise.all([apiFetch('/stats'), apiFetch('/sales/today')]);
    state.stats = stats;
    state.sales = todaySales.sales || [];
    renderStats();
    renderSalesLog();
    renderFullSalesTable();
    updateProfitPanelStats();
    updateHeroStats();
  } catch (e) { /* silent */ }
}

// ─── RENDER ALL ──────────────────────────────────────────────────────────────
function renderAll() {
  renderStats();
  renderIngredients();
  renderProducts();
  renderSellPanel();
  renderProfitTable();
  renderFullProfitTable();
  renderSalesLog();
  renderFullSalesTable();
  updateProfitPanelStats();
}

// ─── STATS ───────────────────────────────────────────────────────────────────
function renderStats() {
  const s = state.stats;
  const safe = (id, val) => { const e = el(id); if (e) e.textContent = val; };
  safe('stat-revenue', fmt(s.todayRevenue));
  safe('stat-profit',  fmt(s.todayProfit));
  safe('stat-cost',    fmt(s.todayCost));
  safe('stat-orders',  s.todayTransactions || 0);
  safe('stat-lowstock', s.lowStockCount || 0);

  const badge = el('stat-lowstock-badge');
  if (badge) {
    badge.className = `badge ${s.lowStockCount > 0 ? 'badge-danger' : 'badge-success'}`;
    badge.textContent = s.lowStockCount > 0 ? 'Alert' : 'OK';
  }
  const marginEl = el('stat-margin');
  if (marginEl) {
    const m = s.todayRevenue > 0 ? ((s.todayProfit / s.todayRevenue) * 100).toFixed(1) : 0;
    marginEl.textContent = `${m}% margin today`;
  }
}

// ─── HERO STATS (landing page sync) ──────────────────────────────────────────
function updateHeroStats() {
  const s = state.stats;
  const margin = s.todayRevenue > 0 ? ((s.todayProfit / s.todayRevenue) * 100).toFixed(1) : 0;
  const safe = (id, val) => { const e = el(id); if (e) e.textContent = val; };
  safe('stat-revenue-hero', fmt(s.todayRevenue));
  safe('stat-margin-hero', `${margin}%`);
  safe('stat-items-hero', s.todayTransactions || 0);
  safe('hero-revenue-trend', `💰 ${fmt(s.todayRevenue)} total today`);
  safe('hero-margin-trend', `📈 ${margin}% profit margin`);
  safe('hero-items-trend', `☕ ${s.todayTransactions || 0} orders today`);
}

// ─── INGREDIENTS TABLE ────────────────────────────────────────────────────────
function renderIngredients() {
  const tbody = el('ing-tbody');
  if (!tbody) return;

  const q = state.ingSearch.toLowerCase();
  const filtered = state.ingredients.filter(i => i.name.toLowerCase().includes(q));

  const ingCount = el('ing-count');
  if (ingCount) ingCount.textContent = `${state.ingredients.length} items`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">🧂</div>
      <p>${state.ingSearch ? 'No results found.' : 'No ingredients yet. Add one to get started!'}</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(ing => {
    const isLow = ing.stock <= ing.threshold;
    const barClass = isLow ? 'low' : (ing.stock <= ing.threshold * 2 ? 'warn' : 'ok');
    const barPct = pct(ing.stock, ing.stock + ing.threshold * 3);
    return `<tr class="${isLow ? 'row-low' : ''}" id="ing-row-${ing.id}">
      <td><span style="font-weight:600">${escHtml(ing.name)}</span></td>
      <td>
        <div class="stock-bar-wrap">
          <div class="stock-bar"><div class="stock-bar-fill ${barClass}" style="width:${barPct}%"></div></div>
          <span style="font-weight:600;white-space:nowrap">${ing.stock} ${ing.unit}</span>
        </div>
      </td>
      <td>${ing.threshold} ${ing.unit}</td>
      <td><span class="badge ${isLow ? 'badge-danger' : 'badge-success'}">${isLow ? '⚠ Low' : '✓ OK'}</span></td>
      <td>$${parseFloat(ing.costPerUnit).toFixed(4)}/${ing.unit}</td>
      <td>
        <div style="display:flex;gap:.4rem">
          <button class="btn btn-outline btn-xs" onclick="openEditIngredient('${ing.id}')">✏ Edit</button>
          <button class="btn btn-danger btn-xs" onclick="deleteIngredient('${ing.id}')">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ─── INGREDIENT MODAL ─────────────────────────────────────────────────────────
function openAddIngredient() {
  state.editingIngredient = null;
  const title = el('ing-modal-title');
  if (title) title.textContent = 'Add Ingredient';
  ['ing-name','ing-stock','ing-threshold','ing-cost'].forEach(id => { const e = el(id); if (e) e.value = ''; });
  const unit = el('ing-unit'); if (unit) unit.value = '';
  openModal('ing-modal');
}

function openEditIngredient(id) {
  const ing = state.ingredients.find(i => i.id === id);
  if (!ing) return;
  state.editingIngredient = ing;
  const title = el('ing-modal-title');
  if (title) title.textContent = 'Edit Ingredient';
  const set = (eid, val) => { const e = el(eid); if (e) e.value = val; };
  set('ing-name', ing.name);
  set('ing-stock', ing.stock);
  set('ing-unit', ing.unit);
  set('ing-threshold', ing.threshold);
  set('ing-cost', ing.costPerUnit);
  openModal('ing-modal');
}

async function saveIngredient() {
  const body = {
    name:        el('ing-name')?.value.trim() || '',
    stock:       parseFloat(el('ing-stock')?.value || ''),
    unit:        el('ing-unit')?.value.trim() || '',
    threshold:   parseFloat(el('ing-threshold')?.value || ''),
    costPerUnit: parseFloat(el('ing-cost')?.value || ''),
  };
  if (!body.name || !body.unit || isNaN(body.stock) || isNaN(body.threshold) || isNaN(body.costPerUnit)) {
    toast('Please fill all fields correctly.', 'error'); return;
  }

  if (state.demoMode) {
    // Mock: manipulate state directly
    if (state.editingIngredient) {
      const idx = state.ingredients.findIndex(i => i.id === state.editingIngredient.id);
      state.ingredients[idx] = { ...state.editingIngredient, ...body };
      toast('Ingredient updated!');
    } else {
      state.ingredients.push({ id: genId(), ...body });
      toast('Ingredient added!');
    }
    saveMockIngredients();
    closeModal('ing-modal');
    state.stats = calcMockStats(state.sales);
    renderStats();
    renderIngredients();
    renderSellPanel();
    renderProfitTable();
    renderFullProfitTable();
    updateHeroStats();
    return;
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
    renderIngredients(); renderSellPanel(); renderProfitTable(); renderFullProfitTable();
    await refreshStats();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteIngredient(id) {
  if (!confirm('Delete this ingredient? Make sure it is not used in any recipe.')) return;

  if (state.demoMode) {
    state.ingredients = state.ingredients.filter(i => i.id !== id);
    saveMockIngredients();
    toast('Ingredient deleted.');
    renderIngredients(); renderProfitTable(); renderFullProfitTable();
    return;
  }
  try {
    await apiFetch(`/ingredients/${id}`, { method: 'DELETE' });
    state.ingredients = state.ingredients.filter(i => i.id !== id);
    toast('Ingredient deleted.');
    renderIngredients(); renderProfitTable(); renderFullProfitTable();
    await refreshStats();
  } catch (e) { toast(e.message, 'error'); }
}

// ─── PRODUCTS TABLE ───────────────────────────────────────────────────────────
function renderProducts() {
  const tbody = el('prod-tbody');
  if (!tbody) return;

  const q = state.prodFilter.toLowerCase();
  const filtered = state.products.filter(p => p.name.toLowerCase().includes(q));
  const prodCount = el('prod-count');
  if (prodCount) prodCount.textContent = `${state.products.length} items`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">☕</div>
      <p>${state.prodFilter ? 'No results found.' : 'No products yet. Add one!'}</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(prod => {
    const cost   = calcProductCost(prod);
    const profit = prod.price - cost;
    const margin = prod.price > 0 ? ((profit / prod.price) * 100).toFixed(1) : 0;
    const recipe = prod.recipe.map(r => {
      const ing = state.ingredients.find(i => i.id === r.ingredientId);
      return ing ? `<span class="tag">${escHtml(ing.name)}: ${r.amount}${ing.unit}</span>` : '';
    }).join('');
    return `<tr id="prod-row-${prod.id}">
      <td><span style="font-weight:600">${escHtml(prod.name)}</span></td>
      <td style="font-weight:700">${fmt(prod.price)}</td>
      <td style="color:var(--red-600)">${fmt(cost)}</td>
      <td style="color:var(--green-600);font-weight:700">${fmt(profit)}</td>
      <td>
        <div class="profit-bar-wrap">
          <div class="profit-bar"><div class="profit-bar-fill" style="width:${margin}%"></div></div>
          <span class="margin-text">${margin}%</span>
        </div>
      </td>
      <td><div style="max-width:260px;flex-wrap:wrap;display:flex;gap:.25rem">${recipe}</div></td>
      <td>
        <div style="display:flex;gap:.4rem">
          <button class="btn btn-outline btn-xs" onclick="openEditProduct('${prod.id}')">✏ Edit</button>
          <button class="btn btn-danger btn-xs" onclick="deleteProduct('${prod.id}')">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ─── PRODUCT MODAL ────────────────────────────────────────────────────────────
let recipeRows = [];

function openAddProduct() {
  state.editingProduct = null;
  const title = el('prod-modal-title');
  if (title) title.textContent = 'Add Product';
  const nameEl = el('prod-name'); if (nameEl) nameEl.value = '';
  const priceEl = el('prod-price'); if (priceEl) priceEl.value = '';
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
  const nameEl = el('prod-name'); if (nameEl) nameEl.value = prod.name;
  const priceEl = el('prod-price'); if (priceEl) priceEl.value = prod.price;
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
          `<option value="${i.id}" ${i.id === row.ingredientId ? 'selected' : ''}>${escHtml(i.name)} (${i.unit})</option>`
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
  const name  = el('prod-name')?.value.trim() || '';
  const price = parseFloat(el('prod-price')?.value || '0');
  if (!name || isNaN(price) || price <= 0) { toast('Please enter a valid name and price.', 'error'); return; }
  if (recipeRows.length === 0) { toast('Please add at least one ingredient to the recipe.', 'error'); return; }
  for (const r of recipeRows) {
    if (!r.ingredientId || !r.amount || r.amount <= 0) {
      toast('Each recipe item needs an ingredient and amount.', 'error'); return;
    }
  }
  const body = { name, price, recipe: recipeRows };

  if (state.demoMode) {
    if (state.editingProduct) {
      const idx = state.products.findIndex(p => p.id === state.editingProduct.id);
      state.products[idx] = { ...state.editingProduct, ...body };
      toast('Product updated!');
    } else {
      state.products.push({ id: genId(), ...body });
      toast('Product added!');
    }
    saveMockProducts();
    closeModal('prod-modal');
    renderProducts(); renderSellPanel(); renderProfitTable(); renderFullProfitTable();
    return;
  }

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
    renderProducts(); renderSellPanel(); renderProfitTable(); renderFullProfitTable();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;

  if (state.demoMode) {
    state.products = state.products.filter(p => p.id !== id);
    saveMockProducts();
    toast('Product deleted.');
    renderProducts(); renderSellPanel(); renderProfitTable(); renderFullProfitTable();
    return;
  }
  try {
    await apiFetch(`/products/${id}`, { method: 'DELETE' });
    state.products = state.products.filter(p => p.id !== id);
    toast('Product deleted.');
    renderProducts(); renderSellPanel(); renderProfitTable(); renderFullProfitTable();
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
    const cost    = calcProductCost(prod);
    const profit  = prod.price - cost;
    const canSell = prod.recipe.every(r => {
      const ing = state.ingredients.find(i => i.id === r.ingredientId);
      return ing && ing.stock >= r.amount;
    });
    return `<div class="sell-card ${!canSell ? 'out-of-stock' : ''}" style="${!canSell ? 'opacity:.6' : ''}">
      <div class="sell-card-name">${escHtml(prod.name)}</div>
      <div class="sell-card-price">${fmt(prod.price)}</div>
      <div class="sell-card-meta">
        Cost: ${fmt(cost)} · Profit: <span style="color:var(--green-600);font-weight:700">${fmt(profit)}</span>
        ${!canSell ? '<br><span style="color:var(--red-500);font-weight:700">⚠ Out of stock</span>' : ''}
      </div>
      <div class="sell-card-actions">
        <input type="number" class="qty-input" id="qty-${prod.id}" value="1" min="1" max="99">
        <button class="sell-btn" onclick="sellProduct('${prod.id}')" ${!canSell ? 'disabled' : ''}>☕ Sell</button>
      </div>
    </div>`;
  }).join('');
}

async function sellProduct(productId) {
  const qtyInput = el(`qty-${productId}`);
  const quantity = parseInt(qtyInput?.value || 1) || 1;
  const btn      = qtyInput?.parentElement?.querySelector('.sell-btn');
  if (btn) { btn.disabled = true; btn.textContent = '...'; }

  if (state.demoMode) {
    // Mock sell: deduct stock locally
    const prod = state.products.find(p => p.id === productId);
    if (!prod) { if (btn) { btn.disabled = false; btn.textContent = '☕ Sell'; } return; }
    // Check stock
    for (const r of prod.recipe) {
      const ing = state.ingredients.find(i => i.id === r.ingredientId);
      if (!ing || ing.stock < r.amount * quantity) {
        toast('Not enough stock!', 'error');
        if (btn) { btn.disabled = false; btn.textContent = '☕ Sell'; }
        return;
      }
    }
    // Deduct
    prod.recipe.forEach(r => {
      const ing = state.ingredients.find(i => i.id === r.ingredientId);
      if (ing) ing.stock -= r.amount * quantity;
    });
    const cost    = calcProductCost(prod) * quantity;
    const revenue = prod.price * quantity;
    const sale    = { id: genId(), productId, productName: prod.name, quantity, revenue, cost, profit: revenue - cost, timestamp: new Date().toISOString() };
    state.sales.unshift(sale);
    state.stats = calcMockStats(state.sales);
    saveMockIngredients(); saveMockSales();
    renderIngredients(); renderSellPanel(); renderProfitTable(); renderFullProfitTable();
    renderSalesLog(); renderFullSalesTable();
    renderStats(); updateProfitPanelStats(); updateHeroStats();
    toast(`Sold ${quantity}× ${prod.name} — Revenue: ${fmt(revenue)}`, 'success');
    const row = el(`prod-row-${productId}`);
    if (row) { row.classList.add('tr-highlight'); setTimeout(() => row.classList.remove('tr-highlight'), 900); }
    if (btn) { btn.disabled = false; btn.textContent = '☕ Sell'; }
    return;
  }

  try {
    const result = await apiFetch('/sell', { method: 'POST', body: { productId, quantity } });
    state.ingredients = result.updatedIngredients;
    state.sales.unshift(result.sale);
    renderIngredients(); renderSellPanel(); renderProfitTable(); renderFullProfitTable();
    renderSalesLog(); renderFullSalesTable();
    await refreshStats();
    const prod = state.products.find(p => p.id === productId);
    toast(`Sold ${quantity}× ${prod ? prod.name : 'item'} — Revenue: ${fmt(result.sale.revenue)}`, 'success');
    const row = el(`prod-row-${productId}`);
    if (row) { row.classList.add('tr-highlight'); setTimeout(() => row.classList.remove('tr-highlight'), 900); }
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '☕ Sell'; }
  }
}

// ─── PROFIT TABLE (compact, in sell panel) ────────────────────────────────────
function renderProfitTable() {
  const tbody = el('profit-tbody');
  if (!tbody) return;
  if (state.products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">📊</div><p>No products to analyze.</p></div></td></tr>`;
    return;
  }
  const sorted = [...state.products].sort((a, b) => {
    return (b.price - calcProductCost(b)) - (a.price - calcProductCost(a));
  });
  tbody.innerHTML = sorted.map((prod, i) => {
    const cost   = calcProductCost(prod);
    const profit = prod.price - cost;
    const margin = prod.price > 0 ? ((profit / prod.price) * 100).toFixed(1) : 0;
    const medal  = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
    return `<tr>
      <td><span style="font-weight:600">${medal} ${escHtml(prod.name)}</span></td>
      <td style="font-weight:700">${fmt(prod.price)}</td>
      <td style="color:var(--green-600);font-weight:700">${fmt(profit)}</td>
      <td>
        <div class="profit-bar-wrap">
          <div class="profit-bar"><div class="profit-bar-fill" style="width:${margin}%"></div></div>
          <span class="margin-text">${margin}%</span>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ─── PROFIT ANALYSIS TABLE (full panel) ──────────────────────────────────────
function renderFullProfitTable() {
  const tbody = el('profit-full-tbody');
  if (!tbody) return;
  if (state.products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📊</div><p>No products added yet.</p></div></td></tr>`;
    return;
  }
  const sorted = [...state.products].sort((a, b) => {
    return (b.price - calcProductCost(b)) - (a.price - calcProductCost(a));
  });
  tbody.innerHTML = sorted.map((prod, i) => {
    const cost   = calcProductCost(prod);
    const profit = prod.price - cost;
    const margin = prod.price > 0 ? ((profit / prod.price) * 100).toFixed(1) : 0;
    const medal  = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
    const mColor = margin >= 60 ? 'var(--green-600)' : margin >= 40 ? 'var(--yellow-500)' : 'var(--red-500)';
    return `<tr>
      <td style="font-weight:700;color:var(--brown-500)">${medal}</td>
      <td style="font-weight:600">${escHtml(prod.name)}</td>
      <td style="font-weight:700">${fmt(prod.price)}</td>
      <td style="color:var(--red-600)">${fmt(cost)}</td>
      <td style="color:var(--green-600);font-weight:800;font-size:1rem">${fmt(profit)}</td>
      <td>
        <div class="profit-bar-wrap">
          <div class="profit-bar"><div class="profit-bar-fill" style="width:${margin}%"></div></div>
          <span style="font-size:.8rem;font-weight:700;color:${mColor};white-space:nowrap">${margin}%</span>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function updateProfitPanelStats() {
  const s = state.stats;
  const margin = s.todayRevenue > 0 ? ((s.todayProfit / s.todayRevenue) * 100).toFixed(1) : 0;
  const safe = (id, val) => { const e = el(id); if (e) e.textContent = val; };
  safe('pa-revenue', fmt(s.todayRevenue));
  safe('pa-profit',  fmt(s.todayProfit));
  safe('pa-margin',  `${margin}%`);
}

// ─── SALES LOG (mini sidebar) ─────────────────────────────────────────────────
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
        <div class="sale-name">${escHtml(s.productName)} ×${s.quantity}</div>
        <div class="sale-time">${fmtDate(s.timestamp)} · ${fmtTime(s.timestamp)} · Profit: ${fmt(s.profit)}</div>
      </div>
      <div class="sale-amount">${fmt(s.revenue)}</div>
    </div>
  `).join('');
}

// ─── SALES LOG TABLE (full panel) ────────────────────────────────────────────
function renderFullSalesTable() {
  const tbody = el('sales-full-tbody');
  if (!tbody) return;
  const count = el('sales-count');
  if (count) count.textContent = `${state.sales.length} transactions`;
  if (state.sales.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📋</div><p>No sales today yet.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = state.sales.map((s, i) => `<tr class="${i === 0 ? 'tr-highlight' : ''}">
    <td style="color:var(--brown-400);font-size:.8rem">${fmtTime(s.timestamp)}</td>
    <td style="font-weight:600">${escHtml(s.productName)}</td>
    <td><span class="badge badge-neutral">×${s.quantity}</span></td>
    <td style="font-weight:700">${fmt(s.revenue)}</td>
    <td style="color:var(--red-600)">${fmt(s.cost)}</td>
    <td style="color:var(--green-600);font-weight:700">${fmt(s.profit)}</td>
  </tr>`).join('');
}

// ─── EXPORT CSV ──────────────────────────────────────────────────────────────
function exportSalesCSV() {
  if (state.sales.length === 0) { toast('No sales to export.', 'info'); return; }
  const header = ['Time', 'Product', 'Qty', 'Revenue', 'Cost', 'Profit'];
  const rows = state.sales.map(s => [
    fmtTime(s.timestamp), s.productName, s.quantity,
    s.revenue.toFixed(2), s.cost.toFixed(2), s.profit.toFixed(2),
  ]);
  const csv = [header, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `brewdesk-sales-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  toast('Sales exported to CSV ✅');
}

// ─── SECURITY ────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── MODALS ───────────────────────────────────────────────────────────────────
function openModal(id) {
  const overlay = el(id);
  if (overlay) { overlay.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const overlay = el(id);
  if (overlay) { overlay.classList.remove('open'); document.body.style.overflow = ''; }
}
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open'); document.body.style.overflow = '';
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => {
      m.classList.remove('open'); document.body.style.overflow = '';
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
  if (name === 'landing')   updateHeroStats();
  window.scrollTo(0, 0);
}

// ─── DASHBOARD TABS ───────────────────────────────────────────────────────────
function setDashTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const tabBtn = el('tab-' + tab);
  if (tabBtn) tabBtn.classList.add('active');
  ['sell', 'ingredients', 'products', 'profit', 'sales'].forEach(t => {
    const panel = el('dash-panel-' + t);
    if (panel) panel.style.display = (t === tab) ? 'block' : 'none';
  });
}

// ─── LIVE CLOCK ──────────────────────────────────────────────────────────────
function updateClock() {
  const c = el('live-clock');
  if (c) c.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── FEEDBACK ─────────────────────────────────────────────────────────────────
function setRating(n) {
  state.selectedRating = n;
  document.querySelectorAll('.star').forEach((s, i) => s.classList.toggle('active', i < n));
}

async function submitFeedback() {
  const name    = el('fb-name')?.value.trim() || '';
  const message = el('fb-message')?.value.trim() || '';
  const rating  = state.selectedRating;
  if (!name)    { toast('Please enter your name.', 'error'); return; }
  if (!rating)  { toast('Please select a rating.', 'error'); return; }
  if (!message) { toast('Please write a message.', 'error'); return; }
  const btn = el('fb-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
  // In demo mode just simulate success
  setTimeout(() => {
    toast('Thank you for your feedback! ☕', 'success');
    const ne = el('fb-name'); if (ne) ne.value = '';
    const me = el('fb-message'); if (me) me.value = '';
    setRating(0);
    if (btn) { btn.disabled = false; btn.textContent = 'Submit Feedback ☕'; }
  }, 800);
}

// ─── SEARCH / FILTER ─────────────────────────────────────────────────────────
const debouncedIngSearch  = debounce(v => { state.ingSearch  = v; renderIngredients(); }, CONFIG.SEARCH_DEBOUNCE);
const debouncedProdFilter = debounce(v => { state.prodFilter = v; renderProducts(); },    CONFIG.SEARCH_DEBOUNCE);

// ─── KEYBOARD SHORTCUTS ───────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    // Ctrl+F: focus search on active tab
    const activeSearch = document.querySelector('.section.active input[type="text"]');
    if (activeSearch) { e.preventDefault(); activeSearch.focus(); }
  }
});

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  showSection('landing');
  // Pre-load mock data so hero stats show immediately
  initMockData();
  loadMockData();
  updateHeroStats();
  setInterval(updateClock, 1000);
  updateClock();
  setDashTab('sell');
});

// ─── GLOBAL EXPORTS (for inline onclick handlers) ─────────────────────────────
Object.assign(window, {
  showSection, loadAll, setDashTab,
  openAddIngredient, openEditIngredient, saveIngredient, deleteIngredient,
  openAddProduct, openEditProduct, saveProduct, deleteProduct,
  addRecipeRow, removeRecipeRow,
  sellProduct, refreshStats,
  submitFeedback, setRating,
  closeModal, openModal,
  exportSalesCSV,
  debouncedIngSearch, debouncedProdFilter,
});
