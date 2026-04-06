// ─── ANTHROPIC API CONFIG ───
// Replace with your actual API key
const ANTHROPIC_API_KEY = "sk-ant-v3-YOUR_API_KEY_HERE";
const BRAND_LOGO_STORAGE_KEY = 'fieldproCompanyLogo';
let companyLogoDataUrl = '';
const API_BASE = '/api';

// ─── TAB SWITCH ───
function switchTab(t) {
  closeMobileNav();
  document.querySelectorAll('.page-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.page-tab').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('panel-' + t).classList.add('active');
  document.getElementById('tab-' + t).classList.add('active');
  const mobileBtn = document.getElementById('mtab-' + t);
  if (mobileBtn) mobileBtn.classList.add('active');
  window.scrollTo({top:0, behavior:'smooth'});
}

function toggleMobileNav() {
  document.body.classList.toggle('mobile-nav-open');
}

function closeMobileNav() {
  document.body.classList.remove('mobile-nav-open');
}

function updateLogoTargets(src) {
  const hasLogo = Boolean(src);
  ['contact-logo', 'footer-logo', 'csr-logo', 'bo-logo'].forEach(id => {
    const img = document.getElementById(id);
    if (!img) return;
    if (hasLogo) {
      img.src = src;
      img.style.display = 'inline-block';
      img.hidden = false;
    } else {
      img.removeAttribute('src');
      img.style.display = 'none';
      img.hidden = true;
    }
  });
}

function persistCompanyLogo(dataUrl) {
  companyLogoDataUrl = dataUrl || '';
  if (companyLogoDataUrl) {
    localStorage.setItem(BRAND_LOGO_STORAGE_KEY, companyLogoDataUrl);
  } else {
    localStorage.removeItem(BRAND_LOGO_STORAGE_KEY);
  }
  updateLogoTargets(companyLogoDataUrl);
}

function handleLogoUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('Please upload an image file.');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => persistCompanyLogo(reader.result || '');
  reader.readAsDataURL(file);
}

function clearLogo() {
  persistCompanyLogo('');
  const input = document.getElementById('company-logo-input');
  if (input) input.value = '';
}

function getLogoFormat(dataUrl) {
  if (!dataUrl) return 'PNG';
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG';
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  return 'PNG';
}

function safeAddLogoToPdf(doc, x, y, w, h) {
  if (!companyLogoDataUrl) return;
  try {
    if (!/^data:image\/(png|jpeg|jpg);base64,/i.test(companyLogoDataUrl)) return;
    doc.addImage(companyLogoDataUrl, getLogoFormat(companyLogoDataUrl), x, y, w, h);
  } catch (_err) {
    // Ignore logo rendering failures so PDF download still works.
  }
}

function getPreferredCompanyName() {
  return (
    document.getElementById('r-company')?.value.trim() ||
    document.getElementById('b-bname')?.value.trim() ||
    'Insight Reports Co.'
  );
}

function getPreferredCompanyAddress() {
  return (
    document.getElementById('r-companyaddr')?.value.trim() ||
    document.getElementById('b-baddr')?.value.trim() ||
    'Kolkata, West Bengal'
  );
}

function getPreferredCompanyPhone() {
  return (
    document.getElementById('r-phone')?.value.trim() ||
    document.getElementById('b-bphone')?.value.trim() ||
    'Add your phone number in Service Report or Billing section.'
  );
}

function refreshBrandingContact() {
  const company = getPreferredCompanyName();
  const address = getPreferredCompanyAddress();
  const phone = getPreferredCompanyPhone();

  const footerCompany = document.getElementById('footer-company');
  const footerAddress = document.getElementById('footer-address');
  const contactCompany = document.getElementById('contact-company');
  const contactAddress = document.getElementById('contact-address');
  const contactPhone = document.getElementById('contact-phone');

  if (footerCompany) footerCompany.textContent = company;
  if (footerAddress) footerAddress.textContent = address;
  if (contactCompany) contactCompany.textContent = company;
  if (contactAddress) contactAddress.textContent = address;
  if (contactPhone) contactPhone.textContent = phone;
  updateLogoTargets(companyLogoDataUrl);
}

