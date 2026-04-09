/**
 * Operator Dashboard - Enterprise Edition
 * Frontend-first ESP32 connectivity + local ticketing + live map.
 */

// State
let myBusId = null;
let myBusSnapshot = null;
let currentRoute = null;
let recentTickets = [];
let ticketsToday = 0;
let alertHistory = [];
let stopIndex = 0;
let lastFleetSnapshot = [];
let tripActive = false;
let tripDirection = 'forward';

let operatorMap = null;
let operatorMapMarkers = {};
let operatorRoutePolyline = null;
let operatorRouteTrace = [];
let lastBusTelemetryPushMs = 0;

let esp32PollTimer = null;
let connectedBusEsp32Ip = '';
let connectedBusStopEsp32Ip = '';
let latestGps = null;
let lastSafetyStatus = 'UNKNOWN';

const LOCAL_TICKET_KEY = 'smartbus_tickets';
const ESP32_BUS_IP_KEY = 'smartbus_esp32_bus_ip';
const ESP32_BUSSTOP_IP_KEY = 'smartbus_esp32_busstop_ip';
const ESP32_SHARED_TELEMETRY_KEY = 'smartbus_esp32_latest_bus_data';
const ESP32_POLL_MS = 3000;
const DEFAULT_MAP_CENTER = [12.9716, 77.5946];
const DEFAULT_SEATING_CAPACITY = 40;
const ROUTE_TRACE_STORAGE_KEY = 'smartbus_route_trace';
const MAX_ROUTE_TRACE_POINTS = 240;
const DISABLE_TOAST_ALERTS = true;
const USE_MOCK_REALTIME_FEED = false;

