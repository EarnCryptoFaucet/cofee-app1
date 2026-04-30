const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'database.json');

function readDB() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return { ingredients: [], products: [], sales: [] };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── INGREDIENTS ────────────────────────────────────────────────────────────

router.get('/ingredients', (req, res) => {
  const db = readDB();
  res.json(db.ingredients);
});

router.post('/ingredients', (req, res) => {
  const { name, stock, unit, threshold, costPerUnit } = req.body;
  if (!name || stock === undefined || !unit || threshold === undefined || costPerUnit === undefined) {
    return res.status(400).json({ error: 'Missing required fields: name, stock, unit, threshold, costPerUnit' });
  }
  const db = readDB();
  const ingredient = {
    id: 'ing-' + uuidv4().slice(0, 8),
    name: String(name).trim(),
    stock: parseFloat(stock),
    unit: String(unit).trim(),
    threshold: parseFloat(threshold),
    costPerUnit: parseFloat(costPerUnit)
  };
  db.ingredients.push(ingredient);
  writeDB(db);
  res.status(201).json(ingredient);
});

router.put('/ingredients/:id', (req, res) => {
  const db = readDB();
  const index = db.ingredients.findIndex(i => i.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Ingredient not found' });

  const { name, stock, unit, threshold, costPerUnit } = req.body;
  const updated = { ...db.ingredients[index] };
  if (name !== undefined) updated.name = String(name).trim();
  if (stock !== undefined) updated.stock = parseFloat(stock);
  if (unit !== undefined) updated.unit = String(unit).trim();
  if (threshold !== undefined) updated.threshold = parseFloat(threshold);
  if (costPerUnit !== undefined) updated.costPerUnit = parseFloat(costPerUnit);

  db.ingredients[index] = updated;
  writeDB(db);
  res.json(updated);
});

router.delete('/ingredients/:id', (req, res) => {
  const db = readDB();
  const index = db.ingredients.findIndex(i => i.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Ingredient not found' });

  const inUse = db.products.some(p =>
    p.recipe.some(r => r.ingredientId === req.params.id)
  );
  if (inUse) {
    return res.status(409).json({ error: 'Ingredient is used in one or more products. Remove it from recipes first.' });
  }

  db.ingredients.splice(index, 1);
  writeDB(db);
  res.json({ success: true });
});

// ─── PRODUCTS ───────────────────────────────────────────────────────────────

router.get('/products', (req, res) => {
  const db = readDB();
  res.json(db.products);
});

router.post('/products', (req, res) => {
  const { name, price, recipe } = req.body;
  if (!name || price === undefined || !Array.isArray(recipe)) {
    return res.status(400).json({ error: 'Missing required fields: name, price, recipe (array)' });
  }

  const db = readDB();

  for (const r of recipe) {
    if (!r.ingredientId || r.amount === undefined) {
      return res.status(400).json({ error: 'Each recipe item must have ingredientId and amount' });
    }
    const exists = db.ingredients.find(i => i.id === r.ingredientId);
    if (!exists) {
      return res.status(400).json({ error: `Ingredient ${r.ingredientId} not found` });
    }
  }

  const product = {
    id: 'prod-' + uuidv4().slice(0, 8),
    name: String(name).trim(),
    price: parseFloat(price),
    recipe: recipe.map(r => ({ ingredientId: r.ingredientId, amount: parseFloat(r.amount) }))
  };

  db.products.push(product);
  writeDB(db);
  res.status(201).json(product);
});

router.put('/products/:id', (req, res) => {
  const db = readDB();
  const index = db.products.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Product not found' });

  const { name, price, recipe } = req.body;
  const updated = { ...db.products[index] };

  if (name !== undefined) updated.name = String(name).trim();
  if (price !== undefined) updated.price = parseFloat(price);
  if (Array.isArray(recipe)) {
    for (const r of recipe) {
      if (!r.ingredientId || r.amount === undefined) {
        return res.status(400).json({ error: 'Each recipe item must have ingredientId and amount' });
      }
      const exists = db.ingredients.find(i => i.id === r.ingredientId);
      if (!exists) {
        return res.status(400).json({ error: `Ingredient ${r.ingredientId} not found` });
      }
    }
    updated.recipe = recipe.map(r => ({ ingredientId: r.ingredientId, amount: parseFloat(r.amount) }));
  }

  db.products[index] = updated;
  writeDB(db);
  res.json(updated);
});

router.delete('/products/:id', (req, res) => {
  const db = readDB();
  const index = db.products.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Product not found' });
  db.products.splice(index, 1);
  writeDB(db);
  res.json({ success: true });
});

// ─── SELL ────────────────────────────────────────────────────────────────────

router.post('/sell', (req, res) => {
  const { productId, quantity } = req.body;
  if (!productId) return res.status(400).json({ error: 'productId is required' });

  const qty = parseInt(quantity) || 1;
  if (qty < 1) return res.status(400).json({ error: 'quantity must be at least 1' });

  const db = readDB();
  const product = db.products.find(p => p.id === productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  // Check and deduct stock
  const deductions = [];
  for (const recipeItem of product.recipe) {
    const ingredient = db.ingredients.find(i => i.id === recipeItem.ingredientId);
    if (!ingredient) {
      return res.status(400).json({ error: `Ingredient ${recipeItem.ingredientId} not found` });
    }
    const needed = recipeItem.amount * qty;
    if (ingredient.stock < needed) {
      return res.status(400).json({
        error: `Insufficient stock for "${ingredient.name}". Need ${needed}${ingredient.unit}, have ${ingredient.stock}${ingredient.unit}`
      });
    }
    deductions.push({ ingredient, needed });
  }

  // Calculate cost
  let cost = 0;
  for (const recipeItem of product.recipe) {
    const ingredient = db.ingredients.find(i => i.id === recipeItem.ingredientId);
    cost += ingredient.costPerUnit * recipeItem.amount * qty;
  }

  // Apply deductions
  for (const { ingredient, needed } of deductions) {
    const idx = db.ingredients.findIndex(i => i.id === ingredient.id);
    db.ingredients[idx].stock = parseFloat((db.ingredients[idx].stock - needed).toFixed(4));
  }

  // Record sale
  const revenue = product.price * qty;
  const profit = revenue - cost;
  const sale = {
    id: 'sale-' + uuidv4().slice(0, 8),
    productId: product.id,
    productName: product.name,
    quantity: qty,
    revenue: parseFloat(revenue.toFixed(2)),
    cost: parseFloat(cost.toFixed(2)),
    profit: parseFloat(profit.toFixed(2)),
    timestamp: new Date().toISOString()
  };

  db.sales.push(sale);
  writeDB(db);

  res.json({ success: true, sale, updatedIngredients: db.ingredients });
});

// ─── SALES HISTORY ───────────────────────────────────────────────────────────

router.get('/sales', (req, res) => {
  const db = readDB();
  res.json(db.sales);
});

router.get('/sales/today', (req, res) => {
  const db = readDB();
  const today = new Date().toISOString().slice(0, 10);
  const todaySales = db.sales.filter(s => s.timestamp.slice(0, 10) === today);
  const totalRevenue = todaySales.reduce((sum, s) => sum + s.revenue, 0);
  const totalCost = todaySales.reduce((sum, s) => sum + s.cost, 0);
  const totalProfit = todaySales.reduce((sum, s) => sum + s.profit, 0);
  res.json({
    sales: todaySales,
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalCost: parseFloat(totalCost.toFixed(2)),
    totalProfit: parseFloat(totalProfit.toFixed(2)),
    count: todaySales.length
  });
});

// ─── STATS ───────────────────────────────────────────────────────────────────

router.get('/stats', (req, res) => {
  const db = readDB();
  const today = new Date().toISOString().slice(0, 10);
  const todaySales = db.sales.filter(s => s.timestamp.slice(0, 10) === today);

  const totalRevenue = todaySales.reduce((sum, s) => sum + s.revenue, 0);
  const totalCost = todaySales.reduce((sum, s) => sum + s.cost, 0);
  const totalProfit = todaySales.reduce((sum, s) => sum + s.profit, 0);
  const lowStockCount = db.ingredients.filter(i => i.stock <= i.threshold).length;

  const productSales = {};
  for (const s of db.sales) {
    if (!productSales[s.productName]) productSales[s.productName] = 0;
    productSales[s.productName] += s.quantity;
  }
  const topProduct = Object.entries(productSales).sort((a, b) => b[1] - a[1])[0];

  res.json({
    todayRevenue: parseFloat(totalRevenue.toFixed(2)),
    todayCost: parseFloat(totalCost.toFixed(2)),
    todayProfit: parseFloat(totalProfit.toFixed(2)),
    todayTransactions: todaySales.length,
    totalIngredients: db.ingredients.length,
    totalProducts: db.products.length,
    lowStockCount,
    topProduct: topProduct ? { name: topProduct[0], qty: topProduct[1] } : null
  });
});

module.exports = router;
