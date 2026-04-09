/**
 * Sector Incharge Dashboard � Enterprise Edition
 * MockWS real-time fleet monitoring + full CRUD for operators
 */

//  Helpers 
function el(id) { return document.getElementById(id); }
function setText(id, v) { const e = el(id); if (e) e.textContent = v; }
function fmt(d) {
    return new Date(d).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}
function safeJsonParse(raw, fallback) {
    try { return JSON.parse(raw); }
    catch (_err) { return fallback; }
}

let sectorLiveMap = null;
let sectorMapMarkers = {};
let latestSectorFleet = [];

const ESP32_SHARED_TELEMETRY_KEY = 'smartbus_esp32_latest_bus_data';
const SECTOR_MAP_CENTER = [12.9716, 77.5946];

//  Init 
document.addEventListener('DOMContentLoaded', async function () {
    checkRoleAccess('sector');

    setInterval(() => setText('navClock', new Date().toLocaleTimeString('en-IN')), 1000);
    setText('navClock', new Date().toLocaleTimeString('en-IN'));

    const user = getCurrentUser();
    if (user) {
        setText('sectorName', user.name || user.id || 'Sector Incharge');
        setText('sectorZone', user.zone || user.sectorId || 'Zone 1');
    }

    setupSidebar();
    await loadSectorData();
    initSectorMap();
    applyStoredBusTelemetry();

    el('addOperatorForm')?.addEventListener('submit', handleAddOperator);
    el('reportForm')?.addEventListener('submit', handleGenerateReport);
    el('recenterSectorMapBtn')?.addEventListener('click', recenterSectorMap);

    window.addEventListener('storage', onSharedTelemetryChange);

    MockWS.start();
    Notify.connectToMockWS();
    MockWS.on('fleet_update',  onFleetUpdate);
    MockWS.on('location_update', onLocationUpdate);
    MockWS.on('system_health', onSystemHealth);
});