function setBackendStatus(text, isOnline) {
  const el = document.getElementById('backend-status');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('offline', !isOnline);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateShort(iso) {
  if (!iso) return 'Date N/A';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Date N/A';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getCompanyCode(companyName) {
  const parts = String(companyName || '')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return 'FP';

  const initials = parts
    .slice(0, 4)
    .map(part => part[0])
    .join('')
    .toUpperCase();

  return initials.slice(0, 4) || 'FP';
}

function buildReportNumber(companyName) {
  const year = new Date().getFullYear();
  const code = getCompanyCode(companyName);
  const suffix = String(Math.floor(Math.random() * 9000) + 1000);
  return `SR-${code}-${year}-${suffix}`;
}

async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body && body.error) msg = body.error;
    } catch (_err) {
      // Ignore parse errors, fallback to generic message.
    }
    throw new Error(msg);
  }
  return res.json();
}

async function saveReportToBackend(d) {
  const reportNumber = document.getElementById('csr-rptnum')?.textContent?.trim() || '';
  const payload = {
    reportNumber,
    serviceDate: d.date || null,
    status: d.status || '',
    deviceType: d.dev || '',
    brandModel: d.brand || '',
    companyName: d.co || '',
    companyAddress: d.companyAddr || '',
    technicianName: d.tech || '',
    technicianPhone: d.phone || '',
    city: d.city || '',
    customerName: d.cn || '',
    customerPhone: d.cphone || '',
    customerAddress: d.caddr || '',
    complaint: d.complaint || '',
    workPerformed: d.workPerformed || d.work || '',
    diagnosis: d.diagnosis || '',
    recommendations: d.recommendations || '',
    warranty: d.warranty || ''
  };
  return apiRequest('/reports', { method: 'POST', body: JSON.stringify(payload) });
}

async function saveInvoiceToBackend(d) {
  const invoiceNumber = document.getElementById('bo-invnum')?.textContent?.replace('#', '').trim() || '';
  const payload = {
    invoiceNumber,
    billDate: d.date || null,
    paymentStatus: d.pay || '',
    businessName: d.bname || '',
    ownerName: d.owner || '',
    businessPhone: d.bphone || '',
    businessAddress: d.baddr || '',
    gstin: d.gstin || '',
    customerName: d.cname || '',
    customerPhone: d.cphone || '',
    customerAddress: d.caddr || '',
    subtotal: d.sub || 0,
    gstRate: d.gstR || 0,
    gstAmount: d.gstA || 0,
    grandTotal: d.grand || 0,
    notes: d.notes || '',
    items: d.rows || []
  };
  return apiRequest('/invoices', { method: 'POST', body: JSON.stringify(payload) });
}

