const fs = require('fs');
const path = require('path');

const sampleDir = path.join(__dirname);

// 1. Retail Sales Transactions CSV (1200 rows with realistic distributions)
const categories = {
  'Electronics': ['Pro Laptop 15', 'Wireless Noise-Canceling Headphones', 'Smart 4K Monitor 27"', 'Ergonomic Mechanical Keyboard', 'Ultra-fast NVMe SSD 1TB', 'USB-C Docking Station'],
  'Furniture': ['Ergonomic Mesh Chair', 'Electric Standing Desk', 'Under-Desk Footrest', 'Monitor Arm Mount', 'Acoustic Desk Privacy Panel'],
  'Office Supplies': ['Recycled Printing Paper 500ct', 'Gel Pen Pack (12)', 'Heavy Duty Stapler', 'Dry Erase Whiteboard 36x24', 'Filing Cabinet Organizer'],
  'Software & Cloud': ['Team Collaboration Pro Annual', 'Cloud Backup 2TB Plan', 'Developer IDE Enterprise License', 'Cybersecurity Suite Shield'],
  'Accessories': ['Braided USB-C Cable 2m', 'Laptop Sleeve Water-Resistant', 'Wireless Mouse Rechargeable', 'Desk Pad Leather Mat']
};

const regions = ['North America', 'EMEA', 'Asia Pacific', 'Latin America'];
const paymentMethods = ['Credit Card', 'Bank Wire', 'ACH Transfer', 'Corporate PayPal'];

function randomDate(start, end) {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString().split('T')[0];
}

const transactions = [];
const startDate = new Date('2024-01-01');
const endDate = new Date('2024-12-31');

for (let i = 1; i <= 1200; i++) {
  const catKeys = Object.keys(categories);
  const category = catKeys[Math.floor(Math.random() * catKeys.length)];
  const prodList = categories[category];
  const product = prodList[Math.floor(Math.random() * prodList.length)];
  
  let basePrice = 25;
  if (category === 'Electronics') basePrice = 180 + Math.floor(Math.random() * 850);
  else if (category === 'Furniture') basePrice = 120 + Math.floor(Math.random() * 450);
  else if (category === 'Software & Cloud') basePrice = 99 + Math.floor(Math.random() * 300);
  else if (category === 'Office Supplies') basePrice = 15 + Math.floor(Math.random() * 50);
  else basePrice = 19 + Math.floor(Math.random() * 45);

  const quantity = Math.floor(Math.random() * 6) + 1;
  const discountRate = Math.random() < 0.35 ? (Math.random() * 0.2).toFixed(2) : '0.00';
  const unitPrice = basePrice;
  const gross = unitPrice * quantity;
  const discountAmount = parseFloat((gross * parseFloat(discountRate)).toFixed(2));
  const totalRevenue = parseFloat((gross - discountAmount).toFixed(2));
  const customerId = `CUST-${1000 + (Math.floor(Math.random() * 250))}`;
  const region = regions[Math.floor(Math.random() * regions.length)];
  const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
  const date = randomDate(startDate, endDate);

  transactions.push({
    transaction_id: `TXN-${100000 + i}`,
    date,
    customer_id: customerId,
    product,
    category,
    unit_price: unitPrice,
    quantity,
    discount_rate: discountRate,
    discount_amount: discountAmount,
    total_revenue: totalRevenue,
    payment_method: paymentMethod,
    region
  });
}

