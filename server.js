const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 8080;

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'insight_reports.db');
const db = new sqlite3.Database(dbPath);

app.use(express.json({ limit: '2mb' }));
app.use(express.static(__dirname));

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDb() {
  await run(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_number TEXT,
      service_date TEXT,
      status TEXT,
      device_type TEXT,
      brand_model TEXT,
      company_name TEXT,
      company_address TEXT,
      technician_name TEXT,
      technician_phone TEXT,
      city TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      customer_address TEXT,
      complaint TEXT,
      work_performed TEXT,
      diagnosis TEXT,
      recommendations TEXT,
      warranty TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT,
      bill_date TEXT,
      payment_status TEXT,
      business_name TEXT,
      owner_name TEXT,
      business_phone TEXT,
      business_address TEXT,
      gstin TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      customer_address TEXT,
      subtotal REAL,
      gst_rate REAL,
      gst_amount REAL,
      grand_total REAL,
      notes TEXT,
      items_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'insight-reports-api' });
});

app.get('/api/reports', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 10));
    const rows = await all(
      `SELECT * FROM reports ORDER BY id DESC LIMIT ?`,
      [limit]
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reports.' });
  }
});

app.post('/api/reports', async (req, res) => {
  const b = req.body || {};
  if (!b.companyName || !b.customerName || !b.deviceType) {
    return res.status(400).json({ error: 'companyName, customerName, and deviceType are required.' });
  }

  try {
    const result = await run(
      `INSERT INTO reports (
        report_number, service_date, status, device_type, brand_model,
        company_name, company_address, technician_name, technician_phone, city,
        customer_name, customer_phone, customer_address, complaint, work_performed,
        diagnosis, recommendations, warranty
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.reportNumber || null,
        b.serviceDate || null,
        b.status || null,
        b.deviceType || null,
        b.brandModel || null,
        b.companyName || null,
        b.companyAddress || null,
        b.technicianName || null,
        b.technicianPhone || null,
        b.city || null,
        b.customerName || null,
        b.customerPhone || null,
        b.customerAddress || null,
        b.complaint || null,
        b.workPerformed || null,
        b.diagnosis || null,
        b.recommendations || null,
        b.warranty || null
      ]
    );
    res.status(201).json({ id: result.id, message: 'Report saved.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save report.' });
  }
});

app.get('/api/invoices', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 10));
    const rows = await all(
      `SELECT * FROM invoices ORDER BY id DESC LIMIT ?`,
      [limit]
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoices.' });
  }
});

app.post('/api/invoices', async (req, res) => {
  const b = req.body || {};
  if (!b.businessName || !b.customerName) {
    return res.status(400).json({ error: 'businessName and customerName are required.' });
  }

  try {
    const result = await run(
      `INSERT INTO invoices (
        invoice_number, bill_date, payment_status, business_name, owner_name,
        business_phone, business_address, gstin, customer_name, customer_phone,
        customer_address, subtotal, gst_rate, gst_amount, grand_total,
        notes, items_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.invoiceNumber || null,
        b.billDate || null,
        b.paymentStatus || null,
        b.businessName || null,
        b.ownerName || null,
        b.businessPhone || null,
        b.businessAddress || null,
        b.gstin || null,
        b.customerName || null,
        b.customerPhone || null,
        b.customerAddress || null,
        Number(b.subtotal || 0),
        Number(b.gstRate || 0),
        Number(b.gstAmount || 0),
        Number(b.grandTotal || 0),
        b.notes || null,
        JSON.stringify(b.items || [])
      ]
    );
    res.status(201).json({ id: result.id, message: 'Invoice saved.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save invoice.' });
  }
});

app.get('/api/dashboard', async (_req, res) => {
  try {
    const reportCount = await all('SELECT COUNT(*) AS count FROM reports');
    const invoiceCount = await all('SELECT COUNT(*) AS count FROM invoices');
    res.json({
      reports: reportCount[0].count,
      invoices: invoiceCount[0].count
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load dashboard stats.' });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Insight Reports backend running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database', err);
    process.exit(1);
  });
