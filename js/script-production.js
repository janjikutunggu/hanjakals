// script-production.js
const API_BASE = "https://temp-mail-api.rayhanarditya88.workers.dev/api";
const emailInput = document.getElementById("addr");
const subdomainInput = document.getElementById("subdomain");
const tableBody = document.querySelector("#emails tbody");
const statusText = document.getElementById("status-text");
const statusLed = document.getElementById("status-led");
const errorMessage = document.getElementById("error-message");
const spinner = document.getElementById("loading-spinner");

let currentEmail = "";

async function genEmail() {
  const random = Math.random().toString(36).substring(2, 10);
  const sub = subdomainInput.value.trim();
  currentEmail = sub
    ? `${random}@${sub}.netapp.my.id`
    : `${random}@netapp.my.id`;
  emailInput.value = currentEmail;
  await refreshMail();
}

async function refreshMail() {
  if (!currentEmail) {
    errorMessage.textContent = "Generate email terlebih dahulu.";
    errorMessage.classList.remove("hidden");
    return;
  }

  spinner.style.display = "block";
  errorMessage.classList.add("hidden");
  statusLed.className = "status-led offline";
  statusText.textContent = "Loading...";

  try {
    const res = await fetch(`${API_BASE}/inbox?email=${encodeURIComponent(currentEmail)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    tableBody.innerHTML = "";

    if (data.messages && data.messages.length > 0) {
      data.messages.forEach((msg, i) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${i + 1}</td>
          <td>${msg.from || "-"}</td>
          <td>${msg.subject || "(No Subject)"}</td>
          <td>${msg.date || "-"}</td>
          <td><button onclick="viewMail('${msg.id}')">Open</button></td>
        `;
        tableBody.appendChild(tr);
      });
      statusText.textContent = "Online";
      statusLed.className = "status-led online";
    } else {
      statusText.textContent = "No Emails";
      statusLed.className = "status-led warning";
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Belum ada email</td></tr>`;
    }
  } catch (e) {
    console.error(e);
    errorMessage.textContent = `Failed to fetch: ${e.message}`;
    errorMessage.classList.remove("hidden");
    statusText.textContent = "Offline";
    statusLed.className = "status-led offline";
  } finally {
    spinner.style.display = "none";
  }
}

async function viewMail(id) {
  try {
    const res = await fetch(`${API_BASE}/message?id=${id}&email=${encodeURIComponent(currentEmail)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const body = data.body || "(Tidak ada isi)";
    alert(`Dari: ${data.from}\nSubjek: ${data.subject}\n\n${body}`);
  } catch (e) {
    alert("Gagal membuka email: " + e.message);
  }
}

function copyEmail() {
  if (!currentEmail) return;
  navigator.clipboard.writeText(currentEmail);
  alert(`📋 ${currentEmail} disalin`);
}

document.addEventListener("DOMContentLoaded", () => {
  genEmail();
});
