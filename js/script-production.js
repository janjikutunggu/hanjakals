/**
 * Gmail Temp Mail Frontend Script - Production Version
 * Mengintegrasikan dengan Cloudflare Worker untuk Gmail API
 */

// Konfigurasi Production
const CONFIG = {
    // GANTI dengan URL Cloudflare Worker Anda atau gunakan mock untuk demo
    WORKER_URL: 'https://temp-mail-api.rayhanarditya88.workers.dev', // Untuk production
    // Atau gunakan mock server untuk demo:
    // WORKER_URL: 'https://gmail-temp-mail-mock-api.your-domain.com',
    
    DOMAINS: ['netapp.my.id'],
    AUTO_REFRESH_INTERVAL: 30000, // 30 detik
    EMAIL_STORAGE_KEY: 'temp_mail_current_email',
    SUBDOMAIN_STORAGE_KEY: 'temp_mail_subdomain'
};

// Auto-detect environment dan fallback ke mock jika worker tidak tersedia
const MOCK_MODE = CONFIG.WORKER_URL.includes('your-worker') || CONFIG.WORKER_URL.includes('your-subdomain');

// Debug logging
console.log('🔧 Configuration loaded:');
console.log('   WORKER_URL:', CONFIG.WORKER_URL);
console.log('   MOCK_MODE:', MOCK_MODE);
console.log('   DOMAINS:', CONFIG.DOMAINS);

// State management
let currentEmail = '';
let autoRefreshTimer = null;
let isLoading = false;

// DOM Elements
const elements = {
    emailInput: document.getElementById('addr'),
    subdomainInput: null, // Akan dibuat dinamis
    loadMailButton: null,
    newAddressButton: null,
    emailTable: document.getElementById('emails').querySelector('tbody'),
    loadingSpinner: document.getElementById('loading-spinner'),
    errorMessage: document.getElementById('error-message'),
    autoRefreshCheckbox: document.getElementById('auto-refresh'),
    refreshIntervalSelect: document.getElementById('refresh-interval'),
    emailSearch: document.getElementById('email-search'),
    statusLed: document.getElementById('status-led'),
    statusText: document.getElementById('status-text')
};

/**
 * Utility Functions
 */
function generateRandomString(length = 10) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function showNotification(message, type = 'success') {
    if (!elements.errorMessage) return;
    
    elements.errorMessage.textContent = message;
    elements.errorMessage.classList.remove('hidden');
    elements.errorMessage.style.backgroundColor = type === 'success' ? '#DEF7EC' : '#FEE2E2';
    elements.errorMessage.style.color = type === 'success' ? '#03543F' : '#DC2626';
    
    setTimeout(() => {
        elements.errorMessage.classList.add('hidden');
    }, 3000);
}

function setLoadingState(loading) {
    isLoading = loading;
    if (elements.loadingSpinner) {
        elements.loadingSpinner.style.display = loading ? 'block' : 'none';
    }
    
    if (elements.loadMailButton) {
        elements.loadMailButton.disabled = loading;
        elements.loadMailButton.innerHTML = loading ? 
            '<i class="fa-solid fa-spinner fa-spin"></i> Loading...' : 
            '<i class="fa-solid fa-rotate"></i> Load Mail';
    }
}

function updateStatus(online = false) {
    if (elements.statusLed && elements.statusText) {
        elements.statusLed.classList.toggle('offline', !online);
        elements.statusText.textContent = online ? 'Online' : 'Offline';
    }
}

/**
 * Email Generation
 */
function generateEmailAddress() {
    // Cek apakah menggunakan custom email atau random
    const customTab = document.getElementById('custom-tab');
    const isCustomMode = customTab && customTab.classList.contains('active');
    
    if (isCustomMode) {
        return generateCustomEmail();
    } else {
        return generateRandomEmail();
    }
}

