/**
 * SmartLab OS - Core Application Logic
 * Integrates Chart.js, QRCode.js, Web Audio API, and LabAPI adapter.
 */

// User Personas (RBAC)
const PERSONAS = {
  admin: {
    name: 'Dr. Sarah Vance',
    email: 's.vance@smartlab.edu',
    role: 'Admin',
    department: 'Chemistry',
    badgeId: 'RFID-88129',
    avatar: 'SV',
    roleLabel: 'Lab Director (Admin)'
  },
  technician: {
    name: 'Markus Reed',
    email: 'm.reed@smartlab.edu',
    role: 'Technician',
    department: 'Biotechnology',
    badgeId: 'RFID-55201',
    avatar: 'MR',
    roleLabel: 'Chief Technician'
  },
  student: {
    name: 'Elena Rostova',
    email: 'e.rostova@smartlab.edu',
    role: 'Student',
    department: 'Material Science',
    badgeId: 'RFID-34901',
    avatar: 'ER',
    roleLabel: 'PhD Researcher (Student)'
  }
};

let currentPersona = PERSONAS.student;
let soundEnabled = true;
let telemetryChartInstance = null;
let deptUsageChartInstance = null;
let currentViewingQrBooking = null;

// Audio Synthesizer via Web Audio API (Zero dependencies)
const AudioFX = (function () {
  let ctx = null;
  function getContext() {
    if (!ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) ctx = new AudioContext();
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
    return ctx;
  }

  return {
    playSuccess: () => {
      if (!soundEnabled) return;
      try {
        const c = getContext();
        if (!c) return;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.connect(gain);
        gain.connect(c.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, c.currentTime); // D5
        osc.frequency.setValueAtTime(880.00, c.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.15, c.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.35);
        osc.start();
        osc.stop(c.currentTime + 0.35);
      } catch (e) {}
    },
    playAlert: () => {
      if (!soundEnabled) return;
      try {
        const c = getContext();
        if (!c) return;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.connect(gain);
        gain.connect(c.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, c.currentTime);
        osc.frequency.setValueAtTime(330, c.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, c.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4);
        osc.start();
        osc.stop(c.currentTime + 0.4);
      } catch (e) {}
    },
    playSwipe: () => {
      if (!soundEnabled) return;
      try {
        const c = getContext();
        if (!c) return;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.connect(gain);
        gain.connect(c.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, c.currentTime); // C5
        gain.gain.setValueAtTime(0.12, c.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
        osc.start();
        osc.stop(c.currentTime + 0.2);
      } catch (e) {}
    }
  };
})();

// Toast Notification Manager
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'fa-info-circle';
  let color = 'var(--primary)';
  if (type === 'success') { icon = 'fa-circle-check'; color = 'var(--accent-emerald)'; AudioFX.playSuccess(); }
  if (type === 'error') { icon = 'fa-triangle-exclamation'; color = 'var(--accent-rose)'; AudioFX.playAlert(); }
  if (type === 'warning') { icon = 'fa-circle-exclamation'; color = 'var(--accent-amber)'; AudioFX.playAlert(); }

  toast.innerHTML = `
    <i class="fa-solid ${icon}" style="color:${color}; font-size:1.1rem;"></i>
    <div style="flex:1;">${message}</div>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3800);
}

// DOM Initialization
document.addEventListener('DOMContentLoaded', async () => {
  initNavigation();
  initPersonaSwitcher();
  initThemeAndSound();
  initModals();
  initEventListeners();

  // Initial Data Load
  await refreshAllData();

  // Setup periodic live polling (every 6 seconds for IoT telemetry & room status)
  setInterval(async () => {
    await updateDashboardTelemetry();
  }, 6000);
});

// Navigation Handling
function initNavigation() {
  const navBtns = document.querySelectorAll('.nav-link-btn');
  const sections = document.querySelectorAll('.view-section');
  const pageHeading = document.getElementById('pageHeading');
  const pageSubHeading = document.getElementById('pageSubHeading');

  const headers = {
    'view-dashboard': { title: 'Dashboard & Telemetry', sub: 'Real-time environmental monitoring and instrument utilization' },
    'view-equipment': { title: 'Instruments & Equipment Directory', sub: 'Precision laboratory equipment, specifications, and availability' },
    'view-bookings': { title: 'Smart Slot Booking & Allocation', sub: 'Conflict-aware laboratory time slot reservations and sessions' },
    'view-inventory': { title: 'Chemicals & Reagents Inventory', sub: 'NFPA 704 hazard tracking, stock thresholds, and consumption logs' },
    'view-maintenance': { title: 'Preventive Maintenance & Incident Tickets', sub: 'Calibration schedules, fault diagnostics, and work orders' },
    'view-access': { title: 'Smart RFID Door Access Simulator', sub: 'Security authorization testing and automated facility clearance' },
    'view-reports': { title: 'Audit Trail & Compliance Reports', sub: 'Complete tamper-evident log records and data export' }
  };

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      sections.forEach(sec => {
        sec.classList.remove('active');
        if (sec.id === targetId) sec.classList.add('active');
      });

      if (headers[targetId]) {
        pageHeading.textContent = headers[targetId].title;
        pageSubHeading.textContent = headers[targetId].sub;
      }

      // Close mobile sidebar if open
      document.getElementById('appSidebar').classList.remove('mobile-open');

      // Trigger redraws if necessary
      if (targetId === 'view-dashboard') {
        if (telemetryChartInstance) telemetryChartInstance.resize();
        if (deptUsageChartInstance) deptUsageChartInstance.resize();
      }
    });
  });

  // Mobile toggle
  const toggleBtn = document.getElementById('sidebarToggleBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      document.getElementById('appSidebar').classList.toggle('mobile-open');
    });
  }
}

// User Persona Switcher (RBAC)
function initPersonaSwitcher() {
  const select = document.getElementById('userRoleSelect');
  const avatar = document.getElementById('currentPersonaAvatar');
  const name = document.getElementById('currentPersonaName');
  const role = document.getElementById('currentPersonaRole');
  const rfidPrompt = document.getElementById('rfidPromptPersona');

  function updatePersona(key) {
    currentPersona = PERSONAS[key] || PERSONAS.student;
    avatar.textContent = currentPersona.avatar;
    name.textContent = currentPersona.name;
    role.textContent = currentPersona.roleLabel;
    if (rfidPrompt) {
      rfidPrompt.innerHTML = `Current Badge: <strong>${currentPersona.name}</strong> (${currentPersona.badgeId}) - Dept: ${currentPersona.department}`;
    }

    // Toggle admin/technician visibility classes
    const isAdminOrTech = ['Admin', 'Technician'].includes(currentPersona.role);
    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = isAdminOrTech ? '' : 'none';
    });

    showToast(`Switched active persona to ${currentPersona.name} (${currentPersona.role})`, 'info');
    renderBookings(); // re-render with persona actions
  }

  select.addEventListener('change', (e) => updatePersona(e.target.value));
  updatePersona(select.value);
}

// Theme & Sound Toggle
function initThemeAndSound() {
  const themeBtn = document.getElementById('themeToggleBtn');
  const soundBtn = document.getElementById('soundToggleBtn');

  themeBtn.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
    themeBtn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    // update chart colors
    if (telemetryChartInstance) telemetryChartInstance.update();
  });

  soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundBtn.innerHTML = soundEnabled ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>';
    showToast(`Audio feedback ${soundEnabled ? 'enabled' : 'muted'}`, 'info');
  });
}

// Modal Controllers
function initModals() {
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close');
      const modal = document.getElementById(modalId);
      if (modal) modal.classList.remove('active');
    });
  });

  // Close when clicking backdrop
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.classList.remove('active');
    });
  });
}

// Global Refresh Data
async function refreshAllData() {
  try {
    await Promise.all([
      updateDashboardTelemetry(),
      renderEquipment(),
      renderBookings(),
      renderInventory(),
      renderMaintenance(),
      renderAccessLogs(),
      renderAuditTrail()
    ]);
  } catch (err) {
    console.error('Error refreshing lab data:', err);
  }
}

// =============================================================================
// 1. DASHBOARD & TELEMETRY LOGIC
// =============================================================================
async function updateDashboardTelemetry() {
  try {
    const [summary, rooms, telemetry] = await Promise.all([
      LabAPI.getSummary(),
      LabAPI.getRooms(),
      LabAPI.getTelemetry()
    ]);

    // Update Top Metric Counters
    document.getElementById('statAvailEq').textContent = `${summary.availableEquipment} / ${summary.totalEquipment}`;
    document.getElementById('statInUseEq').textContent = `${summary.inUseEquipment}`;
    document.getElementById('statActiveBookings').textContent = `${summary.activeBookings} active reservations`;
    document.getElementById('statLowStock').textContent = `${summary.lowStockCount}`;
    document.getElementById('statOpenMnt').textContent = `${summary.openMaintenanceCount}`;

    // Update Sidebar Badges
    document.getElementById('sidebarEqCount').textContent = summary.totalEquipment;
    document.getElementById('sidebarBookingsCount').textContent = summary.activeBookings;
    document.getElementById('sidebarLowStockCount').textContent = summary.lowStockCount;
    document.getElementById('sidebarMntCount').textContent = summary.openMaintenanceCount;

    // Render Rooms Cards
    renderRoomCards(rooms);

    // Render / Update Charts
    renderTelemetryChart(telemetry.timeline);
    renderDeptUsageChart(telemetry.deptUsage);
  } catch (e) {
    console.error('Telemetry update failed:', e);
  }
}

function renderRoomCards(rooms) {
  const container = document.getElementById('roomCardsContainer');
  if (!container) return;

  container.innerHTML = rooms.map(room => {
    const s = room.sensors || {};
    const tempColor = s.temperature > 24 ? 'var(--accent-amber)' : (s.temperature < 18 ? 'var(--accent-rose)' : 'var(--primary)');
    const co2Color = s.co2 > 800 ? 'var(--accent-rose)' : (s.co2 > 600 ? 'var(--accent-amber)' : 'var(--accent-emerald)');

    return `
      <div class="room-card">
        <div class="room-card-header">
          <div class="room-name-box">
            <h4>${room.name}</h4>
            <span>${room.id} &bull; ${room.building} (${room.floor})</span>
          </div>
          <span class="occupancy-pill">
            <i class="fa-solid fa-users" style="color:var(--primary); margin-right:4px;"></i>
            ${room.currentOccupancy} / ${room.maxCapacity}
          </span>
        </div>

        <div class="room-sensor-strip">
          <div class="sensor-item">
            <span class="sensor-lbl">Temp</span>
            <span class="sensor-val" style="color:${tempColor}">${s.temperature}°C</span>
          </div>
          <div class="sensor-item">
            <span class="sensor-lbl">Humidity</span>
            <span class="sensor-val">${s.humidity}%</span>
          </div>
          <div class="sensor-item">
            <span class="sensor-lbl">CO2 / AQI</span>
            <span class="sensor-val" style="color:${co2Color}">${s.co2} ppm</span>
          </div>
          <div class="sensor-item">
            <span class="sensor-lbl">Power</span>
            <span class="sensor-val">${s.powerLoad} kW</span>
          </div>
        </div>

        <div class="room-card-actions">
          <span class="room-auth-tag"><i class="fa-solid fa-shield-halved"></i> ${room.authorizedDepartments.slice(0, 2).join(', ')}</span>
          <button class="btn btn-secondary btn-sm" onclick="quickSwipeRoom('${room.id}')">
            <i class="fa-solid fa-id-card"></i> Badge Swipe
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderTelemetryChart(timelineData) {
  const ctx = document.getElementById('telemetryChart');
  if (!ctx) return;

  const labels = timelineData.map(d => d.time);
  const tempData = timelineData.map(d => d.avgTemp);
  const humidityData = timelineData.map(d => d.avgHumidity);
  const co2Data = timelineData.map(d => d.avgCo2 / 10); // scale for visual harmony

  if (telemetryChartInstance) {
    telemetryChartInstance.data.labels = labels;
    telemetryChartInstance.data.datasets[0].data = tempData;
    telemetryChartInstance.data.datasets[1].data = humidityData;
    telemetryChartInstance.data.datasets[2].data = co2Data;
    telemetryChartInstance.update();
    return;
  }

  telemetryChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Temperature (°C)',
          data: tempData,
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.1)',
          fill: true,
          tension: 0.35,
          borderWidth: 2
        },
        {
          label: 'Rel. Humidity (%)',
          data: humidityData,
          borderColor: '#10b981',
          backgroundColor: 'transparent',
          tension: 0.35,
          borderWidth: 2
        },
        {
          label: 'CO2 / 10 (ppm)',
          data: co2Data,
          borderColor: '#f59e0b',
          backgroundColor: 'transparent',
          borderDash: [4, 4],
          tension: 0.35,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 11 } } }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } }
      }
    }
  });
}