//  Sidebar 
function setupSidebar() {
    const items    = document.querySelectorAll('.sidebar-menu li');
    const sections = document.querySelectorAll('.content-section');
    items.forEach(item => {
        item.addEventListener('click', function () {
            items.forEach(i => i.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            this.classList.add('active');
            const target = document.getElementById(this.dataset.section);
            if (target) target.classList.add('active');
        });
    });
}

//  Load Data 
async function loadSectorData() {
    const [buses, operators, routes] = await Promise.all([getBuses(), getOperators(), getRoutes()]);

    const fleet    = MockWS.getFleetSnapshot();
    latestSectorFleet = fleet;
    const active   = fleet.filter(b => b.status !== 'offline').length;
    const totalPax = fleet.reduce((a, b) => a + (b.passengers || 0), 0);
    const alerts   = fleet.filter(b => b.occupancyPct >= 100).length;

    setText('statTotalBuses',  buses.length  || fleet.length);
    setText('statActiveBuses', active);
    setText('statPassengers',  totalPax);
    setText('statOperators',   operators.length);
    setText('statAlerts',      alerts);
    setText('statRoutes',      routes.length);

    setText('sysFleetStatus', `${active}/${fleet.length} active`);
    setText('sysAlerts',      `${alerts} active`);
    setText('sysLastUpdate',  fmt(Date.now()));
    setText('lastSyncTime',   fmt(Date.now()));

    renderDashboardFleet(fleet);
    renderMonitoringTable(fleet, buses);
    renderOperatorTable(operators);
    renderRoutes(routes);
    populateBusDropdown(buses);

    fleet.forEach(plotBusOnSectorMap);
}

//  MockWS Handlers 
function onFleetUpdate(fleet) {
    latestSectorFleet = fleet;
    const active   = fleet.filter(b => b.status !== 'offline').length;
    const totalPax = fleet.reduce((a, b) => a + (b.passengers || 0), 0);
    const alerts   = fleet.filter(b => b.occupancyPct >= 100).length;

    setText('statActiveBuses', active);
    setText('statPassengers',  totalPax);
    setText('statAlerts',      alerts);
    setText('sysFleetStatus',  `${active}/${fleet.length} active`);
    setText('sysAlerts',       `${alerts} active`);
    setText('sysLastUpdate',   fmt(Date.now()));
    setText('lastSyncTime',    fmt(Date.now()));

    if (el('healthDot')) el('healthDot').className = alerts > 0 ? 'health-dot warn' : 'health-dot ok';

    renderDashboardFleet(fleet);
    renderMonitoringTable(fleet, null);
    fleet.forEach(plotBusOnSectorMap);
}

function onLocationUpdate(data) {
    if (!data || !data.busId) return;
    const existing = latestSectorFleet.find(b => b.busId === data.busId);
    if (existing) {
        existing.lat = data.lat;
        existing.lng = data.lng;
        plotBusOnSectorMap(existing);
    }
}

function onSystemHealth(data) {
    const online = (data.onlineCount || 0);
    const total  = (data.totalCount  || 6);
    if (el('sysOnlineDot')) el('sysOnlineDot').className = 'live-dot ' + (online === total ? 'ok' : 'warn');
}

//  Live Map 
function initSectorMap() {
    if (sectorLiveMap) return;
    const mapEl = el('sectorLiveMap');
    if (!mapEl || !window.L) return;

    mapEl.style.padding = '0';
    sectorLiveMap = L.map('sectorLiveMap').setView(SECTOR_MAP_CENTER, 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'OpenStreetMap contributors'
    }).addTo(sectorLiveMap);

    MockWS.getFleetSnapshot().forEach(plotBusOnSectorMap);

    MockWS.getStops().forEach((stop, i) => {
        const lat = 12.96 + (i * 0.004);
        const lng = 77.58 + (i * 0.003);
        const stopIcon = L.divIcon({
            className: '',
            html: '<div class="stop-marker-icon"><i class="fas fa-circle-dot" style="font-size:.6rem"></i></div>',
            iconSize: [22, 22],
            iconAnchor: [11, 11]
        });
        L.marker([lat, lng], { icon: stopIcon })
            .addTo(sectorLiveMap)
            .bindPopup(`<b>${stop}</b><br>Bus Stop`);
    });

    setTimeout(() => sectorLiveMap.invalidateSize(), 200);
}