function generateRandomEmail() {
    const subdomainInput = document.getElementById('subdomain');
    const subdomain = subdomainInput ? subdomainInput.value.trim() : '';
    const randomPart = generateRandomString(12);
    
    let domain = CONFIG.DOMAINS[0]; // netapp.my.id
    
    if (subdomain) {
        // Validasi subdomain (hanya huruf, angka, dan dash)
        if (!/^[a-z0-9-]+$/.test(subdomain)) {
            showNotification('Subdomain hanya boleh mengandung huruf, angka, dan dash', 'error');
            return null;
        }
        domain = `${subdomain}.${domain}`;
    }
    
    const email = `${randomPart}@${domain}`;
    
    // Simpan ke localStorage
    localStorage.setItem(CONFIG.EMAIL_STORAGE_KEY, email);
    if (subdomain) {
        localStorage.setItem(CONFIG.SUBDOMAIN_STORAGE_KEY, subdomain);
    }
    
    return email;
}

function generateCustomEmail() {
    const customUsernameInput = document.getElementById('custom-username');
    const customSubdomainInput = document.getElementById('custom-subdomain');
    
    const username = customUsernameInput ? customUsernameInput.value.trim() : '';
    const subdomain = customSubdomainInput ? customSubdomainInput.value.trim() : '';
    
    if (!username) {
        showNotification('Masukkan username yang diinginkan', 'error');
        return null;
    }
    
    // Validasi username (hanya huruf, angka, dot, dan dash)
    if (!/^[a-z0-9.-]+$/.test(username)) {
        showNotification('Username hanya boleh mengandung huruf, angka, titik, dan dash', 'error');
        return null;
    }
    
    // Validasi panjang username
    if (username.length < 3 || username.length > 20) {
        showNotification('Username harus antara 3-20 karakter', 'error');
        return null;
    }
    
    let domain = CONFIG.DOMAINS[0]; // netapp.my.id
    
    if (subdomain) {
        // Validasi subdomain (hanya huruf, angka, dan dash)
        if (!/^[a-z0-9-]+$/.test(subdomain)) {
            showNotification('Subdomain hanya boleh mengandung huruf, angka, dan dash', 'error');
            return null;
        }
        domain = `${subdomain}.${domain}`;
    }
    
    const email = `${username}@${domain}`;
    
    // Simpan ke localStorage
    localStorage.setItem(CONFIG.EMAIL_STORAGE_KEY, email);
    localStorage.setItem('temp_mail_custom_username', username);
    if (subdomain) {
        localStorage.setItem(CONFIG.SUBDOMAIN_STORAGE_KEY, subdomain);
    }
    
    return email;
}

function setCurrentEmail(email) {
    currentEmail = email;
    if (elements.emailInput) {
        elements.emailInput.value = email;
    }
}

/**
 * API Communication dengan Fallback ke Mock
 */
async function fetchInbox(email) {
    if (!email) {
        throw new Error('Email address is required');
    }

    // Jika MOCK_MODE atau worker belum disetup, gunakan mock data
    if (MOCK_MODE) {
        return getMockInboxData(email);
    }

    const url = `${CONFIG.WORKER_URL}/api/inbox?email=${encodeURIComponent(email)}`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }

        // Adaptasi format response API
        if (data.messages && Array.isArray(data.messages)) {
            console.log(`📬 Found ${data.messages.length} messages, fetching details...`);
            
            // Ambil detail email untuk setiap message
            const emailPromises = data.messages.map(async (msg) => {
                try {
                    const emailDetail = await fetchEmailDetails(msg.id);
                    return emailDetail;
                } catch (err) {
                    console.warn(`Gagal mengambil detail email ${msg.id}:`, err);
                    // Return basic info if detail fetch fails
                    return {
                        id: msg.id,
                        from: 'Unknown Sender',
                        subject: 'Unable to load details',
                        date: new Date().toISOString(),
                        snippet: 'Email details unavailable',
                        timestamp: Date.now()
                    };
                }
            });
            
            const emails = await Promise.all(emailPromises);
            const validEmails = emails.filter(email => email !== null);
            console.log(`✅ Successfully processed ${validEmails.length} emails`);
            
            return {
                success: true,
                email: email,
                count: validEmails.length,
                emails: validEmails,
                timestamp: new Date().toISOString(),
                mode: 'production'
            };
        }

        return data;
    } catch (error) {
        console.warn('Worker tidak tersedia, menggunakan mock data:', error.message);
        return getMockInboxData(email);
    }
}