function renderDeptUsageChart(deptUsage) {
  const ctx = document.getElementById('deptUsageChart');
  if (!ctx) return;

  const labels = Object.keys(deptUsage);
  const data = Object.values(deptUsage);

  if (deptUsageChartInstance) {
    deptUsageChartInstance.data.labels = labels;
    deptUsageChartInstance.data.datasets[0].data = data;
    deptUsageChartInstance.update();
    return;
  }

  deptUsageChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: ['#06b6d4', '#10b981', '#f59e0b', '#8b5cf6'],
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 10 } } }
      },
      cutout: '70%'
    }
  });
}

// =============================================================================
// 2. EQUIPMENT & INSTRUMENT MANAGEMENT
// =============================================================================
let activeEqCategory = 'All';
let eqSearchQuery = '';

async function renderEquipment() {
  const container = document.getElementById('equipmentGridContainer');
  if (!container) return;

  const equipmentList = await LabAPI.getEquipment({ category: activeEqCategory, q: eqSearchQuery });
  const rooms = await LabAPI.getRooms();
  const roomMap = Object.fromEntries(rooms.map(r => [r.id, r.name]));

  // Populate Add Equipment & Book Equipment Select options
  populateEquipmentDropdowns(equipmentList, rooms);

  if (equipmentList.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding:3rem; color:var(--text-dim);">
        <i class="fa-solid fa-microscope" style="font-size:2.5rem; margin-bottom:1rem;"></i>
        <p>No laboratory instruments found matching current criteria.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = equipmentList.map(eq => {
    const statusClass = `eq-status-${eq.status.replace(/\s+/g, '')}`;
    const roomName = roomMap[eq.roomId] || eq.roomId;

    return `
      <div class="equipment-card">
        <div class="equipment-card-header">
          <div class="equipment-title-box">
            <h4>${eq.name}</h4>
            <span class="model-code">${eq.model} &bull; ${eq.id}</span>
          </div>
          <span class="eq-status-badge ${statusClass}">${eq.status}</span>
        </div>

        <div class="equipment-card-body">
          <div class="spec-snippet">${eq.specifications}</div>
          
          <table class="eq-details-table">
            <tr>
              <td class="label"><i class="fa-solid fa-location-dot"></i> Location</td>
              <td class="val">${roomName} (${eq.location})</td>
            </tr>
            <tr>
              <td class="label"><i class="fa-solid fa-shield-virus"></i> Safety Req.</td>
              <td class="val">${eq.safetyLevel}</td>
            </tr>
            <tr>
              <td class="label"><i class="fa-solid fa-clock-rotate-left"></i> Usage Log</td>
              <td class="val">${eq.totalUsageHours} hrs total</td>
            </tr>
            <tr>
              <td class="label"><i class="fa-solid fa-screwdriver"></i> Next Service</td>
              <td class="val">${eq.nextMaintenance}</td>
            </tr>
          </table>

          ${eq.currentSession ? `
            <div class="in-session-banner">
              <i class="fa-solid fa-spinner fa-spin"></i>
              <span>In use by <strong>${eq.currentSession.userName}</strong></span>
            </div>
          ` : ''}
        </div>

        <div class="equipment-card-footer">
          <div class="rate-tag">$${eq.hourlyRate} <span>/ hour</span></div>
          <div style="display:flex; gap:0.4rem;">
            <button class="btn btn-secondary btn-sm" onclick="reportFaultForEquipment('${eq.id}', '${eq.name}')" title="Report Fault">
              <i class="fa-solid fa-triangle-exclamation"></i>
            </button>
            <button class="btn btn-primary btn-sm" onclick="openBookingModalForEquipment('${eq.id}')" ${eq.status === 'Under Maintenance' ? 'disabled' : ''}>
              <i class="fa-solid fa-calendar-check"></i> Book
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function populateEquipmentDropdowns(equipmentList, rooms) {
  const bookSelect = document.getElementById('bookEquipmentSelect');
  const incidentSelect = document.getElementById('incidentEquipmentSelect');
  const roomSelect = document.getElementById('eqRoomId');

  if (bookSelect) {
    bookSelect.innerHTML = equipmentList
      .filter(e => e.status !== 'Under Maintenance')
      .map(e => `<option value="${e.id}" data-rate="${e.hourlyRate}" data-req="${e.requiresApproval}">${e.name} ($${e.hourlyRate}/hr)</option>`)
      .join('');
  }

  if (incidentSelect) {
    incidentSelect.innerHTML = equipmentList
      .map(e => `<option value="${e.id}">${e.name} (${e.id})</option>`)
      .join('');
  }

  if (roomSelect) {
    roomSelect.innerHTML = rooms
      .map(r => `<option value="${r.id}">${r.name} (${r.building})</option>`)
      .join('');
  }
}

// =============================================================================
// 3. SMART SLOT BOOKINGS & SESSIONS
// =============================================================================
let activeBookingStatus = 'All';
let bookingSearchQuery = '';

async function renderBookings() {
  const tbody = document.getElementById('bookingsTableBody');
  if (!tbody) return;

  const bookings = await LabAPI.getBookings({ status: activeBookingStatus });
  
  if (bookings.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:2rem; color:var(--text-dim);">
          No slot reservations found.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = bookings.map(b => {
    const isOwnerOrAdmin = currentPersona.email === b.userEmail || ['Admin', 'Technician'].includes(currentPersona.role);
    const statusColor = b.status === 'In-Session' ? 'var(--primary)' : (b.status === 'Confirmed' ? 'var(--accent-emerald)' : (b.status === 'Pending Approval' ? 'var(--accent-amber)' : 'var(--text-dim)'));

    return `
      <tr>
        <td>
          <div style="font-weight:700; font-family:var(--font-mono);">${b.id}</div>
          <button class="btn btn-secondary btn-sm" style="padding:2px 6px; font-size:0.7rem; margin-top:3px;" onclick="viewQrPass('${b.id}')">
            <i class="fa-solid fa-qrcode"></i> QR Pass
          </button>
        </td>
        <td>
          <div style="font-weight:600;">${b.equipmentName}</div>
          <div style="font-size:0.75rem; color:var(--text-dim);">${b.purpose}</div>
        </td>
        <td>
          <div>${b.userName}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${b.department} &bull; <span style="color:var(--primary)">${b.userRole}</span></div>
        </td>
        <td>
          <div style="font-weight:600;"><i class="fa-regular fa-calendar"></i> ${b.date}</div>
          <div style="font-size:0.75rem; color:var(--text-dim);"><i class="fa-regular fa-clock"></i> ${b.startTime} - ${b.endTime}</div>
        </td>
        <td>
          <div>${b.durationHours} hrs</div>
          <div style="font-weight:700; color:var(--accent-emerald); font-size:0.8rem;">$${b.totalCost}</div>
        </td>
        <td>
          <span style="display:inline-flex; align-items:center; gap:4px; font-weight:700; font-size:0.75rem; color:${statusColor};">
            <span style="width:6px; height:6px; border-radius:50%; background-color:${statusColor};"></span>
            ${b.status}
          </span>
        </td>
        <td>
          <div style="display:flex; gap:0.3rem;">
            ${b.status === 'Confirmed' && isOwnerOrAdmin ? `
              <button class="btn btn-primary btn-sm" onclick="checkInBooking('${b.id}')" title="Start Session">
                <i class="fa-solid fa-play"></i> Check-In
              </button>
            ` : ''}

            ${b.status === 'In-Session' && isOwnerOrAdmin ? `
              <button class="btn btn-success btn-sm" onclick="checkOutBooking('${b.id}')" title="Complete Session">
                <i class="fa-solid fa-stop"></i> Check-Out
              </button>
            ` : ''}

            ${b.status === 'Pending Approval' && ['Admin', 'Technician'].includes(currentPersona.role) ? `
              <button class="btn btn-success btn-sm" onclick="approveBooking('${b.id}')" title="Approve Reservation">
                <i class="fa-solid fa-check"></i>
              </button>
            ` : ''}

            ${isOwnerOrAdmin && b.status !== 'Completed' ? `
              <button class="btn btn-danger btn-sm" onclick="cancelBooking('${b.id}')" title="Cancel Booking">
                <i class="fa-solid fa-trash"></i>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function checkInBooking(bookingId) {
  try {
    await LabAPI.checkInBooking(bookingId);
    showToast(`Checked in! Session started for booking ${bookingId}`, 'success');
    await refreshAllData();
  } catch (err) {
    showToast(`Check-in failed: ${err.message}`, 'error');
  }
}

async function checkOutBooking(bookingId) {
  try {
    await LabAPI.checkOutBooking(bookingId);
    showToast(`Checked out! Session completed for booking ${bookingId}`, 'success');
    await refreshAllData();
  } catch (err) {
    showToast(`Check-out failed: ${err.message}`, 'error');
  }
}

async function approveBooking(bookingId) {
  try {
    await LabAPI.updateBookingStatus(bookingId, 'Confirmed', currentPersona.name);
    showToast(`Booking ${bookingId} approved successfully!`, 'success');
    await refreshAllData();
  } catch (err) {
    showToast(`Approval failed: ${err.message}`, 'error');
  }
}

async function cancelBooking(bookingId) {
  if (!confirm(`Are you sure you want to cancel booking ${bookingId}?`)) return;
  try {
    await LabAPI.deleteBooking(bookingId);
    showToast(`Booking ${bookingId} cancelled`, 'info');
    await refreshAllData();
  } catch (err) {
    showToast(`Cancellation failed: ${err.message}`, 'error');
  }
}

// Digital QR Pass Generator
async function viewQrPass(bookingId) {
  const bookings = await LabAPI.getBookings();
  const booking = bookings.find(b => b.id === bookingId);
  if (!booking) return;

  currentViewingQrBooking = booking;

  document.getElementById('qrPassBookingTitle').textContent = booking.equipmentName;
  document.getElementById('qrPassResearcher').textContent = `${booking.userName} (${booking.department})`;
  document.getElementById('qrPassCodeText').textContent = booking.qrPassCode;
  document.getElementById('qrPassTimeWindow').textContent = `${booking.date} | ${booking.startTime} - ${booking.endTime} (${booking.status})`;

  const qrContainer = document.getElementById('qrCodeContainer');
  qrContainer.innerHTML = '';

  // Generate QR Code using QRCode.js
  new QRCode(qrContainer, {
    text: JSON.stringify({
      bookingId: booking.id,
      code: booking.qrPassCode,
      equipmentId: booking.equipmentId,
      date: booking.date,
      user: booking.userName
    }),
    width: 140,
    height: 140,
    colorDark: "#0f172a",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  document.getElementById('qrPassModal').classList.add('active');
}

// =============================================================================
// 4. CHEMICALS & HAZARDOUS REAGENTS INVENTORY
// =============================================================================
let activeChemCategory = 'All';
let chemSearchQuery = '';

async function renderInventory() {
  const container = document.getElementById('inventoryGridContainer');
  if (!container) return;

  const items = await LabAPI.getInventory({ category: activeChemCategory, q: chemSearchQuery });

  if (items.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding:3rem; color:var(--text-dim);">
        <i class="fa-solid fa-flask" style="font-size:2.5rem; margin-bottom:1rem;"></i>
        <p>No chemicals or reagents found.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = items.map(chem => {
    const nfpa = chem.nfpa || { health: 0, flammability: 0, instability: 0, special: '' };
    const pct = Math.min(100, Math.round((chem.quantity / (chem.minThreshold * 2.5)) * 100));
    const fillClass = chem.status === 'Critical' ? 'fill-critical' : (chem.status === 'Low Stock' ? 'fill-low' : 'fill-adequate');

    return `
      <div class="chemical-card">
        <div class="chemical-card-top">
          <div class="chemical-title">
            <h4>${chem.name}</h4>
            <div class="cas-tag">CAS: ${chem.casNumber} &bull; ${chem.formula}</div>
          </div>
          <!-- Standard NFPA 704 Diamond -->
          <div class="nfpa-diamond" title="NFPA 704: Health ${nfpa.health}, Flammability ${nfpa.flammability}, Reactivity ${nfpa.instability}">
            <div class="nfpa-box nfpa-health"><span>${nfpa.health}</span></div>
            <div class="nfpa-box nfpa-flam"><span>${nfpa.flammability}</span></div>
            <div class="nfpa-box nfpa-react"><span>${nfpa.instability}</span></div>
            <div class="nfpa-box nfpa-spec"><span>${nfpa.special || ''}</span></div>
          </div>
        </div>

        <div style="font-size:0.75rem; color:var(--text-muted);">
          <div><i class="fa-solid fa-box-archive"></i> ${chem.location}</div>
          <div><i class="fa-solid fa-calendar-xmark"></i> Expires: ${chem.expiryDate} (Batch: ${chem.batchNo})</div>
        </div>

        <div class="stock-meter-wrap">
          <div class="stock-meter-header">
            <span>Available Stock: <strong>${chem.quantity} ${chem.unit}</strong></span>
            <span style="color:${chem.status === 'Adequate' ? 'var(--accent-emerald)' : 'var(--accent-amber)'}">
              ${chem.status} (Min: ${chem.minThreshold} ${chem.unit})
            </span>
          </div>
          <div class="stock-progress-bar">
            <div class="stock-progress-fill ${fillClass}" style="width: ${pct}%"></div>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; gap:0.5rem; margin-top:auto; padding-top:0.5rem; border-top:1px solid var(--border-subtle);">
          <button class="btn btn-secondary btn-sm" onclick="openConsumeModal('${chem.id}', '${chem.name}', ${chem.quantity}, '${chem.unit}')">
            <i class="fa-solid fa-minus"></i> Use Material
          </button>
          <button class="btn btn-success btn-sm" onclick="openRestockModal('${chem.id}', '${chem.name}', '${chem.unit}')">
            <i class="fa-solid fa-plus"></i> Restock
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function openConsumeModal(id, name, qty, unit) {
  document.getElementById('consumeChemId').value = id;
  document.getElementById('consumeChemName').value = name;
  document.getElementById('consumeChemStock').value = `${qty} ${unit}`;
  document.getElementById('consumeAmount').value = '';
  document.getElementById('consumeReason').value = '';
  document.getElementById('consumeChemicalModal').classList.add('active');
}

function openRestockModal(id, name, unit) {
  document.getElementById('restockChemId').value = id;
  document.getElementById('restockChemName').value = `${name} (${unit})`;
  document.getElementById('restockAmount').value = '';
  document.getElementById('restockChemicalModal').classList.add('active');
}

// =============================================================================
// 5. MAINTENANCE & BREAKDOWN TICKETING
// =============================================================================
async function renderMaintenance() {
  const tbody = document.getElementById('maintenanceTableBody');
  if (!tbody) return;

  const tickets = await LabAPI.getMaintenance();

  if (tickets.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:2rem; color:var(--text-dim);">
          No open maintenance tickets. All lab systems nominal.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = tickets.map(t => {
    const priorityColor = t.priority === 'Critical Emergency' || t.priority === 'High' ? 'var(--accent-rose)' : (t.priority === 'Medium' ? 'var(--accent-amber)' : 'var(--primary)');
    const isResolved = t.status === 'Resolved';

    return `
      <tr>
        <td style="font-family:var(--font-mono); font-weight:700;">${t.id}</td>
        <td>
          <div style="font-weight:600;">${t.equipmentName}</div>
          <div style="font-size:0.75rem; color:var(--text-dim);">${t.equipmentId}</div>
        </td>
        <td>
          <div style="font-weight:600; color:${priorityColor};">${t.issueType}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${t.description}</div>
        </td>
        <td>
          <span style="font-size:0.75rem; font-weight:700; color:${priorityColor}; background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:12px;">
            ${t.priority}
          </span>
        </td>
        <td style="font-size:0.8rem;">${t.reportedDate}</td>
        <td style="font-size:0.8rem;">${t.assignedTo || 'Unassigned'}</td>
        <td>
          <span class="status-badge ${isResolved ? 'status-online' : 'status-fallback'}" style="font-size:0.7rem;">
            ${t.status}
          </span>
        </td>
        <td>
          ${!isResolved ? `
            <button class="btn btn-success btn-sm" onclick="resolveMaintenance('${t.id}')">
              <i class="fa-solid fa-wrench"></i> Mark Fixed
            </button>
          ` : `<span style="font-size:0.75rem; color:var(--accent-emerald);"><i class="fa-solid fa-check-double"></i> Fixed</span>`}
        </td>
      </tr>
    `;
  }).join('');
}

async function resolveMaintenance(ticketId) {
  const notes = prompt('Enter repair and calibration resolution notes:');
  if (!notes) return;

  try {
    await LabAPI.resolveMaintenanceTicket(ticketId, notes, currentPersona.name);
    showToast(`Ticket ${ticketId} marked resolved. Instrument returned to Available status.`, 'success');
    await refreshAllData();
  } catch (err) {
    showToast(`Error resolving ticket: ${err.message}`, 'error');
  }
}

function reportFaultForEquipment(eqId, eqName) {
  const select = document.getElementById('incidentEquipmentSelect');
  if (select) select.value = eqId;
  document.getElementById('incidentModal').classList.add('active');
}

// =============================================================================
// 6. SMART RFID ACCESS SIMULATOR
// =============================================================================
async function quickSwipeRoom(roomId) {
  const select = document.getElementById('rfidTargetRoom');
  if (select) select.value = roomId;
  await performRfidSwipe();
}

async function performRfidSwipe() {
  const roomId = document.getElementById('rfidTargetRoom').value;
  AudioFX.playSwipe();

  try {
    const res = await LabAPI.swipeAccessCard({
      badgeId: currentPersona.badgeId,
      userName: currentPersona.name,
      userRole: currentPersona.role,
      department: currentPersona.department,
      roomId
    });

    if (res.granted) {
      showToast(`ACCESS GRANTED: Welcome, ${currentPersona.name} to ${res.room.name}`, 'success');
    } else {
      showToast(`ACCESS DENIED: ${res.reason || 'Restricted Lab Clearance'}`, 'error');
    }

    await renderAccessLogs();
    await updateDashboardTelemetry();
  } catch (err) {
    showToast(`Swipe failed: ${err.message}`, 'error');
  }
}

async function renderAccessLogs() {
  const tbody = document.getElementById('accessLogsTableBody');
  if (!tbody) return;

  const logsData = await LabAPI.getLogs();
  const accessLogs = logsData.accessLogs || [];

  tbody.innerHTML = accessLogs.slice(0, 15).map(log => {
    const isGranted = log.action === 'ENTRY_GRANTED';
    const timeStr = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    return `
      <tr>
        <td style="font-family:var(--font-mono); font-size:0.75rem;">${timeStr}</td>
        <td>
          <div style="font-weight:600;">${log.userName}</div>
          <div style="font-size:0.7rem; color:var(--text-dim);">${log.department} (${log.userRole})</div>
        </td>
        <td style="font-size:0.8rem;">${log.roomName}</td>
        <td>
          <span style="font-size:0.75rem; font-weight:700; color:${isGranted ? 'var(--accent-emerald)' : 'var(--accent-rose)'};">
            <i class="fa-solid ${isGranted ? 'fa-unlock' : 'fa-lock'}"></i> ${isGranted ? 'Granted' : 'Denied'}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

// =============================================================================
// 7. AUDIT TRAIL & DATA EXPORTS
// =============================================================================
async function renderAuditTrail() {
  const tbody = document.getElementById('auditTrailTableBody');
  if (!tbody) return;

  const logsData = await LabAPI.getLogs();
  const auditTrail = logsData.auditTrail || [];

  tbody.innerHTML = auditTrail.map(a => {
    const timeStr = new Date(a.timestamp).toLocaleString();
    return `
      <tr>
        <td style="font-family:var(--font-mono); font-size:0.75rem; font-weight:700;">${a.id}</td>
        <td style="font-size:0.8rem; color:var(--text-dim);">${timeStr}</td>
        <td><span style="font-family:var(--font-mono); font-weight:700; color:var(--primary); font-size:0.75rem;">${a.action}</span></td>
        <td style="font-weight:600; font-size:0.85rem;">${a.user}</td>
        <td style="font-size:0.8rem; color:var(--text-muted);">${a.details}</td>
      </tr>
    `;
  }).join('');
}

function exportAuditToCsv() {
  LabAPI.getLogs().then(logs => {
    const rows = [
      ['Log ID', 'Timestamp', 'Action', 'User', 'Details'],
      ...(logs.auditTrail || []).map(a => [a.id, a.timestamp, a.action, `"${a.user}"`, `"${a.details.replace(/"/g, '""')}"`])
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SmartLab_AuditTrail_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast('Audit log CSV exported successfully', 'success');
  });
}

// =============================================================================
// EVENT LISTENERS & FORM SUBMISSIONS
// =============================================================================
function initEventListeners() {
  // Quick Reserve Button in Header
  document.getElementById('quickBookBtn').addEventListener('click', () => {
    openBookingModalForEquipment();
  });

  // Category filter clicks in Equipment View
  document.querySelectorAll('#eqCategoryPills .filter-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#eqCategoryPills .filter-pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeEqCategory = btn.getAttribute('data-category');
      renderEquipment();
    });
  });

  // Equipment Search input
  const eqSearch = document.getElementById('eqSearchInput');
  if (eqSearch) {
    eqSearch.addEventListener('input', (e) => {
      eqSearchQuery = e.target.value;
      renderEquipment();
    });
  }

  // Booking Status filter clicks
  document.querySelectorAll('#bookingStatusPills .filter-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#bookingStatusPills .filter-pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeBookingStatus = btn.getAttribute('data-status');
      renderBookings();
    });
  });

  // Chemical Category filters
  document.querySelectorAll('#chemCategoryPills .filter-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#chemCategoryPills .filter-pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeChemCategory = btn.getAttribute('data-category');
      renderInventory();
    });
  });

  // Chemical Search
  const chemSearch = document.getElementById('chemSearchInput');
  if (chemSearch) {
    chemSearch.addEventListener('input', (e) => {
      chemSearchQuery = e.target.value;
      renderInventory();
    });
  }

  // Open Add Equipment Modal
  document.getElementById('addNewEquipmentBtn').addEventListener('click', () => {
    document.getElementById('addEquipmentModal').classList.add('active');
  });

  // Open Add Chemical Modal
  document.getElementById('addChemicalBtn').addEventListener('click', () => {
    showToast('Use standard stock replenishment or import batch files', 'info');
  });

  // Open Incident Modal
  document.getElementById('reportIncidentBtn').addEventListener('click', () => {
    document.getElementById('incidentModal').classList.add('active');
  });

  // Open Reservation Modal
  document.getElementById('createReservationBtn').addEventListener('click', () => {
    openBookingModalForEquipment();
  });

  // RFID Virtual Swipe Pad
  document.getElementById('virtualRfidPad').addEventListener('click', performRfidSwipe);

  // Refresh Rooms Button
  document.getElementById('refreshRoomsBtn').addEventListener('click', async () => {
    await updateDashboardTelemetry();
    showToast('IoT telemetry refreshed', 'info');
  });

  // Export CSV & Print
  document.getElementById('exportAuditCsvBtn').addEventListener('click', exportAuditToCsv);
  document.getElementById('printReportBtn').addEventListener('click', () => window.print());

  // Simulate QR Check-In
  document.getElementById('simulateQrCheckInBtn').addEventListener('click', async () => {
    if (currentViewingQrBooking) {
      document.getElementById('qrPassModal').classList.remove('active');
      await checkInBooking(currentViewingQrBooking.id);
    }
  });

  // FORM 1: New Booking
  const newBookingForm = document.getElementById('newBookingForm');
  newBookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const eqId = document.getElementById('bookEquipmentSelect').value;
    const date = document.getElementById('bookDate').value;
    const startTime = document.getElementById('bookStartTime').value;
    const endTime = document.getElementById('bookEndTime').value;
    const purpose = document.getElementById('bookPurpose').value;

    try {
      const newBooking = await LabAPI.createBooking({
        equipmentId: eqId,
        date,
        startTime,
        endTime,
        purpose,
        userName: currentPersona.name,
        userEmail: currentPersona.email,
        userRole: currentPersona.role,
        department: currentPersona.department
      });

      document.getElementById('bookingModal').classList.remove('active');
      showToast(`Reservation ${newBooking.id} created! [Status: ${newBooking.status}]`, 'success');
      await refreshAllData();
      viewQrPass(newBooking.id); // auto-show QR pass
    } catch (err) {
      showToast(`Booking error: ${err.message}`, 'error');
    }
  });

  // Dynamic booking estimation updates
  ['bookStartTime', 'bookEndTime', 'bookEquipmentSelect'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', updateBookingEstimate);
  });

  // FORM 2: New Equipment
  const newEquipmentForm = document.getElementById('newEquipmentForm');
  newEquipmentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('eqName').value;
    const category = document.getElementById('eqCategory').value;
    const model = document.getElementById('eqModel').value;
    const roomId = document.getElementById('eqRoomId').value;
    const hourlyRate = Number(document.getElementById('eqHourlyRate').value);
    const specifications = document.getElementById('eqSpecs').value;
    const location = document.getElementById('eqLocation').value;

    try {
      await LabAPI.addEquipment({
        name,
        category,
        model,
        serialNumber: `SN-${Math.floor(1000 + Math.random() * 9000)}`,
        roomId,
        location,
        hourlyRate,
        specifications,
        safetyLevel: 'Level 1 - Standard SOP',
        requiresApproval: false,
        lastCalibration: new Date().toISOString().split('T')[0],
        nextMaintenance: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
        creator: currentPersona.name
      });

      document.getElementById('addEquipmentModal').classList.remove('active');
      newEquipmentForm.reset();
      showToast(`Instrument "${name}" added to laboratory directory`, 'success');
      await refreshAllData();
    } catch (err) {
      showToast(`Error adding instrument: ${err.message}`, 'error');
    }
  });

  // FORM 3: Chemical Consumption Log
  const consumeForm = document.getElementById('consumeChemicalForm');
  consumeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('consumeChemId').value;
    const amount = Number(document.getElementById('consumeAmount').value);
    const reason = document.getElementById('consumeReason').value;

    try {
      await LabAPI.consumeInventory(id, amount, currentPersona.name, reason);
      document.getElementById('consumeChemicalModal').classList.remove('active');
      showToast(`Recorded consumption of ${amount} units`, 'success');
      await refreshAllData();
    } catch (err) {
      showToast(`Consumption error: ${err.message}`, 'error');
    }
  });

  // FORM 4: Restock Chemical
  const restockForm = document.getElementById('restockChemicalForm');
  restockForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('restockChemId').value;
    const amount = Number(document.getElementById('restockAmount').value);

    try {
      await LabAPI.restockInventory(id, amount, currentPersona.name);
      document.getElementById('restockChemicalModal').classList.remove('active');
      showToast(`Restocked +${amount} units`, 'success');
      await refreshAllData();
    } catch (err) {
      showToast(`Restock error: ${err.message}`, 'error');
    }
  });

  // FORM 5: Incident Report
  const incidentForm = document.getElementById('newIncidentForm');
  incidentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const eqId = document.getElementById('incidentEquipmentSelect').value;
    const priority = document.getElementById('incidentPriority').value;
    const issueType = document.getElementById('incidentIssueType').value;
    const description = document.getElementById('incidentDesc').value;

    const eqSelect = document.getElementById('incidentEquipmentSelect');
    const eqName = eqSelect.options[eqSelect.selectedIndex].text;

    try {
      await LabAPI.createMaintenanceTicket({
        equipmentId: eqId,
        equipmentName: eqName,
        priority,
        issueType,
        description,
        reportedBy: `${currentPersona.name} (${currentPersona.roleLabel})`,
        assignedTo: 'Chief Technician Markus Reed',
        estimatedDowntimeHours: priority === 'High' ? 6 : 2
      });

      document.getElementById('incidentModal').classList.remove('active');
      incidentForm.reset();
      showToast(`Maintenance Ticket opened for ${eqName}`, 'warning');
      await refreshAllData();
    } catch (err) {
      showToast(`Error creating ticket: ${err.message}`, 'error');
    }
  });
}

