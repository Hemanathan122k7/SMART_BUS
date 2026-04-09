const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

const DEFAULT_SEATING_CAPACITY = 40;

app.use(cors());
app.use(express.json());

/* ── STATIC FRONTEND ──────────────────────────────────── */
const frontendRoot = path.join(__dirname, '..', 'frontend');
app.use('/frontend', express.static(frontendRoot));

/* ── IN-MEMORY STORE  ──────────────────────────────────── */
const DEFAULT_OPERATOR = {
  operatorId: 'OP001',
  password: 'op1234',
  busId: 'BUS001',
  name: 'Default Operator',
};

const store = {
  operators: {
    [DEFAULT_OPERATOR.operatorId]: DEFAULT_OPERATOR,
  },
  buses: {
    BUS001: {
      busId: 'BUS001',
      latitude: 12.9716,
      longitude: 77.5946,
      doorStatus: 'CLOSED',
      safetyStatus: 'SAFE',
      passengerCount: 0,
      lastUpdated: new Date().toISOString(),
      route: 'R1 City Center - Tech Park',
      speedKmph: 0,
    },
  },
  tickets: [],
  busStopDisplay: {},
  locationHistory: {},
};

/* ── HELPERS ───────────────────────────────────────────── */
const sseClients = new Set();
const MAX_LOCATION_HISTORY = 300;

function nowIso() {
  return new Date().toISOString();
}

function getBus(busId) {
  if (!store.buses[busId]) {
    store.buses[busId] = {
      busId,
      latitude: 0,
      longitude: 0,
      doorStatus: 'CLOSED',
      safetyStatus: 'SAFE',
      passengerCount: 0,
      lastUpdated: nowIso(),
      route: 'UNASSIGNED',
      speedKmph: 0,
    };
  }
  return store.buses[busId];
}

function appendLocationHistory(busId, latitude, longitude, source = 'updateBus') {
  const latNum = Number(latitude);
  const lngNum = Number(longitude);

  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return;
  }

  if (!store.locationHistory[busId]) {
    store.locationHistory[busId] = [];
  }

  const points = store.locationHistory[busId];
  points.push({
    latitude: latNum,
    longitude: lngNum,
    source,
    ts: nowIso(),
  });

  if (points.length > MAX_LOCATION_HISTORY) {
    points.splice(0, points.length - MAX_LOCATION_HISTORY);
  }
}

function readLocationHistory(busId, limit = 80) {
  const points = store.locationHistory[busId] || [];
  const cap = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(500, Number(limit))) : 80;
  return points.slice(-cap);
}

function broadcast(event, payload) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    res.write(msg);
  }
}

function normalizeDoorStatus(value) {
  const normalized = String(value || '').toUpperCase();
  return normalized === 'OPEN' ? 'OPEN' : 'CLOSED';
}

function normalizeSafetyStatus(value) {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'ALERT' || normalized === 'BLOCKED') {
    return 'ALERT';
  }
  return 'SAFE';
}

function toNonNegativeInt(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return Math.max(0, Number(fallback) || 0);
  }
  return Math.max(0, Math.round(parsed));
}

function normalizeBusToken(value, fallback = '--') {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized || fallback;
}

function normalizeEtaToken(value, fallback = '--') {
  const text = String(value ?? '').trim();
  if (!text) {
    return fallback;
  }

  if (text === '--') {
    return '--';
  }

  const parsed = Number(text);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return String(Math.round(parsed));
  }

  return fallback;
}

function computeSeatsAvailable(passengers, seatingCapacity = DEFAULT_SEATING_CAPACITY) {
  const seating = Math.max(1, toNonNegativeInt(seatingCapacity, DEFAULT_SEATING_CAPACITY));
  const pax = toNonNegativeInt(passengers, 0);
  return Math.max(0, seating - Math.min(pax, seating));
}

function deriveEtaFromSpeed(speedKmph) {
  const speed = Number(speedKmph || 0);
  if (!Number.isFinite(speed) || speed <= 0) {
    return '--';
  }
  if (speed >= 45) return '3';
  if (speed >= 30) return '4';
  if (speed >= 20) return '5';
  return '7';
}

function parseEtaForSort(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return Number.POSITIVE_INFINITY;
  }
  return parsed;
}