function escapeCsvField(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// Convert to CSV
const csvHeaders = Object.keys(transactions[0]).join(',');
const csvRows = transactions.map(t => Object.values(t).map(escapeCsvField).join(','));
fs.writeFileSync(path.join(sampleDir, 'retail_sales_transactions.csv'), [csvHeaders, ...csvRows].join('\n'));
console.log('Created retail_sales_transactions.csv (1200 rows)');

// 2. Customer Segments CSV
const customerMap = new Map();
transactions.forEach(t => {
  if (!customerMap.has(t.customer_id)) {
    customerMap.set(t.customer_id, {
      customer_id: t.customer_id,
      name: `Enterprise Client ${t.customer_id.replace('CUST-', '')}`,
      segment: Math.random() < 0.25 ? 'Enterprise' : (Math.random() < 0.5 ? 'Mid-Market' : 'SMB'),
      region: t.region,
      primary_contact: `contact_${t.customer_id.toLowerCase()}@clientorg.com`,
      credit_rating: Math.random() < 0.7 ? 'Tier 1' : 'Tier 2'
    });
  }
});
const custArr = Array.from(customerMap.values());
const custHeaders = Object.keys(custArr[0]).join(',');
const custRows = custArr.map(c => Object.values(c).join(','));
fs.writeFileSync(path.join(sampleDir, 'customer_segments.csv'), [custHeaders, ...custRows].join('\n'));
console.log(`Created customer_segments.csv (${custArr.length} rows)`);

// 3. Product Catalog CSV
const allProducts = [];
let pId = 1;
for (const [cat, prods] of Object.entries(categories)) {
  for (const p of prods) {
    allProducts.push({
      product_sku: `SKU-${100 + pId++}`,
      product_name: p,
      category: cat,
      standard_cost: Math.floor(Math.random() * 80) + 15,
      target_margin: '0.42',
      status: 'Active'
    });
  }
}
const prodHeaders = Object.keys(allProducts[0]).join(',');
const prodRows = allProducts.map(p => Object.values(p).join(','));
fs.writeFileSync(path.join(sampleDir, 'product_catalog.csv'), [prodHeaders, ...prodRows].join('\n'));
console.log(`Created product_catalog.csv (${allProducts.length} products)`);

// 4. Inventory Levels CSV
const inventory = allProducts.map(p => ({
  sku: p.product_sku,
  product_name: p.product_name,
  warehouse_location: ['Warehouse Alpha (US-East)', 'Warehouse Beta (US-West)', 'Hub Central (EU)'][Math.floor(Math.random() * 3)],
  units_in_stock: Math.floor(Math.random() * 450) + 20,
  reorder_point: 50,
  lead_time_days: Math.floor(Math.random() * 14) + 3
}));
const invHeaders = Object.keys(inventory[0]).join(',');
const invRows = inventory.map(i => Object.values(i).join(','));
fs.writeFileSync(path.join(sampleDir, 'inventory_levels.csv'), [invHeaders, ...invRows].join('\n'));
console.log(`Created inventory_levels.csv (${inventory.length} items)`);

// 5. SaaS Service Metrics CSV
const saasMetrics = [];
const saasPlans = ['Starter', 'Professional', 'Enterprise', 'Scale'];
for (let i = 1; i <= 300; i++) {
  const plan = saasPlans[Math.floor(Math.random() * saasPlans.length)];
  let mrr = 49;
  if (plan === 'Professional') mrr = 199;
  else if (plan === 'Enterprise') mrr = 799;
  else if (plan === 'Scale') mrr = 2499;

  saasMetrics.push({
    account_id: `ACC-${2000 + i}`,
    date: randomDate(new Date('2024-06-01'), new Date('2024-12-31')),
    plan,
    mrr_usd: mrr,
    active_users: Math.floor(Math.random() * 120) + 5,
    support_tickets: Math.floor(Math.random() * 8),
    churn_risk_score: (Math.random() * 0.4).toFixed(2),
    retention_status: Math.random() < 0.92 ? 'Retained' : 'At-Risk'
  });
}
const saasHeaders = Object.keys(saasMetrics[0]).join(',');
const saasRows = saasMetrics.map(s => Object.values(s).join(','));
fs.writeFileSync(path.join(sampleDir, 'saas_service_metrics.csv'), [saasHeaders, ...saasRows].join('\n'));
console.log(`Created saas_service_metrics.csv (300 rows)`);
