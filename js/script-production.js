// ===============================
// Temp Mail Frontend Script
// ===============================

// Konfigurasi utama
const API_URL = "https://temp-mail-api.rayhanarditya88.workers.dev/api/inbox";
const CONNECTED_EMAIL = "lebaleuyi@gmail.com"; // akun Gmail yang sudah dihubungkan Worker

// Elemen UI
const tableBody = document.getElementById("email-list");
const refreshButton = document.getElementById("btn-refresh");

// Fungsi memuat email
async function loadEmails() {
  tableBody.innerHTML = `
    <tr>
      <td colspan="5" style="text-align:center;padding:10px;">⏳ Loading emails...</td>
    </tr>
  `;

  try {
    const response = await fetch(`${API_URL}?email=${encodeURIComponent(CONNECTED_EMAIL)}`);
    const data = await response.json();

    if (!data.messages || data.messages.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;padding:10px;">📭 Tidak ada email ditemukan</td>
        </tr>
      `;
      return;
    }

    // Reset tabel
    tableBody.innerHTML = "";

    // Render setiap pesan
    data.messages.forEach((msg, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td style="text-align:center;">${index + 1}</td>
        <td>${msg.from || "-"}</td>
        <td>${msg.subject || "(tanpa subjek)"}</td>
        <td>${msg.date || "-"}</td>
        <td>${msg.snippet || ""}</td>
      `;
      tableBody.appendChild(row);
    });

  } catch (error) {
    console.error("Gagal memuat email:", error);
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;color:red;padding:10px;">❌ Gagal memuat email. Periksa koneksi API Worker.</td>
      </tr>
    `;
  }
}

// Tombol refresh (opsional)
if (refreshButton) {
  refreshButton.addEventListener("click", loadEmails);
}

// Auto load saat halaman siap
document.addEventListener("DOMContentLoaded", loadEmails);