async function loadRecentActivity() {
  const reportList = document.getElementById('recent-reports');
  const invoiceList = document.getElementById('recent-invoices');
  if (!reportList || !invoiceList) return;

  reportList.innerHTML = '<div class="service-mini-card">Loading...</div>';
  invoiceList.innerHTML = '<div class="service-mini-card">Loading...</div>';

  const reportCard = (r) => {
    const serviceDate = formatDateShort(r.service_date || r.created_at);
    const status = r.status || 'Completed';
    const statusClass = String(status).toLowerCase().includes('pending') ? 'warn' : String(status).toLowerCase().includes('warranty') ? 'info' : 'ok';
    return `
      <article class="service-mini-card">
        <div class="service-mini-top">
          <span class="service-mini-badge">Report</span>
          <span class="service-mini-status ${statusClass}">${escapeHtml(status)}</span>
        </div>
        <h4>${escapeHtml(r.report_number || 'Report')}</h4>
        <p class="service-mini-name">${escapeHtml(r.customer_name || 'Unknown Customer')}</p>
        <div class="service-mini-meta">
          <span>${escapeHtml(r.device_type || 'Service')}</span>
          <span>${escapeHtml(serviceDate)}</span>
        </div>
      </article>`;
  };

  const invoiceCard = (i) => {
    const billDate = formatDateShort(i.bill_date || i.created_at);
    const amount = Number(i.grand_total || 0).toLocaleString('en-IN');
    const payment = i.payment_status || 'Paid';
    return `
      <article class="service-mini-card">
        <div class="service-mini-top">
          <span class="service-mini-badge alt">Invoice</span>
          <span class="service-mini-status ok">${escapeHtml(payment)}</span>
        </div>
        <h4>${escapeHtml(i.invoice_number || 'Invoice')}</h4>
        <p class="service-mini-name">${escapeHtml(i.customer_name || 'Unknown Customer')}</p>
        <div class="service-mini-meta">
          <span>₹${escapeHtml(amount)}</span>
          <span>${escapeHtml(billDate)}</span>
        </div>
      </article>`;
  };

  try {
    const [reportsRes, invoicesRes] = await Promise.all([
      apiRequest('/reports?limit=5'),
      apiRequest('/invoices?limit=5')
    ]);

    const reports = reportsRes.data || [];
    const invoices = invoicesRes.data || [];

    reportList.innerHTML = reports.length
      ? reports
          .map(reportCard)
          .join('')
      : '<div class="service-mini-card empty">No reports saved yet.</div>';

    invoiceList.innerHTML = invoices.length
      ? invoices
          .map(invoiceCard)
          .join('')
      : '<div class="service-mini-card empty">No invoices saved yet.</div>';
  } catch (_err) {
    reportList.innerHTML = '<div class="service-mini-card empty">Backend unavailable</div>';
    invoiceList.innerHTML = '<div class="service-mini-card empty">Backend unavailable</div>';
  }
}

async function initializeBackendConnection() {
  try {
    await apiRequest('/health');
    setBackendStatus('Backend: connected', true);
    await loadRecentActivity();
  } catch (_err) {
    setBackendStatus('Backend: offline (start Node server)', false);
  }
}

// ─── DEFAULTS ───
const savedLogo = localStorage.getItem(BRAND_LOGO_STORAGE_KEY) || '';
if (savedLogo) persistCompanyLogo(savedLogo);

const logoInput = document.getElementById('company-logo-input');
if (logoInput) logoInput.addEventListener('change', handleLogoUpload);

refreshBrandingContact();
initializeBackendConnection();

['r-company', 'b-bname', 'r-companyaddr', 'b-baddr', 'r-phone', 'b-bphone'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', refreshBrandingContact);
});


// ─── AUTO-GENERATE FUNCTIONS ───
function autoGenReportNum() {
  const companyName = document.getElementById('r-company')?.value.trim() || getPreferredCompanyName();
  const reportNumberInput = document.getElementById('r-rptnum');
  if (reportNumberInput) reportNumberInput.value = buildReportNumber(companyName);
}

function autoGenInvNum() {
  const year = new Date().getFullYear();
  const num = String(Math.floor(Math.random() * 9000) + 1000);
  document.getElementById('b-custominvnum').value = `INV-${year}-${num}`;
}

// ─── THEME APPLICATION ───
function applyReportTheme() {
  const theme = document.getElementById('r-theme').value || 'corporate';
  const preview = document.getElementById('rpt-preview');
  preview.classList.remove('theme-corporate', 'theme-warm', 'theme-dark', 'theme-teal');
  preview.classList.add('theme-' + theme);
}

function applyBillTheme() {
  const theme = document.getElementById('b-theme').value || 'corporate';
  const preview = document.getElementById('bill-preview');
  preview.classList.remove('theme-corporate', 'theme-warm', 'theme-dark', 'theme-teal');
  preview.classList.add('theme-' + theme);
}