async function fetchEmailDetails(messageId) {
    if (MOCK_MODE) {
        return getMockEmailDetails(messageId);
    }

    const url = `${CONFIG.WORKER_URL}/api/email/${messageId}`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }

        // Konversi response API ke format yang diharapkan UI
        const message = data.message || data;
        
        // Extract header information
        const headers = message.payload?.headers || [];
        const getHeader = (name) => {
            const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
            return header ? header.value : '';
        };
        
        // Format untuk tampilan list email
        return {
            id: messageId,
            from: getHeader('From') || 'Unknown Sender',
            subject: getHeader('Subject') || 'No Subject',
            date: getHeader('Date') || new Date().toISOString(),
            snippet: message.snippet || 'No preview available',
            timestamp: Date.now(),
            payload: message.payload // Simpan payload untuk modal detail
        };
    } catch (error) {
        console.warn('Worker tidak tersedia, menggunakan mock data:', error.message);
        return getMockEmailDetails(messageId);
    }
}

/**
 * Mock Data untuk Demo/Fallback
 */
function getMockInboxData(email) {
    const mockEmails = [
        {
            id: 'mock1',
            from: 'welcome@netapp.my.id',
            subject: 'Selamat datang di Gmail Temp Mail!',
            date: new Date().toISOString(),
            snippet: 'Terima kasih telah menggunakan layanan Gmail Temp Mail. Fitur ini menggunakan mock data untuk demo.',
            timestamp: Date.now()
        },
        {
            id: 'mock2', 
            from: 'noreply@github.com',
            subject: 'Repository siap digunakan',
            date: new Date(Date.now() - 3600000).toISOString(),
            snippet: 'Selamat! Repository Gmail Temp Mail Anda telah berhasil dibuat dan siap untuk deployment.',
            timestamp: Date.now() - 3600000
        },
        {
            id: 'mock3',
            from: 'support@cloudflare.com', 
            subject: 'Worker deployment berhasil',
            date: new Date(Date.now() - 7200000).toISOString(),
            snippet: 'Cloudflare Worker Anda telah berhasil di-deploy dan sekarang aktif untuk Gmail API integration.',
            timestamp: Date.now() - 7200000
        }
    ];

    return {
        success: true,
        email: email,
        count: mockEmails.length,
        emails: mockEmails,
        timestamp: new Date().toISOString(),
        mode: 'mock',
        note: 'Ini adalah mock data untuk demo. Setup Cloudflare Worker untuk data Gmail yang sesungguhnya.'
    };
}

function getMockEmailDetails(messageId) {
    return {
        id: messageId,
        payload: {
            headers: [
                { name: 'From', value: 'demo@netapp.my.id' },
                { name: 'To', value: currentEmail || 'random123@netapp.my.id' },
                { name: 'Subject', value: 'Detail Email Demo' },
                { name: 'Date', value: new Date().toISOString() }
            ]
        },
        snippet: 'Ini adalah tampilan detail email dalam mode demo. Untuk melihat email Gmail yang sesungguhnya, deploy Cloudflare Worker dan setup Gmail API sesuai panduan di README-GMAIL.md.'
    };
}

/**
 * UI Updates
 */
function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleString('id-ID', {
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return dateString;
    }
}