function deriveNextBusOnRoute(busId, routeName) {
  const route = String(routeName || 'UNASSIGNED');
  const peers = Object.values(store.buses)
    .filter((bus) => bus.busId !== busId && String(bus.route || 'UNASSIGNED') === route)
    .map((bus) => {
      const pushed = store.busStopDisplay[bus.busId];
      const etaMin = normalizeEtaToken(
        pushed ? pushed.etaMin : deriveEtaFromSpeed(bus.speedKmph),
        '--',
      );
      return {
        busId: bus.busId,
        etaMin,
      };
    });

  if (!peers.length) {
    return { nextBusId: '--', nextBusEta: '--' };
  }

  peers.sort((a, b) => parseEtaForSort(a.etaMin) - parseEtaForSort(b.etaMin));
  return {
    nextBusId: normalizeBusToken(peers[0].busId, '--'),
    nextBusEta: normalizeEtaToken(peers[0].etaMin, '--'),
  };
}

function buildLiveBusData(busId) {
  const normalizedBusId = normalizeBusToken(busId || DEFAULT_OPERATOR.busId, DEFAULT_OPERATOR.busId);
  const bus = getBus(normalizedBusId);
  const pushed = store.busStopDisplay[normalizedBusId];

  const passengers = toNonNegativeInt(
    pushed ? pushed.passengers : bus.passengerCount,
    0,
  );

  const seatsAvailable = toNonNegativeInt(
    pushed ? pushed.seatsAvailable : computeSeatsAvailable(passengers, bus.seatingCapacity),
    computeSeatsAvailable(passengers, bus.seatingCapacity),
  );

  const etaMin = normalizeEtaToken(
    pushed ? pushed.etaMin : deriveEtaFromSpeed(bus.speedKmph),
    '--',
  );

  const nextFromRoute = deriveNextBusOnRoute(normalizedBusId, bus.route);
  const nextBusId = normalizeBusToken(
    pushed ? pushed.nextBusId : nextFromRoute.nextBusId,
    nextFromRoute.nextBusId,
  );
  const nextBusEta = normalizeEtaToken(
    pushed ? pushed.nextBusEta : nextFromRoute.nextBusEta,
    nextFromRoute.nextBusEta,
  );

  return {
    busId: normalizedBusId,
    passengers,
    seatsAvailable,
    etaMin,
    nextBusId,
    nextBusEta,
    route: bus.route,
    lastUpdated: nowIso(),
  };
}

function saveLiveBusData(data) {
  const busId = normalizeBusToken(data.busId || DEFAULT_OPERATOR.busId, DEFAULT_OPERATOR.busId);
  const bus = getBus(busId);

  const passengers = toNonNegativeInt(
    data.passengers ?? data.passengerCount,
    bus.passengerCount,
  );
  const seatsAvailable = toNonNegativeInt(
    data.seatsAvailable,
    computeSeatsAvailable(passengers, bus.seatingCapacity),
  );
  const etaMin = normalizeEtaToken(data.etaMin ?? data.eta, deriveEtaFromSpeed(bus.speedKmph));

  const route = String(data.route || bus.route || 'UNASSIGNED');
  const nextBusId = normalizeBusToken(data.nextBusId ?? data.nextBus, '--');
  const nextBusEta = normalizeEtaToken(data.nextBusEta ?? data.nextEta, '--');

  bus.passengerCount = passengers;
  bus.route = route;
  bus.lastUpdated = nowIso();

  const snapshot = {
    busId,
    passengers,
    seatsAvailable,
    etaMin,
    nextBusId,
    nextBusEta,
    route,
    lastUpdated: nowIso(),
  };

  store.busStopDisplay[busId] = snapshot;
  return snapshot;
}

function toPipeBusData(data) {
  return [
    normalizeBusToken(data.busId, DEFAULT_OPERATOR.busId),
    String(toNonNegativeInt(data.passengers, 0)),
    String(toNonNegativeInt(data.seatsAvailable, DEFAULT_SEATING_CAPACITY)),
    normalizeEtaToken(data.etaMin, '--'),
    normalizeBusToken(data.nextBusId, '--'),
    normalizeEtaToken(data.nextBusEta, '--'),
  ].join('|');
}