// Helpers
function el(id) { return document.getElementById(id); }
function setText(id, value) {
    const node = el(id);
    if (node) node.textContent = value;
}
function fmt(value) {
    return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function safeJsonParse(raw, fallback) {
    try {
        return JSON.parse(raw);
    } catch (_err) {
        return fallback;
    }
}
function normalizeBaseUrl(value) {
    let base = String(value || '').trim();
    if (!base) return '';
    if (!/^https?:\/\//i.test(base)) base = `http://${base}`;
    return base.replace(/\/+$/, '');
}
async function fetchWithTimeout(url, options = {}, timeoutMs = 3000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}
function toNonNegativeInt(value, fallback = 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return Math.max(0, Number(fallback) || 0);
    return Math.max(0, Math.round(parsed));
}
function formatEtaLabel(value) {
    const text = String(value ?? '--').trim();
    const eta = Number(text);
    if (Number.isFinite(eta) && eta >= 0) return `${Math.round(eta)}m`;
    return '--';
}
function nextBusShortId(value) {
    const busId = String(value || '--').toUpperCase();
    if (busId.startsWith('BUS') && busId.length > 3) return busId.slice(3);
    return busId;
}
function deriveEtaMinutes() {
    const speed = Number(myBusSnapshot?.speedKmph || myBusSnapshot?.speed || 0);
    if (Number.isFinite(speed) && speed > 0) {
        if (speed >= 45) return 3;
        if (speed >= 30) return 4;
        if (speed >= 20) return 5;
        return 7;
    }
    const nextStop = String(el('nextStopName')?.textContent || '').trim();
    if (nextStop && nextStop !== '-' && nextStop !== 'End of Route') return 5;
    return '--';
}
function deriveNextBusInfo() {
    const currentRouteId = currentRoute?.routeId || currentRoute?.routeName || myBusSnapshot?.route || '';
    const peers = (Array.isArray(lastFleetSnapshot) ? lastFleetSnapshot : [])
        .filter(bus => bus && String(bus.busId || '').toUpperCase() !== String(myBusId || '').toUpperCase())
        .filter(bus => {
            const candidateRoute = bus.routeId || bus.routeName || bus.route || '';
            return currentRouteId ? candidateRoute === currentRouteId : true;
        })
        .map((bus, idx) => {
            const eta = toNonNegativeInt(bus.etaMin ?? bus.eta ?? (6 + (idx * 2)), 6 + (idx * 2));
            return {
                busId: String(bus.busId || '--').toUpperCase(),
                eta
            };
        })
        .sort((a, b) => a.eta - b.eta);

    if (!peers.length) return { nextBusId: '--', nextBusEta: '--' };
    return {
        nextBusId: peers[0].busId,
        nextBusEta: String(peers[0].eta)
    };
}
function buildBusDataPayload() {
    const bus = myBusSnapshot || {};
    const busId = String(myBusId || bus.busId || 'BUS001').toUpperCase();
    const passengers = toNonNegativeInt(bus.passengers ?? bus.passengerCount, 0);
    const seating = toNonNegativeInt(bus.seatingCapacity || bus.seating, DEFAULT_SEATING_CAPACITY) || DEFAULT_SEATING_CAPACITY;
    const seatsAvailable = Math.max(0, seating - Math.min(passengers, seating));
    const etaMin = deriveEtaMinutes();
    const nextInfo = deriveNextBusInfo();

    return {
        busId,
        passengers,
        seatsAvailable,
        etaMin,
        nextBusId: nextInfo.nextBusId,
        nextBusEta: nextInfo.nextBusEta,
        location: getCurrentLocationLabel()
    };
}
function updateBusStopDisplayPreview(payload) {
    const data = payload || buildBusDataPayload();
    const line1 = `${data.busId} P:${data.passengers} S:${data.seatsAvailable}`;
    const line2 = `Arr:${formatEtaLabel(data.etaMin)} N:${nextBusShortId(data.nextBusId)} ${formatEtaLabel(data.nextBusEta)}`;

    setText('busStopPreviewLine1', line1);
    setText('busStopPreviewLine2', line2);
    setText('busStopPreviewUpdated', fmt(Date.now()));
}
function resolveApiBaseUrl() {
    if (typeof getApiBase === 'function') {
        return normalizeBaseUrl(getApiBase());
    }
    if (window.SmartBusApi && typeof window.SmartBusApi.getApiBase === 'function') {
        return normalizeBaseUrl(window.SmartBusApi.getApiBase());
    }
    return '';
}
function safeParseUrl(value) {
    try {
        return new URL(String(value || ''));
    } catch (_err) {
        return null;
    }
}
function normalizeStopName(value) {
    return String(value || '').trim().toLowerCase();
}
function routeTraceStorageKey() {
    return `${ROUTE_TRACE_STORAGE_KEY}_${String(myBusId || 'BUS001').toUpperCase()}`;
}
function saveRouteTraceToStorage() {
    try {
        localStorage.setItem(routeTraceStorageKey(), JSON.stringify(operatorRouteTrace));
    } catch (_err) {
        // Ignore storage quota and serialization failures.
    }
}
function loadRouteTraceFromStorage() {
    const parsed = safeJsonParse(localStorage.getItem(routeTraceStorageKey()), []);
    if (!Array.isArray(parsed)) {
        operatorRouteTrace = [];
        return;
    }

    operatorRouteTrace = parsed
        .map(point => ({
            latitude: Number(point.latitude),
            longitude: Number(point.longitude),
            ts: point.ts || null
        }))
        .filter(point => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
        .slice(-MAX_ROUTE_TRACE_POINTS);
}
function renderRouteTrace() {
    if (!operatorMap || !window.L) return;

    if (operatorRoutePolyline) {
        operatorMap.removeLayer(operatorRoutePolyline);
        operatorRoutePolyline = null;
    }

    if (operatorRouteTrace.length < 2) return;

    const points = operatorRouteTrace.map(point => [point.latitude, point.longitude]);
    operatorRoutePolyline = L.polyline(points, {
        color: '#00c9a7',
        weight: 4,
        opacity: 0.65,
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(operatorMap);
}
function addRouteTracePoint(latitude, longitude, timestamp) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const lastPoint = operatorRouteTrace[operatorRouteTrace.length - 1];
    if (lastPoint) {
        const dLat = Math.abs(lastPoint.latitude - lat);
        const dLng = Math.abs(lastPoint.longitude - lng);
        if (dLat < 0.00001 && dLng < 0.00001) {
            return;
        }
    }

    operatorRouteTrace.push({ latitude: lat, longitude: lng, ts: timestamp || new Date().toISOString() });
    if (operatorRouteTrace.length > MAX_ROUTE_TRACE_POINTS) {
        operatorRouteTrace = operatorRouteTrace.slice(-MAX_ROUTE_TRACE_POINTS);
    }

    saveRouteTraceToStorage();
    renderRouteTrace();
}
async function hydrateRouteTraceFromBackend() {
    const apiBase = resolveApiBaseUrl();
    const normalizedBusId = String(myBusId || '').toUpperCase();
    if (!apiBase || !normalizedBusId) return;

    try {
        const response = await fetchWithTimeout(
            `${apiBase}/busLocationHistory?busId=${encodeURIComponent(normalizedBusId)}&limit=160`,
            { method: 'GET' },
            3200,
        );
        if (!response.ok) return;

        const payload = await response.json();
        if (!payload || !Array.isArray(payload.history) || payload.history.length === 0) return;

        operatorRouteTrace = payload.history
            .map(point => ({
                latitude: Number(point.latitude),
                longitude: Number(point.longitude),
                ts: point.ts || null,
            }))
            .filter(point => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
            .slice(-MAX_ROUTE_TRACE_POINTS);

        saveRouteTraceToStorage();
        renderRouteTrace();
    } catch (_err) {
        // Keep local trace if backend history fetch fails.
    }
}
async function pushBusTelemetryToServer(telemetry) {
    const now = Date.now();
    if (now - lastBusTelemetryPushMs < 2400) {
        return;
    }
    lastBusTelemetryPushMs = now;

    if (typeof updateBusLocation !== 'function') {
        return;
    }

    const lat = Number(telemetry?.latitude);
    const lng = Number(telemetry?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
    }

    try {
        await updateBusLocation({
            busId: String(myBusId || 'BUS001').toUpperCase(),
            latitude: lat,
            longitude: lng,
            doorStatus: String(telemetry?.doorStatus || 'CLOSED').toUpperCase(),
            safetyStatus: String(telemetry?.safetyStatus || 'SAFE').toUpperCase(),
            speedKmph: Number(telemetry?.speedKmph || 0)
        });
    } catch (_err) {
        // Ignore transient backend push failures.
    }
}
function getFallbackStops() {
    if (window.MockWS && typeof window.MockWS.getStops === 'function') {
        const mockStops = window.MockWS.getStops();
        if (Array.isArray(mockStops) && mockStops.length) {
            return mockStops;
        }
    }
    return ['Central Station', 'City Mall', 'Airport', 'University', 'Hospital'];
}
function notify(kind, title, message) {
    if (DISABLE_TOAST_ALERTS) return;
    if (window.Notify && typeof window.Notify[kind] === 'function') {
        window.Notify[kind](title, message);
    }
}
function getRouteStops() {
    const routeStops = Array.isArray(currentRoute?.stops) ? currentRoute.stops : [];
    return routeStops.length ? routeStops : getFallbackStops();
}
function getDirectionLabel() {
    const stops = getRouteStops();
    if (!stops.length) return '--';
    return `${stops[0]} -> ${stops[stops.length - 1]}`;
}
function setTripControlState() {
    const startBtn = el('startTripBtn');
    const endBtn = el('endTripBtn');
    const issueBtn = el('issueTicketBtn');

    if (startBtn) startBtn.disabled = tripActive;
    if (endBtn) endBtn.disabled = !tripActive;
    if (issueBtn) issueBtn.disabled = !tripActive;

    const directionText = tripDirection === 'forward' ? 'Forward' : 'Reverse';
    setText('tripStatusText', tripActive ? `Trip Running (${directionText})` : 'Trip Not Started');
    setText('tripDirectionText', getDirectionLabel());
}
function clearBusTicketsForCurrentBus() {
    const normalizedBusId = String(myBusId || '').toUpperCase();
    const nextTickets = readTicketStore().filter(ticket => String(ticket.busId || '').toUpperCase() !== normalizedBusId);
    writeTicketStore(nextTickets);
    recentTickets = [];
    ticketsToday = 0;
    setText('ticketsToday', 0);
    renderRecentTickets();
}
function resetBusStateForNewTrip() {
    if (!myBusSnapshot) {
        myBusSnapshot = { busId: myBusId || 'BUS001', seatingCapacity: 40, standingCapacity: 20, passengers: 0 };
    }
    myBusSnapshot.passengers = 0;
    stopIndex = 0;
    updateCapacityDisplay(myBusSnapshot);
    updateRoutePanel();
    setText('lastSyncTime', fmt(Date.now()));
}
function countActiveDropOffs(stopName) {
    const normalizedBusId = String(myBusId || '').toUpperCase();
    const normalizedStop = normalizeStopName(stopName);
    return readTicketStore()
        .filter(ticket => String(ticket.busId || '').toUpperCase() === normalizedBusId)
        .filter(ticket => String(ticket.status || 'active') === 'active')
        .filter(ticket => normalizeStopName(ticket.destinationStop || ticket.destination || '') === normalizedStop)
        .reduce((sum, ticket) => sum + Number(ticket.passengerCount || ticket.passengers || 0), 0);
}
function computeOnboardFromTickets(busId) {
    const normalizedBusId = String(busId || '').toUpperCase();
    return readTicketStore()
        .filter(ticket => String(ticket.busId || '').toUpperCase() === normalizedBusId)
        .filter(ticket => String(ticket.status || 'active') === 'active')
        .reduce((sum, ticket) => sum + Number(ticket.passengerCount || ticket.passengers || 0), 0);
}

// Init
document.addEventListener('DOMContentLoaded', async function () {
    checkRoleAccess('operator');

    if (DISABLE_TOAST_ALERTS) {
        document.body.classList.add('operator-no-toast');
        const toastContainer = document.getElementById('toast-container');
        if (toastContainer) {
            toastContainer.innerHTML = '';
        }
    }

    setInterval(() => setText('navClock', new Date().toLocaleTimeString('en-IN')), 1000);
    setText('navClock', new Date().toLocaleTimeString('en-IN'));

    const user = getCurrentUser();
    if (user) {
        setText('operatorName', user.name || user.id || 'Operator');
        myBusId = user.busId || 'BUS001';
        setText('currentBus', myBusId);
    } else {
        myBusId = 'BUS001';
    }

    setupSidebar();
    setupEsp32DeviceManager();
    try {
        await loadOperatorData();
    } catch (err) {
        console.warn('Operator data load failed, using fallback route/stops.', err);
        if (!myBusSnapshot) {
            myBusSnapshot = { busId: myBusId || 'BUS001', seatingCapacity: 40, standingCapacity: 20, passengers: 0 };
        }
        currentRoute = {
            routeId: 'R-LOCAL',
            routeName: 'Local Route',
            stops: getFallbackStops(),
            buses: [myBusSnapshot.busId || myBusId || 'BUS001']
        };
        updateCapacityDisplay(myBusSnapshot);
        populateStops();
        updateRoutePanel();
    }

    loadRouteTraceFromStorage();
    initOperatorMap();
    hydrateRouteTraceFromBackend();

    el('ticketForm')?.addEventListener('submit', handleIssueTicket);
    el('passengerCount')?.addEventListener('input', calcFarePreview);
    el('boardingStop')?.addEventListener('change', calcFarePreview);
    el('destinationStop')?.addEventListener('change', calcFarePreview);
    el('ticketType')?.addEventListener('change', calcFarePreview);
    el('arrivedAtStopBtn')?.addEventListener('click', handleArriveAtStop);
    el('startTripBtn')?.addEventListener('click', handleStartTrip);
    el('endTripBtn')?.addEventListener('click', handleEndTrip);
    el('connectBusEsp32Btn')?.addEventListener('click', connectBusEsp32);
    el('connectBusStopEsp32Btn')?.addEventListener('click', connectBusStopEsp32);
    el('recenterOperatorMapBtn')?.addEventListener('click', recenterOperatorMap);

    window.addEventListener('storage', onStorageUpdate);

    if (USE_MOCK_REALTIME_FEED && window.MockWS) {
        MockWS.start();
        if (!DISABLE_TOAST_ALERTS && window.Notify && typeof window.Notify.connectToMockWS === 'function') {
            window.Notify.connectToMockWS();
        }
        MockWS.on('fleet_update', onFleetUpdate);
        MockWS.on('passenger_update', onPassengerUpdate);
        MockWS.on('location_update', onLocationUpdate);
        MockWS.on('safety_alert', onSafetyAlert);
        MockWS.on('safety_clear', onSafetyClear);
        MockWS.on('health_update', onHealthUpdate);
    }

    startEsp32Polling();
    const sharedTelemetry = safeJsonParse(localStorage.getItem(ESP32_SHARED_TELEMETRY_KEY), null);
    if (sharedTelemetry && sharedTelemetry.busId === myBusId) {
        applyBusTelemetry(sharedTelemetry, true);
    } else {
        applyDoorSafetyState(myBusSnapshot?.doorStatus || 'CLOSED', 'SAFE');
    }

    updateBusStopDisplayPreview();
    setTripControlState();
});

// Sidebar
function setupSidebar() {
    const items = document.querySelectorAll('.sidebar-menu li');
    const sections = document.querySelectorAll('.content-section');
    items.forEach(item => {
        item.addEventListener('click', function () {
            items.forEach(i => i.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            this.classList.add('active');
            const target = document.getElementById(this.dataset.section);
            if (target) target.classList.add('active');

            // Leaflet needs resize after hidden section becomes visible.
            if (this.dataset.section === 'capacity-display' && operatorMap) {
                setTimeout(() => operatorMap.invalidateSize(), 150);
            }
        });
    });
}

// Data Load
async function loadOperatorData() {
    if (USE_MOCK_REALTIME_FEED && window.MockWS && typeof window.MockWS.getBusSnapshot === 'function') {
        myBusSnapshot = window.MockWS.getBusSnapshot(myBusId);
    }
    if (!myBusSnapshot && USE_MOCK_REALTIME_FEED && window.MockWS && typeof window.MockWS.getFleetSnapshot === 'function') {
        const snap = window.MockWS.getFleetSnapshot();
        myBusSnapshot = snap[0] || null;
        if (myBusSnapshot) {
            myBusId = myBusSnapshot.busId;
        }
    }
    if (!myBusSnapshot) {
        myBusSnapshot = {
            busId: myBusId || 'BUS001',
            seatingCapacity: 40,
            standingCapacity: 20,
            passengers: computeOnboardFromTickets(myBusId || 'BUS001')
        };
    }
    updateCapacityDisplay(myBusSnapshot);

    let routes = [];
    try {
        routes = await getRoutes();
    } catch (err) {
        console.warn('Failed to fetch routes from API layer, using fallback stops.', err);
        routes = [];
    }

    if (!Array.isArray(routes)) {
        routes = [];
    }

    currentRoute = routes.find(r => r.buses && r.buses.includes(myBusId)) || routes[0] || null;
    if (!currentRoute) {
        currentRoute = {
            routeId: 'R-LOCAL',
            routeName: 'Local Route',
            stops: getFallbackStops(),
            buses: [myBusId || 'BUS001']
        };
    } else if (!Array.isArray(currentRoute.stops) || !currentRoute.stops.length) {
        currentRoute = {
            ...currentRoute,
            stops: getFallbackStops()
        };
    }

    populateStops();
    updateRoutePanel();

    recentTickets = getLocalTickets(myBusId).slice(0, 20);
    ticketsToday = countTodayTickets(recentTickets);
    renderRecentTickets();
    setText('ticketsToday', ticketsToday);
    setText('lastSyncTime', fmt(Date.now()));
}

// ESP32 Device Manager
function setupEsp32DeviceManager() {
    const busIp = localStorage.getItem(ESP32_BUS_IP_KEY) || '';
    const busStopIp = localStorage.getItem(ESP32_BUSSTOP_IP_KEY) || '';

    if (busIp) {
        connectedBusEsp32Ip = normalizeBaseUrl(busIp);
        if (el('busEsp32Ip')) el('busEsp32Ip').value = connectedBusEsp32Ip;
        setBusConnectionState(false, 'Saved');
    } else {
        setBusConnectionState(false, 'Not Connected');
    }

    if (busStopIp) {
        connectedBusStopEsp32Ip = normalizeBaseUrl(busStopIp);
        if (el('busStopEsp32Ip')) el('busStopEsp32Ip').value = connectedBusStopEsp32Ip;
        setBusStopConnectionState(false, 'Saved');
    } else {
        setBusStopConnectionState(false, 'Not Connected');
    }
}

function setBusConnectionState(connected, label) {
    const dot = el('busEsp32Dot');
    const status = el('busEsp32Status');
    if (dot) dot.className = 'live-dot ' + (connected ? 'ok' : 'danger');
    if (status) {
        status.textContent = label || (connected ? 'Connected' : 'Failed');
        status.className = 'hi-value ' + (connected ? 'ok' : 'warn');
    }
}

function setBusStopConnectionState(connected, label) {
    const dot = el('busStopEsp32Dot');
    const status = el('busStopEsp32Status');
    if (dot) dot.className = 'live-dot ' + (connected ? 'ok' : 'danger');
    if (status) {
        status.textContent = label || (connected ? 'Connected' : 'Failed');
        status.className = 'hi-value ' + (connected ? 'ok' : 'warn');
    }
}

async function connectBusEsp32() {
    const entered = el('busEsp32Ip')?.value;
    connectedBusEsp32Ip = normalizeBaseUrl(entered);
    if (!connectedBusEsp32Ip) {
        setBusConnectionState(false, 'Failed');
        notify('error', 'Bus ESP32', 'Enter a valid bus ESP32 IP address.');
        return;
    }

    const apiBase = resolveApiBaseUrl();
    const busUrl = safeParseUrl(connectedBusEsp32Ip);
    const apiUrl = safeParseUrl(apiBase);
    if (busUrl && apiUrl && busUrl.hostname === apiUrl.hostname) {
        setBusConnectionState(false, 'Use Bus Device IP');
        notify('warning', 'Wrong IP Field', 'Use the Bus ESP32 device IP from serial monitor, not backend server IP.');
        return;
    }

    localStorage.setItem(ESP32_BUS_IP_KEY, connectedBusEsp32Ip);
    const ok = await pollBusEsp32(true);
    if (ok) {
        setText('esp32LastPoll', fmt(Date.now()));
        notify('success', 'Bus ESP32 Connected', connectedBusEsp32Ip);
    } else {
        notify('warning', 'Bus ESP32 Unreachable', `${connectedBusEsp32Ip}/data did not respond.`);
    }
}

async function connectBusStopEsp32() {
    const entered = el('busStopEsp32Ip')?.value;
    connectedBusStopEsp32Ip = normalizeBaseUrl(entered);
    if (!connectedBusStopEsp32Ip) {
        setBusStopConnectionState(false, 'Failed');
        notify('error', 'Bus Stop ESP32', 'Enter a valid bus stop ESP32 IP address.');
        return;
    }

    const apiBase = resolveApiBaseUrl();
    const espUrl = safeParseUrl(connectedBusStopEsp32Ip);
    const apiUrl = safeParseUrl(apiBase);
    if (espUrl && apiUrl && espUrl.hostname === apiUrl.hostname) {
        setBusStopConnectionState(false, 'Use ESP32 Device IP');
        notify('warning', 'Wrong IP Field', 'Use the bus stop ESP32 IP, not the backend server IP.');
        return;
    }

    localStorage.setItem(ESP32_BUSSTOP_IP_KEY, connectedBusStopEsp32Ip);

    let reachable = false;

    for (let attempt = 0; attempt < 3 && !reachable; attempt += 1) {
        try {
            const response = await fetchWithTimeout(`${connectedBusStopEsp32Ip}/health`, { method: 'GET' }, 2600);
            reachable = response.ok;
        } catch (_err) {
            reachable = false;
        }

        if (!reachable) {
            try {
                await fetchWithTimeout(`${connectedBusStopEsp32Ip}/health`, { method: 'GET', mode: 'no-cors' }, 2600);
                reachable = true;
            } catch (_err) {
                reachable = false;
            }
        }

        if (!reachable) {
            await new Promise(resolve => setTimeout(resolve, 220));
        }
    }

    if (!reachable) {
        // Some browsers/networks block direct private-device fetch even when ESP32 is online.
        // Fall back to backend-sync mode so LCD can continue via /busdata polling.
        const serverSynced = await pushBusDataToServer(buildBusDataPayload());
        if (serverSynced) {
            setBusStopConnectionState(true, 'Connected');
            setText('esp32LastPoll', fmt(Date.now()));
            return;
        }

        setBusStopConnectionState(false, 'Failed');
        notify('warning', 'Bus Stop ESP32 Unreachable', `${connectedBusStopEsp32Ip}/health did not respond.`);
        return;
    }

    setBusStopConnectionState(true, 'Connected');
    setText('esp32LastPoll', fmt(Date.now()));
    const configured = await configureBusStopEsp32();
    const syncResult = await sendTicketToBusStopDisplay();
    if (configured || syncResult.deviceSynced) {
        setBusStopConnectionState(true, 'Connected');
    } else {
        setBusStopConnectionState(true, 'Connected');
    }

    if (configured) {
        notify('success', 'Bus Stop ESP32 Connected', `${connectedBusStopEsp32Ip} configured for ${myBusId}`);
    }
}

async function configureBusStopEsp32() {
    if (!connectedBusStopEsp32Ip) return false;

    const apiBase = resolveApiBaseUrl();
    if (!apiBase) return false;

    // Avoid writing stale/default server IP into ESP32 when dashboard API base is wrong.
    try {
        const health = await fetchWithTimeout(`${apiBase}/health`, { method: 'GET' }, 2200);
        if (!health.ok) return false;
    } catch (_err) {
        return false;
    }

    const payload = {
        serverBaseUrl: apiBase,
        busId: String(myBusId || 'BUS001').toUpperCase()
    };

    try {
        const response = await fetchWithTimeout(`${connectedBusStopEsp32Ip}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }, 2800);

        if (!response.ok) return false;

        // Read back config so we know ESP32 stored the exact backend URL and bus ID.
        const verify = await fetchWithTimeout(`${connectedBusStopEsp32Ip}/config`, { method: 'GET' }, 2400);
        if (!verify.ok) return false;

        const verifyJson = await verify.json();
        const configuredBusId = String(verifyJson.busId || '').toUpperCase();
        const configuredBase = normalizeBaseUrl(verifyJson.serverBaseUrl || verifyJson.serverURL || '');
        const expectedBase = normalizeBaseUrl(apiBase);

        return configuredBusId === payload.busId && configuredBase.startsWith(expectedBase);
    } catch (_err) {
        return false;
    }
}

function startEsp32Polling() {
    if (esp32PollTimer) clearInterval(esp32PollTimer);
    esp32PollTimer = setInterval(() => { pollBusEsp32(false); }, ESP32_POLL_MS);
    if (connectedBusEsp32Ip) pollBusEsp32(false);
}

async function pollBusEsp32(isManualConnect) {
    if (!connectedBusEsp32Ip) return false;

    try {
        const response = await fetchWithTimeout(`${connectedBusEsp32Ip}/data`, { method: 'GET' }, 2800);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        const telemetry = normalizeBusTelemetry(payload);
        if (!telemetry) throw new Error('Invalid payload');
        applyBusTelemetry(telemetry, false);
        setBusConnectionState(true, 'Connected');
        setText('esp32LastPoll', fmt(Date.now()));
        return true;
    } catch (_err) {
        setBusConnectionState(false, isManualConnect ? 'Failed' : 'Disconnected');
        return false;
    }
}

function normalizeBusTelemetry(payload) {
    if (!payload || typeof payload !== 'object') return null;

    const latNum = Number(payload.latitude ?? payload.lat);
    const lngNum = Number(payload.longitude ?? payload.lng);
    const paxNum = Number(payload.passengerCount ?? payload.passengers ?? myBusSnapshot?.passengers ?? 0);
    const speedNum = Number(payload.speedKmph ?? payload.speed ?? 0);

    const rawDoor = String(payload.doorStatus ?? payload.door ?? 'CLOSED').toUpperCase();
    const normalizedDoor = rawDoor === 'OPEN' ? 'OPEN' : 'CLOSED';

    let rawSafety = String(payload.safetyStatus ?? payload.safety ?? '').toUpperCase();
    if (!rawSafety && payload.safetyBlocked !== undefined) {
        rawSafety = payload.safetyBlocked ? 'BLOCKED' : 'SAFE';
    }
    const normalizedSafety = (rawSafety === 'BLOCKED' || rawSafety === 'ALERT') ? 'BLOCKED' : 'SAFE';

    return {
        busId: String(payload.busId || myBusId || 'BUS001').toUpperCase(),
        doorStatus: normalizedDoor,
        safetyStatus: normalizedSafety,
        passengerCount: Number.isFinite(paxNum) ? Math.max(0, paxNum) : 0,
        latitude: Number.isFinite(latNum) ? latNum : null,
        longitude: Number.isFinite(lngNum) ? lngNum : null,
        speedKmph: Number.isFinite(speedNum) ? Math.max(0, speedNum) : 0,
        timestamp: payload.timestamp || new Date().toISOString()
    };
}

function applyBusTelemetry(telemetry, fromSharedOnly) {
    if (!telemetry || telemetry.busId !== myBusId) return;

    applyDoorSafetyState(telemetry.doorStatus, telemetry.safetyStatus);

    if (!myBusSnapshot) myBusSnapshot = { busId: myBusId, seatingCapacity: 40, standingCapacity: 20 };
    myBusSnapshot.passengers = telemetry.passengerCount;
    myBusSnapshot.doorStatus = telemetry.doorStatus;
    myBusSnapshot.safetyStatus = telemetry.safetyStatus;
    myBusSnapshot.speedKmph = Number(telemetry.speedKmph || 0);

    if (typeof telemetry.latitude === 'number' && typeof telemetry.longitude === 'number') {
        latestGps = { latitude: telemetry.latitude, longitude: telemetry.longitude };
        myBusSnapshot.lat = telemetry.latitude;
        myBusSnapshot.lng = telemetry.longitude;
        addRouteTracePoint(telemetry.latitude, telemetry.longitude, telemetry.timestamp);

        plotBusOnOperatorMap({
            busId: myBusId,
            busNumber: myBusSnapshot.busNumber || myBusId,
            passengers: myBusSnapshot.passengers || 0,
            occupancyPct: estimateOccupancyPct(myBusSnapshot),
            status: occupancyStatusLabel(myBusSnapshot),
            lat: telemetry.latitude,
            lng: telemetry.longitude
        });
    }

    updateCapacityDisplay(myBusSnapshot);
    setText('deviceStatus', 'Online');
    setText('lastDataTime', fmt(Date.now()));

    if (!fromSharedOnly) {
        localStorage.setItem(ESP32_SHARED_TELEMETRY_KEY, JSON.stringify(telemetry));
        pushBusTelemetryToServer(telemetry);
    }
}

function applyDoorSafetyState(doorStatus, safetyStatus) {
    const normalizedDoor = String(doorStatus || 'CLOSED').toUpperCase();
    const normalizedSafety = String(safetyStatus || 'SAFE').toUpperCase();
    const blocked = normalizedSafety === 'BLOCKED' || normalizedSafety === 'ALERT';

    setText('doorStatusLive', normalizedDoor);
    setText('safetyStatusLive', blocked ? 'BLOCKED' : normalizedSafety);

    if (blocked) {
        setSafetyBox('alert', '', 'Door Safety Alert!', 'Obstruction detected. Keep the bus stopped.');
        if (lastSafetyStatus !== 'BLOCKED') addAlertHistory('Door Obstruction', 'danger');
        if (el('healthDot')) el('healthDot').className = 'health-dot warn';
        renderDoorWarning(true);
    } else {
        setSafetyBox('safe', '', 'All Clear', 'No safety alerts detected');
        if (el('healthDot')) el('healthDot').className = 'health-dot ok';
        renderDoorWarning(false);
    }

    lastSafetyStatus = blocked ? 'BLOCKED' : normalizedSafety;
}

function renderDoorWarning(blocked) {
    const box = el('doorSafetyWarningBox');
    if (!box) return;
    if (!blocked) {
        box.innerHTML = '<div class="alert-panel alert-ok"><i class="fas fa-circle-check"></i><div><div class="ap-title">Door Safety: SAFE</div><div class="ap-msg">No obstruction detected.</div></div></div>';
        return;
    }
    box.innerHTML = '<div class="alert-panel alert-danger"><i class="fas fa-triangle-exclamation"></i><div><div class="ap-title">Door Safety: BLOCKED</div><div class="ap-msg">Passenger or object detected near the door.</div></div></div>';
}

function onStorageUpdate(event) {
    if (event.key !== ESP32_SHARED_TELEMETRY_KEY || !event.newValue) return;
    const telemetry = safeJsonParse(event.newValue, null);
    if (telemetry && telemetry.busId === myBusId) {
        applyBusTelemetry(telemetry, true);
    }
}

// MockWS Handlers
function onFleetUpdate(fleet) {
    lastFleetSnapshot = Array.isArray(fleet) ? fleet : [];
    const bus = lastFleetSnapshot.find(b => b.busId === myBusId);
    if (bus) {
        myBusSnapshot = { ...myBusSnapshot, ...bus };
        updateCapacityDisplay(myBusSnapshot);
    }
    lastFleetSnapshot.forEach(plotBusOnOperatorMap);
    setText('lastSyncTime', fmt(Date.now()));
}

function onPassengerUpdate(data) {
    if (data.busId !== myBusId) return;
    if (myBusSnapshot) {
        myBusSnapshot.passengers = data.passengers;
        updateCapacityDisplay(myBusSnapshot);
    }
}

function onLocationUpdate(data) {
    if (!data || !data.busId) return;
    const bus = lastFleetSnapshot.find(b => b.busId === data.busId);
    if (bus) {
        bus.lat = data.lat;
        bus.lng = data.lng;
        plotBusOnOperatorMap(bus);
    }
}

function onSafetyAlert(data) {
    if (data.busId && data.busId !== myBusId) return;
    if (connectedBusEsp32Ip) return;
    applyDoorSafetyState('OPEN', 'BLOCKED');
}

function onSafetyClear(data) {
    if (data.busId && data.busId !== myBusId) return;
    if (connectedBusEsp32Ip) return;
    applyDoorSafetyState('CLOSED', 'SAFE');
}

function onHealthUpdate(data) {
    if (data.busId !== myBusId) return;
    const online = data.deviceOnline !== false;
    if (el('deviceDot')) el('deviceDot').className = 'live-dot ' + (online ? 'ok' : 'danger');
    setText('deviceStatus', online ? 'Online' : 'Offline');
    setText('lastDataTime', fmt(Date.now()));

    const signal = Number(data.signalStrength || data.gsmSignal || 4);
    if (el('signalBars')) {
        const level = signal >= 4 ? 's4' : signal === 3 ? 's3' : signal === 2 ? 's2' : 's1';
        el('signalBars').className = 'signal-bars ' + level;
    }
    setText('signalStrength', signal >= 4 ? 'Excellent' : signal === 3 ? 'Good' : signal === 2 ? 'Fair' : 'Weak');
}

// Live Map (same pattern as enterprise live map)
function initOperatorMap() {
    if (operatorMap) return;
    const mapEl = el('operatorLiveMap');
    if (!mapEl || !window.L) return;

    mapEl.style.padding = '0';
    operatorMap = L.map('operatorLiveMap').setView(DEFAULT_MAP_CENTER, 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'OpenStreetMap contributors'
    }).addTo(operatorMap);

    if (USE_MOCK_REALTIME_FEED && window.MockWS && typeof window.MockWS.getFleetSnapshot === 'function') {
        const fleet = MockWS.getFleetSnapshot();
        lastFleetSnapshot = fleet;
        fleet.forEach(plotBusOnOperatorMap);
    } else {
        lastFleetSnapshot = [];
        if (myBusSnapshot && Number.isFinite(Number(myBusSnapshot.lat ?? myBusSnapshot.latitude)) && Number.isFinite(Number(myBusSnapshot.lng ?? myBusSnapshot.longitude))) {
            plotBusOnOperatorMap({
                ...myBusSnapshot,
                busId: myBusId,
                lat: Number(myBusSnapshot.lat ?? myBusSnapshot.latitude),
                lng: Number(myBusSnapshot.lng ?? myBusSnapshot.longitude),
                passengers: Number(myBusSnapshot.passengers || 0),
                occupancyPct: estimateOccupancyPct(myBusSnapshot),
                status: occupancyStatusLabel(myBusSnapshot)
            });
        }
    }

    getRouteStops().forEach((stop, idx) => {
        const lat = 12.96 + (idx * 0.004);
        const lng = 77.58 + (idx * 0.003);
        const stopIcon = L.divIcon({
            className: '',
            html: '<div class="stop-marker-icon"><i class="fas fa-circle-dot" style="font-size:.6rem"></i></div>',
            iconSize: [22, 22],
            iconAnchor: [11, 11]
        });
        L.marker([lat, lng], { icon: stopIcon }).addTo(operatorMap).bindPopup(`<b>${stop}</b><br>Bus Stop`);
    });

    renderRouteTrace();

    setTimeout(() => operatorMap.invalidateSize(), 200);
}

function plotBusOnOperatorMap(bus) {
    if (!operatorMap || !bus || !bus.busId) return;

    const lat = Number(bus.lat ?? bus.latitude);
    const lng = Number(bus.lng ?? bus.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const occ = Number(bus.occupancyPct || 0);
    const color = occ < 50 ? '#10b981' : occ < 80 ? '#f59e0b' : '#ef4444';

    const icon = L.divIcon({
        className: '',
        html: `<div style="background:${color};width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);font-size:.85rem"><i class="fas fa-bus"></i></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });

    const popup = `<b>${bus.busId}</b><br>${bus.busNumber || bus.busId}<br>Passengers: ${bus.passengers || 0}<br>Status: ${bus.status || 'Running'}`;

    if (operatorMapMarkers[bus.busId]) {
        operatorMapMarkers[bus.busId].setLatLng([lat, lng]);
        operatorMapMarkers[bus.busId].setIcon(icon);
        operatorMapMarkers[bus.busId].setPopupContent(popup);
    } else {
        operatorMapMarkers[bus.busId] = L.marker([lat, lng], { icon }).addTo(operatorMap).bindPopup(popup);
    }
}

function recenterOperatorMap() {
    if (!operatorMap) return;
    if (latestGps && Number.isFinite(latestGps.latitude) && Number.isFinite(latestGps.longitude)) {
        operatorMap.setView([latestGps.latitude, latestGps.longitude], 14);
    } else {
        operatorMap.setView(DEFAULT_MAP_CENTER, 12);
    }
}

// Capacity Display
function updateCapacityDisplay(bus) {
    const seating = Number(bus.seatingCapacity || bus.seating || 40);
    const standing = Number(bus.standingCapacity || bus.standing || 20);
    const total = seating + standing;
    const pax = Number(bus.passengers || 0);

    const seatsOcc = Math.min(pax, seating);
    const standOcc = Math.max(0, pax - seating);
    const seatsAvail = seating - seatsOcc;
    const standAvail = standing - standOcc;
    const pct = total > 0 ? (pax / total) * 100 : 0;
    const level = pct < 50 ? 'low' : pct < 80 ? 'mid' : 'high';

    bus.occupancyPct = Math.round(pct);
    bus.status = occupancyStatusLabel(bus);

    setText('seatsAvailable', seatsAvail);
    setText('standingAvailable', standAvail);
    setText('currentPassengers', pax);
    setText('passengersOnboard', pax);
    setText('seatsRemaining', seatsAvail);
    setText('standingRemaining', standAvail);

    setBar('seatingBar', seating > 0 ? (seatsOcc / seating) * 100 : 0, level);
    setBar('standingBar', standing > 0 ? (standOcc / standing) * 100 : 0, level);
    setBar('totalBar', pct, level);

    setText('seatingBarLabel', `${seatsOcc} / ${seating}`);
    setText('standingBarLabel', `${standOcc} / ${standing}`);
    setText('totalBarLabel', `${pax} / ${total}`);

    if (pct >= 100) {
        setCapacityBox('alert', '', 'Bus Full!', 'No more passengers can board this bus.');
    } else if (pct >= 80) {
        setCapacityBox('warn', '', 'Nearly Full', `Only ${total - pax} places remaining.`);
    } else {
        setCapacityBox('safe', '', 'Seats Available', `${seatsAvail} seats and ${standAvail} standing places.`);
    }

    setText('tk-passengers', pax);
    setText('tk-seatsAvail', seatsAvail);
    setText('tk-standingAvail', standAvail);

    const tkStatus = el('tk-status');
    if (tkStatus) {
        if (pct >= 100) {
            tkStatus.textContent = 'FULL';
            tkStatus.style.color = 'var(--clr-danger)';
        } else if (pct >= 80) {
            tkStatus.textContent = 'NEAR';
            tkStatus.style.color = 'var(--clr-warn)';
        } else {
            tkStatus.textContent = 'OK';
            tkStatus.style.color = 'var(--clr-ok)';
        }
    }

    updateBusStopDisplayPreview();
}

function setBar(id, pct, level) {
    const bar = el(id);
    if (!bar) return;
    bar.style.width = Math.min(Math.max(pct, 0), 100) + '%';
    bar.className = 'occ-bar-fill ' + level;
}

function setCapacityBox(state, _icon, title, message) {
    const box = el('capacityStatusBox');
    if (box) box.className = 'safety-status-big ' + state;
    setText('capacityStatusTitle', title);
    setText('capacityStatusMsg', message);
}

function setSafetyBox(state, _icon, title, message) {
    const box = el('safetyStatusBox');
    if (box) box.className = 'safety-status-big ' + state;
    setText('safetyTitle', title);
    setText('safetyMsg', message);
}

function addAlertHistory(type, levelClass) {
    alertHistory.unshift({ time: Date.now(), type, levelClass });
    renderAlertHistory();
}

function renderAlertHistory() {
    const tbody = el('alertHistoryBody');
    if (!tbody) return;

    if (!alertHistory.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--txt-muted)">No recent alerts</td></tr>';
        return;
    }

    tbody.innerHTML = alertHistory.slice(0, 15).map(a => `
        <tr>
            <td><span class="mono">${fmt(a.time)}</span></td>
            <td>${a.type}</td>
            <td><span class="status-pill ${a.levelClass === 'danger' ? 'pill-danger' : 'pill-warn'}">${a.levelClass === 'danger' ? 'Critical' : 'Info'}</span></td>
            <td>${myBusId}</td>
        </tr>`).join('');
}

// Ticket Issuing (localStorage only)
async function handleIssueTicket(event) {
    event.preventDefault();

    if (!tripActive) {
        showTicketAlert('Click Start Bus before issuing tickets.', 'warn');
        return;
    }

    const paxCount = parseInt(el('passengerCount')?.value || '1', 10) || 1;
    const boarding = el('boardingStop')?.value;
    const destination = el('destinationStop')?.value;
    const ticketType = el('ticketType')?.value || 'regular';

    if (!boarding || !destination) {
        showTicketAlert('Please select boarding and destination stops.', 'warn');
        return;
    }
    if (boarding === destination) {
        showTicketAlert('Boarding and destination cannot be the same.', 'warn');
        return;
    }

    const bus = myBusSnapshot || {};
    const seating = Number(bus.seatingCapacity || bus.seating || 40);
    const standing = Number(bus.standingCapacity || bus.standing || 20);
    const available = (seating + standing) - Number(bus.passengers || 0);

    if (paxCount > available) {
        showTicketAlert(`Only ${available} places available.`, 'danger');
        notify('warning', 'Capacity Full', `Cannot board ${paxCount} passengers. Only ${available} left.`);
        return;
    }

    const fare = calculateFare(boarding, destination, paxCount, ticketType);
    const issued = createLocalTicket({
        busId: myBusId,
        passengers: paxCount,
        source: boarding,
        destination,
        fare,
        ticketType,
        operatorId: getCurrentUser()?.id || 'OP001'
    });

    if (!myBusSnapshot) myBusSnapshot = { busId: myBusId, seatingCapacity: 40, standingCapacity: 20, passengers: 0 };
    myBusSnapshot.passengers = computeOnboardFromTickets(myBusId);

    updateCapacityDisplay(myBusSnapshot);
    recentTickets.unshift(issued);
    ticketsToday = countTodayTickets(recentTickets);
    setText('ticketsToday', ticketsToday);
    renderRecentTickets();
    clearTicketAlert();

    event.target.reset();
    if (el('passengerCount')) el('passengerCount').value = '1';
    setText('fareAmount', 'Rs 0.00');
    setText('lastSyncTime', fmt(Date.now()));

    notify('success', 'Ticket Issued', `Rs ${fare.toFixed(2)} | ${paxCount} pax | ${boarding} -> ${destination}`);

    const syncResult = await sendTicketToBusStopDisplay();
    if (!syncResult.serverSynced) {
        notify('warning', 'Backend Sync Failed', 'Ticket saved locally, but /busdata/update did not respond.');
    }
    if (connectedBusStopEsp32Ip && !syncResult.deviceSynced) {
        notify('warning', 'Bus Stop Sync Failed', 'Ticket saved locally, but bus stop ESP32 update failed.');
    }
}

function calculateFare(from, to, paxCount, ticketType) {
    const stops = currentRoute?.stops || (MockWS.getStops ? MockWS.getStops() : []);
    let hopCount = 1;
    if (Array.isArray(stops) && stops.length > 1) {
        const fromIdx = stops.indexOf(from);
        const toIdx = stops.indexOf(to);
        if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
            hopCount = Math.max(1, Math.abs(toIdx - fromIdx));
        }
    }

    const base = Math.max(10, hopCount * 8);
    const discount = ticketType === 'student' ? 0.5 : ticketType === 'senior' ? 0.7 : 1;
    return Number((base * discount * paxCount).toFixed(2));
}

function calcFarePreview() {
    const pax = parseInt(el('passengerCount')?.value || '1', 10);
    const from = el('boardingStop')?.value;
    const to = el('destinationStop')?.value;
    const type = el('ticketType')?.value || 'regular';

    if (from && to && from !== to) {
        setText('fareAmount', `Rs ${calculateFare(from, to, pax, type).toFixed(2)}`);
    } else {
        setText('fareAmount', 'Rs 0.00');
    }
}

function showTicketAlert(message, type) {
    const box = el('ticketAlertBox');
    if (!box) return;
    box.innerHTML = `<div class="alert-panel ${type === 'danger' ? 'alert-danger' : 'alert-warn'}" style="margin-bottom:1rem"><i class="fas fa-triangle-exclamation"></i><div>${message}</div></div>`;
}

function clearTicketAlert() {
    const box = el('ticketAlertBox');
    if (box) box.innerHTML = '';
}

function renderRecentTickets() {
    const tbody = el('recentTicketsBody');
    if (!tbody) return;

    if (!recentTickets.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--txt-muted)">No tickets today</td></tr>';
        return;
    }

    tbody.innerHTML = recentTickets.slice(0, 15).map(t => {
        const ticketId = t.ticketId || t.id || '-';
        const source = t.boardingStop || t.source || '-';
        const destination = t.destinationStop || t.destination || '-';
        const pax = Number(t.passengerCount || t.passengers || 0);
        const fare = Number(t.fare || 0).toFixed(2);
        const time = t.timestamp || t.issuedAt || Date.now();

        return `<tr>
            <td><span class="mono">${ticketId}</span></td>
            <td>${source}</td>
            <td>${destination}</td>
            <td>${pax}</td>
            <td>Rs ${fare}</td>
            <td><span class="mono">${fmt(time)}</span></td>
        </tr>`;
    }).join('');
}

function readTicketStore() {
    return safeJsonParse(localStorage.getItem(LOCAL_TICKET_KEY), []) || [];
}

function writeTicketStore(tickets) {
    localStorage.setItem(LOCAL_TICKET_KEY, JSON.stringify(tickets));
}

function getLocalTickets(busId) {
    const all = readTicketStore();
    const list = busId ? all.filter(t => String(t.busId || '').toUpperCase() === String(busId).toUpperCase()) : all;
    return list.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
}

function createLocalTicket(data) {
    const ticket = {
        ticketId: `TKT-${Date.now()}`,
        busId: data.busId,
        operatorId: data.operatorId || 'OP001',
        passengers: Number(data.passengers || 1),
        source: data.source,
        destination: data.destination,
        timestamp: new Date().toISOString(),

        // Backward compatibility with existing table helpers
        passengerCount: Number(data.passengers || 1),
        boardingStop: data.source,
        destinationStop: data.destination,
        ticketType: data.ticketType || 'regular',
        fare: Number(data.fare || 0),
        status: 'active'
    };

    const tickets = readTicketStore();
    tickets.unshift(ticket);
    writeTicketStore(tickets);
    return ticket;
}

function countTodayTickets(tickets) {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();

    return tickets.filter(t => {
        const dt = new Date(t.timestamp || t.issuedAt || 0);
        return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
    }).length;
}

async function pushBusDataToServer(payload) {
    const apiBase = resolveApiBaseUrl();
    if (!apiBase) return false;

    const body = payload || buildBusDataPayload();
    try {
        const response = await fetchWithTimeout(`${apiBase}/busdata/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }, 3200);
        return response.ok;
    } catch (_err) {
        return false;
    }
}

async function sendTicketToBusStopDisplay() {
    const payload = buildBusDataPayload();
    updateBusStopDisplayPreview(payload);

    const serverSynced = await pushBusDataToServer(payload);

    if (!connectedBusStopEsp32Ip) {
        return { serverSynced, deviceSynced: false };
    }

    const espPayload = {
        busId: payload.busId,
        passengerCount: payload.passengers,
        seatsAvailable: payload.seatsAvailable,
        etaMin: payload.etaMin,
        nextBusId: payload.nextBusId,
        nextBusEta: payload.nextBusEta,
        location: payload.location
    };

    try {
        const response = await fetchWithTimeout(`${connectedBusStopEsp32Ip}/display`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(espPayload)
        }, 3000);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setBusStopConnectionState(true, 'Connected');
        setText('esp32LastPoll', fmt(Date.now()));
        return { serverSynced, deviceSynced: true };
    } catch (_err) {
        try {
            await fetchWithTimeout(`${connectedBusStopEsp32Ip}/display`, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(espPayload)
            }, 3000);
            setBusStopConnectionState(true, 'Connected');
            setText('esp32LastPoll', fmt(Date.now()));
            return { serverSynced, deviceSynced: true };
        } catch (_err2) {
            setBusStopConnectionState(true, 'Connected');
            return { serverSynced, deviceSynced: false };
        }
    }
}

function getCurrentLocationLabel() {
    if (latestGps && Number.isFinite(latestGps.latitude) && Number.isFinite(latestGps.longitude)) {
        return `${latestGps.latitude.toFixed(5)}, ${latestGps.longitude.toFixed(5)}`;
    }
    return el('currentStopName')?.textContent || 'Unknown';
}

function occupancyStatusLabel(bus) {
    const pct = estimateOccupancyPct(bus);
    if (pct >= 100) return 'Bus Full';
    if (pct >= 80) return 'Limited Seats';
    return 'Seats Available';
}

function estimateOccupancyPct(bus) {
    const seating = Number(bus.seatingCapacity || bus.seating || 40);
    const standing = Number(bus.standingCapacity || bus.standing || 20);
    const total = seating + standing;
    const pax = Number(bus.passengers || 0);
    if (!total) return 0;
    return Math.round((pax / total) * 100);
}

// Stops / Route
function populateStops() {
    const routeStops = Array.isArray(currentRoute?.stops) ? currentRoute.stops : [];
    const stops = routeStops.length > 0 ? routeStops : getFallbackStops();

    const options = stops.map(stop => `<option value="${stop}">${stop}</option>`).join('');

    const boardingSelect = el('boardingStop');
    if (boardingSelect) {
        boardingSelect.innerHTML = '<option value="">Select current stop</option>' + options;
    }

    const destinationSelect = el('destinationStop');
    if (destinationSelect) {
        destinationSelect.innerHTML = '<option value="">Select destination</option>' + options;
    }
}

function updateRoutePanel() {
    if (!currentRoute) {
        setText('currentRoute', '-');
        setText('currentStopName', '-');
        setText('nextStopName', '-');
        renderDropOffTable([]);
        updateBusStopDisplayPreview();
        return;
    }

    setText('currentRoute', currentRoute.routeName || currentRoute.routeId || '-');
    const stops = getRouteStops();
    setText('currentStopName', stops[stopIndex] || stops[0] || '-');
    setText('nextStopName', stops[stopIndex + 1] || 'End of Route');

    const boarding = el('boardingStop');
    if (boarding && (stops[stopIndex] || stops[0])) {
        boarding.value = stops[stopIndex] || stops[0];
    }

    const rows = stops.slice(stopIndex + 1).map((stop, idx) => ({
        name: stop,
        drops: countActiveDropOffs(stop),
        dist: `${(idx + 1) * 2} km`,
        eta: `${(idx + 1) * 4} min`
    }));

    renderDropOffTable(rows);
    updateBusStopDisplayPreview();
    setTripControlState();
}

function renderDropOffTable(rows) {
    const tbody = el('dropOffTableBody');
    if (!tbody) return;

    if (!rows || !rows.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--txt-muted)">No upcoming stops</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map(row => `<tr><td>${row.name}</td><td>${row.drops}</td><td>${row.dist}</td><td>${row.eta}</td></tr>`).join('');
}

async function handleArriveAtStop() {
    if (!tripActive) {
        showTicketAlert('Start the bus trip before processing arrivals.', 'warn');
        return;
    }

    const stops = getRouteStops();
    if (!stops.length) {
        notify('warning', 'No Route', 'No route assigned.');
        return;
    }

    const nextStopIndex = Math.min(stopIndex + 1, stops.length - 1);
    const arrivedAt = stops[nextStopIndex] || stops[stopIndex] || stops[0];
    const normalizedBusId = String(myBusId || '').toUpperCase();
    const normalizedArrivedAt = normalizeStopName(arrivedAt);
    let dropped = 0;

    const updatedTickets = readTicketStore().map(ticket => {
        const belongsToBus = String(ticket.busId || '').toUpperCase() === normalizedBusId;
        const isActive = String(ticket.status || 'active') === 'active';
        const destination = normalizeStopName(ticket.destinationStop || ticket.destination || '');
        if (belongsToBus && isActive && destination === normalizedArrivedAt) {
            dropped += Number(ticket.passengerCount || ticket.passengers || 0);
            return {
                ...ticket,
                status: 'dropped',
                droppedAt: new Date().toISOString(),
                droppedAtStop: arrivedAt
            };
        }
        return ticket;
    });

    writeTicketStore(updatedTickets);

    if (myBusSnapshot) {
        myBusSnapshot.passengers = computeOnboardFromTickets(myBusId);
    }

    recentTickets = getLocalTickets(myBusId).slice(0, 20);
    ticketsToday = countTodayTickets(recentTickets);
    setText('ticketsToday', ticketsToday);
    renderRecentTickets();

    updateCapacityDisplay(myBusSnapshot || {});
    notify('success', 'Arrived at Stop', `${dropped} passenger(s) dropped off at ${arrivedAt}`);
    addAlertHistory(`Stop Arrival: ${arrivedAt}`, 'ok');

    stopIndex = nextStopIndex;
    updateRoutePanel();
    setText('lastSyncTime', fmt(Date.now()));

    const syncResult = await sendTicketToBusStopDisplay();
    if (!syncResult.serverSynced) {
        notify('warning', 'Backend Sync Failed', 'Drop-off updated locally, but /busdata/update did not respond.');
    }
    if (connectedBusStopEsp32Ip && !syncResult.deviceSynced) {
        notify('warning', 'Bus Stop Sync Failed', 'Drop-off updated locally, but bus stop ESP32 update failed.');
    }
}

function reverseCurrentRouteDirection() {
    const stops = getRouteStops();
    if (stops.length < 2) return;
    currentRoute = {
        ...currentRoute,
        stops: [...stops].reverse()
    };
    tripDirection = tripDirection === 'forward' ? 'reverse' : 'forward';
    populateStops();
}

async function handleStartTrip() {
    clearTicketAlert();
    tripActive = true;
    resetBusStateForNewTrip();
    clearBusTicketsForCurrentBus();
    updateRoutePanel();
    setTripControlState();

    if (connectedBusStopEsp32Ip) {
        await configureBusStopEsp32();
    }

    const syncResult = await sendTicketToBusStopDisplay();
    if (!syncResult.serverSynced) {
        notify('warning', 'Backend Sync Failed', 'Trip started locally, but /busdata/update did not respond.');
    }
}

async function handleEndTrip() {
    tripActive = false;
    if (myBusSnapshot) {
        myBusSnapshot.passengers = 0;
    }
    reverseCurrentRouteDirection();
    stopIndex = 0;
    clearTicketAlert();
    updateCapacityDisplay(myBusSnapshot || {});
    updateRoutePanel();
    setTripControlState();

    const syncResult = await sendTicketToBusStopDisplay();
    if (!syncResult.serverSynced) {
        notify('warning', 'Backend Sync Failed', 'Trip ended locally, but /busdata/update did not respond.');
    }
}

window.handleIssueTicket = handleIssueTicket;
window.handleArriveAtStop = handleArriveAtStop;
window.handleStartTrip = handleStartTrip;
window.handleEndTrip = handleEndTrip;