// ─── ANTHROPIC API CONFIG ───
// Replace with your actual API key
const ANTHROPIC_API_KEY = "sk-ant-v3-YOUR_API_KEY_HERE";
const BRAND_LOGO_STORAGE_KEY = 'fieldproCompanyLogo';
const DEFAULT_BRAND_LOGO_SRC = 'logo insight.png';
const AUTH_STORAGE_KEY = 'insight-auth-session';
let companyLogoDataUrl = '';
const API_BASE = '/api';
let authSession = null;
let authMode = 'login';
let accountReportsCache = [];
let accountInvoicesCache = [];

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
  const logoSrc = src || DEFAULT_BRAND_LOGO_SRC;
  const hasLogo = Boolean(logoSrc);
  ['navbar-logo', 'contact-logo', 'footer-logo', 'csr-logo', 'bo-logo'].forEach(id => {
    const img = document.getElementById(id);
    if (!img) return;
    if (hasLogo) {
      img.src = logoSrc;
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
  ['company-logo-input', 'b-logo-input'].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = '';
  });
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

function loadAuthSession() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.email) return null;
    return parsed;
  } catch (_err) {
    return null;
  }
}

function saveAuthSession(session) {
  authSession = session || null;
  if (authSession) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authSession));
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
  updateAuthUI();
}

function getCurrentUserEmail() {
  return String(authSession?.email || '').trim().toLowerCase();
}

function getDisplayNameFromEmail(email) {
  const local = String(email || '').split('@')[0] || 'User';
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function updateAccountProfileCard() {
  const email = getCurrentUserEmail();
  const nameEl = document.getElementById('account-name');
  const emailEl = document.getElementById('account-email');
  if (nameEl) nameEl.textContent = email ? getDisplayNameFromEmail(email) : 'Guest User';
  if (emailEl) emailEl.textContent = email || 'Login required';
}

function updateAuthUI() {
  const accountBtn = document.getElementById('account-btn');
  const stateEl = document.getElementById('auth-user-state');
  const titleEl = document.getElementById('auth-title');
  const submitBtn = document.getElementById('auth-submit-btn');
  const logoutBtn = document.getElementById('auth-logout-btn');
  const googleContainer = document.getElementById('google-login-container');
  const loginTab = document.getElementById('auth-login-tab');
  const signupTab = document.getElementById('auth-signup-tab');
  const emailEl = document.getElementById('auth-email');

  const email = getCurrentUserEmail();
  const loggedIn = Boolean(email);

  if (titleEl) titleEl.textContent = authMode === 'signup' ? 'Create Account' : 'Login';
  if (loginTab) loginTab.classList.toggle('active', authMode === 'login');
  if (signupTab) signupTab.classList.toggle('active', authMode === 'signup');
  if (accountBtn) accountBtn.textContent = loggedIn ? 'My Account' : 'Login';
  if (stateEl) stateEl.textContent = loggedIn
    ? `Logged in as ${email}. Your account history is scoped to this email.`
    : 'Login to sync and view your previous reports and bills.';
  if (submitBtn) {
    submitBtn.style.display = loggedIn ? 'none' : 'inline-flex';
    submitBtn.textContent = authMode === 'signup' ? 'Create Account' : 'Log In';
  }
  if (googleContainer) googleContainer.style.display = loggedIn ? 'none' : 'flex';
  if (logoutBtn) logoutBtn.style.display = loggedIn ? 'inline-flex' : 'none';
  if (emailEl && loggedIn) emailEl.value = email;
  updateAccountProfileCard();
  if (!loggedIn && window.renderGoogleLoginButton) {
    window.renderGoogleLoginButton();
  }
}

function setAuthMode(mode) {
  authMode = mode === 'signup' ? 'signup' : 'login';
  updateAuthUI();
}

function openAuthModal() {
  closeResetPasswordModalWithReturn(false);
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  modal.style.display = 'grid';
  modal.hidden = false;
  updateAuthUI();
}

function openAccountPortal() {
  if (getCurrentUserEmail()) {
    switchTab('account');
    loadAccountOverview();
    return;
  }
  openAuthModal();
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  modal.hidden = true;
  modal.style.display = 'none';
  const msgEl = document.getElementById('auth-msg');
  if (msgEl) {
    msgEl.className = 'auth-msg';
    msgEl.textContent = '';
  }
}

function openResetPasswordModal() {
  closeAuthModal();

  const modal = document.getElementById('reset-password-modal');
  if (!modal) return;

  const newPassEl = document.getElementById('reset-new-password');
  const confirmPassEl = document.getElementById('reset-confirm-password');
  const msgEl = document.getElementById('reset-msg');

  if (newPassEl) newPassEl.value = '';
  if (confirmPassEl) confirmPassEl.value = '';
  if (msgEl) {
    msgEl.className = 'auth-msg';
    msgEl.textContent = authSession?.idToken ? '' : 'Login first, then set a new password.';
  }

  modal.style.display = 'grid';
  modal.hidden = false;
}

function closeResetPasswordModal() {
  closeResetPasswordModalWithReturn(false);
}

function closeResetPasswordModalWithReturn(returnToLogin = false) {
  const modal = document.getElementById('reset-password-modal');
  if (!modal) return;
  modal.hidden = true;
  modal.style.display = 'none';

  if (returnToLogin && !getCurrentUserEmail()) {
    openAuthModal();
  }
}

function showMainWebsiteAfterLogin() {
  closeAuthModal();
  switchTab('report');
}

async function changePasswordFromAccount() {
  if (!authSession?.idToken) {
    alert('Please login first to change your password.');
    openAuthModal();
    return;
  }

  const newPassword = prompt('Enter new password (minimum 6 characters):');
  if (!newPassword) return;
  if (newPassword.length < 6) {
    alert('Password must be at least 6 characters.');
    return;
  }

  try {
    const data = await apiRequest('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ idToken: authSession.idToken, newPassword })
    });
    saveAuthSession({ ...authSession, idToken: data.idToken || authSession.idToken });
    alert('Password changed successfully.');
  } catch (err) {
    alert(`Unable to change password: ${err.message}`);
  }
}