function syncLiveBusDataFromBus(busId) {
  const snapshot = buildLiveBusData(busId);
  store.busStopDisplay[snapshot.busId] = snapshot;
  return snapshot;
}

function buildBusStopPayload(bus) {
  return {
    busId: bus.busId,
    route: bus.route,
    currentLocation: {
      latitude: bus.latitude,
      longitude: bus.longitude,
    },
    passengerCount: bus.passengerCount,
    doorStatus: bus.doorStatus,
    safetyStatus: bus.safetyStatus,
    etaToNextStopMin: bus.speedKmph > 0 ? 4 : 7,
    lastUpdated: bus.lastUpdated,
  };
}

/* ── ROUTES: INFO ──────────────────────────────────────── */
app.get('/', (req, res) => {
  res.json({
    name: 'Smart Bus Monitoring Backend',
    dashboard: '/dashboard',
    endpoints: [
      'POST /login',
      'POST /updateBus',
      'GET /getBusData',
      'GET /busLocationHistory',
      'POST /issueTicket',
      'GET /busdata',
      'POST /busdata/update',
      'GET /busStopData',
      'GET /events',
    ],
    defaultOperator: {
      operatorId: DEFAULT_OPERATOR.operatorId,
      password: DEFAULT_OPERATOR.password,
      busId: DEFAULT_OPERATOR.busId,
    },
  });
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(frontendRoot, 'pages', 'live-dashboard.html'));
});

/* ── ROUTES: SSE ───────────────────────────────────────── */
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res);
  res.write(`event: hello\ndata: ${JSON.stringify({ ts: nowIso() })}\n\n`);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

/* ── ROUTES: AUTH ──────────────────────────────────────── */
app.post('/login', (req, res) => {
  const { operatorId, password } = req.body || {};

  const operator = store.operators[String(operatorId || '').toUpperCase()];
  if (!operator || operator.password !== String(password || '')) {
    return res.status(401).json({
      success: false,
      message: 'Invalid operator ID or password',
    });
  }

  return res.json({
    success: true,
    operator: {
      operatorId: operator.operatorId,
      name: operator.name,
      busId: operator.busId,
    },
  });
});

/* ── ROUTES: BUS CRUD ──────────────────────────────────── */
function handleUpdateBus(req, res) {
  const {
    busId,
    latitude,
    longitude,
    doorStatus,
    safetyStatus,
    speedKmph,
  } = req.body || {};

  if (!busId) {
    return res.status(400).json({
      success: false,
      message: 'busId is required',
    });
  }

  const latNum = Number(latitude);
  const lngNum = Number(longitude);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return res.status(400).json({
      success: false,
      message: 'latitude and longitude must be valid numbers',
    });
  }

  const bus = getBus(String(busId).toUpperCase());
  bus.latitude = latNum;
  bus.longitude = lngNum;
  bus.doorStatus = normalizeDoorStatus(doorStatus);
  bus.safetyStatus = normalizeSafetyStatus(safetyStatus);
  bus.speedKmph = Number(speedKmph) || 0;
  bus.lastUpdated = nowIso();

  appendLocationHistory(bus.busId, latNum, lngNum, 'updateBus');

  const busData = syncLiveBusDataFromBus(bus.busId);

  broadcast('bus_update', { bus });
  broadcast('location_update', { busId: bus.busId, lat: latNum, lng: lngNum, ts: nowIso() });
  broadcast('busdata_update', { busData, pipe: toPipeBusData(busData) });

  return res.json({
    success: true,
    message: 'Bus data updated',
    bus,
  });
}

app.post('/updateBus', handleUpdateBus);
app.post('/api/updateBus', handleUpdateBus);

function handleGetBusData(req, res) {
  const requestedBusId = req.query.busId ? String(req.query.busId).toUpperCase() : null;

  if (requestedBusId) {
    const bus = getBus(requestedBusId);
    return res.json({ success: true, bus });
  }

  return res.json({
    success: true,
    buses: Object.values(store.buses),
  });
}

app.get('/getBusData', handleGetBusData);
app.get('/api/getBusData', handleGetBusData);

function handleGetBusLocationHistory(req, res) {
  const busId = String(req.query.busId || DEFAULT_OPERATOR.busId).toUpperCase();
  const limit = Number(req.query.limit || 80);

  return res.json({
    success: true,
    busId,
    history: readLocationHistory(busId, limit),
  });
}

