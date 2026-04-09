/**
 * admin.js  –  Enterprise Admin Dashboard
 * Upgraded: real-time WebSocket simulation, analytics, Leaflet map
 */

/* ── STATE ─────────────────────────────────────────────── */
let currentBuses   = [];
let currentSectors = [];
let currentRoutes  = [];
let liveMap        = null;
let busMarkers     = {};
let chartOcc       = null;
let chartPax       = null;
let chartHeat      = null;

/* ── INIT ──────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async function() {
    checkRoleAccess('admin');

    const user = getCurrentUser();
    if (user) {
        const nameEl     = document.getElementById('adminName');
        const districtEl = document.getElementById('districtName');
        if (nameEl)     nameEl.textContent     = user.name;
        if (districtEl) districtEl.textContent = user.district || 'District';
    }

    setupSidebar();
    startClock();
    await loadAllData();
    setupFormListeners();

    // Start real-time simulation
    MockWS.start();
    Notify.connectToMockWS();

    // Wire WebSocket events
    MockWS.on('fleet_update',   renderFleet);
    MockWS.on('health_update',  updateDeviceHealth);
    MockWS.on('system_health',  updateSystemHealth);
    MockWS.on('location_update',updateBusMarker);
});

/* ── CLOCK ──────────────────────────────────────────────── */
function startClock() {
    const el = document.getElementById('navClock');
    if (!el) return;
    function tick() { el.textContent = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}); }
    tick();
    setInterval(tick, 1000);
}