function openBookingModalForEquipment(eqId) {
  const modal = document.getElementById('bookingModal');
  const eqSelect = document.getElementById('bookEquipmentSelect');
  const dateInput = document.getElementById('bookDate');
  const deptInput = document.getElementById('bookDepartment');

  // Set default date to today or tomorrow
  const today = new Date().toISOString().split('T')[0];
  dateInput.value = today;
  dateInput.min = today;
  deptInput.value = currentPersona.department;

  if (eqId && eqSelect) {
    eqSelect.value = eqId;
  }

  updateBookingEstimate();
  modal.classList.add('active');
}

function updateBookingEstimate() {
  const start = document.getElementById('bookStartTime').value;
  const end = document.getElementById('bookEndTime').value;
  const eqSelect = document.getElementById('bookEquipmentSelect');

  if (!start || !end || !eqSelect) return;

  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);

  const selectedOpt = eqSelect.options[eqSelect.selectedIndex];
  const rate = selectedOpt ? Number(selectedOpt.getAttribute('data-rate') || 20) : 20;

  if (mins > 0) {
    const hrs = (mins / 60).toFixed(2);
    const cost = (hrs * rate).toFixed(2);
    document.getElementById('estDuration').textContent = `${hrs} Hours`;
    document.getElementById('estCost').textContent = `$${cost}`;
  } else {
    document.getElementById('estDuration').textContent = `Invalid Window`;
    document.getElementById('estCost').textContent = `$0.00`;
  }
}
