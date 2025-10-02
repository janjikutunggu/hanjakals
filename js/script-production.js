/*
  Gmail Temp Mail Frontend Script
  Mengambil email dari Cloudflare Worker → Gmail API
  Author: @rayhanarditya88 - Oct 2025
*/

const API_URL = "https://temp-mail-api.rayhanarditya88.workers.dev/api/inbox";
const CONNECTED_EMAIL = "lebaleuyi@gmail.com";

const tbody = document.querySelector("#emails tbody");
const responsiveDiv = document.getElementById("emails-responsive");
const statusLed = document.getElementById("status-led");
const statusText = document.getElementById("status-text");
const loadingSpinner = document.getElementById("loading-spinner");
const errorMessage = document.getElementById("error-message");
const autoRefreshCheckbox = document.getElementById("auto-refresh");
const refreshIntervalSelect = document.getElementById("refresh-interval");

let refreshTimer = null;

// Fungsi utama: ambil email dari Worker
async function fetchEmails() {
  setStatus("loading");
  loadingSpinner.style.display = "block";
  errorMessage.classList.add("hidden");

  try {
    const res = await fetch(`${API_URL}?email=${encodeURIComponent(CONNECTED_EMAIL)}`);
    const data = await res.json();

    if (!res.ok || !data.messages) {
      throw new Error(data.error || "Gagal memuat data");
    }

    renderEmails(data.messages);
    setStatus("online");
  } catch (err) {
    console.error("Gagal memuat email:", err);
    setStatus("offline");
    showError(err.message);
  } finally {
    loadingSpinner.style.display = "none";
  }
}

// Render daftar email ke tabel dan tampilan mobile
function renderEmails(messages) {
  tbody.innerHTML = "";
  responsiveDiv.innerHTML = "";

  if (messages.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">📭 Tidak ada email ditemukan</td></tr>`;
    return;
  }

  messages.forEach((msg, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${msg.from || "-"}</td>
      <td>${msg.subject || "(tanpa subjek)"}</td>
      <td>${msg.date || "-"}</td>
      <td><button onclick="alert('ID: ${msg.id}\\nSubject: ${msg.subject}')">📩 Detail</button></td>
    `;
    tbody.appendChild(tr);

    // Responsive view (mobile)
    const block = document.createElement("div");
    block.className = "email-card";
    block.innerHTML = `
      <p><strong>From:</strong> ${msg.from || "-"}</p>
      <p><strong>Subject:</strong> ${msg.subject || "(tanpa subjek)"}</p>
      <p><strong>Date:</strong> ${msg.date || "-"}</p>
      <p><strong>Snippet:</strong> ${msg.snippet || ""}</p>
      <hr/>
    `;
    responsiveDiv.appendChild(block);
  });
}

// Ubah status LED
function setStatus(state) {
  statusLed.classList.remove("offline", "online", "loading");
  if (state === "online") {
    statusLed.classList.add("online");
    statusText.textContent = "Online";
  } else if (state === "loading") {
    statusLed.classList.add("loading");
    statusText.textContent = "Loading...";
  } else {
    statusLed.classList.add("offline");
    statusText.textContent = "Offline";
  }
}

// Tampilkan pesan error
function showError(msg) {
  errorMessage.textContent = `❌ ${msg}`;
  errorMessage.classList.remove("hidden");
}

// Tombol manual
function refreshMail() {
  fetchEmails();
}

// Auto refresh
function setupAutoRefresh() {
  clearInterval(refreshTimer);
  if (autoRefreshCheckbox.checked) {
    const seconds = parseInt(refreshIntervalSelect.value);
    refreshTimer = setInterval(fetchEmails, seconds * 1000);
  }
}

// Generate alamat email baru (dummy untuk demo)
function genEmail() {
  const randomName = Math.random().toString(36).substring(2, 10);
  const subdomain = document.getElementById("subdomain").value.trim();
  const domain = subdomain ? `${subdomain}.netapp.my.id` : "netapp.my.id";
  const newEmail = `${randomName}@${domain}`;
  document.getElementById("addr").value = newEmail;
  confetti();
}

// Copy email
function copyEmail() {
  const emailField = document.getElementById("addr");
  navigator.clipboard.writeText(emailField.value);
  alert(`📋 Email disalin: ${emailField.value}`);
}

// Inisialisasi
document.addEventListener("DOMContentLoaded", () => {
  fetchEmails();
  autoRefreshCheckbox.addEventListener("change", setupAutoRefresh);
  refreshIntervalSelect.addEventListener("change", setupAutoRefresh);
});