/* ── SIDEBAR ────────────────────────────────────────────── */
function setupSidebar() {
    const items    = document.querySelectorAll('.ent-sidebar .sidebar-menu li');
    const sections = document.querySelectorAll('.content-section');

    items.forEach(item => {
        item.addEventListener('click', function() {
            const target = this.getAttribute('data-section');
            items.forEach(i => i.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            this.classList.add('active');
            const sec = document.getElementById(target);
            if (sec) sec.classList.add('active');

            // Lazy init map / charts when section shown
            if (target === 'map-view')   initMap();
            if (target === 'analytics')  initAnalytics();
        });
    });
}

/* ── DATA LOAD ──────────────────────────────────────────── */
async function loadAllData() {
    currentBuses   = await getBuses()   || [];
    currentSectors = await getSectors() || [];
    currentRoutes  = await getRoutes()  || [];

    // Merge MockWS fleet as initial data if no localStorage buses
    if (currentBuses.length === 0) {
        currentBuses = MockWS.getBuses().map(b => ({
            busId: b.busId, busNumber: b.busNumber,
            seatingCapacity: b.seating, standingCapacity: b.standing,
            totalCapacity: b.seating + b.standing, status: 'active'
        }));
        localStorage.setItem('buses', JSON.stringify(currentBuses));
    }

    renderBusTable();
    renderSectorTable();
    renderRoutesView();
    populateBusDropdowns();

    // Initial fleet render from MockWS
    renderFleet(MockWS.getFleetSnapshot());
}

/* ── FORM LISTENERS ─────────────────────────────────────── */
function setupFormListeners() {
    document.getElementById('addBusForm')?.addEventListener('submit',    handleAddBus);
    document.getElementById('addSectorForm')?.addEventListener('submit', handleAddSector);
    document.getElementById('addRouteForm')?.addEventListener('submit',  handleAddRoute);
    document.getElementById('seatingCapacity')?.addEventListener('input', updateTotalCapacity);
    document.getElementById('standingCapacity')?.addEventListener('input',updateTotalCapacity);
}

/* ── FLEET RENDER ───────────────────────────────────────── */
function renderFleet(fleet) {
    if (!fleet || !fleet.length) return;
    const tbody = document.getElementById('liveMonitoringBody');
    if (!tbody) return;

    // Update stats
    const totalPax    = fleet.reduce((s, b) => s + b.passengers, 0);
    const avgOcc      = Math.round(fleet.reduce((s, b) => s + b.occupancyPct, 0) / fleet.length);
    const fullCount   = fleet.filter(b => b.status === 'Bus Full').length;
    const doorCount   = fleet.filter(b => b.doorAlert).length;

    setText('totalBuses',      currentBuses.length || fleet.length);
    setText('activeBuses',     fleet.length);
    setText('totalPassengers', totalPax);
    setText('avgCapacity',     avgOcc + '%');
    setText('busesFull',       fullCount);
    setText('doorAlerts',      doorCount);

    // Health strip
    const online  = fleet.filter(b => b.deviceOnline).length;
    setText('hs-online',  online);
    setText('hs-offline', fleet.length - online);
    setText('hs-pax',     totalPax);
    setText('hs-occ',     avgOcc + '%');
    setText('hs-time',    new Date().toLocaleTimeString());
    setText('lastSyncTime', new Date().toLocaleTimeString());

    tbody.innerHTML = fleet.map(b => {
        const seatsAvail    = Math.max(0, b.seating - Math.min(b.passengers, b.seating));
        const standingAvail = Math.max(0, b.standing - Math.max(0, b.passengers - b.seating));
        const pct           = b.occupancyPct;
        const barClass      = pct < 50 ? 'low' : pct < 80 ? 'mid' : 'high';
        const pillClass     = b.status === 'Seats Available' ? 'pill-ok' : b.status === 'Bus Full' ? 'pill-danger' : 'pill-warn';
        const devClass      = b.deviceOnline ? 'ok' : 'offline';

        return `<tr>
            <td class="td-mono">${b.busId}</td>
            <td>${b.route}</td>
            <td>${b.currentStop}</td>
            <td>
                <div style="display:flex;align-items:center;gap:.6rem;min-width:120px">
                    <div class="occ-bar-track" style="flex:1;height:8px">
                        <div class="occ-bar-fill ${barClass}" style="width:${pct}%"></div>
                    </div>
                    <span style="font-size:.78rem;font-weight:700;width:36px;text-align:right">${pct}%</span>
                </div>
            </td>
            <td style="font-weight:700">${b.passengers}</td>
            <td>${seatsAvail}</td>
            <td>${standingAvail}</td>
            <td><span class="status-pill ${pillClass}">${b.status}</span></td>
            <td><span class="live-dot ${devClass}"></span> ${b.deviceOnline ? '<span style="color:var(--clr-ok);font-size:.8rem;font-weight:600">Online</span>' : '<span style="color:var(--clr-offline);font-size:.8rem">Offline</span>'}</td>
            <td style="font-size:.8rem;color:var(--txt-muted)">${b.lastUpdate}</td>
        </tr>`;
    }).join('');
}

function refreshLiveMonitoring() {
    renderFleet(MockWS.getFleetSnapshot());
    Notify.success('Refreshed', 'Live monitoring data updated');
}

/* ── SYSTEM HEALTH ──────────────────────────────────────── */
function updateSystemHealth(data) {
    const dot   = document.getElementById('healthDot');
    const label = document.getElementById('healthLabel');
    if (dot && label) {
        dot.className   = data.offlineDevices > 0 ? 'health-dot warn' : 'health-dot ok';
        label.textContent = data.offlineDevices > 0
            ? `${data.offlineDevices} Device(s) Offline`
            : 'All Systems Online';
    }
}

function updateDeviceHealth() { /* handled by fleet_update */ }

/* ── MAP ────────────────────────────────────────────────── */
function initMap() {
    if (liveMap) return;
    const mapEl = document.getElementById('liveMap');
    if (!mapEl || !window.L) return;

    // Remove overlay inside map container for leaflet
    mapEl.style.padding = '0';

    liveMap = L.map('liveMap').setView([12.9716, 77.5946], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(liveMap);

    // Initial markers
    MockWS.getFleetSnapshot().forEach(b => plotBusOnMap(b));

    // Keep markers updated
    MockWS.on('location_update', function(d) {
        const buses = MockWS.getFleetSnapshot();
        const bus   = buses.find(b => b.busId === d.busId);
        if (bus) plotBusOnMap(bus);
    });

    // Bus stop markers
    MockWS.getStops().forEach((stop, i) => {
        const lat = 12.96 + (i * 0.004);
        const lng = 77.58 + (i * 0.003);
        const stopIcon = L.divIcon({
            className: '',
            html: `<div class="stop-marker-icon"><i class="fas fa-circle-dot" style="font-size:.6rem"></i></div>`,
            iconSize: [22, 22], iconAnchor: [11, 11]
        });
        L.marker([lat, lng], { icon: stopIcon })
            .addTo(liveMap)
            .bindPopup(`<b>${stop}</b><br>Bus Stop`);
    });
}

function plotBusOnMap(bus) {
    if (!liveMap) return;
    const lat = bus.lat || (12.96 + Math.random() * 0.04);
    const lng = bus.lng || (77.58 + Math.random() * 0.04);

    const color  = bus.occupancyPct < 50 ? '#10b981' : bus.occupancyPct < 80 ? '#f59e0b' : '#ef4444';
    const busIcon = L.divIcon({
        className: '',
        html: `<div style="background:${color};width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);font-size:.85rem"><i class="fas fa-bus"></i></div>`,
        iconSize: [30, 30], iconAnchor: [15, 15]
    });

    if (busMarkers[bus.busId]) {
        busMarkers[bus.busId].setLatLng([lat, lng]);
        busMarkers[bus.busId].setIcon(busIcon);
    } else {
        busMarkers[bus.busId] = L.marker([lat, lng], { icon: busIcon })
            .addTo(liveMap)
            .bindPopup(`<b>${bus.busId}</b><br>${bus.busNumber}<br>Passengers: ${bus.passengers}<br>Status: ${bus.status}`);
    }
}

function recenterMap() {
    if (liveMap) liveMap.setView([12.9716, 77.5946], 12);
}

/* ── ANALYTICS ──────────────────────────────────────────── */
function initAnalytics() {
    const data = MockWS.getAnalyticsData();
    initOccTrendChart(data);
    initPassengerChart(data);
    initRoutePerf(data);
    initHeatmap(data);
}

function refreshCharts() {
    if (chartOcc)  chartOcc.destroy();
    if (chartPax)  chartPax.destroy();
    if (chartHeat) chartHeat.destroy();
    chartOcc = chartPax = chartHeat = null;
    initAnalytics();
    Notify.success('Charts Updated', 'Analytics data refreshed');
}

function initOccTrendChart(data) {
    if (chartOcc) return;
    const ctx = document.getElementById('occTrendChart');
    if (!ctx || !window.Chart) return;
    chartOcc = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.hours,
            datasets: [{
                label: 'Avg Occupancy %',
                data: data.occupancy,
                borderColor: '#00c9a7',
                backgroundColor: 'rgba(0,201,167,.12)',
                fill: true,
                tension: .4,
                pointRadius: 4,
                pointBackgroundColor: '#00c9a7'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: {
                y: { beginAtZero: true, max: 100,
                     ticks: { callback: v => v + '%' },
                     grid: { color: 'rgba(0,0,0,.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function initPassengerChart(data) {
    if (chartPax) return;
    const ctx = document.getElementById('passengerChart');
    if (!ctx || !window.Chart) return;
    chartPax = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.hours,
            datasets: [{
                label: 'Total Passengers',
                data: data.passengers,
                backgroundColor: data.passengers.map(v =>
                    v > 200 ? 'rgba(239,68,68,.7)' : v > 120 ? 'rgba(245,158,11,.7)' : 'rgba(16,185,129,.7)'
                ),
                borderRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function initRoutePerf(data) {
    const tbody = document.getElementById('routePerfBody');
    if (!tbody) return;
    tbody.innerHTML = data.routes.map(r => {
        const pct     = r.avgOcc;
        const cls     = pct < 50 ? 'low' : pct < 80 ? 'mid' : 'high';
        const onTimeCls = r.onTime >= 90 ? 'pill-ok' : r.onTime >= 75 ? 'pill-warn' : 'pill-danger';
        return `<tr>
            <td class="td-mono">${r.id}</td><td>${r.name}</td>
            <td>
                <div style="display:flex;align-items:center;gap:.5rem">
                    <div class="occ-bar-track" style="flex:1;height:8px"><div class="occ-bar-fill ${cls}" style="width:${pct}%"></div></div>
                    <span style="font-size:.8rem;font-weight:700;width:32px">${pct}%</span>
                </div>
            </td>
            <td>${r.trips}</td>
            <td><span class="status-pill ${onTimeCls}">${r.onTime}%</span></td>
            <td>${pct > 80 ? '<span style="color:var(--clr-danger)">↑ High</span>' : pct > 60 ? '<span style="color:var(--clr-warn)">→ Normal</span>' : '<span style="color:var(--clr-ok)">↓ Low</span>'}</td>
        </tr>`;
    }).join('');
}

function initHeatmap(data) {
    if (chartHeat) return;
    const ctx = document.getElementById('heatmapChart');
    if (!ctx || !window.Chart) return;

    const days       = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const peakHours  = [6,7,8,9,17,18,19];
    const labels     = peakHours.map(h => h + ':00');
    const datasets   = days.map((d, di) => ({
        label: d,
        data: peakHours.map(h => {
            const item = data.heatmap.find(x => x.day === d && x.hour === h);
            return item ? item.value : 0;
        }),
        backgroundColor: `hsla(${di * 50},70%,55%,.75)`,
        borderRadius: 3, barThickness: 18
    }));

    chartHeat = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'right' } },
            scales: {
                y: { beginAtZero: true, max: 100,
                     ticks: { callback: v => v + '%' },
                     grid: { color: 'rgba(0,0,0,.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

/* ── CRUD: BUSES ────────────────────────────────────────── */
async function handleAddBus(e) {
    e.preventDefault();
    const formData = {
        busId:            document.getElementById('busId').value.trim(),
        busNumber:        document.getElementById('busNumber').value.trim(),
        seatingCapacity:  parseInt(document.getElementById('seatingCapacity').value),
        standingCapacity: parseInt(document.getElementById('standingCapacity').value),
        totalCapacity:    parseInt(document.getElementById('totalCapacity').value)
    };
    try {
        const newBus = await addBus(formData);
        currentBuses.push(newBus);
        renderBusTable();
        populateBusDropdowns();
        e.target.reset();
        Notify.success('Bus Added', `${formData.busId} created successfully`);
    } catch(err) { Notify.error('Error', err.message); }
}

function renderBusTable() {
    const tbody = document.getElementById('busTableBody');
    if (!tbody) return;
    if (!currentBuses.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--txt-muted)">No buses added yet</td></tr>';
        return;
    }
    tbody.innerHTML = currentBuses.map(bus => `
        <tr>
            <td class="td-mono">${bus.busId}</td>
            <td>${bus.busNumber}</td>
            <td>${bus.seatingCapacity}</td>
            <td>${bus.standingCapacity}</td>
            <td><strong>${bus.totalCapacity}</strong></td>
            <td><span class="status-pill ${bus.status === 'active' ? 'pill-ok' : 'pill-info'}">${bus.status || 'inactive'}</span></td>
            <td style="display:flex;gap:.4rem">
                <button class="btn btn-ghost btn-sm" onclick="editBus('${bus.busId}')"><i class="fas fa-pen"></i></button>
                <button class="btn btn-danger btn-sm" onclick="deleteBusConfirm('${bus.busId}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`).join('');
}

/* ── CRUD: SECTORS ──────────────────────────────────────── */
async function handleAddSector(e) {
    e.preventDefault();
    const formData = {
        sectorId:   document.getElementById('sectorId').value.trim(),
        sectorName: document.getElementById('sectorName').value.trim(),
        phone:      document.getElementById('sectorPhone').value.trim(),
        zone:       document.getElementById('sectorZone').value.trim(),
        password:   document.getElementById('sectorPassword').value
    };
    try {
        const newSector = await addSector(formData);
        currentSectors.push(newSector);
        renderSectorTable();
        e.target.reset();
        Notify.success('Sector Added', `${formData.sectorId} created successfully`);
    } catch(err) { Notify.error('Error', err.message); }
}

function renderSectorTable() {
    const tbody = document.getElementById('sectorTableBody');
    if (!tbody) return;
    if (!currentSectors.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--txt-muted)">No sector incharges added yet</td></tr>';
        return;
    }
    tbody.innerHTML = currentSectors.map(s => `
        <tr>
            <td class="td-mono">${s.sectorId}</td>
            <td>${s.sectorName}</td>
            <td>${s.phone}</td>
            <td>${s.zone}</td>
            <td><span class="status-pill ${s.status === 'active' ? 'pill-ok' : 'pill-warn'}">${s.status || 'inactive'}</span></td>
            <td style="display:flex;gap:.4rem">
                <button class="btn btn-ghost btn-sm" onclick="editSector('${s.sectorId}')"><i class="fas fa-pen"></i></button>
                <button class="btn btn-danger btn-sm" onclick="deleteSectorConfirm('${s.sectorId}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`).join('');
}

/* ── CRUD: ROUTES ───────────────────────────────────────── */
async function handleAddRoute(e) {
    e.preventDefault();
    const stops = Array.from(document.querySelectorAll('.stop-input')).map(i => i.value.trim()).filter(Boolean);
    const buses = Array.from(document.getElementById('assignBusToRoute').selectedOptions).map(o => o.value);
    const formData = {
        routeId:   document.getElementById('routeId').value.trim(),
        routeName: document.getElementById('routeName').value.trim(),
        stops, buses
    };
    try {
        const newRoute = await addRoute(formData);
        currentRoutes.push(newRoute);
        renderRoutesView();
        e.target.reset();
        document.getElementById('stopsContainer').innerHTML = `
            <div class="stop-input-group">
                <input type="text" class="stop-input" placeholder="Stop 1">
                <button type="button" class="btn btn-outline btn-sm" onclick="addStopInput()"><i class="fas fa-plus"></i></button>
            </div>`;
        Notify.success('Route Created', `Route ${formData.routeId} saved`);
    } catch(err) { Notify.error('Error', err.message); }
}

function renderRoutesView() {
    const container = document.getElementById('routesList');
    if (!container) return;
    if (!currentRoutes.length) {
        container.innerHTML = '<p style="text-align:center;color:var(--txt-muted)">No routes configured yet</p>';
        return;
    }
    container.innerHTML = currentRoutes.map(route => `
        <div class="route-card-mini">
            <div class="rc-header">
                <span class="rc-id">${route.routeId}</span>
                <button class="btn btn-danger btn-sm" onclick="deleteRouteConfirm('${route.routeId}')"><i class="fas fa-trash"></i></button>
            </div>
            <div class="rc-name">${route.routeName}</div>
            <div class="route-stop-list" style="margin:.6rem 0">
                ${route.stops.map((stop, i) => `
                    ${i > 0 ? '<div style="width:20px;height:2px;background:var(--border);margin:0 2px"></div>' : ''}
                    <div style="display:inline-flex;flex-direction:column;align-items:center">
                        <div style="width:10px;height:10px;border-radius:50%;border:2px solid var(--clr-accent);background:#fff"></div>
                        <span style="font-size:.7rem;color:var(--txt-secondary);max-width:70px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${stop}</span>
                    </div>`).join('')}
            </div>
            <div style="font-size:.8rem;color:var(--txt-muted)">
                <i class="fas fa-bus" style="color:var(--clr-accent)"></i>
                ${route.buses && route.buses.length ? route.buses.join(', ') : 'No buses assigned'}
            </div>
        </div>`).join('');
}

/* ── HELPERS ────────────────────────────────────────────── */
function addStopInput() {
    const container = document.getElementById('stopsContainer');
    const count     = container.querySelectorAll('.stop-input').length;
    const div       = document.createElement('div');
    div.className   = 'stop-input-group';
    div.innerHTML   = `
        <input type="text" class="stop-input" placeholder="Stop ${count + 1}">
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()"><i class="fas fa-minus"></i></button>`;
    container.appendChild(div);
}

function updateTotalCapacity() {
    const s = parseInt(document.getElementById('seatingCapacity')?.value || 0);
    const t = parseInt(document.getElementById('standingCapacity')?.value || 0);
    const f = document.getElementById('totalCapacity');
    if (f) f.value = s + t;
}

function populateBusDropdowns() {
    const sel = document.getElementById('assignBusToRoute');
    if (sel) sel.innerHTML = currentBuses.map(b =>
        `<option value="${b.busId}">${b.busId} – ${b.busNumber}</option>`).join('');
}

function editBus(busId) {
    const bus = currentBuses.find(b => b.busId === busId);
    if (!bus) return;
    document.getElementById('busId').value            = bus.busId;
    document.getElementById('busNumber').value        = bus.busNumber;
    document.getElementById('seatingCapacity').value  = bus.seatingCapacity;
    document.getElementById('standingCapacity').value = bus.standingCapacity;
    updateTotalCapacity();
    // Switch to bus management tab
    document.querySelectorAll('.ent-sidebar .sidebar-menu li').forEach(li => {
        li.classList.toggle('active', li.getAttribute('data-section') === 'bus-management');
    });
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById('bus-management').classList.add('active');
}

async function deleteBusConfirm(busId) {
    if (!confirm(`Delete bus ${busId}?`)) return;
    await deleteBus(busId);
    currentBuses = currentBuses.filter(b => b.busId !== busId);
    renderBusTable();
    populateBusDropdowns();
    Notify.success('Deleted', `Bus ${busId} removed`);
}

function editSector(sectorId) {
    const s = currentSectors.find(x => x.sectorId === sectorId);
    if (!s) return;
    document.getElementById('sectorId').value       = s.sectorId;
    document.getElementById('sectorName').value     = s.sectorName;
    document.getElementById('sectorPhone').value    = s.phone;
    document.getElementById('sectorZone').value     = s.zone;
}

function deleteSectorConfirm(sectorId) {
    if (!confirm(`Delete sector ${sectorId}?`)) return;
    currentSectors = currentSectors.filter(s => s.sectorId !== sectorId);
    localStorage.setItem('sectors', JSON.stringify(currentSectors));
    renderSectorTable();
    Notify.success('Deleted', `Sector ${sectorId} removed`);
}

function deleteRouteConfirm(routeId) {
    if (!confirm(`Delete route ${routeId}?`)) return;
    currentRoutes = currentRoutes.filter(r => r.routeId !== routeId);
    localStorage.setItem('routes', JSON.stringify(currentRoutes));
    renderRoutesView();
    Notify.success('Deleted', `Route ${routeId} removed`);
}

function updateBusMarker(data) { /* handled by location_update listener in initMap */ }

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

// Expose for inline onclick
window.addStopInput        = addStopInput;
window.editBus             = editBus;
window.deleteBusConfirm    = deleteBusConfirm;
window.editSector          = editSector;
window.deleteSectorConfirm = deleteSectorConfirm;
window.deleteRouteConfirm  = deleteRouteConfirm;
window.refreshLiveMonitoring = refreshLiveMonitoring;
window.recenterMap         = recenterMap;
window.refreshCharts       = refreshCharts;
