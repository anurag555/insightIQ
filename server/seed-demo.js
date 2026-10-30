const fs = require('fs');
const path = require('path');

async function seedDemoWorkspace() {
  console.log('Seeding Demo Executive Workspace...');
  const baseUrl = 'http://localhost:5000/api';

  // 1. Login or register demo user
  let token = null;
  let workspaceId = null;

  try {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'executive@insightiq.internal', password: 'DemoPass2026!' })
    });
    const loginData = await loginRes.json();
    if (loginData.success) {
      token = loginData.token;
      workspaceId = loginData.workspace._id;
    }
  } catch (e) {}

  if (!token) {
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Demo Executive',
        email: 'executive@insightiq.internal',
        password: 'DemoPass2026!'
      })
    });
    const regData = await regRes.json();
    if (regData.success) {
      token = regData.token;
      workspaceId = regData.workspace._id;
    }
  }

  if (!token || !workspaceId) {
    console.error('Failed to authenticate demo user');
    return;
  }

  console.log(`Demo user authenticated. Workspace ID: ${workspaceId}`);

  // Helper fetch with auth
  async function api(endpoint, options = {}) {
    const headers = options.headers || {};
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-workspace-id'] = workspaceId;
    const res = await fetch(`${baseUrl}${endpoint}`, { ...options, headers });
    return res.json();
  }

  // Check if dataset already exists
  const existingDs = await api('/datasets');
  let datasetId = null;

  if (existingDs.success && existingDs.datasets.length > 0) {
    datasetId = existingDs.datasets[0]._id;
    console.log(`Using existing dataset: ${existingDs.datasets[0].name} (${datasetId})`);
  } else {
    // Upload retail sales transactions
    console.log('Uploading retail_sales_transactions.csv...');
    const csvPath = path.join(__dirname, '../sample-data/retail_sales_transactions.csv');
    const csvBuffer = fs.readFileSync(csvPath);
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16).slice(2);
    const bodyBuffer = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="retail_sales_transactions.csv"\r\nContent-Type: text/csv\r\n\r\n`),
      csvBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const uploadRes = await fetch(`${baseUrl}/datasets/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-workspace-id': workspaceId,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: bodyBuffer
    });
    const uploadData = await uploadRes.json();
    if (uploadData.success) {
      datasetId = uploadData.dataset._id;
      console.log(`Dataset uploaded: ${uploadData.dataset.name} (${datasetId})`);
    }
  }

  // Store in PostgreSQL
  if (datasetId) {
    console.log('Ensuring dataset is provisioned in PostgreSQL...');
    const storeRes = await api(`/datasets/${datasetId}/store`, { method: 'POST' });
    console.log('Store status:', storeRes.message || storeRes.error || 'OK');
  }

  // Check documents
  const existingDocs = await api('/documents');
  if (!existingDocs.documents || existingDocs.documents.length === 0) {
    console.log('Uploading sample business document Q3_Strategic_Business_Review.pdf...');
    const pdfPath = path.join(__dirname, '../sample-docs/Q3_Strategic_Business_Review.pdf');
    if (fs.existsSync(pdfPath)) {
      const pdfBuffer = fs.readFileSync(pdfPath);
      const pdfBoundary = '----WebKitFormBoundary' + Math.random().toString(16).slice(2);
      const pdfBody = Buffer.concat([
        Buffer.from(`--${pdfBoundary}\r\nContent-Disposition: form-data; name="file"; filename="Q3_Strategic_Business_Review.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
        pdfBuffer,
        Buffer.from(`\r\n--${pdfBoundary}--\r\n`)
      ]);

      const docRes = await fetch(`${baseUrl}/documents/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-workspace-id': workspaceId,
          'Content-Type': `multipart/form-data; boundary=${pdfBoundary}`
        },
        body: pdfBody
      });
      const docData = await docRes.json();
      console.log('Document upload status:', docData.message || docData.error || 'OK');
    }
  }

  console.log('✅ Demo Executive Workspace successfully primed with live PostgreSQL data!');
}

seedDemoWorkspace().catch(err => console.error('Seed error:', err));