function plotBusOnSectorMap(bus) {
    if (!sectorLiveMap || !bus || !bus.busId) return;

    const lat = Number(bus.lat ?? bus.latitude);
    const lng = Number(bus.lng ?? bus.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const occupancy = Number(bus.occupancyPct || 0);
    const color = occupancy < 50 ? '#10b981' : occupancy < 80 ? '#f59e0b' : '#ef4444';
    const busIcon = L.divIcon({
        className: '',
        html: `<div style="background:${color};width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);font-size:.85rem"><i class="fas fa-bus"></i></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });

    const popup = `<b>${bus.busId}</b><br>${bus.busNumber || bus.busId}<br>Passengers: ${bus.passengers || 0}<br>Status: ${bus.status || 'Running'}`;

    if (sectorMapMarkers[bus.busId]) {
        sectorMapMarkers[bus.busId].setLatLng([lat, lng]);
        sectorMapMarkers[bus.busId].setIcon(busIcon);
        sectorMapMarkers[bus.busId].setPopupContent(popup);
    } else {
        sectorMapMarkers[bus.busId] = L.marker([lat, lng], { icon: busIcon })
            .addTo(sectorLiveMap)
            .bindPopup(popup);
    }
}

function recenterSectorMap() {
    if (sectorLiveMap) sectorLiveMap.setView(SECTOR_MAP_CENTER, 12);
}

function applyStoredBusTelemetry() {
    const telemetry = safeJsonParse(localStorage.getItem(ESP32_SHARED_TELEMETRY_KEY), null);
    if (!telemetry || typeof telemetry !== 'object') return;

    const lat = Number(telemetry.latitude ?? telemetry.lat);
    const lng = Number(telemetry.longitude ?? telemetry.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    plotBusOnSectorMap({
        busId: telemetry.busId || 'BUS001',
        busNumber: telemetry.busId || 'BUS001',
        passengers: Number(telemetry.passengerCount || 0),
        occupancyPct: 0,
        status: telemetry.safetyStatus === 'BLOCKED' ? 'Safety Alert' : 'Running',
        lat,
        lng
    });
}

function onSharedTelemetryChange(event) {
    if (event.key !== ESP32_SHARED_TELEMETRY_KEY || !event.newValue) return;
    applyStoredBusTelemetry();
}

//  Dashboard Fleet Quick View 
function renderDashboardFleet(fleet) {
    const tbody = el('dashboardFleetBody'); if (!tbody) return;
    tbody.innerHTML = fleet.slice(0, 8).map(b => {
        const pct = b.occupancyPct || 0;
        const lvl = pct < 50 ? 'low' : pct < 80 ? 'mid' : 'high';
        const pill = pct >= 100 ? 'pill-full' : pct >= 80 ? 'pill-warn' : 'pill-ok';
        const label = pct >= 100 ? 'Full' : pct >= 80 ? 'Near Full' : 'OK';
        return `<tr>
            <td><strong>${b.busId}</strong></td>
            <td>${b.routeId || '�'}</td>
            <td>${b.passengers || 0}</td>
            <td>
                <div class="occ-bar-track" style="max-width:120px">
                    <div class="occ-bar-fill ${lvl}" style="width:${Math.min(pct,100)}%"></div>
                </div>
                <small>${pct.toFixed(0)}%</small>
            </td>
            <td><span class="status-pill ${pill}">${label}</span></td>
        </tr>`;
    }).join('');
}

//  Bus Monitoring Table 
function renderMonitoringTable(fleet, buses) {
    const tbody = el('monitoringTableBody'); if (!tbody) return;
    if (!fleet.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--txt-muted)">No buses found</td></tr>';
        return;
    }
    tbody.innerHTML = fleet.map(b => {
        const pct  = b.occupancyPct || 0;
        const lvl  = pct < 50 ? 'low' : pct < 80 ? 'mid' : 'high';
        const pill = pct >= 100 ? 'pill-full' : pct >= 80 ? 'pill-warn' : 'pill-ok';
        const stat = pct >= 100 ? 'Full' : pct >= 80 ? 'Near Full' : 'Running';
        const devLvl = b.deviceOnline !== false ? 'ok' : 'danger';
        const devTxt = b.deviceOnline !== false ? 'Online' : 'Offline';
        return `<tr>
            <td><span class="mono">${b.busId}</span></td>
            <td>${b.plate || '�'}</td>
            <td>${b.routeId || '�'}</td>
            <td>
                <div class="occ-bar-track" style="max-width:100px;display:inline-block;vertical-align:middle">
                    <div class="occ-bar-fill ${lvl}" style="width:${Math.min(pct,100)}%"></div>
                </div>
                <small style="margin-left:.3rem">${pct.toFixed(0)}%</small>
            </td>
            <td>${b.passengers || 0} / ${(b.seatingCapacity||40)+(b.standingCapacity||20)}</td>
            <td><span class="live-dot ${devLvl}" style="margin-right:.3rem"></span>${devTxt}</td>
            <td><span class="status-pill ${pill}">${stat}</span></td>
        </tr>`;
    }).join('');
}

//  Operator Table 
function renderOperatorTable(operators) {
    const tbody = el('operatorTableBody'); if (!tbody) return;
    if (!operators.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--txt-muted)">No operators registered</td></tr>';
        return;
    }
    tbody.innerHTML = operators.map(op => `
        <tr>
            <td><span class="mono">${op.id || op.operatorId}</span></td>
            <td>${op.name}</td>
            <td>${op.phone || '�'}</td>
            <td>${op.busId || op.assignedBus || '�'}</td>
            <td><span class="status-pill ${op.active !== false ? 'pill-ok' : 'pill-warn'}">${op.active !== false ? 'Active' : 'Inactive'}</span></td>
            <td><button class="btn btn-danger-sm" onclick="deleteOperatorRow('${op.id || op.operatorId}')"><i class="fas fa-trash"></i></button></td>
        </tr>`).join('');
}

//  Add Operator 
async function handleAddOperator(e) {
    e.preventDefault();
    const data = {
        id:          el('operatorId').value.trim(),
        name:        el('operatorName').value.trim(),
        phone:       el('operatorPhone').value.trim(),
        busId:       el('assignedBus').value,
        password:    el('operatorPassword').value,
        active:      true
    };
    if (!data.id || !data.name) { showFormAlert('operatorFormAlert', 'ID and name are required.', 'warn'); return; }

    try {
        await addOperator(data);
        Notify.success('Operator Added', `${data.name} has been registered.`);
        e.target.reset();
        clearFormAlert('operatorFormAlert');
        const ops = await getOperators();
        renderOperatorTable(ops);
        setText('statOperators', ops.length);
    } catch (err) {
        showFormAlert('operatorFormAlert', 'Error: ' + err.message, 'danger');
        Notify.error('Error', err.message);
    }
}

async function deleteOperatorRow(opId) {
    if (!confirm(`Remove operator ${opId}?`)) return;
    try {
        await deleteOperator(opId);
        Notify.warning('Operator Removed', `Operator ${opId} has been removed.`);
        const ops = await getOperators();
        renderOperatorTable(ops);
        setText('statOperators', ops.length);
    } catch (err) {
        Notify.error('Error', err.message);
    }
}

//  Routes 
function renderRoutes(routes) {
    const container = el('routesList'); if (!container) return;
    if (!routes.length) {
        container.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--txt-muted)">No routes found</div>';
        return;
    }
    container.innerHTML = routes.map(r => `
        <div class="ent-card route-card">
            <div class="ent-card-header">
                <div class="ent-card-title"><i class="fas fa-route"></i> ${r.routeName || r.routeId}</div>
                <span class="status-pill pill-ok">Active</span>
            </div>
            <div class="ent-card-body">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:.75rem">
                    <div><div style="font-size:.72rem;color:var(--txt-muted);text-transform:uppercase">Start</div><div style="font-weight:600">${(r.stops && r.stops[0]) || '�'}</div></div>
                    <div><div style="font-size:.72rem;color:var(--txt-muted);text-transform:uppercase">End</div><div style="font-weight:600">${(r.stops && r.stops[r.stops.length-1]) || '�'}</div></div>
                    <div><div style="font-size:.72rem;color:var(--txt-muted);text-transform:uppercase">Stops</div><div style="font-weight:600">${(r.stops && r.stops.length) || 0}</div></div>
                    <div><div style="font-size:.72rem;color:var(--txt-muted);text-transform:uppercase">Buses</div><div style="font-weight:600">${(r.buses && r.buses.length) || 0}</div></div>
                </div>
                ${r.stops && r.stops.length ? `<div style="font-size:.78rem;color:var(--txt-muted)">${r.stops.join('  ')}</div>` : ''}
            </div>
        </div>`).join('');
}

//  Bus Dropdown 
async function populateBusDropdown(buses) {
    const sel = el('assignedBus'); if (!sel) return;
    const fleet = MockWS.getFleetSnapshot();
    const allBuses = buses.length ? buses : fleet;
    const opts = allBuses.map(b => `<option value="${b.busId || b.id}">${b.busId || b.id} � ${b.plate || b.registrationNumber || ''}</option>`).join('');
    sel.innerHTML = '<option value="">Select bus</option>' + opts;
}

//  Reports 
async function handleGenerateReport(e) {
    e.preventDefault();
    const type = el('reportType').value;
    const fleet = MockWS.getFleetSnapshot();
    const ops   = await getOperators();

    const statsEl = el('reportStats');
    const outEl   = el('reportOutput');

    const totalPax  = fleet.reduce((a, b) => a + (b.passengers || 0), 0);
    const fullBuses = fleet.filter(b => b.occupancyPct >= 100).length;
    const avgOcc    = fleet.length ? (fleet.reduce((a, b) => a + (b.occupancyPct || 0), 0) / fleet.length).toFixed(1) : 0;

    if (statsEl) {
        statsEl.innerHTML = `
            <div class="stat-card"><div class="stat-icon-wrap teal"><i class="fas fa-users"></i></div><div class="stat-body"><div class="stat-label">Total Passengers</div><div class="stat-value">${totalPax}</div></div></div>
            <div class="stat-card"><div class="stat-icon-wrap orange"><i class="fas fa-gauge-high"></i></div><div class="stat-body"><div class="stat-label">Avg Occupancy</div><div class="stat-value">${avgOcc}%</div></div></div>
            <div class="stat-card"><div class="stat-icon-wrap red"><i class="fas fa-ban"></i></div><div class="stat-body"><div class="stat-label">Full Buses</div><div class="stat-value">${fullBuses}</div></div></div>
            <div class="stat-card"><div class="stat-icon-wrap blue"><i class="fas fa-bus"></i></div><div class="stat-body"><div class="stat-label">Fleet Size</div><div class="stat-value">${fleet.length}</div></div></div>`;
    }

    if (type === 'operator') {
        setText('reportTitle', 'Operator Performance Report');
        el('reportThead').innerHTML = '<tr><th>Operator</th><th>Bus</th><th>Status</th></tr>';
        el('reportTbody').innerHTML = ops.length
            ? ops.map(op => `<tr><td>${op.name}</td><td>${op.busId||'�'}</td><td><span class="status-pill pill-ok">Active</span></td></tr>`).join('')
            : '<tr><td colspan="3" style="text-align:center;color:var(--txt-muted)">No data</td></tr>';
        if (outEl) outEl.style.display = '';
    } else if (type === 'route') {
        setText('reportTitle', 'Fleet Performance by Route');
        const byRoute = {};
        fleet.forEach(b => { const k = b.routeId||'Unknown'; if (!byRoute[k]) byRoute[k] = {count:0,pax:0}; byRoute[k].count++; byRoute[k].pax+=(b.passengers||0); });
        el('reportThead').innerHTML = '<tr><th>Route</th><th>Buses</th><th>Passengers</th><th>Avg/Bus</th></tr>';
        el('reportTbody').innerHTML = Object.entries(byRoute).map(([r,d]) =>
            `<tr><td>${r}</td><td>${d.count}</td><td>${d.pax}</td><td>${(d.pax/d.count).toFixed(0)}</td></tr>`).join('');
        if (outEl) outEl.style.display = '';
    } else {
        setText('reportTitle', type === 'daily' ? 'Daily Summary' : 'Weekly Summary');
        el('reportThead').innerHTML = '<tr><th>Bus</th><th>Route</th><th>Passengers</th><th>Occupancy %</th><th>Status</th></tr>';
        el('reportTbody').innerHTML = fleet.map(b => {
            const pct = b.occupancyPct||0;
            const pill = pct>=100 ? 'pill-full' : pct>=80 ? 'pill-warn' : 'pill-ok';
            return `<tr><td>${b.busId}</td><td>${b.routeId||'�'}</td><td>${b.passengers||0}</td><td>${pct.toFixed(0)}%</td><td><span class="status-pill ${pill}">${pct>=100?'Full':pct>=80?'Near Full':'OK'}</span></td></tr>`;
        }).join('');
        if (outEl) outEl.style.display = '';
    }

    Notify.success('Report Generated', `${type.charAt(0).toUpperCase()+type.slice(1)} report is ready.`);
}

//  Form Alert Helpers 
function showFormAlert(boxId, msg, type) {
    const box = el(boxId); if (!box) return;
    box.innerHTML = `<div class="alert-panel ${type==='danger'?'alert-danger':'alert-warn'}" style="margin-bottom:1rem">
        <i class="fas fa-triangle-exclamation"></i><div>${msg}</div></div>`;
}
function clearFormAlert(boxId) { const b = el(boxId); if (b) b.innerHTML = ''; }
