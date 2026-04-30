const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===============================
// 🔥 FIX: مسیر درست frontend
// ===============================
const frontendPath = path.join(__dirname, 'frontend');

// اگر frontend وجود داشت سرو کن
app.use(express.static(frontendPath));

// ===============================
// API routes
// ===============================
app.use('/api', routes);

// ===============================
// SPA fallback (React / HTML)
// ===============================
app.get('*', (req, res) => {
  const indexPath = path.join(frontendPath, 'index.html');

  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).send('Frontend not found (index.html missing)');
    }
  });
});

// ===============================
app.listen(PORT, () => {
  console.log(`☕ Coffee Shop Server running on port ${PORT}`);
});