function normalizeReportRow(row) {
  return {
    id: row.id,
    reportNumber: row.report_number || '',
    tech: row.technician_name || '',
    co: row.company_name || '',
    companyAddr: row.company_address || '',
    phone: row.technician_phone || '',
    city: row.city || '',
    cn: row.customer_name || '',
    cphone: row.customer_phone || '',
    caddr: row.customer_address || '',
    dev: row.device_type || '',
    brand: row.brand_model || '',
    complaint: row.complaint || '',
    workPerformed: row.work_performed || '',
    date: row.service_date || '',
    status: row.status || 'Completed'
  };
}

function normalizeInvoiceRow(row) {
  let items = [];
  try {
    const parsed = JSON.parse(row.items_json || '[]');
    items = Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    items = [];
  }

  const sub = Number(row.subtotal || 0);
  const gstR = Number(row.gst_rate || 0);
  const gstA = Number(row.gst_amount || 0);
  const grand = Number(row.grand_total || 0);

  return {
    id: row.id,
    invoiceNumber: row.invoice_number || '',
    bname: row.business_name || '',
    owner: row.owner_name || '',
    bphone: row.business_phone || '',
    baddr: row.business_address || '',
    gstin: row.gstin || '',
    cname: row.customer_name || '',
    cphone: row.customer_phone || '',
    caddr: row.customer_address || '',
    date: row.bill_date || '',
    pay: row.payment_status || 'Paid',
    notes: row.notes || '',
    rows: items,
    sub,
    gstR,
    gstA,
    grand,
    payDetails: '',
    terms: '',
    bemail: '',
    bsite: ''
  };
}

function renderAccountHistory() {
  const reportsEl = document.getElementById('account-reports-list');
  const invoicesEl = document.getElementById('account-invoices-list');
  if (!reportsEl || !invoicesEl) return;

  if (!getCurrentUserEmail()) {
    reportsEl.innerHTML = '<div class="account-history-item">Login to view your saved service reports.</div>';
    invoicesEl.innerHTML = '<div class="account-history-item">Login to view your saved invoices.</div>';
    return;
  }

  reportsEl.innerHTML = accountReportsCache.length
    ? accountReportsCache.map((row) => `
      <article class="account-history-item">
        <div class="account-history-title">${escapeHtml(row.report_number || 'Service Report')}</div>
        <div class="account-history-meta">${escapeHtml(row.customer_name || 'Unknown Customer')} • ${escapeHtml(formatDateShort(row.service_date || row.created_at))}</div>
        <div class="account-history-actions">
          <button class="account-mini-btn" type="button" onclick="editSavedReport(${Number(row.id)})">Edit</button>
          <button class="account-mini-btn" type="button" onclick="redownloadSavedReport(${Number(row.id)})">Re-download PDF</button>
        </div>
      </article>`).join('')
    : '<div class="account-history-item">No service reports saved yet.</div>';

  invoicesEl.innerHTML = accountInvoicesCache.length
    ? accountInvoicesCache.map((row) => `
      <article class="account-history-item">
        <div class="account-history-title">${escapeHtml(row.invoice_number || 'Invoice')}</div>
        <div class="account-history-meta">${escapeHtml(row.customer_name || 'Unknown Customer')} • ₹${escapeHtml(Number(row.grand_total || 0).toLocaleString('en-IN'))}</div>
        <div class="account-history-actions">
          <button class="account-mini-btn" type="button" onclick="editSavedInvoice(${Number(row.id)})">Edit</button>
          <button class="account-mini-btn" type="button" onclick="redownloadSavedInvoice(${Number(row.id)})">Re-download PDF</button>
        </div>
      </article>`).join('')
    : '<div class="account-history-item">No invoices saved yet.</div>';
}

async function loadAccountOverview() {
  updateAccountProfileCard();
  const userEmail = getCurrentUserEmail();
  if (!userEmail) {
    accountReportsCache = [];
    accountInvoicesCache = [];
    renderAccountHistory();
    return;
  }

  try {
    const [reportsRes, invoicesRes] = await Promise.all([
      apiRequest(`/reports?limit=50&userEmail=${encodeURIComponent(userEmail)}`),
      apiRequest(`/invoices?limit=50&userEmail=${encodeURIComponent(userEmail)}`)
    ]);
    accountReportsCache = reportsRes.data || [];
    accountInvoicesCache = invoicesRes.data || [];
  } catch (_err) {
    accountReportsCache = [];
    accountInvoicesCache = [];
  }

  renderAccountHistory();
}