function updateEmailTable(emails) {
    if (!elements.emailTable) return;

    elements.emailTable.innerHTML = '';

    if (!emails || emails.length === 0) {
        const row = elements.emailTable.insertRow();
        row.innerHTML = `
            <td colspan="5" style="text-align: center; padding: 20px; color: #6B7280;">
                <i class="fa-solid fa-inbox"></i><br>
                Tidak ada email ditemukan<br>
                <small>Kirim email ke alamat di atas untuk melihat pesan masuk</small>
            </td>
        `;
        return;
    }

    emails.forEach((email, index) => {
        const row = elements.emailTable.insertRow();
        row.innerHTML = `
            <td>${index + 1}</td>
            <td title="${email.from}">${email.from.length > 30 ? email.from.substring(0, 30) + '...' : email.from}</td>
            <td title="${email.subject}">${email.subject.length > 50 ? email.subject.substring(0, 50) + '...' : email.subject}</td>
            <td>${formatDate(email.date)}</td>
            <td>
                <button onclick="viewEmail('${email.id}')" class="icon-button" title="Lihat email">
                    <i class="fa-solid fa-eye"></i>
                </button>
            </td>
        `;
    });
}

/**
 * Main Functions
 */
async function loadMail() {
    if (!currentEmail) {
        showNotification('Buat alamat email terlebih dahulu', 'error');
        return;
    }

    setLoadingState(true);
    
    try {
        console.log('🔄 Loading mail for:', currentEmail);
        const data = await fetchInbox(currentEmail);
        console.log('📧 Response data:', data);
        
        updateEmailTable(data.emails);
        updateStatus(true);
        
        const message = data.mode === 'mock' ? 
            `${data.count} email demo ditampilkan (Mode: Demo)` : 
            `${data.count} email ditemukan`;
        showNotification(message, 'success');
        
        // Tampilkan info jika dalam mode demo
        if (data.mode === 'mock') {
            console.log('📧 Mode Demo Aktif - Gunakan mock data');
            console.log('🔧 Untuk data Gmail real, setup Cloudflare Worker sesuai README-GMAIL.md');
        } else {
            console.log('✅ Production mode - menggunakan API real');
        }
    } catch (error) {
        console.error('Error loading mail:', error);
        showNotification(`Gagal memuat email: ${error.message}`, 'error');
        updateStatus(false);
    } finally {
        setLoadingState(false);
    }
}

function newAddress() {
    const email = generateEmailAddress();
    if (email) {
        setCurrentEmail(email);
        
        // Determine notification message based on mode
        const customTab = document.getElementById('custom-tab');
        const isCustomMode = customTab && customTab.classList.contains('active');
        const message = isCustomMode ? 
            `Email custom berhasil dibuat: ${email}` : 
            `Email acak berhasil dibuat: ${email}`;
            
        showNotification(message, 'success');
        
        // Konfetti animation
        if (typeof confetti !== 'undefined') {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: isCustomMode ? ['#10B981', '#34D399', '#6EE7B7'] : ['#3B82F6', '#60A5FA', '#93C5FD']
            });
        }
        
        // Auto load mail untuk email baru
        setTimeout(() => {
            loadMail();
        }, 1000);
    }
}

async function viewEmail(messageId) {
    try {
        setLoadingState(true);
        const emailData = await fetchEmailDetails(messageId);
        
        showEmailModal(emailData);
        
    } catch (error) {
        console.error('Error viewing email:', error);
        showNotification(`Gagal membuka email: ${error.message}`, 'error');
    } finally {
        setLoadingState(false);
    }
}

