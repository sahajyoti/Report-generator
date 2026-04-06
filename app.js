const STORAGE_KEYS = {
  customers: "fieldpro_customers",
  reports: "fieldpro_reports",
};

let customers = load(STORAGE_KEYS.customers, []);
let reports = load(STORAGE_KEYS.reports, []);
let currentStep = 1;
let drawing = false;
let lastSignatureData = "";

const invoicePrefix = "INV-";
const todayIso = () => new Date().toISOString();
const formatDate = (iso) => new Date(iso).toLocaleString("en-IN");

const el = {
  todayCount: document.getElementById("todayCount"),
  customerCount: document.getElementById("customerCount"),
  invoiceCount: document.getElementById("invoiceCount"),
  newReportBtn: document.getElementById("newReportBtn"),
  newReportTopBtn: document.getElementById("newReportTopBtn"),
  historyBtn: document.getElementById("historyBtn"),
  wizardSection: document.getElementById("wizardSection"),
  previewSection: document.getElementById("previewSection"),
  historySection: document.getElementById("historySection"),
  stepLabel: document.getElementById("stepLabel"),
  steps: document.querySelectorAll(".step"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  customerSelect: document.getElementById("customerSelect"),
  customerName: document.getElementById("customerName"),
  customerPhone: document.getElementById("customerPhone"),
  customerAddress: document.getElementById("customerAddress"),
  serviceType: document.getElementById("serviceType"),
  problem: document.getElementById("problem"),
  workDone: document.getElementById("workDone"),
  technicianName: document.getElementById("technicianName"),
  partsList: document.getElementById("partsList"),
  addPartBtn: document.getElementById("addPartBtn"),
  serviceCharge: document.getElementById("serviceCharge"),
  notes: document.getElementById("notes"),
  gstEnabled: document.getElementById("gstEnabled"),
  gstPercent: document.getElementById("gstPercent"),
  subtotal: document.getElementById("subtotal"),
  gstAmount: document.getElementById("gstAmount"),
  totalAmount: document.getElementById("totalAmount"),
  signaturePad: document.getElementById("signaturePad"),
  clearSignBtn: document.getElementById("clearSignBtn"),
  saveReportBtn: document.getElementById("saveReportBtn"),
  pdfContent: document.getElementById("pdfContent"),
  downloadPdfBtn: document.getElementById("downloadPdfBtn"),
  shareWaBtn: document.getElementById("shareWaBtn"),
  searchHistory: document.getElementById("searchHistory"),
  historyList: document.getElementById("historyList"),
};

function init() {
  bindEvents();
  addPartRow();
  renderCustomerSelect();
  renderDashboard();
  renderHistory();
  resizeCanvas();
}

function bindEvents() {
  el.newReportBtn.addEventListener("click", openWizard);
  el.newReportTopBtn.addEventListener("click", openWizard);
  el.historyBtn.addEventListener("click", () => {
    el.historySection.classList.toggle("hidden");
    renderHistory(el.searchHistory.value);
  });

  el.prevBtn.addEventListener("click", () => moveStep(-1));
  el.nextBtn.addEventListener("click", () => moveStep(1));
  el.addPartBtn.addEventListener("click", addPartRow);

  el.partsList.addEventListener("input", updateTotals);
  el.partsList.addEventListener("click", (event) => {
    if (event.target.matches(".remove-part")) {
      event.target.closest(".part-row").remove();
      updateTotals();
    }
  });

  el.serviceCharge.addEventListener("input", updateTotals);
  el.gstEnabled.addEventListener("change", updateTotals);
  el.gstPercent.addEventListener("input", updateTotals);

  el.customerSelect.addEventListener("change", () => {
    const customer = customers.find((c) => c.id === el.customerSelect.value);
    if (!customer) return;
    el.customerName.value = customer.name;
    el.customerPhone.value = customer.phone;
    el.customerAddress.value = customer.address || "";
  });

  initSignaturePad();
  el.clearSignBtn.addEventListener("click", clearSignature);
  el.saveReportBtn.addEventListener("click", saveReport);
  el.downloadPdfBtn.addEventListener("click", downloadPdf);
  el.shareWaBtn.addEventListener("click", shareWhatsApp);
  el.searchHistory.addEventListener("input", (e) => renderHistory(e.target.value));

  window.addEventListener("resize", resizeCanvas);
}

function openWizard() {
  el.wizardSection.classList.remove("hidden");
  el.previewSection.classList.add("hidden");
  currentStep = 1;
  updateStepUI();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function moveStep(delta) {
  if (delta > 0 && !validateStep(currentStep)) return;
  currentStep = Math.min(5, Math.max(1, currentStep + delta));
  updateStepUI();
  if (currentStep === 4) updateTotals();
}

function updateStepUI() {
  el.steps.forEach((node) => {
    node.classList.toggle("hidden", Number(node.dataset.step) !== currentStep);
  });
  el.stepLabel.textContent = `Step ${currentStep} of 5`;
  el.prevBtn.style.visibility = currentStep === 1 ? "hidden" : "visible";
  el.nextBtn.style.display = currentStep === 5 ? "none" : "inline-block";
}

function validateStep(step) {
  if (step === 1) {
    if (!el.customerName.value.trim() || !el.customerPhone.value.trim()) {
      alert("Please add customer name and phone number.");
      return false;
    }
  }
  if (step === 2) {
    if (!el.problem.value.trim() || !el.workDone.value.trim()) {
      alert("Please add problem and work done.");
      return false;
    }
  }
  if (step === 3 && !el.serviceCharge.value) {
    alert("Please add service charge.");
    return false;
  }
  return true;
}

function addPartRow() {
  const row = document.createElement("div");
  row.className = "part-row";
  row.innerHTML = `
    <input type="text" class="part-name" placeholder="Part name" />
    <input type="number" class="part-qty" min="1" value="1" />
    <input type="number" class="part-rate" min="0" placeholder="Rate" />
    <button type="button" class="icon-btn remove-part" aria-label="Remove">X</button>
  `;
  el.partsList.appendChild(row);
}

function readParts() {
  return [...document.querySelectorAll(".part-row")]
    .map((row) => {
      const part = row.querySelector(".part-name").value.trim();
      const qty = Number(row.querySelector(".part-qty").value || 0);
      const rate = Number(row.querySelector(".part-rate").value || 0);
      return { part, qty, rate, amount: qty * rate };
    })
    .filter((item) => item.part && item.qty > 0);
}

function updateTotals() {
  const parts = readParts();
  const partsTotal = parts.reduce((acc, part) => acc + part.amount, 0);
  const service = Number(el.serviceCharge.value || 0);
  const subtotal = partsTotal + service;
  const gst = el.gstEnabled.checked ? (subtotal * Number(el.gstPercent.value || 0)) / 100 : 0;
  const total = subtotal + gst;

  el.subtotal.textContent = money(subtotal);
  el.gstAmount.textContent = money(gst);
  el.totalAmount.textContent = money(total);
}

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function initSignaturePad() {
  const canvas = el.signaturePad;
  const ctx = canvas.getContext("2d");
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#1f2937";

  const getPos = (event) => {
    const rect = canvas.getBoundingClientRect();
    if (event.touches && event.touches[0]) {
      return {
        x: event.touches[0].clientX - rect.left,
        y: event.touches[0].clientY - rect.top,
      };
    }
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event) => {
    drawing = true;
    const { x, y } = getPos(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    event.preventDefault();
  };

  const draw = (event) => {
    if (!drawing) return;
    const { x, y } = getPos(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    event.preventDefault();
  };

  const end = () => {
    drawing = false;
    lastSignatureData = canvas.toDataURL("image/png");
  };

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", draw);
  window.addEventListener("mouseup", end);

  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", draw, { passive: false });
  window.addEventListener("touchend", end);
}

function resizeCanvas() {
  const canvas = el.signaturePad;
  const data = canvas.toDataURL();
  const tempImg = new Image();

  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = 180 * devicePixelRatio;
  const ctx = canvas.getContext("2d");
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#1f2937";

  tempImg.onload = () => {
    ctx.drawImage(tempImg, 0, 0, rect.width, 180);
  };
  tempImg.src = data;
}

function clearSignature() {
  const canvas = el.signaturePad;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  lastSignatureData = "";
}

function upsertCustomer() {
  const name = el.customerName.value.trim();
  const phone = el.customerPhone.value.trim();
  const address = el.customerAddress.value.trim();
  let customer = customers.find((c) => c.phone === phone);

  if (customer) {
    customer.name = name;
    customer.address = address;
  } else {
    customer = { id: crypto.randomUUID(), name, phone, address, createdAt: todayIso() };
    customers.unshift(customer);
  }

  persist(STORAGE_KEYS.customers, customers);
  return customer;
}

function saveReport() {
  if (!validateStep(1) || !validateStep(2) || !validateStep(3)) return;

  const customer = upsertCustomer();
  const parts = readParts();
  const serviceCharge = Number(el.serviceCharge.value || 0);
  const subtotal = serviceCharge + parts.reduce((sum, p) => sum + p.amount, 0);
  const gstPercent = el.gstEnabled.checked ? Number(el.gstPercent.value || 0) : 0;
  const gstAmount = (subtotal * gstPercent) / 100;
  const total = subtotal + gstAmount;
  const createdAt = todayIso();

  const report = {
    id: crypto.randomUUID(),
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    customerAddress: customer.address,
    serviceType: el.serviceType.value,
    problem: el.problem.value.trim(),
    workDone: el.workDone.value.trim(),
    technicianName: el.technicianName.value.trim() || "Technician",
    parts,
    notes: el.notes.value.trim(),
    serviceCharge,
    gstPercent,
    gstAmount,
    subtotal,
    total,
    signature: lastSignatureData,
    invoiceNumber: `${invoicePrefix}${Date.now().toString().slice(-6)}`,
    createdAt,
  };

  reports.unshift(report);
  persist(STORAGE_KEYS.reports, reports);

  renderCustomerSelect();
  renderDashboard();
  renderHistory();
  buildPreview(report);

  el.previewSection.classList.remove("hidden");
  el.historySection.classList.remove("hidden");
  alert("Report saved successfully.");
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

function buildPreview(report) {
  const partRows = report.parts.length
    ? report.parts
        .map(
          (p) =>
            `<tr><td>${escapeHtml(p.part)}</td><td>${p.qty}</td><td>${money(p.rate)}</td><td>${money(
              p.amount
            )}</td></tr>`
        )
        .join("")
    : `<tr><td colspan="4">No parts used</td></tr>`;

  el.pdfContent.innerHTML = `
    <div class="pdf-head">
      <div>
        <h2 style="margin:0">Service Report & Invoice</h2>
        <p style="margin:4px 0;color:#555">FieldPro Reports</p>
      </div>
      <div>
        <p style="margin:0"><strong>Invoice:</strong> ${report.invoiceNumber}</p>
        <p style="margin:4px 0"><strong>Date:</strong> ${formatDate(report.createdAt)}</p>
      </div>
    </div>

    <div class="pdf-grid">
      <div>
        <h4>Customer Details</h4>
        <p><strong>${escapeHtml(report.customerName)}</strong></p>
        <p>${escapeHtml(report.customerPhone)}</p>
        <p>${escapeHtml(report.customerAddress || "-")}</p>
      </div>
      <div>
        <h4>Service Details</h4>
        <p><strong>Type:</strong> ${escapeHtml(report.serviceType)}</p>
        <p><strong>Technician:</strong> ${escapeHtml(report.technicianName)}</p>
      </div>
    </div>

    <div class="pdf-section">
      <h4>Issue & Work Done</h4>
      <p><strong>Problem:</strong> ${escapeHtml(report.problem)}</p>
      <p><strong>Work Done:</strong> ${escapeHtml(report.workDone)}</p>
      <p><strong>Notes:</strong> ${escapeHtml(report.notes || "-")}</p>
    </div>

    <div class="pdf-section">
      <h4>Parts Used</h4>
      <table class="pdf-table">
        <thead>
          <tr><th>Part</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
        </thead>
        <tbody>${partRows}</tbody>
      </table>
    </div>

    <div class="pdf-section">
      <table class="pdf-table">
        <tbody>
          <tr><td>Service Charge</td><td>${money(report.serviceCharge)}</td></tr>
          <tr><td>Subtotal</td><td>${money(report.subtotal)}</td></tr>
          <tr><td>GST (${report.gstPercent}%)</td><td>${money(report.gstAmount)}</td></tr>
          <tr><td><strong>Total</strong></td><td><strong>${money(report.total)}</strong></td></tr>
        </tbody>
      </table>
    </div>

    <div class="pdf-grid pdf-section">
      <div>
        <p><strong>Customer Signature</strong></p>
        ${
          report.signature
            ? `<img src="${report.signature}" alt="Signature" class="pdf-signature" />`
            : `<p>Not signed</p>`
        }
      </div>
      <div>
        <p><strong>Status:</strong> Generated</p>
        <p><strong>Contact:</strong> ${escapeHtml(report.customerPhone)}</p>
      </div>
    </div>
  `;
}

function renderCustomerSelect() {
  const options = customers
    .map((c) => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.phone)})</option>`)
    .join("");
  el.customerSelect.innerHTML = `<option value="">Select customer</option>${options}`;
}

function renderDashboard() {
  const today = new Date().toDateString();
  const todayReports = reports.filter((r) => new Date(r.createdAt).toDateString() === today).length;

  el.todayCount.textContent = todayReports;
  el.customerCount.textContent = customers.length;
  el.invoiceCount.textContent = reports.length;
}

function renderHistory(search = "") {
  const query = search.trim().toLowerCase();
  const filtered = reports.filter((r) => {
    if (!query) return true;
    return (
      r.customerName.toLowerCase().includes(query) ||
      r.customerPhone.toLowerCase().includes(query) ||
      r.invoiceNumber.toLowerCase().includes(query)
    );
  });

  if (!filtered.length) {
    el.historyList.innerHTML = `<p class="muted">No reports found.</p>`;
    return;
  }

  el.historyList.innerHTML = filtered
    .map(
      (r) => `
      <article class="history-item">
        <p><strong>${escapeHtml(r.customerName)}</strong> (${escapeHtml(r.customerPhone)})</p>
        <p>${escapeHtml(r.serviceType)} | ${money(r.total)} | ${formatDate(r.createdAt)}</p>
        <div class="button-row">
          <button class="btn btn-secondary" data-view="${r.id}">View</button>
          <button class="btn btn-ghost" data-wa="${r.id}">WhatsApp</button>
        </div>
      </article>
    `
    )
    .join("");

  el.historyList.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const report = reports.find((r) => r.id === btn.dataset.view);
      if (!report) return;
      buildPreview(report);
      el.previewSection.classList.remove("hidden");
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    });
  });

  el.historyList.querySelectorAll("[data-wa]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const report = reports.find((r) => r.id === btn.dataset.wa);
      if (!report) return;
      shareWhatsApp(report);
    });
  });
}

function downloadPdf() {
  const node = el.pdfContent;
  if (!node.innerHTML.trim()) {
    alert("Please generate a report first.");
    return;
  }

  if (!window.html2pdf) {
    window.print();
    return;
  }

  const originalText = el.downloadPdfBtn.textContent;
  el.downloadPdfBtn.disabled = true;
  el.downloadPdfBtn.textContent = "Generating...";
  node.classList.add("pdf-export-compact");

  const options = {
    margin: [4, 4, 4, 4],
    filename: `report-${Date.now()}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
    pagebreak: { mode: ["avoid-all", "css", "legacy"] },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  };

  window
    .html2pdf()
    .set(options)
    .from(node)
    .save()
    .catch((error) => {
      console.error("PDF generation failed", error);
      alert("Unable to generate PDF. Using print instead.");
      window.print();
    })
    .finally(() => {
      node.classList.remove("pdf-export-compact");
      el.downloadPdfBtn.disabled = false;
      el.downloadPdfBtn.textContent = originalText;
    });
}

function shareWhatsApp(reportInput) {
  let report = reportInput;
  if (!report) {
    report = reports[0];
  }

  if (!report) {
    alert("Please create at least one report first.");
    return;
  }

  const msg = `Service Report Ready%0AInvoice: ${report.invoiceNumber}%0ACustomer: ${encodeURIComponent(
    report.customerName
  )}%0ATotal: ${encodeURIComponent(money(report.total))}%0AThank you.`;

  const url = `https://wa.me/?text=${msg}`;
  window.open(url, "_blank");
}

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function persist(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

init();