function editSavedReport(id) {
  const row = accountReportsCache.find((r) => Number(r.id) === Number(id));
  if (!row) return;
  const d = normalizeReportRow(row);

  resetReport();
  document.getElementById('r-tech').value = d.tech;
  document.getElementById('r-company').value = d.co;
  document.getElementById('r-companyaddr').value = d.companyAddr;
  document.getElementById('r-phone').value = d.phone;
  document.getElementById('r-city').value = d.city;
  document.getElementById('r-cname').value = d.cn;
  document.getElementById('r-cphone').value = d.cphone;
  document.getElementById('r-caddr').value = d.caddr;
  document.getElementById('r-device').value = d.dev;
  document.getElementById('r-brand').value = d.brand;
  document.getElementById('r-complaint').value = d.complaint;
  document.getElementById('r-work').value = d.workPerformed;
  document.getElementById('r-date').value = d.date ? String(d.date).slice(0, 10) : '';
  document.getElementById('r-status').value = d.status;
  document.getElementById('r-rptnum').value = d.reportNumber;
  refreshBrandingContact();
  switchTab('report');
}

async function redownloadSavedReport(id) {
  const row = accountReportsCache.find((r) => Number(r.id) === Number(id));
  if (!row) return;
  const d = normalizeReportRow(row);
  reportData = d;
  document.getElementById('r-rptnum').value = d.reportNumber;
  renderReport(d);
  completeReportSteps();
  await downloadReportPDF();
}