function showEmailModal(emailData) {
    // Hapus modal yang ada jika ada
    const existingModal = document.getElementById('email-modal');
    if (existingModal) {
        existingModal.remove();
    }

    // Extract email data dengan fallback
    const headers = emailData.payload?.headers || [];
    const getHeader = (name) => {
        const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
        return header ? header.value : 'N/A';
    };
    
    // Fallback jika data sudah dalam format yang sudah diproses
    const fromFallback = emailData.from || getHeader('From');
    const subjectFallback = emailData.subject || getHeader('Subject');
    const dateFallback = emailData.date || getHeader('Date');

    const modal = document.createElement('div');
    modal.id = 'email-modal';
    modal.className = 'email-modal';
    modal.innerHTML = `
        <div class="email-modal-content">
            <div class="email-modal-header">
                <h3><i class="fa-solid fa-envelope"></i> Detail Email</h3>
                <button onclick="closeEmailModal()" class="close-button">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <div class="email-modal-body">
                <div class="email-field">
                    <strong><i class="fa-solid fa-user"></i> Dari:</strong>
                    <div class="email-field-content">${fromFallback}</div>
                </div>
                <div class="email-field">
                    <strong><i class="fa-solid fa-envelope-open"></i> Subjek:</strong>
                    <div class="email-field-content">${subjectFallback}</div>
                </div>
                <div class="email-field">
                    <strong><i class="fa-solid fa-calendar"></i> Tanggal:</strong>
                    <div class="email-field-content">${formatDate(dateFallback)}</div>
                </div>
                <div class="email-field">
                    <strong><i class="fa-solid fa-at"></i> Kepada:</strong>
                    <div class="email-field-content">${getHeader('To')}</div>
                </div>
                <div class="email-content">
                    <strong><i class="fa-solid fa-file-text"></i> Isi Email:</strong>
                    <div class="email-body">
                        ${emailData.snippet || 'Tidak ada preview tersedia'}
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    // Animate in
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);

    // Close on click outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeEmailModal();
        }
    });

    // Close on escape key
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeEmailModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
}

function closeEmailModal() {
    const modal = document.getElementById('email-modal');
    if (modal) {
        modal.classList.add('hide');
        modal.classList.remove('show');
        
        // Restore body scroll
        document.body.style.overflow = '';
        
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

function copyEmail() {
    if (currentEmail) {
        navigator.clipboard.writeText(currentEmail).then(() => {
            showNotification('Email disalin ke clipboard!', 'success');
        }).catch(() => {
            showNotification('Gagal menyalin email', 'error');
        });
    }
}

/**
 * Auto Refresh
 */
function startAutoRefresh() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
    }
    
    const interval = parseInt(elements.refreshIntervalSelect?.value || '30') * 1000;
    
    autoRefreshTimer = setInterval(() => {
        if (currentEmail && !isLoading) {
            loadMail();
        }
    }, interval);
}

function stopAutoRefresh() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
    }
}

/**
 * Search Function
 */
function filterEmails() {
    const searchTerm = elements.emailSearch?.value.toLowerCase() || '';
    const rows = elements.emailTable?.querySelectorAll('tr') || [];
    
    rows.forEach(row => {
        if (row.cells.length > 1) { // Skip header and empty rows
            const from = row.cells[1].textContent.toLowerCase();
            const subject = row.cells[2].textContent.toLowerCase();
            const shouldShow = from.includes(searchTerm) || subject.includes(searchTerm);
            row.style.display = shouldShow ? '' : 'none';
        }
    });
}

/**
 * Initialization
 */
function initializeUI() {
    // Load saved values
    const savedSubdomain = localStorage.getItem(CONFIG.SUBDOMAIN_STORAGE_KEY);
    const savedCustomUsername = localStorage.getItem('temp_mail_custom_username');
    
    // Set saved subdomain untuk random email
    const subdomainInput = document.getElementById('subdomain');
    if (savedSubdomain && subdomainInput) {
        subdomainInput.value = savedSubdomain;
    }
    
    // Set saved values untuk custom email
    const customUsernameInput = document.getElementById('custom-username');
    const customSubdomainInput = document.getElementById('custom-subdomain');
    
    if (savedCustomUsername && customUsernameInput) {
        customUsernameInput.value = savedCustomUsername;
    }
    
    if (savedSubdomain && customSubdomainInput) {
        customSubdomainInput.value = savedSubdomain;
    }

    // Update button handlers
    elements.loadMailButton = document.querySelector('[onclick="refreshMail()"]');
    elements.newAddressButton = document.querySelector('[onclick="genEmail()"]');
    
    if (elements.loadMailButton) {
        elements.loadMailButton.onclick = loadMail;
    }
    
    if (elements.newAddressButton) {
        elements.newAddressButton.onclick = newAddress;
    }

    // Auto refresh handler
    if (elements.autoRefreshCheckbox) {
        elements.autoRefreshCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                startAutoRefresh();
            } else {
                stopAutoRefresh();
            }
        });
    }

    if (elements.refreshIntervalSelect) {
        elements.refreshIntervalSelect.addEventListener('change', () => {
            if (elements.autoRefreshCheckbox?.checked) {
                startAutoRefresh();
            }
        });
    }

    // Search handler
    if (elements.emailSearch) {
        elements.emailSearch.addEventListener('input', filterEmails);
    }

    // Load saved email
    const savedEmail = localStorage.getItem(CONFIG.EMAIL_STORAGE_KEY);
    if (savedEmail) {
        setCurrentEmail(savedEmail);
    }

    // Show mode info
    if (MOCK_MODE) {
        console.log('🔧 Gmail Temp Mail - Mode Demo');
        console.log('📧 Menggunakan mock data untuk testing');
        console.log('🚀 Setup Cloudflare Worker untuk Gmail API real');
    }
    
    console.log('✅ UI Initialized successfully');
    console.log('📧 Custom email feature: ENABLED');
    console.log('🎯 Subdomain feature: ENABLED');
}

// Global functions for backward compatibility
window.refreshMail = loadMail;
window.genEmail = newAddress;
window.copyEmail = copyEmail;
window.viewEmail = viewEmail;
window.closeEmailModal = closeEmailModal;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM Content Loaded - Initializing Gmail Temp Mail...');
    
    initializeUI();
    
    // Load saved email first
    const savedEmail = localStorage.getItem(CONFIG.EMAIL_STORAGE_KEY);
    if (savedEmail) {
        console.log('📧 Loading saved email:', savedEmail);
        setCurrentEmail(savedEmail);
        // Auto load mail for saved email after a short delay
        setTimeout(() => {
            loadMail();
        }, 1500);
    } else {
        console.log('🎲 No saved email found, generating new one...');
        // Auto-generate email if none exists
        setTimeout(() => {
            newAddress();
        }, 500);
    }
});

// CSS untuk modal email (jika belum ada di style.css)
const modalCSS = `
<style>
.email-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    opacity: 0;
    transition: opacity 0.3s ease;
    backdrop-filter: blur(4px);
}

