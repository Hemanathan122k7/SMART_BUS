/**
 * api.js
 * Shared API and storage layer for admin/sector/operator dashboards.
 */

(function (global) {
    'use strict';

    const API_BASE_KEY = 'smartbus_api_base';
    const STORAGE_KEYS = {
        buses: 'smartbus_buses',
        sectors: 'smartbus_sectors',
        routes: 'smartbus_routes',
        operators: 'smartbus_operators',
        tickets: 'smartbus_tickets'
    };

    // Safe default for local dashboard usage; can be changed from the Server slot.
    const HARDWARE_DEFAULT_BASE = 'http://127.0.0.1:3000';

    let sampleCache = {};
    let apiBase = resolveInitialApiBase();

    function resolveInitialApiBase() {
        const saved = normalizeApiBase(localStorage.getItem(API_BASE_KEY));
        if (saved) {
            return saved;
        }

        const host = window.location.hostname;
        if (host && host !== 'localhost' && host !== '127.0.0.1') {
            return normalizeApiBase(`${window.location.protocol}//${host}:3000`);
        }

        if (host === 'localhost' || host === '127.0.0.1') {
            return normalizeApiBase(`${window.location.protocol}//${host}:3000`);
        }

        return HARDWARE_DEFAULT_BASE;
    }

    function normalizeApiBase(value) {
        if (!value) {
            return '';
        }

        let base = String(value).trim();
        if (!base) {
            return '';
        }

        if (!/^https?:\/\//i.test(base)) {
            base = `http://${base}`;
        }

        return base.replace(/\/+$/, '');
    }

    function safeJsonParse(raw, fallback) {
        try {
            return JSON.parse(raw);
        } catch (_err) {
            return fallback;
        }
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function readList(key) {
        const raw = localStorage.getItem(key);
        if (!raw) {
            return [];
        }
        const parsed = safeJsonParse(raw, []);
        return Array.isArray(parsed) ? parsed : [];
    }

    function writeList(key, list) {
        localStorage.setItem(key, JSON.stringify(list));
        return list;
    }

    async function loadSample(fileName) {
        if (sampleCache[fileName]) {
            return clone(sampleCache[fileName]);
        }

        const response = await fetch(`../data/${fileName}`);
        if (!response.ok) {
            throw new Error(`Failed to load ${fileName}`);
        }

        const data = await response.json();
        sampleCache[fileName] = data;
        return clone(data);
    }

    async function request(path, options = {}) {
        const response = await fetch(`${apiBase}${path}`, {
            headers: {
                'Content-Type': 'application/json'
            },
            ...options
        });

        let body = null;
        try {
            body = await response.json();
        } catch (_err) {
            body = null;
        }

        if (!response.ok) {
            const message = body && body.message ? body.message : `HTTP ${response.status}`;
            throw new Error(message);
        }

        return body;
    }

    async function safeRequest(path, options = {}) {
        try {
            return await request(path, options);
        } catch (_err) {
            return null;
        }
    }

    function notify(kind, title, message) {
        if (global.Notify && typeof global.Notify[kind] === 'function') {
            global.Notify[kind](title, message);
            return;
        }

        if (kind === 'error') {
            console.error(`${title}: ${message}`);
        } else {
            console.log(`${title}: ${message}`);
        }
    }

    function mapOperator(op) {
        return {
            id: op.id || op.operatorId,
            operatorId: op.operatorId || op.id,
            name: op.name || op.operatorName,
            phone: op.phone || '',
            busId: op.busId || op.assignedBus || '',
            assignedBus: op.assignedBus || op.busId || '',
            active: op.active !== false && op.status !== 'inactive',
            status: op.status || (op.active === false ? 'inactive' : 'active')
        };
    }

    function mapBusFromBackend(bus) {
        const seating = Number(bus.seatingCapacity || 40);
        const standing = Number(bus.standingCapacity || 20);
        return {
            busId: bus.busId,
            busNumber: bus.busNumber || `${bus.busId}-REG`,
            seatingCapacity: seating,
            standingCapacity: standing,
            totalCapacity: Number(bus.totalCapacity || seating + standing),
            status: bus.status || 'active',
            currentPassengers: Number(bus.passengerCount || bus.currentPassengers || 0),
            route: bus.route || 'R1 City Center - Tech Park',
            currentStop: bus.currentStop || 'In Transit',
            createdAt: bus.createdAt || new Date().toISOString()
        };
    }

    function mapTicketFromBackend(ticket) {
        return {
            ticketId: ticket.ticketId,
            busId: ticket.busId,
            operatorId: ticket.operatorId || 'OP001',
            boardingStop: ticket.boardingStop || ticket.source || 'Unknown',
            destinationStop: ticket.destinationStop || ticket.destination || 'Unknown',
            passengerCount: Number(ticket.passengerCount || 1),
            ticketType: ticket.ticketType || 'regular',
            fare: Number(ticket.fare || 0),
            status: ticket.status || 'active',
            timestamp: ticket.timestamp || ticket.issuedAt || new Date().toISOString()
        };
    }

    function updateServerSlot(online) {
        const slot = document.getElementById('apiServerSlot');
        if (!slot) {
            return;
        }

        slot.textContent = `Server: ${apiBase}`;
        slot.classList.toggle('offline', online === false);
        slot.title = 'Click to change backend IP';
    }

    async function pingServer(base) {
        try {
            const response = await fetch(`${base}/health`, { method: 'GET' });
            return response.ok;
        } catch (_err) {
            return false;
        }
    }

    async function setApiBase(nextBase) {
        const normalized = normalizeApiBase(nextBase);
        if (!normalized) {
            throw new Error('Please enter a valid IP or URL. Example: 10.103.240.81:3000');
        }

        apiBase = normalized;
        localStorage.setItem(API_BASE_KEY, apiBase);

        const isOnline = await pingServer(apiBase);
        updateServerSlot(isOnline);

        global.dispatchEvent(new CustomEvent('smartbus:api-base-changed', {
            detail: { apiBase, online: isOnline }
        }));

        return { apiBase, online: isOnline };
    }

    function getApiBase() {
        return apiBase;
    }

    async function ensureServerSlot() {
        const brand = document.querySelector('.ent-navbar .nav-brand');
        if (!brand) {
            return;
        }

        let slot = document.getElementById('apiServerSlot');
        if (!slot) {
            slot = document.createElement('button');
            slot.id = 'apiServerSlot';
            slot.className = 'api-server-slot';
            slot.type = 'button';
            brand.appendChild(slot);
        }

        updateServerSlot();

        slot.addEventListener('click', async function () {
            const input = prompt('Enter backend URL for web + ESP32 (example: http://10.103.240.81:3000)', apiBase);
            if (!input) {
                return;
            }

            try {
                const result = await setApiBase(input);
                if (result.online) {
                    notify('success', 'Server Connected', `Using ${result.apiBase}`);
                } else {
                    notify('warning', 'Server Saved', `${result.apiBase} saved, but health check failed`);
                }
            } catch (err) {
                notify('error', 'Invalid Server', err.message);
            }
        });

        const online = await pingServer(apiBase);
        updateServerSlot(online);
    }

    async function getBuses() {
        const remote = await safeRequest('/getBusData');
        if (remote && Array.isArray(remote.buses)) {
            const buses = remote.buses.map(mapBusFromBackend);
            writeList(STORAGE_KEYS.buses, buses);
            return buses;
        }

        const stored = readList(STORAGE_KEYS.buses);
        if (stored.length) {
            return stored;
        }

        const sample = await loadSample('sampleBuses.json');
        writeList(STORAGE_KEYS.buses, sample);
        return sample;
    }

    async function addBus(data) {
        const buses = await getBuses();
        if (buses.some((b) => b.busId === data.busId)) {
            throw new Error('Bus ID already exists');
        }

        const bus = {
            ...data,
            status: data.status || 'active',
            createdAt: new Date().toISOString()
        };

        buses.push(bus);
        writeList(STORAGE_KEYS.buses, buses);
        return bus;
    }

    async function getSectors() {
        const stored = readList(STORAGE_KEYS.sectors);
        if (stored.length) {
            return stored;
        }

        const sample = await loadSample('sectors.json');
        writeList(STORAGE_KEYS.sectors, sample);
        return sample;
    }

    async function addSector(data) {
        const sectors = await getSectors();
        if (sectors.some((s) => s.sectorId === data.sectorId)) {
            throw new Error('Sector ID already exists');
        }

        const sector = {
            ...data,
            status: data.status || 'active',
            createdAt: new Date().toISOString()
        };

        sectors.push(sector);
        writeList(STORAGE_KEYS.sectors, sectors);
        return sector;
    }

    async function getRoutes() {
        const stored = readList(STORAGE_KEYS.routes);
        if (stored.length) {
            return stored;
        }

        const sample = await loadSample('sampleRoutes.json');
        writeList(STORAGE_KEYS.routes, sample);
        return sample;
    }

    async function addRoute(data) {
        const routes = await getRoutes();
        if (routes.some((r) => r.routeId === data.routeId)) {
            throw new Error('Route ID already exists');
        }

        const route = {
            ...data,
            createdAt: new Date().toISOString()
        };

        routes.push(route);
        writeList(STORAGE_KEYS.routes, routes);
        return route;
    }

    async function getOperators() {
        const stored = readList(STORAGE_KEYS.operators);
        if (stored.length) {
            return stored;
        }

        const sample = await loadSample('sampleOperators.json');
        const mapped = sample.map(mapOperator);
        writeList(STORAGE_KEYS.operators, mapped);
        return mapped;
    }

    async function addOperator(data) {
        const operators = await getOperators();
        const normalizedId = String(data.id || data.operatorId || '').toUpperCase();

        if (!normalizedId) {
            throw new Error('Operator ID is required');
        }

        if (operators.some((op) => String(op.id || op.operatorId).toUpperCase() === normalizedId)) {
            throw new Error('Operator ID already exists');
        }

        const operator = mapOperator({
            id: normalizedId,
            name: data.name,
            phone: data.phone,
            busId: data.busId,
            active: data.active !== false,
            status: data.active === false ? 'inactive' : 'active'
        });

        operators.push(operator);
        writeList(STORAGE_KEYS.operators, operators);
        return operator;
    }

    async function deleteOperator(operatorId) {
        const operators = await getOperators();
        const normalized = String(operatorId || '').toUpperCase();
        const next = operators.filter((op) => String(op.id || op.operatorId).toUpperCase() !== normalized);
        writeList(STORAGE_KEYS.operators, next);
        return true;
    }

    async function getBusTickets(busId) {
        const query = busId ? `?busId=${encodeURIComponent(String(busId).toUpperCase())}` : '';
        const remote = await safeRequest(`/getTickets${query}`);

        if (remote && Array.isArray(remote.tickets)) {
            const tickets = remote.tickets.map(mapTicketFromBackend);
            writeList(STORAGE_KEYS.tickets, tickets);
            return busId ? tickets.filter((t) => t.busId === busId) : tickets;
        }

        const stored = readList(STORAGE_KEYS.tickets);
        if (stored.length) {
            return busId ? stored.filter((t) => t.busId === busId) : stored;
        }

        const sample = await loadSample('sampleTickets.json');
        writeList(STORAGE_KEYS.tickets, sample);
        return busId ? sample.filter((t) => t.busId === busId) : sample;
    }

    async function issueTicket(data) {
        const source = data.source || data.boardingStop;
        const destination = data.destination || data.destinationStop;

        const remotePayload = {
            busId: data.busId,
            source,
            destination,
            passengerCount: data.passengerCount,
            operatorId: data.operatorId
        };

        const remote = await safeRequest('/issueTicket', {
            method: 'POST',
            body: JSON.stringify(remotePayload)
        });

        const ticket = {
            ticketId: remote && remote.ticket ? remote.ticket.ticketId : `TKT-${Date.now()}`,
            busId: data.busId,
            operatorId: data.operatorId || 'OP001',
            boardingStop: source,
            destinationStop: destination,
            passengerCount: Number(data.passengerCount || 1),
            ticketType: data.ticketType || 'regular',
            fare: Number(data.fare || 0),
            status: 'active',
            timestamp: remote && remote.ticket ? remote.ticket.issuedAt : new Date().toISOString()
        };

        const tickets = readList(STORAGE_KEYS.tickets);
        tickets.unshift(ticket);
        writeList(STORAGE_KEYS.tickets, tickets);

        return ticket;
    }

    async function updateBusLocation(payload) {
        return request('/updateBus', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }


    function resetSampleCache() {
        sampleCache = {};
    }

    global.getApiBase = getApiBase;
    global.setApiBase = setApiBase;
    global.getBuses = getBuses;
    global.addBus = addBus;
    global.getSectors = getSectors;
    global.addSector = addSector;
    global.getRoutes = getRoutes;
    global.addRoute = addRoute;
    global.getOperators = getOperators;
    global.addOperator = addOperator;
    global.deleteOperator = deleteOperator;
    global.getBusTickets = getBusTickets;
    global.issueTicket = issueTicket;
    global.updateBusLocation = updateBusLocation;

    global.SmartBusApi = {
        getApiBase,
        setApiBase,
        request,
        resetSampleCache
    };

    document.addEventListener('DOMContentLoaded', function () {
        ensureServerSlot();
    });
})(window);