app.get('/busLocationHistory', handleGetBusLocationHistory);
app.get('/api/busLocationHistory', handleGetBusLocationHistory);

function handleGetBusDataPipe(req, res) {
  const requestedBusId = req.query.busId
    ? String(req.query.busId).toUpperCase()
    : DEFAULT_OPERATOR.busId;

  const snapshot = syncLiveBusDataFromBus(requestedBusId);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.send(toPipeBusData(snapshot));
}

function handleBusDataUpdate(req, res) {
  const snapshot = saveLiveBusData(req.body || {});
  const pipe = toPipeBusData(snapshot);

  broadcast('busdata_update', { busData: snapshot, pipe });

  return res.json({
    success: true,
    busData: snapshot,
    pipe,
  });
}

app.get('/busdata', handleGetBusDataPipe);
app.get('/api/busdata', handleGetBusDataPipe);
app.post('/busdata/update', handleBusDataUpdate);
app.post('/api/busdata/update', handleBusDataUpdate);

/* ── ROUTES: TICKETS ───────────────────────────────────── */
function handleIssueTicket(req, res) {
  const {
    busId,
    source,
    destination,
    passengerCount,
    operatorId,
  } = req.body || {};

  if (!busId || !source || !destination) {
    return res.status(400).json({
      success: false,
      message: 'busId, source and destination are required',
    });
  }

  const pax = Number(passengerCount || 1);
  if (!Number.isInteger(pax) || pax <= 0) {
    return res.status(400).json({
      success: false,
      message: 'passengerCount must be a positive integer',
    });
  }

  const bus = getBus(String(busId).toUpperCase());
  bus.passengerCount += pax;
  bus.lastUpdated = nowIso();

  const ticket = {
    ticketId: `TKT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    busId: bus.busId,
    source,
    destination,
    passengerCount: pax,
    operatorId: operatorId || 'UNKNOWN',
    issuedAt: nowIso(),
  };

  store.tickets.unshift(ticket);

  const busData = syncLiveBusDataFromBus(bus.busId);

  broadcast('ticket_issued', { ticket, passengerCount: bus.passengerCount, busId: bus.busId });
  broadcast('bus_update', { bus });
  broadcast('busdata_update', { busData, pipe: toPipeBusData(busData) });

  return res.json({
    success: true,
    ticket,
    updatedPassengerCount: bus.passengerCount,
  });
}

app.post('/issueTicket', handleIssueTicket);
app.post('/api/issueTicket', handleIssueTicket);

app.get('/getTickets', (req, res) => {
  const busId = req.query.busId ? String(req.query.busId).toUpperCase() : null;
  const tickets = busId
    ? store.tickets.filter((ticket) => ticket.busId === busId)
    : store.tickets;

  return res.json({
    success: true,
    tickets,
  });
});

app.get('/busStopData', (req, res) => {
  const busId = String(req.query.busId || DEFAULT_OPERATOR.busId).toUpperCase();
  const bus = getBus(busId);
  return res.json({
    success: true,
    data: buildBusStopPayload(bus),
  });
});

app.get('/examplePayloads', (req, res) => {
  res.json({
    updateBusRequest: {
      busId: 'BUS001',
      latitude: 12.9731,
      longitude: 77.6022,
      doorStatus: 'OPEN',
      safetyStatus: 'ALERT',
      speedKmph: 28,
    },
    issueTicketRequest: {
      busId: 'BUS001',
      source: 'Central Station',
      destination: 'Tech Park',
      passengerCount: 2,
      operatorId: 'OP001',
    },
    busDataUpdateRequest: {
      busId: 'BUS001',
      passengers: 12,
      seatsAvailable: 28,
      etaMin: 5,
      nextBusId: 'BUS002',
      nextBusEta: 7,
    },
    busDataPipeResponse: 'BUS001|12|28|5|BUS002|7',
    getBusDataResponse: {
      success: true,
      bus: store.buses.BUS001,
    },
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', ts: nowIso() });
});

/* ── ERROR HANDLER ────────────────────────────────────── */
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

/* ── START ─────────────────────────────────────────────── */
const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Smart Bus backend running at http://0.0.0.0:${PORT}`);
});
