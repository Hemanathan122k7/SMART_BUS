const API_BASE = `${window.location.protocol}//${window.location.hostname}:3000`;

let loggedInOperator = null;
let map;
let busMarker;
let eventSource;

const state = {
  bus: null,
  tickets: [],
};

function byId(id) {
  return document.getElementById(id);
}

function setMessage(elementId, text, ok) {
  const el = byId(elementId);
  el.textContent = text || "";
  el.className = "msg" + (text ? (ok ? " ok" : " error") : "");
}

function formatTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString();
}

function updateServerBadge(isConnected) {
  byId("serverBadge").textContent = isConnected ? "Server: connected" : "Server: disconnected";
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      message = body.message || message;
    } catch (_err) {
      // ignore JSON parse error
    }
    throw new Error(message);
  }

  return response.json();
}

async function handleLogin(event) {
  event.preventDefault();

  const operatorId = byId("operatorId").value.trim().toUpperCase();
  const password = byId("password").value;

  try {
    const data = await api("/login", {
      method: "POST",
      body: JSON.stringify({ operatorId, password }),
    });

    loggedInOperator = data.operator;
    setMessage("loginMessage", `Welcome ${loggedInOperator.name}`, true);
    byId("loginCard").classList.add("hidden");
    byId("dashboard").classList.remove("hidden");

    byId("busIdText").textContent = loggedInOperator.busId;

    initializeMap();
    await refreshBusData();
    startEvents();

    setInterval(refreshBusData, 5000);
  } catch (err) {
    setMessage("loginMessage", err.message, false);
  }
}

function initializeMap() {
  if (map) return;

  map = L.map("map").setView([12.9716, 77.5946], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "OpenStreetMap",
  }).addTo(map);

  busMarker = L.marker([12.9716, 77.5946]).addTo(map).bindPopup("Bus");
}

function applyBusData(bus) {
  if (!bus) return;

  state.bus = bus;
  byId("busIdText").textContent = bus.busId;

  const doorNode = byId("doorStatusText");
  const safetyNode = byId("safetyStatusText");
  doorNode.textContent = bus.doorStatus;
  safetyNode.textContent = bus.safetyStatus;
  doorNode.className = `pill ${String(bus.doorStatus || "").toLowerCase()}`;
  safetyNode.className = `pill ${String(bus.safetyStatus || "").toLowerCase()}`;

  byId("passengerCountText").textContent = String(bus.passengerCount ?? 0);
  byId("lastUpdateText").textContent = formatTime(bus.lastUpdated);
  byId("coordsText").textContent = `Latitude: ${bus.latitude}, Longitude: ${bus.longitude}`;

  if (map && busMarker) {
    const lat = Number(bus.latitude) || 0;
    const lng = Number(bus.longitude) || 0;
    busMarker.setLatLng([lat, lng]);
    busMarker.setPopupContent(`${bus.busId}<br>Passengers: ${bus.passengerCount}`);
    map.panTo([lat, lng]);
  }
}

function renderTickets() {
  const body = byId("ticketTableBody");
  if (!state.tickets.length) {
    body.innerHTML = "<tr><td colspan='5'>No tickets issued yet</td></tr>";
    return;
  }

  body.innerHTML = state.tickets
    .slice(0, 10)
    .map(
      (ticket) =>
        `<tr>
          <td>${ticket.ticketId}</td>
          <td>${ticket.source}</td>
          <td>${ticket.destination}</td>
          <td>${ticket.passengerCount}</td>
          <td>${formatTime(ticket.issuedAt)}</td>
        </tr>`
    )
    .join("");
}

async function refreshBusData() {
  if (!loggedInOperator) return;

  try {
    const data = await api(`/getBusData?busId=${encodeURIComponent(loggedInOperator.busId)}`);
    applyBusData(data.bus);
    updateServerBadge(true);
  } catch (err) {
    updateServerBadge(false);
  }
}

async function handleIssueTicket(event) {
  event.preventDefault();

  if (!loggedInOperator) return;

  const source = byId("source").value;
  const destination = byId("destination").value;
  const passengerCount = Number(byId("ticketPassengers").value || "1");

  if (source === destination) {
    setMessage("ticketMessage", "Source and destination must be different", false);
    return;
  }

  try {
    const data = await api("/issueTicket", {
      method: "POST",
      body: JSON.stringify({
        busId: loggedInOperator.busId,
        source,
        destination,
        passengerCount,
        operatorId: loggedInOperator.operatorId,
      }),
    });

    state.tickets.unshift(data.ticket);
    renderTickets();
    if (state.bus) {
      state.bus.passengerCount = data.updatedPassengerCount;
      applyBusData(state.bus);
    }

    byId("ticketForm").reset();
    byId("ticketPassengers").value = "1";
    setMessage("ticketMessage", `Ticket ${data.ticket.ticketId} issued`, true);
  } catch (err) {
    setMessage("ticketMessage", err.message, false);
  }
}

function startEvents() {
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource(`${API_BASE}/events`);

  eventSource.addEventListener("open", () => {
    updateServerBadge(true);
  });

  eventSource.addEventListener("error", () => {
    updateServerBadge(false);
  });

  eventSource.addEventListener("bus_update", (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.bus?.busId === loggedInOperator.busId) {
        applyBusData(payload.bus);
      }
    } catch (_err) {
      // ignore malformed events
    }
  });

  eventSource.addEventListener("ticket_issued", (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.ticket?.busId === loggedInOperator.busId) {
        state.tickets.unshift(payload.ticket);
        renderTickets();
      }
    } catch (_err) {
      // ignore malformed events
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  byId("loginForm").addEventListener("submit", handleLogin);
  byId("ticketForm").addEventListener("submit", handleIssueTicket);
});