.email-modal.show {
    opacity: 1;
}

.email-modal-content {
    background: var(--card-bg);
    border-radius: 12px;
    max-width: 700px;
    width: 90%;
    max-height: 85vh;
    overflow: hidden;
    box-shadow: var(--shadow-lg);
    transform: translateY(-20px);
    transition: transform 0.3s ease;
    border: 1px solid var(--border-color);
}

.email-modal.show .email-modal-content {
    transform: translateY(0);
}

.email-modal-header {
    background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
    color: white;
    padding: 20px 25px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.close-button {
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
    padding: 8px;
    border-radius: 50%;
    transition: all 0.2s ease;
}

.close-button:hover {
    background: rgba(255, 255, 255, 0.2);
}

.email-modal-body {
    padding: 25px;
    max-height: 60vh;
    overflow-y: auto;
}

.email-field {
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid var(--border-color);
}

.email-field strong {
    color: var(--text-color);
    font-weight: 600;
}

.email-field-content {
    color: var(--text-secondary);
    margin-top: 8px;
    padding: 8px 12px;
    background: var(--bg-color);
    border-radius: 6px;
}

.email-body {
    background: var(--bg-color);
    padding: 20px;
    border-radius: 8px;
    margin-top: 15px;
    line-height: 1.6;
    border: 1px solid var(--border-color);
}
</style>
`;

// Inject modal CSS jika belum ada
if (!document.querySelector('#modal-css')) {
    const style = document.createElement('style');
    style.id = 'modal-css';
    style.innerHTML = modalCSS.replace('<style>', '').replace('</style>', '');
    document.head.appendChild(style);
}
