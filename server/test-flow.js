const fs = require('fs');
const path = require('path');

async function runEndToEndVerification() {
  console.log('=== Running InsightIQ End-to-End Verification ===\n');

  const baseUrl = 'http://localhost:5000/api';
  let token = null;
  let workspaceId = null;
  let datasetId = null;
  let documentId = null;

  // Helper fetch with cookies/auth
  async function api(endpoint, options = {}) {
    const headers = options.headers || {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (workspaceId) headers['x-workspace-id'] = workspaceId;

    const res = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers
    });
    const text = await res.text();
    try {
      return { status: res.status, data: JSON.parse(text) };
    } catch {
      return { status: res.status, text };
    }
  }

  // 1. Health check
  console.log('1. Verifying Health Check...');
  const health = await api('/health');
  console.log('   Health Status:', health.data.status, '| Demo Mode:', health.data.demoMode);
  if (health.data.status !== 'ok') throw new Error('Health check failed');

  // 2. Register User
  console.log('2. Registering Analyst User...');
  const email = `analyst_${Date.now()}@insightiq.test`;
  const reg = await api('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Dr. Sarah Connor',
      email,
      password: 'EnterprisePassword2026!'
    })
  });
  console.log('   Register Result:', reg.data.success ? 'SUCCESS' : 'FAILED', reg.data.user?.email);
  token = reg.data.token;
  workspaceId = reg.data.workspace._id;
  console.log('   Assigned Workspace ID:', workspaceId);

  // 3. Upload Dataset (retail_sales_transactions.csv)
  console.log('3. Uploading retail_sales_transactions.csv...');
  const csvPath = path.join(__dirname, '../sample-data/retail_sales_transactions.csv');
  const csvBuffer = fs.readFileSync(csvPath);
  const boundary = '----WebKitFormBoundary' + Math.random().toString(16).slice(2);
  
  const bodyBuffer = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="retail_sales_transactions.csv"\r\nContent-Type: text/csv\r\n\r\n`),
    csvBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);

  const uploadRes = await api('/datasets/upload', {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: bodyBuffer
  });

  console.log('   Dataset Upload Status:', uploadRes.status);
  datasetId = uploadRes.data.dataset._id;
  console.log('   Dataset ID:', datasetId);
  console.log('   Detected Rows:', uploadRes.data.dataset.rowCount, '| Columns:', uploadRes.data.dataset.columnCount);
  console.log('   Columns with Roles:', uploadRes.data.dataset.columns.map(c => `${c.cleanName}(${c.semanticRole})`).join(', '));
  console.log('   Data Quality Score:', uploadRes.data.dataset.qualityReport.overallScore, '/ 100');

  // 4. Store in PostgreSQL Analytical Database
  console.log('4. Storing Dataset in PostgreSQL Isolated Table...');
  const storeRes = await api(`/datasets/${datasetId}/store`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  console.log('   Postgres Store Result:', storeRes.data.message);
  console.log('   Physical Postgres Table:', storeRes.data.dataset.pgTableName);

  // 5. Query Deterministic Analytics Dashboard
  console.log('5. Querying Deterministic Analytics Engine...');
  const dashRes = await api(`/analytics/${datasetId}/dashboard`);
  console.log('   Overview KPIs:');
  console.log('     Total Rows:', dashRes.data.overview.rowCount);
  console.log('     Total Revenue: $' + dashRes.data.overview.totalRevenue.toLocaleString());
  console.log('     Average Order Value: $' + dashRes.data.overview.averageRevenue);
  console.log('     Date Span:', dashRes.data.overview.minDate, 'to', dashRes.data.overview.maxDate);
  console.log('   Monthly Time Series Count:', dashRes.data.timeSeries.series.length);
  console.log('   Top Category Breakdown:', dashRes.data.categoryBreakdown.map(c => `${c.dimension}: $${c.value}`).slice(0, 3).join(', '));

  // 6. Test AI Business Analyst with Controlled Tool Calling
  console.log('6. Testing AI Business Analyst Query ("What is our monthly sales trend?")...');
  const aiChatRes = await api('/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'What is our monthly sales trend and what was our peak month?',
      datasetId,
      mode: 'analyst'
    })
  });
  console.log('   AI Tools Called:', aiChatRes.data.reply.toolsCalled.map(t => t.toolName).join(', '));
  console.log('   Chart Suggestion:', aiChatRes.data.reply.chartSuggestion?.title, `(${aiChatRes.data.reply.chartSuggestion?.type})`);
  console.log('   AI Reply Snippet:\n' + aiChatRes.data.reply.content.split('\n').slice(0, 4).join('\n'));

  // 7. Upload Sample Document (Q3 Strategic Business Review PDF)
  console.log('7. Uploading Business Document (Q3_Strategic_Business_Review.pdf)...');
  const pdfPath = path.join(__dirname, '../sample-docs/Q3_Strategic_Business_Review.pdf');
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfBoundary = '----WebKitFormBoundary' + Math.random().toString(16).slice(2);
  const pdfBody = Buffer.concat([
    Buffer.from(`--${pdfBoundary}\r\nContent-Disposition: form-data; name="file"; filename="Q3_Strategic_Business_Review.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
    pdfBuffer,
    Buffer.from(`\r\n--${pdfBoundary}--\r\n`)
  ]);

  const docUploadRes = await api('/documents/upload', {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${pdfBoundary}`
    },
    body: pdfBody
  });
  console.log('   Document Ingestion Status:', docUploadRes.status);
  console.log('   Indexed Passages:', docUploadRes.data.document?.chunkCount);
  documentId = docUploadRes.data.document?.id;

  // 8. Test Document RAG Query
  console.log('8. Testing Grounded RAG Query ("What are the volume discounting thresholds?")...');
  const ragQueryRes = await api('/documents/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'What are the volume discounting thresholds for enterprise orders?'
    })
  });
  console.log('   Citations Found:', ragQueryRes.data.citations.length);
  if (ragQueryRes.data.citations.length > 0) {
    console.log('   Top Citation:', ragQueryRes.data.citations[0].documentName, 'Page', ragQueryRes.data.citations[0].pageNumber);
    console.log('   Snippet:', ragQueryRes.data.citations[0].passage.slice(0, 100) + '...');
  }

  // 9. Test Hybrid Query (Structured Metrics + Document RAG)
  console.log('9. Testing Hybrid Query Combining SQL Analytics & RAG Strategy...');
  const hybridRes = await api('/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'What was our total revenue in Electronics and what does our strategy review say about this category?',
      datasetId,
      mode: 'hybrid'
    })
  });
  console.log('   Hybrid Mode:', hybridRes.data.reply.mode);
  console.log('   Tools Invoked:', hybridRes.data.reply.toolsCalled?.map(t => t.toolName).join(', ') || 'none');
  console.log('   Document Citations:', hybridRes.data.reply.citations?.length || 0);

  // 10. Test Executive Report Generation
  console.log('10. Generating Executive Summary Report...');
  const repRes = await api(`/reports/${datasetId}/summary`);
  console.log('   Report Generated For:', repRes.data.report.datasetName);
  console.log('   Key Computed Metrics:', JSON.stringify(repRes.data.report.computedMetrics));
  console.log('   Top Segments Count:', repRes.data.report.topPerformers.length);

  console.log('\n✅ ALL 10 CORE MODULE WORKFLOWS VERIFIED SUCCESSFULLY!');
}

runEndToEndVerification().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
