# ☕ BrewDesk — Coffee Shop Inventory & Sales Management

A production-ready MVP for managing your coffee shop's inventory, recipes, sales, and profits.

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start

# Dev mode (auto-reload)
npm run dev
```

Then open `http://localhost:3000` in your browser.

---

## 📁 Project Structure

```
coffee-shop-inventory/
├── backend/
│   ├── server.js        # Express server entry point
│   ├── routes.js        # All API routes + business logic
│   └── database.json    # JSON file database (auto-seeded)
├── frontend/
│   ├── index.html       # Single-page application
│   ├── style.css        # Modern coffee-themed styles
│   └── app.js           # Vanilla JS frontend logic
├── package.json
└── README.md
```

---

## 🎯 Features

### Landing Page
- Hero section with CTA
- Feature showcase
- How-it-works steps
- Feedback form (Supabase)

### Dashboard
- **Stats Cards**: Revenue, Profit, Cost, Transactions, Low-Stock count
- **Quick Sell Panel**: Cards per product with quantity input + Sell button
- **Ingredients Table**: Search, stock bar, status badges, edit/delete
- **Products Table**: Cost/profit/margin per product, recipe tags
- **Profit Analysis**: Ranked product profitability with margin bars
- **Sales Log**: Today's transactions with timestamps

### Inventory Management
- Add/Edit/Delete ingredients
- name, stock, unit, threshold, cost per unit
- Visual stock bars (green/yellow/red)
- Low-stock alerts (red row highlight)

### Product Management
- Add/Edit/Delete products
- Dynamic recipe builder
- Auto-calculated cost & profit margin

### Sales System
- Quick sell with quantity selector
- Auto stock deduction on sale
- Prevents sale if stock is insufficient
- Real-time daily totals

### Profit System
- Cost calculated from recipe × ingredient cost
- Gross profit = Price − Cost
- Profit margin % with visual bar
- Product leaderboard (most profitable first)

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/ingredients | List all ingredients |
| POST | /api/ingredients | Add ingredient |
| PUT | /api/ingredients/:id | Update ingredient |
| DELETE | /api/ingredients/:id | Delete ingredient |
| GET | /api/products | List all products |
| POST | /api/products | Add product |
| PUT | /api/products/:id | Update product |
| DELETE | /api/products/:id | Delete product |
| POST | /api/sell | Process a sale |
| GET | /api/sales | All sales history |
| GET | /api/sales/today | Today's sales + totals |
| GET | /api/stats | Dashboard stats |

---

## ☁️ Deploy on Railway

1. Push to GitHub
2. Connect repo on [railway.app](https://railway.app)
3. Set start command: `npm start`
4. Railway auto-detects Node.js and sets `PORT`
5. That's it — no env vars needed for basic functionality

---

## 💬 Feedback System

Uses Supabase REST API to save feedback:
- **URL**: `https://gvtdvnqvxordraztxkwx.supabase.co`
- **Table**: `feedback`
- **Fields**: `name`, `rating`, `message`

---

## 🧱 Tech Stack

- **Backend**: Node.js + Express
- **Database**: JSON file (no setup required)
- **Frontend**: HTML + CSS + Vanilla JS
- **External**: Supabase (feedback only)

---

## 🔒 Notes

- The `database.json` file persists between restarts
- On Railway, the file system is ephemeral — for production use, replace JSON storage with a real database (PostgreSQL via Railway addon)
- Pre-seeded with 5 ingredients and 5 sample coffee products