function setBillRows(rows) {
  const body = document.getElementById('bill-body');
  if (!body) return;
  body.innerHTML = '';
  if (!rows.length) {
    addBillRow();
    return;
  }
  rows.forEach((item) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" placeholder="Item name"/></td>
      <td><input type="number" min="1" placeholder="1" oninput="calcBill()"/></td>
      <td><input type="number" placeholder="0" oninput="calcBill()"/></td>
      <td class="bill-amt" style="font-weight:600">₹0</td>
      <td><button class="del-btn" onclick="delBillRow(this)">✕</button></td>`;
    tr.cells[0].querySelector('input').value = item.name || '';
    tr.cells[1].querySelector('input').value = item.qty || 1;
    tr.cells[2].querySelector('input').value = item.rate || 0;
    body.appendChild(tr);
  });
  calcBill();
}

function editSavedInvoice(id) {
  const row = accountInvoicesCache.find((r) => Number(r.id) === Number(id));
  if (!row) return;
  const d = normalizeInvoiceRow(row);

  resetBill();
  document.getElementById('b-bname').value = d.bname;
  document.getElementById('b-owner').value = d.owner;
  document.getElementById('b-bphone').value = d.bphone;
  document.getElementById('b-baddr').value = d.baddr;
  document.getElementById('b-gstin').value = d.gstin;
  document.getElementById('b-cname').value = d.cname;
  document.getElementById('b-cphone').value = d.cphone;
  document.getElementById('b-caddr').value = d.caddr;
  document.getElementById('b-date').value = d.date ? String(d.date).slice(0, 10) : '';
  document.getElementById('b-pay').value = d.pay;
  document.getElementById('b-custominvnum').value = d.invoiceNumber;
  document.getElementById('b-gst').value = String(d.gstR || 0);
  document.getElementById('b-notes').value = d.notes;
  setBillRows(d.rows);
  calcBill();
  refreshBrandingContact();
  switchTab('bill');
}

async function redownloadSavedInvoice(id) {
  const row = accountInvoicesCache.find((r) => Number(r.id) === Number(id));
  if (!row) return;
  const d = normalizeInvoiceRow(row);
  billData = d;
  document.getElementById('b-custominvnum').value = d.invoiceNumber;
  renderBill(d);
  document.getElementById('bs1').className = 'step done';
  document.getElementById('bs2').className = 'step done';
  document.getElementById('bs3').className = 'step active';
  document.getElementById('bill-form').style.display = 'none';
  document.getElementById('bill-out').style.display = 'block';
  switchTab('bill');
  await downloadBillPDF();
}

async function backendAuthRequest(mode, email, password) {
  const path = mode === 'signup' ? '/auth/signup' : '/auth/login';
  return apiRequest(path, {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

function getFirebaseUserPayload(user) {
  if (!user) return null;
  return {
    email: user.email || '',
    localId: user.uid || '',
    idToken: user.accessToken || user.stsTokenManager?.accessToken || '',
    refreshToken: user.refreshToken || '',
    displayName: user.displayName || ''
  };
}

async function applyFirebaseUser(user) {
  const payload = getFirebaseUserPayload(user);
  if (!payload?.email) return;
  saveAuthSession(payload);
  setBackendStatus(`Backend: connected as ${payload.email}`, true);
  await loadRecentActivity();
  await loadAccountOverview();
  showMainWebsiteAfterLogin();
}

window.onGoogleCredential = async function onGoogleCredential(payload) {
  try {
    if (!payload?.email) {
      throw new Error('Google did not return an email address.');
    }

    saveAuthSession(payload);
    setBackendStatus(`Backend: connected as ${payload.email}`, true);
    await loadRecentActivity();
    await loadAccountOverview();
    showMainWebsiteAfterLogin();
  } catch (err) {
    const msgEl = document.getElementById('auth-msg');
    if (msgEl) {
      msgEl.className = 'auth-msg err';
      msgEl.textContent = `Google login failed: ${err.message}`;
    }
  }
};

async function handleAuthSubmit(event) {
  event.preventDefault();
  const emailEl = document.getElementById('auth-email');
  const passEl = document.getElementById('auth-password');
  const msgEl = document.getElementById('auth-msg');

  const email = emailEl?.value.trim().toLowerCase() || '';
  const password = passEl?.value || '';
  const mode = authMode;

  if (!email || !password) {
    if (msgEl) {
      msgEl.className = 'auth-msg err';
      msgEl.textContent = 'Email and password are required.';
    }
    return;
  }

  if (password.length < 6) {
    if (msgEl) {
      msgEl.className = 'auth-msg err';
      msgEl.textContent = 'Password must be at least 6 characters.';
    }
    return;
  }

  try {
    const authData = mode === 'signup'
      ? await window.firebaseCreateUser(email, password)
      : await window.firebaseSignInWithEmail(email, password);

    await applyFirebaseUser(authData.user);
    if (msgEl) {
      msgEl.className = 'auth-msg';
      msgEl.textContent = mode === 'signup' ? 'Account created successfully.' : 'Logged in successfully.';
    }
  } catch (err) {
    if (msgEl) {
      msgEl.className = 'auth-msg err';
      msgEl.textContent = `Auth failed: ${err.message}`;
    }
  }
}

async function forgotPassword() {
  const authModal = document.getElementById('auth-modal');
  if (!authModal || authModal.hidden) {
    openAuthModal();
    return;
  }
  openResetPasswordModal();
}

async function submitResetPassword(event) {
  event.preventDefault();

  const newPassword = document.getElementById('reset-new-password')?.value || '';
  const confirmPassword = document.getElementById('reset-confirm-password')?.value || '';
  const msgEl = document.getElementById('reset-msg');

  if (!newPassword || !confirmPassword) {
    if (msgEl) {
      msgEl.className = 'auth-msg err';
      msgEl.textContent = 'Both password fields are required.';
    }
    return;
  }

  if (newPassword.length < 6) {
    if (msgEl) {
      msgEl.className = 'auth-msg err';
      msgEl.textContent = 'New password must be at least 6 characters.';
    }
    return;
  }

  if (newPassword !== confirmPassword) {
    if (msgEl) {
      msgEl.className = 'auth-msg err';
      msgEl.textContent = 'New password and confirm password do not match.';
    }
    return;
  }

  if (!authSession?.idToken) {
    if (msgEl) {
      msgEl.className = 'auth-msg err';
      msgEl.textContent = 'Please log in first, then set your new password.';
    }
    return;
  }

  try {
    const data = await apiRequest('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ idToken: authSession.idToken, newPassword })
    });
    saveAuthSession({ ...authSession, idToken: data.idToken || authSession.idToken });

    closeResetPasswordModal();

    const authPassEl = document.getElementById('auth-password');
    const authMsgEl = document.getElementById('auth-msg');
    if (authPassEl) authPassEl.value = '';
    if (authMsgEl) {
      authMsgEl.className = 'auth-msg';
      authMsgEl.textContent = 'Password updated successfully.';
    }
  } catch (err) {
    if (msgEl) {
      msgEl.className = 'auth-msg err';
      msgEl.textContent = `Unable to update password: ${err.message}`;
    }
  }
}

async function logoutAccount() {
  if (window.firebaseSignOut) {
    try { await window.firebaseSignOut(); } catch (_err) {}
  }
  saveAuthSession(null);
  const emailEl = document.getElementById('auth-email');
  const passEl = document.getElementById('auth-password');
  if (emailEl) emailEl.value = '';
  if (passEl) passEl.value = '';
  setBackendStatus('Backend: connected (login to view account history)', true);
  await loadRecentActivity();
  await loadAccountOverview();
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
  const userEmail = getCurrentUserEmail();
  if (!userEmail) {
    throw new Error('LOGIN_REQUIRED');
  }
  const reportNumber = document.getElementById('csr-rptnum')?.textContent?.trim() || '';
  const payload = {
    userEmail,
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
  const userEmail = getCurrentUserEmail();
  if (!userEmail) {
    throw new Error('LOGIN_REQUIRED');
  }
  const invoiceNumber = document.getElementById('bo-invnum')?.textContent?.replace('#', '').trim() || '';
  const payload = {
    userEmail,
    invoiceNumber,
    billDate: d.date || null,
    paymentStatus: d.pay || '',
    businessName: d.bname || '',
    ownerName: d.owner || '',
    businessPhone: d.bphone || '',
    businessEmail: d.bemail || '',
    businessWebsite: d.bsite || '',
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

  const userEmail = getCurrentUserEmail();
  if (!userEmail) {
    reportList.innerHTML = '<div class="service-mini-card empty">Login to view your report history.</div>';
    invoiceList.innerHTML = '<div class="service-mini-card empty">Login to view your invoice history.</div>';
    return;
  }

  try {
    const [reportsRes, invoicesRes] = await Promise.all([
      apiRequest(`/reports?limit=5&userEmail=${encodeURIComponent(userEmail)}`),
      apiRequest(`/invoices?limit=5&userEmail=${encodeURIComponent(userEmail)}`)
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
    const email = getCurrentUserEmail();
    setBackendStatus(email ? `Backend: connected as ${email}` : 'Backend: connected (login to view account history)', true);
    await loadRecentActivity();
    await loadAccountOverview();
  } catch (_err) {
    setBackendStatus('Backend: offline (start Node server)', false);
  }
}

function setupAuthForm() {
  const form = document.getElementById('auth-form');
  if (form) form.addEventListener('submit', handleAuthSubmit);

  const resetForm = document.getElementById('reset-password-form');
  if (resetForm) resetForm.addEventListener('submit', submitResetPassword);

  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeAuthModal();
    });
  }

  const resetModal = document.getElementById('reset-password-modal');
  if (resetModal) {
    resetModal.addEventListener('click', (event) => {
      if (event.target === resetModal) closeResetPasswordModalWithReturn(true);
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const resetPasswordModal = document.getElementById('reset-password-modal');
    if (resetPasswordModal && !resetPasswordModal.hidden) {
      closeResetPasswordModalWithReturn(true);
      return;
    }
    closeAuthModal();
  });

  window.openAuthModal = openAuthModal;
  window.openAccountPortal = openAccountPortal;
  window.closeAuthModal = closeAuthModal;
  window.openResetPasswordModal = openResetPasswordModal;
  window.closeResetPasswordModal = closeResetPasswordModal;
  window.closeResetPasswordModalWithReturn = closeResetPasswordModalWithReturn;
  window.setAuthMode = setAuthMode;
  window.forgotPassword = forgotPassword;
  window.changePasswordFromAccount = changePasswordFromAccount;
  window.editSavedReport = editSavedReport;
  window.redownloadSavedReport = redownloadSavedReport;
  window.editSavedInvoice = editSavedInvoice;
  window.redownloadSavedInvoice = redownloadSavedInvoice;
  window.logoutAccount = logoutAccount;
}

if (window.firebaseOnAuthStateChanged) {
  window.firebaseOnAuthStateChanged((user) => {
    if (user) {
      const payload = getFirebaseUserPayload(user);
      if (payload?.email) {
        saveAuthSession(payload);
        setBackendStatus(`Backend: connected as ${payload.email}`, true);
        loadRecentActivity();
        loadAccountOverview();
        updateAuthUI();
        closeAuthModal();
      }
    } else {
      saveAuthSession(null);
      updateAuthUI();
      loadRecentActivity();
      loadAccountOverview();
      if (!getCurrentUserEmail()) {
        openAuthModal();
      }
    }
  });
}

// ─── DEFAULTS ───
// Always start with the repository logo file instead of any older saved logo.
localStorage.removeItem(BRAND_LOGO_STORAGE_KEY);
updateLogoTargets(DEFAULT_BRAND_LOGO_SRC);
authSession = loadAuthSession();
setupAuthForm();
closeResetPasswordModalWithReturn(false);
updateAuthUI();
if (!getCurrentUserEmail()) {
  openAuthModal();
}

const logoInput = document.getElementById('company-logo-input');
if (logoInput) logoInput.addEventListener('change', handleLogoUpload);
const billLogoInput = document.getElementById('b-logo-input');
if (billLogoInput) billLogoInput.addEventListener('change', handleLogoUpload);

refreshBrandingContact();
initializeBackendConnection();

const quoteCompanyEl = document.getElementById('q-company');
const quoteCompanyAddrEl = document.getElementById('q-company-address');
const quoteTemplateEl = document.getElementById('q-template');
if (quoteCompanyEl && !quoteCompanyEl.value.trim()) quoteCompanyEl.value = getPreferredCompanyName();
if (quoteCompanyAddrEl && !quoteCompanyAddrEl.value.trim()) quoteCompanyAddrEl.value = getPreferredCompanyAddress();
if (quoteTemplateEl && !quoteTemplateEl.value) quoteTemplateEl.value = 'simple';
if (document.getElementById('q-number') && !document.getElementById('q-number').value.trim()) autoGenQuoteNum();
calcQuote();
applyQuoteTheme(quoteTemplateEl?.value || 'simple');

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
    bemail:document.getElementById('b-bemail').value.trim(),
    bsite:document.getElementById('b-bsite').value.trim(),
    gstin:document.getElementById('b-gstin').value.trim(),
    cname, cphone:document.getElementById('b-cphone').value.trim(),
    caddr:document.getElementById('b-caddr').value.trim(),
    date:document.getElementById('b-date').value,
    pay:document.getElementById('b-pay').value,
    notes:document.getElementById('b-notes').value.trim(),
    payDetails:document.getElementById('b-paydetails').value.trim(),
    terms:document.getElementById('b-terms').value.trim(),
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
  const normalizedSite = String(d.bsite || '').replace(/^https?:\/\//i, '').trim();
  const brandSite = normalizedSite || (d.bname
    ? String(d.bname).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) + '.com'
    : 'invoice.local');
  document.getElementById('bo-bname').textContent = d.bname;
  document.getElementById('bo-binfo').textContent = [d.owner, d.bphone, d.bemail].filter(Boolean).join('  ·  ');
  document.getElementById('bo-invnum').textContent = '#'+invNum;
  document.getElementById('bo-date').textContent = d.date ? new Date(d.date).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}) : '–';
  document.getElementById('bo-pay').textContent = d.pay;
  document.getElementById('bo-paydetails').textContent = d.payDetails || d.pay || 'Payment details will appear here.';
  document.getElementById('bo-cname').textContent = d.cname;
  document.getElementById('bo-cphone').textContent = d.cphone||'';
  document.getElementById('bo-caddr').textContent = d.caddr||'';
  document.getElementById('bo-bname2').textContent = brandSite;
  document.getElementById('bo-baddr').textContent = d.baddr || '';
  document.getElementById('bo-gstin').textContent = d.gstin ? 'GSTIN: '+d.gstin : '';
  document.getElementById('bo-bemail').textContent = d.bemail ? `Email: ${d.bemail}` : '';
  document.getElementById('bo-bsite').textContent = brandSite ? `Website: ${brandSite}` : '';
  document.getElementById('bo-subshow').textContent = '₹'+d.sub.toLocaleString('en-IN');
  document.getElementById('bo-gstlabel').textContent = `Tax ${d.gstR}% :`;
  document.getElementById('bo-gstshow').textContent = '₹'+d.gstA.toLocaleString('en-IN');
  document.getElementById('bo-grandshow').textContent = '₹'+d.grand.toLocaleString('en-IN');
  document.getElementById('bo-signname').textContent = d.owner || d.bname || 'Authorized Signatory';
  
  // Handle logo conditionally for invoice
  const logoImg = document.getElementById('bo-logo');
  if (logoImg) {
    if (companyLogoDataUrl) {
      logoImg.src = companyLogoDataUrl;
      logoImg.hidden = false;
      logoImg.removeAttribute('hidden');
      logoImg.style.display = 'inline-block';
    } else {
      logoImg.hidden = true;
      logoImg.setAttribute('hidden', 'hidden');
      logoImg.style.display = 'none';
    }
  }
  
  // Trigger Netflix-style animation
  playNetflixReportAnimation();

  const tb = document.getElementById('bo-tbody');
  tb.innerHTML='';
  if(!d.rows.length) {
    tb.innerHTML='<tr><td colspan="5" style="text-align:center;color:#666;padding:12px;font-size:12px">No items added</td></tr>';
  } else {
    d.rows.forEach((r, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML=`<td>${idx + 1}</td><td>${r.name}</td><td>${r.qty}</td><td>₹${r.rate.toLocaleString('en-IN')}</td><td>₹${r.amount.toLocaleString('en-IN')}</td>`;
      tb.appendChild(tr);
    });
  }
  applyBillTheme();
  const termsBox = document.getElementById('bo-terms-box');
  if (termsBox) {
    if (d.terms) {
      termsBox.style.display = 'block';
      document.getElementById('bo-terms').textContent = d.terms;
    } else {
      termsBox.style.display = 'none';
    }
  }
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

// ─── QUOTATION MAKER (inspired by quotr: code-boxx/quotr) ───
function autoGenQuoteNum() {
  const year = new Date().getFullYear();
  const num = String(Math.floor(Math.random() * 9000) + 1000);
  const el = document.getElementById('q-number');
  if (el) el.value = `QT-${year}-${num}`;
}

function addQuoteRow() {
  const body = document.getElementById('quote-body');
  if (!body) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" placeholder="Service / Product"/></td>
    <td><input type="text" placeholder="Short description"/></td>
    <td><input type="number" min="1" value="1" oninput="calcQuote()"/></td>
    <td><input type="number" min="0" value="0" oninput="calcQuote()"/></td>
    <td class="quote-amt" style="font-weight:600">₹0</td>
    <td><button class="del-btn" onclick="delQuoteRow(this)">✕</button></td>`;
  body.appendChild(tr);
}

function delQuoteRow(btn) {
  const body = document.getElementById('quote-body');
  if (!body) return;
  const rows = body.querySelectorAll('tr');
  if (rows.length <= 1) {
    const qtyEl = rows[0]?.querySelector('td:nth-child(3) input');
    const rateEl = rows[0]?.querySelector('td:nth-child(4) input');
    const nameEl = rows[0]?.querySelector('td:nth-child(1) input');
    const descEl = rows[0]?.querySelector('td:nth-child(2) input');
    if (nameEl) nameEl.value = '';
    if (descEl) descEl.value = '';
    if (qtyEl) qtyEl.value = '1';
    if (rateEl) rateEl.value = '0';
  } else {
    btn.closest('tr')?.remove();
  }
  calcQuote();
}

function calcQuote() {
  let sub = 0;
  document.querySelectorAll('#quote-body tr').forEach(tr => {
    const qty = parseFloat(tr.cells[2]?.querySelector('input')?.value || 0) || 0;
    const rate = parseFloat(tr.cells[3]?.querySelector('input')?.value || 0) || 0;
    const amt = qty * rate;
    sub += amt;
    const amtCell = tr.querySelector('.quote-amt');
    if (amtCell) amtCell.textContent = '₹' + amt.toLocaleString('en-IN');
  });

  const taxR = parseFloat(document.getElementById('q-tax')?.value || 0) || 0;
  const taxA = (sub * taxR) / 100;
  const grand = sub + taxA;

  const subEl = document.getElementById('q-sub');
  const taxEl = document.getElementById('q-tax-amt');
  const grandEl = document.getElementById('q-grand');
  if (subEl) subEl.textContent = '₹' + sub.toLocaleString('en-IN');
  if (taxEl) taxEl.textContent = '₹' + taxA.toLocaleString('en-IN');
  if (grandEl) grandEl.textContent = '₹' + grand.toLocaleString('en-IN');

  return { sub, taxR, taxA, grand };
}

let quoteData = {};
function applyQuoteTheme(themeName) {
  const preview = document.getElementById('quote-preview');
  if (!preview) return;
  preview.classList.remove('quote-style-simple', 'quote-style-apple', 'quote-style-banana', 'quote-style-blueberry');
  const theme = themeName || document.getElementById('q-template')?.value || 'simple';
  preview.classList.add(`quote-style-${theme}`);
}

function generateQuote() {
  const msgEl = document.getElementById('quote-msg');
  if (msgEl) {
    msgEl.className = 'msg';
    msgEl.textContent = '';
  }

  const company = document.getElementById('q-company')?.value.trim() || '';
  const number = document.getElementById('q-number')?.value.trim() || '';
  const customerName = document.getElementById('q-customer-name')?.value.trim() || '';
  if (!company || !number || !customerName) {
    if (msgEl) {
      msgEl.className = 'msg err';
      msgEl.textContent = '⚠️ Company name, quotation number, and customer name are required.';
    }
    return;
  }

  const totals = calcQuote();
  const rows = [];
  document.querySelectorAll('#quote-body tr').forEach(tr => {
    const name = tr.cells[0]?.querySelector('input')?.value.trim() || '';
    const desc = tr.cells[1]?.querySelector('input')?.value.trim() || '';
    const qty = parseFloat(tr.cells[2]?.querySelector('input')?.value || 0) || 0;
    const unit = parseFloat(tr.cells[3]?.querySelector('input')?.value || 0) || 0;
    if (!name && !desc && !qty && !unit) return;
    rows.push({ name, desc, qty, unit, amount: qty * unit });
  });

  quoteData = {
    company,
    number,
    template: document.getElementById('q-template')?.value || 'simple',
    validFrom: document.getElementById('q-valid-from')?.value || '',
    validTill: document.getElementById('q-valid-till')?.value || '',
    companyAddress: document.getElementById('q-company-address')?.value.trim() || '',
    companyPhone: document.getElementById('q-company-phone')?.value.trim() || '',
    companyEmail: document.getElementById('q-company-email')?.value.trim() || '',
    customerName,
    customerAddress: document.getElementById('q-customer-address')?.value.trim() || '',
    customerContact: document.getElementById('q-customer-contact')?.value.trim() || '',
    notes: document.getElementById('q-notes')?.value.trim() || '',
    rows,
    ...totals
  };

  renderQuote(quoteData);
  document.getElementById('quote-form').style.display = 'none';
  document.getElementById('quote-out').style.display = 'block';
  document.getElementById('quote-out').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderQuote(d) {
  const fmt = (v) => Number(v || 0).toLocaleString('en-IN');
  const dateFmt = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  document.getElementById('qp-company').textContent = d.company;
  document.getElementById('qp-company-address').textContent = d.companyAddress || '-';
  document.getElementById('qp-company-contact').textContent = [d.companyPhone, d.companyEmail].filter(Boolean).join(' | ') || '-';
  document.getElementById('qp-customer-name').textContent = d.customerName || '-';
  document.getElementById('qp-customer-address').textContent = d.customerAddress || '-';
  document.getElementById('qp-customer-contact').textContent = d.customerContact || '-';
  document.getElementById('qp-number').textContent = d.number || '-';
  document.getElementById('qp-valid-from').textContent = dateFmt(d.validFrom);
  document.getElementById('qp-valid-till').textContent = dateFmt(d.validTill);
  document.getElementById('qp-sub').textContent = `₹${fmt(d.sub)}`;
  document.getElementById('qp-tax').textContent = `₹${fmt(d.taxA)}`;
  document.getElementById('qp-tax-label').textContent = `TAX ${Number(d.taxR || 0)}%`;
  document.getElementById('qp-grand').textContent = `₹${fmt(d.grand)}`;

  const notesBox = document.getElementById('qp-notes-box');
  if (d.notes) {
    notesBox.style.display = 'block';
    document.getElementById('qp-notes').textContent = d.notes;
  } else {
    notesBox.style.display = 'none';
  }

  const logoImg = document.getElementById('quote-logo');
  if (logoImg) {
    if (companyLogoDataUrl) {
      logoImg.src = companyLogoDataUrl;
      logoImg.hidden = false;
      logoImg.removeAttribute('hidden');
      logoImg.style.display = 'inline-block';
    } else {
      logoImg.hidden = true;
      logoImg.setAttribute('hidden', 'hidden');
      logoImg.style.display = 'none';
    }
  }

  const tbody = document.getElementById('qp-items');
  tbody.innerHTML = '';
  if (!d.rows.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#666;padding:12px;font-size:12px">No items added</td></tr>';
    return;
  }
  d.rows.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><div>${escapeHtml(r.name || '-')}</div>${r.desc ? `<small class="idesc">${escapeHtml(r.desc)}</small>` : ''}</td><td>${escapeHtml(r.qty || 0)}</td><td>₹${fmt(r.unit)}</td><td>₹${fmt(r.amount)}</td>`;
    tbody.appendChild(tr);
  });

  applyQuoteTheme(d.template);
}

function resetQuote() {
  document.getElementById('quote-out').style.display = 'none';
  document.getElementById('quote-form').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function downloadQuotePDF() {
  if (!quoteData || !quoteData.number) {
    alert('Please generate quotation first.');
    return;
  }

  const customer = (quoteData.customerName || 'Customer').replace(/\s+/g, '_');
  await downloadPreviewAsPdf('quote-preview', `Quotation_${customer}_${quoteData.number}.pdf`, {
    scale: 2.6,
    margin: 4,
    waitMs: 200,
    backgroundColor: '#ffffff',
    imageType: 'JPEG'
  });
}

function shareQuoteWA() {
  if (!quoteData || !quoteData.number) {
    alert('Please generate quotation first.');
    return;
  }

  const itemLines = (quoteData.rows || [])
    .slice(0, 12)
    .map((r, idx) => `${idx + 1}. ${r.name} x${r.qty} @ ₹${Number(r.unit || 0).toLocaleString('en-IN')} = ₹${Number(r.amount || 0).toLocaleString('en-IN')}`)
    .join('\n');

  const msg = `*Quotation – ${quoteData.company}*\n\nQuotation #: ${quoteData.number}\nCustomer: ${quoteData.customerName || '-'}\nValid Till: ${quoteData.validTill ? new Date(quoteData.validTill).toLocaleDateString('en-IN') : '-'}\n\n*Items:*\n${itemLines || 'No items'}\n\nSub Total: ₹${Number(quoteData.sub || 0).toLocaleString('en-IN')}\nTax (${Number(quoteData.taxR || 0)}%): ₹${Number(quoteData.taxA || 0).toLocaleString('en-IN')}\n*Grand Total: ₹${Number(quoteData.grand || 0).toLocaleString('en-IN')}*\n\nNotes: ${quoteData.notes || '-'}\n\n_Generated via Insight Reports Co._`;
  window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
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
  
  // Handle logo conditionally
  const logoImg = document.getElementById('csr-logo');
  if (companyLogoDataUrl) {
    logoImg.src = companyLogoDataUrl;
    logoImg.hidden = false;
    logoImg.removeAttribute('hidden');
    logoImg.style.display = 'inline-block';
  } else {
    logoImg.hidden = true;
    logoImg.setAttribute('hidden', 'hidden');
    logoImg.style.display = 'none';
  }
  
  // Trigger Netflix-style animation
  playNetflixReportAnimation();
  
  applyReportTheme();
}

// Netflix-style report animation
function playNetflixReportAnimation() {
  const overlay = document.getElementById('netflix-animation');
  if (!overlay) return;
  
  overlay.classList.remove('active');
  void overlay.offsetWidth; // Trigger reflow to restart animation
  overlay.classList.add('active');
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

async function downloadPreviewAsPdf(elementId, fileName, options = {}) {
  if (!window.jspdf || !window.html2canvas) {
    alert('PDF tools are not loaded yet. Please refresh and try again.');
    return;
  }

  const el = document.getElementById(elementId);
  if (!el) {
    alert('Preview not found. Please regenerate and try again.');
    return;
  }

  const exportClass = options.exportClass || '';
  el.classList.add('pdf-export-active');
  if (exportClass) el.classList.add(exportClass);

  try {
    await new Promise((resolve) => setTimeout(resolve, options.waitMs ?? 120));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const canvas = await window.html2canvas(el, {
      scale: options.scale || 2.6,
      useCORS: true,
      backgroundColor: options.backgroundColor || '#ffffff'
    });

    const imageType = (options.imageType || 'PNG').toUpperCase();
    const imgData = imageType === 'JPEG'
      ? canvas.toDataURL('image/jpeg', 1.0)
      : canvas.toDataURL('image/png');
    const {jsPDF} = window.jspdf;
    const pdf = new jsPDF({unit:'mm', format:'a4', orientation:'portrait'});
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = options.margin ?? 6;
    const printW = pageW - margin * 2;
    const printH = pageH - margin * 2;
    const imgW = printW;
    const imgH = (canvas.height * imgW) / canvas.width;
    const fitScale = Math.min(1, printH / imgH);
    const finalW = imgW * fitScale;
    const finalH = imgH * fitScale;
    const x = (pageW - finalW) / 2;
    const y = (pageH - finalH) / 2;

    pdf.addImage(imgData, imageType, x, y, finalW, finalH, undefined, 'SLOW');
    pdf.save(fileName);
  } finally {
    el.classList.remove('pdf-export-active');
    if (exportClass) el.classList.remove(exportClass);
  }
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
    await downloadPreviewAsPdf('rpt-preview', `ServiceReport_${customer}_${date}.pdf`, {
      exportClass: 'pdf-export-compact',
      scale: 2.8,
      margin: 2,
      waitMs: 200,
    });
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
    await downloadPreviewAsPdf('bill-preview', `Invoice_${customer}_${date}.pdf`, {
      exportClass: 'pdf-export-compact-invoice',
      scale: 2.6,
      margin: 2,
      backgroundColor: '#ffffff',
      imageType: 'JPEG',
      waitMs: 250,
    });
  } catch (_err) {
    alert('Unable to download invoice PDF right now. Please try again.');
  }
}

// ─── WHATSAPP ───
function shareReportWA(){
  const d = reportData;
  if (!d || !d.co) {
    alert('Please generate a service report first.');
    return;
  }
  const msg = `*Service Report – ${d.co}*\n\n👤 Customer: ${d.cn || '-'}\n🔧 Device: ${d.dev || '-'}${d.brand ? ' (' + d.brand + ')' : ''}\n📅 Date: ${d.date ? new Date(d.date).toLocaleDateString('en-IN') : '-'}\n✅ Status: ${d.status || '-'}\n\n📝 Complaint:\n${d.complaint || '-'}\n\n🛠️ Work Performed:\n${d.workPerformed || d.work || '-'}\n\n_Generated via Insight Reports Co._`;
  window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
}
function shareBillWA(){
  const d = billData;
  if (!d || !d.bname) {
    alert('Please generate an invoice first.');
    return;
  }

  const invNum = document.getElementById('bo-invnum')?.textContent || '#INV';
  const itemLines = (d.rows || [])
    .slice(0, 15)
    .map((r, idx) => `${idx + 1}. ${r.name} x${r.qty} @ ₹${Number(r.rate || 0).toLocaleString('en-IN')} = ₹${Number(r.amount || 0).toLocaleString('en-IN')}`)
    .join('\n');

  const msg = `*Invoice – ${d.bname}*\n\n📄 ${invNum}\n👤 Customer: ${d.cname || '-'}\n📅 Date: ${d.date ? new Date(d.date).toLocaleDateString('en-IN') : '-'}\n\n*Items:*\n${itemLines || 'No items added'}\n\nSub Total: ₹${Number(d.sub || 0).toLocaleString('en-IN')}\nTax (${Number(d.gstR || 0)}%): ₹${Number(d.gstA || 0).toLocaleString('en-IN')}\n*Grand Total: ₹${Number(d.grand || 0).toLocaleString('en-IN')}*\n\n💳 Payment: ${d.pay || '-'}\n🏦 Details: ${d.payDetails || '-'}\n🌐 Website: ${d.bsite || '-'}\n📧 Email: ${d.bemail || '-'}\n📌 Terms: ${d.terms || '-'}\n\n_Generated via Insight Reports Co._`;
  window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
}