// ─── BILL TABLE ───
function addBillRow() {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" placeholder="Item name"/></td>
    <td><input type="number" min="1" placeholder="1" oninput="calcBill()"/></td>
    <td><input type="number" placeholder="0" oninput="calcBill()"/></td>
    <td class="bill-amt" style="font-weight:600">₹0</td>
    <td><button class="del-btn" onclick="delBillRow(this)">✕</button></td>`;
  document.getElementById('bill-body').appendChild(tr);
}
function delBillRow(btn) { btn.closest('tr').remove(); calcBill(); }
function calcBill() {
  let sub = 0;
  document.querySelectorAll('#bill-body tr').forEach(r => {
    const qty = parseFloat(r.cells[1].querySelector('input').value)||0;
    const rate = parseFloat(r.cells[2].querySelector('input').value)||0;
    const a = qty*rate; sub += a;
    r.querySelector('.bill-amt').textContent = '₹'+a.toLocaleString('en-IN');
  });
  const gr = parseFloat(document.getElementById('b-gst').value)||0;
  const ga = sub*gr/100;
  document.getElementById('b-sub').textContent = '₹'+sub.toLocaleString('en-IN');
  document.getElementById('b-gstamt').textContent = '₹'+ga.toLocaleString('en-IN');
  document.getElementById('b-grand').textContent = '₹'+(sub+ga).toLocaleString('en-IN');
}

// ─── GENERATE BILL ───
let billData = {};
async function generateBill() {
  const bname = document.getElementById('b-bname').value.trim();
  const cname = document.getElementById('b-cname').value.trim();
  const msgEl = document.getElementById('bill-msg');
  msgEl.className = 'msg';
  if (!bname) { msgEl.className='msg err'; msgEl.textContent='⚠️ Enter business name.'; return; }
  if (!cname) { msgEl.className='msg err'; msgEl.textContent='⚠️ Enter customer name.'; return; }

  const rows = [];
  document.querySelectorAll('#bill-body tr').forEach(r => {
    const n = r.cells[0].querySelector('input').value.trim();
    const q = parseFloat(r.cells[1].querySelector('input').value)||0;
    const rt = parseFloat(r.cells[2].querySelector('input').value)||0;
    if (n || q > 0 || rt > 0) {
      rows.push({
        name: n || 'Service Item',
        qty: q || 1,
        rate: rt || 0,
        amount: (q || 1) * (rt || 0)
      });
    }
  });
  const sub = rows.reduce((s,r)=>s+r.amount,0);
  const gstR = parseFloat(document.getElementById('b-gst').value)||0;
  const gstA = sub*gstR/100;
  billData = {
    bname, owner:document.getElementById('b-owner').value.trim(),
    baddr:document.getElementById('b-baddr').value.trim(),
    bphone:document.getElementById('b-bphone').value.trim(),
    gstin:document.getElementById('b-gstin').value.trim(),
    cname, cphone:document.getElementById('b-cphone').value.trim(),
    caddr:document.getElementById('b-caddr').value.trim(),
    date:document.getElementById('b-date').value,
    pay:document.getElementById('b-pay').value,
    notes:document.getElementById('b-notes').value.trim(),
    rows, sub, gstR, gstA, grand:sub+gstA
  };

  // Always show generated invoice preview immediately.
  renderBill(billData);
  document.getElementById('bs1').className='step done';
  document.getElementById('bs2').className='step done';
  document.getElementById('bs3').className='step active';
  document.getElementById('bill-form').style.display='none';
  document.getElementById('bill-out').style.display='block';
  document.getElementById('bill-out').scrollIntoView({behavior:'smooth',block:'start'});

  // Sync invoice data with backend without blocking UI.
  try {
    await saveInvoiceToBackend(billData);
    setBackendStatus('Backend: invoice synced', true);
    await loadRecentActivity();
  } catch (_err) {
    setBackendStatus('Backend: offline (invoice shown, not synced)', false);
  }
}

function renderBill(d) {
  let invNum = document.getElementById('b-custominvnum').value.trim();
  if (!invNum) invNum = 'INV-'+String(Math.floor(Math.random()*9000)+1000);
  document.getElementById('bo-bname').textContent = d.bname;
  document.getElementById('bo-binfo').textContent = [d.owner,d.bphone].filter(Boolean).join('  ·  ');
  document.getElementById('bo-invnum').textContent = '#'+invNum;
  document.getElementById('bo-date').textContent = d.date ? new Date(d.date).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}) : '–';
  document.getElementById('bo-pay').textContent = d.pay;
  document.getElementById('bo-cname').textContent = d.cname;
  document.getElementById('bo-cphone').textContent = d.cphone||'';
  document.getElementById('bo-caddr').textContent = d.caddr||'';
  document.getElementById('bo-bname2').textContent = d.bname;
  document.getElementById('bo-baddr').textContent = d.baddr || '';
  document.getElementById('bo-gstin').textContent = d.gstin ? 'GSTIN: '+d.gstin : '';
  document.getElementById('bo-grandshow').textContent = '₹'+d.grand.toLocaleString('en-IN');
  document.getElementById('bo-total').textContent = '₹'+d.grand.toLocaleString('en-IN');
  updateLogoTargets(companyLogoDataUrl);

  const tb = document.getElementById('bo-tbody');
  tb.innerHTML='';
  if(!d.rows.length) {
    tb.innerHTML='<tr><td colspan="4" style="text-align:center;color:#999;padding:12px;font-size:12px">No items added</td></tr>';
  } else {
    d.rows.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML=`<td>${r.name}</td><td>${r.qty}</td><td>₹${r.rate.toLocaleString('en-IN')}</td><td>₹${r.amount.toLocaleString('en-IN')}</td>`;
      tb.appendChild(tr);
    });
    if(d.gstR>0){
      const gt=document.createElement('tr');
      gt.innerHTML=`<td colspan="3" style="text-align:right;color:#666;font-size:12px">GST (${d.gstR}%)</td><td>₹${d.gstA.toLocaleString('en-IN')}</td>`;
      tb.appendChild(gt);
    }
  }
  applyBillTheme();
  const nb = document.getElementById('bo-notes-box');
  if(d.notes){ nb.style.display='block'; document.getElementById('bo-notes').textContent=d.notes; } else nb.style.display='none';
}

function resetBill(){
  document.getElementById('bill-out').style.display='none';
  document.getElementById('bill-form').style.display='block';
  document.getElementById('bs1').className='step active';
  document.getElementById('bs2').className='step';
  document.getElementById('bs3').className='step';
  window.scrollTo({top:0,behavior:'smooth'});
}

// ─── GENERATE REPORT with AI ───
let reportData = {};
async function generateReport() {
  const tech=document.getElementById('r-tech').value.trim();
  const co=document.getElementById('r-company').value.trim();
  const cn=document.getElementById('r-cname').value.trim();
  const dev=document.getElementById('r-device').value;
  const comp=document.getElementById('r-complaint').value.trim();
  const work=document.getElementById('r-work').value.trim();
  const msgEl=document.getElementById('rpt-msg');
  msgEl.className='msg';
  if(!tech){msgEl.className='msg err';msgEl.textContent='⚠️ Enter your name.';return;}
  if(!co){msgEl.className='msg err';msgEl.textContent='⚠️ Enter company name.';return;}
  if(!cn){msgEl.className='msg err';msgEl.textContent='⚠️ Enter customer name.';return;}
  if(!dev){msgEl.className='msg err';msgEl.textContent='⚠️ Select device type.';return;}
  if(!comp){msgEl.className='msg err';msgEl.textContent='⚠️ Describe the complaint.';return;}
  if(!work){msgEl.className='msg err';msgEl.textContent='⚠️ Describe work done.';return;}

  const reportNumberInput = document.getElementById('r-rptnum');
  if (reportNumberInput && !reportNumberInput.value.trim()) {
    reportNumberInput.value = buildReportNumber(co);
  }

  const btn=document.getElementById('rpt-genbtn');
  const spin=document.getElementById('rpt-spin');
  const lbl=document.getElementById('rpt-btnlbl');
  btn.disabled=true; spin.style.display='block'; lbl.textContent='AI writing your report...';

  const prompt=`You are a professional service report writer for Indian appliance/electrical technicians.
Respond ONLY in JSON with key: "workPerformed"
Write a concise work summary in 2-4 sentences, professional yet clear English, specific to the device and issue.

Device: ${dev}${document.getElementById('r-brand').value?' ('+document.getElementById('r-brand').value+')':''}
Complaint: ${comp}
Work Done: ${work}
Status: ${document.getElementById('r-status').value}

JSON only, no markdown:`;

  try {
    // Check if API key is set
    if(ANTHROPIC_API_KEY.includes("YOUR_API_KEY")){
      // Fallback: Generate basic report without AI
      const ai = {
        workPerformed: work || "Service work completed as per requirement."
      };
      reportData={
        tech,co,companyAddr:document.getElementById('r-companyaddr').value.trim(),phone:document.getElementById('r-phone').value.trim(),city:document.getElementById('r-city').value.trim(),
        cn,cphone:document.getElementById('r-cphone').value.trim(),caddr:document.getElementById('r-caddr').value.trim(),
        dev,brand:document.getElementById('r-brand').value.trim(),
        complaint:comp,work,date:document.getElementById('r-date').value,
        status:document.getElementById('r-status').value,...ai
      };
      renderReport(reportData);
      try {
        await saveReportToBackend(reportData);
        setBackendStatus('Backend: report synced', true);
        await loadRecentActivity();
      } catch (_err) {
        setBackendStatus('Backend: offline (report saved locally in page)', false);
      }
      completeReportSteps();
      return;
    }
    const res = await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"x-api-key":ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"},
      body:JSON.stringify({model:"claude-opus-4-1-20250805",max_tokens:1000,messages:[{role:"user",content:prompt}]})
    });
    if(!res.ok) throw new Error(`API error: ${res.status}`);
    const result=await res.json();
    const raw=result.content.map(c=>c.text||'').join('');
    const ai=JSON.parse(raw.replace(/```json|```/g,'').trim());
    reportData={
      tech,co,companyAddr:document.getElementById('r-companyaddr').value.trim(),phone:document.getElementById('r-phone').value.trim(),city:document.getElementById('r-city').value.trim(),
      cn,cphone:document.getElementById('r-cphone').value.trim(),caddr:document.getElementById('r-caddr').value.trim(),
      dev,brand:document.getElementById('r-brand').value.trim(),
      complaint:comp,work,date:document.getElementById('r-date').value,
      status:document.getElementById('r-status').value,...ai
    };
    renderReport(reportData);
    try {
      await saveReportToBackend(reportData);
      setBackendStatus('Backend: report synced', true);
      await loadRecentActivity();
    } catch (_err) {
      setBackendStatus('Backend: offline (report saved locally in page)', false);
    }
    completeReportSteps();
  } catch(e){
    msgEl.className='msg err';
    msgEl.textContent='❌ Failed to generate. Check your API key or connection.';
    btn.disabled=false; spin.style.display='none'; lbl.textContent='✨ Generate AI Service Report';
  }
}

function completeReportSteps(){
  document.getElementById('rs1').className='step done';
  document.getElementById('rs2').className='step done';
  document.getElementById('rs3').className='step done';
  document.getElementById('rs4').className='step active';
  document.getElementById('rpt-form').style.display='none';
  document.getElementById('rpt-out').style.display='block';
  document.getElementById('rpt-out').scrollIntoView({behavior:'smooth',block:'start'});
  document.getElementById('rpt-genbtn').disabled=false;
  document.getElementById('rpt-spin').style.display='none';
  document.getElementById('rpt-btnlbl').textContent='✨ Generate AI Service Report';
}

function renderReport(d){
  let num = document.getElementById('r-rptnum').value.trim();
  if (!num) num = buildReportNumber(d.co);
  
  // Populate new CSR template
  document.getElementById('csr-title').textContent = 'SERVICE REPORT';
  document.getElementById('csr-company').textContent = d.co;
  document.getElementById('csr-rptnum').textContent = num;
  document.getElementById('csr-date').textContent = d.date ? new Date(d.date).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'}) : '–';
  document.getElementById('csr-companyaddr').textContent = d.companyAddr || '–';
  document.getElementById('csr-cname').textContent = d.cn;
  document.getElementById('csr-cphone').textContent = d.cphone || '–';
  document.getElementById('csr-caddr').textContent = d.caddr || '–';
  document.getElementById('csr-device').textContent = d.dev;
  document.getElementById('csr-brand').textContent = d.brand || '–';
  document.getElementById('csr-status').textContent = d.status;
  document.getElementById('csr-complaint').textContent = d.complaint || '–';
  document.getElementById('csr-work').textContent = d.workPerformed || '–';
  document.getElementById('csr-tech').textContent = d.co;
  document.getElementById('csr-techname').textContent = d.tech;
  updateLogoTargets(companyLogoDataUrl);
  
  applyReportTheme();
}

function resetReport(){
  document.getElementById('rpt-out').style.display='none';
  document.getElementById('rpt-form').style.display='block';
  document.getElementById('rs1').className='step active';
  document.getElementById('rs2').className='step';
  document.getElementById('rs3').className='step';
  document.getElementById('rs4').className='step';
  document.getElementById('rpt-msg').className='msg';
  window.scrollTo({top:0,behavior:'smooth'});
}

async function downloadPreviewAsPdf(elementId, fileName) {
  if (!window.jspdf || !window.html2canvas) {
    alert('PDF tools are not loaded yet. Please refresh and try again.');
    return;
  }

  const el = document.getElementById(elementId);
  if (!el) {
    alert('Preview not found. Please regenerate and try again.');
    return;
  }

  const canvas = await window.html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff'
  });

  const imgData = canvas.toDataURL('image/png');
  const {jsPDF} = window.jspdf;
  const pdf = new jsPDF({unit:'mm', format:'a4', orientation:'portrait'});
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const printW = pageW - margin * 2;
  const printH = pageH - margin * 2;
  const imgW = printW;
  const imgH = (canvas.height * imgW) / canvas.width;

  let heightLeft = imgH;
  let positionY = margin;

  pdf.addImage(imgData, 'PNG', margin, positionY, imgW, imgH, undefined, 'FAST');
  heightLeft -= printH;

  while (heightLeft > 0) {
    pdf.addPage();
    positionY = margin - (imgH - heightLeft);
    pdf.addImage(imgData, 'PNG', margin, positionY, imgW, imgH, undefined, 'FAST');
    heightLeft -= printH;
  }

  pdf.save(fileName);
}

// ─── PDF: REPORT ───
async function downloadReportPDF(){
  if (!reportData || !reportData.co) {
    alert('Please generate a service report first.');
    return;
  }

  try {
    const customer = (reportData.cn || 'Customer').replace(/\s+/g, '_');
    const date = reportData.date || 'today';
    await downloadPreviewAsPdf('rpt-preview', `ServiceReport_${customer}_${date}.pdf`);
  } catch (_err) {
    alert('Unable to download report PDF right now. Please try again.');
  }
}

// ─── PDF: BILL ───
async function downloadBillPDF(){
  if (!billData || !billData.bname) {
    alert('Please generate an invoice first.');
    return;
  }

  try {
    const customer = (billData.cname || 'Customer').replace(/\s+/g, '_');
    const date = billData.date || 'today';
    await downloadPreviewAsPdf('bill-preview', `Invoice_${customer}_${date}.pdf`);
  } catch (_err) {
    alert('Unable to download invoice PDF right now. Please try again.');
  }
}

// ─── WHATSAPP ───
function shareReportWA(){
  const d=reportData;
  const msg=`*Service Report – ${d.co}*\n\n👤 Customer: ${d.cn}\n🔧 Device: ${d.dev}${d.brand?' ('+d.brand+')':''}\n📅 Date: ${d.date?new Date(d.date).toLocaleDateString('en-IN'):''}\n✅ Status: ${d.status}\n\n_Generated via Insight Reports Co._`;
  window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
}
function shareBillWA(){
  const d=billData;
  const msg=`*Invoice – ${d.bname}*\n\n👤 Customer: ${d.cname}\n📅 Date: ${d.date?new Date(d.date).toLocaleDateString('en-IN'):''}\n💰 Total: ₹${d.grand.toLocaleString('en-IN')}\n💳 Payment: ${d.pay}\n\n_Generated via Insight Reports Co._`;
  window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
}
