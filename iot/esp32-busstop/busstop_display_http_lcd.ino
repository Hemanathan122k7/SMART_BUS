#include <WiFi.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

const char* WIFI_SSID = "AQUA";
const char* WIFI_PASS = "yourname";

// Update if your laptop IP changes. Current detected LAN IP: 10.239.124.81
String serverBaseUrl = "http://10.239.124.81:3000";
String busId = "BUS001";
String serverURL = serverBaseUrl + "/busdata?busId=" + busId;

const unsigned long POLL_INTERVAL_MS = 3000;
const int BACKEND_HTTP_TIMEOUT_MS = 2200;
const unsigned long DISPLAY_DATA_HOLD_MS = 30000;

WebServer server(80);
LiquidCrystal_I2C lcd(0x27, 16, 2);

String displayBusId = "BUS001";
int displayPassengerCount = 0;
int displaySeatsAvailable = 40;
String displayEta = "--";
String displayNextBusId = "--";
String displayNextEta = "--";

unsigned long lastPollMs = 0;
unsigned long lastBackendSuccessMs = 0;
unsigned long lastDisplayUpdateMs = 0;
bool hasBackendData = false;

const unsigned long WAITING_SCREEN_TIMEOUT_MS = 15000;

String normalizeBaseUrl(const String& value) {
  String out = value;
  out.trim();
  if (out.length() == 0) return out;

  if (!out.startsWith("http://") && !out.startsWith("https://")) {
    out = "http://" + out;
  }

  while (out.endsWith("/")) {
    out.remove(out.length() - 1);
  }
  return out;
}

void rebuildServerUrl() {
  serverBaseUrl = normalizeBaseUrl(serverBaseUrl);
  busId.trim();
  busId.toUpperCase();
  if (busId.length() == 0) busId = "BUS001";
  serverURL = serverBaseUrl + "/busdata?busId=" + busId;
}

void addCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

void sendJsonWithCors(int statusCode, const String& body) {
  addCorsHeaders();
  server.send(statusCode, "application/json", body);
}

void handleCorsPreflight() {
  addCorsHeaders();
  server.send(204, "text/plain", "");
}

String fit16(const String& value) {
  if (value.length() <= 16) {
    String out = value;
    while (out.length() < 16) out += ' ';
    return out;
  }
  return value.substring(0, 16);
}

String formatEta(const String& rawEta) {
  String eta = rawEta;
  eta.trim();
  if (eta.length() == 0 || eta == "--") {
    return "--";
  }
  return eta + "m";
}

String shortBusId(const String& value) {
  String id = value;
  id.trim();
  id.toUpperCase();
  if (id.startsWith("BUS") && id.length() > 3) {
    return id.substring(3);
  }
  return id.length() ? id : "--";
}

void sanitizeDisplayState() {
  displayBusId.trim();
  displayBusId.toUpperCase();
  if (displayBusId.length() == 0) displayBusId = "BUS001";

  if (displayPassengerCount < 0) displayPassengerCount = 0;
  if (displaySeatsAvailable < 0) displaySeatsAvailable = 0;

  displayEta.trim();
  if (displayEta.length() == 0) displayEta = "--";

  displayNextBusId.trim();
  displayNextBusId.toUpperCase();
  if (displayNextBusId.length() == 0) displayNextBusId = "--";

  displayNextEta.trim();
  if (displayNextEta.length() == 0) displayNextEta = "--";
}

void renderBusDataScreen() {
  sanitizeDisplayState();

  String row1 = displayBusId + " P:" + String(displayPassengerCount) + " S:" + String(displaySeatsAvailable);
  String row2 = "Arr:" + formatEta(displayEta) + " N:" + shortBusId(displayNextBusId) + " " + formatEta(displayNextEta);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(fit16(row1));
  lcd.setCursor(0, 1);
  lcd.print(fit16(row2));
}

void renderWaitingScreen(const String& topLine = "Waiting for", const String& bottomLine = "data...") {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(fit16(topLine));
  lcd.setCursor(0, 1);
  lcd.print(fit16(bottomLine));
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  renderWaitingScreen("Connecting WiFi", "Please wait...");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(fit16("WiFi Connected"));
  lcd.setCursor(0, 1);
  lcd.print(fit16(WiFi.localIP().toString()));
  delay(1200);

  Serial.print("Bus stop ESP32 IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("Polling: ");
  Serial.println(serverURL);
}

bool parsePipeBusData(const String& payload) {
  int i1 = payload.indexOf('|');
  if (i1 < 0) return false;
  int i2 = payload.indexOf('|', i1 + 1);
  if (i2 < 0) return false;
  int i3 = payload.indexOf('|', i2 + 1);
  if (i3 < 0) return false;
  int i4 = payload.indexOf('|', i3 + 1);
  if (i4 < 0) return false;
  int i5 = payload.indexOf('|', i4 + 1);
  if (i5 < 0) return false;

  String nextBus = payload.substring(i4 + 1, i5);
  String nextEta = payload.substring(i5 + 1);

  displayBusId = payload.substring(0, i1);
  displayPassengerCount = payload.substring(i1 + 1, i2).toInt();
  displaySeatsAvailable = payload.substring(i2 + 1, i3).toInt();
  displayEta = payload.substring(i3 + 1, i4);
  displayNextBusId = nextBus;
  displayNextEta = nextEta;

  sanitizeDisplayState();
  return true;
}

bool pushCurrentDisplayToBackend() {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  HTTPClient http;
  http.setTimeout(BACKEND_HTTP_TIMEOUT_MS);
  http.begin(serverBaseUrl + "/busdata/update");
  http.addHeader("Content-Type", "application/json");

  DynamicJsonDocument doc(384);
  doc["busId"] = displayBusId;
  doc["passengers"] = displayPassengerCount;
  doc["seatsAvailable"] = displaySeatsAvailable;
  doc["etaMin"] = displayEta;
  doc["nextBusId"] = displayNextBusId;
  doc["nextBusEta"] = displayNextEta;

  String body;
  serializeJson(doc, body);

  int httpCode = http.POST(body);
  if (httpCode != HTTP_CODE_OK && httpCode != HTTP_CODE_CREATED) {
    Serial.print("pushCurrentDisplayToBackend: HTTP error ");
    Serial.println(httpCode);
    http.end();
    return false;
  }

  http.end();
  hasBackendData = true;
  lastBackendSuccessMs = millis();
  return true;
}

bool pollBackendBusData() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("pollBackendBusData: WiFi not connected");
    return false;
  }

  HTTPClient http;
  http.setTimeout(BACKEND_HTTP_TIMEOUT_MS);
  http.begin(serverURL);

  int httpCode = http.GET();
  if (httpCode != HTTP_CODE_OK) {
    Serial.print("pollBackendBusData: HTTP error ");
    Serial.print(httpCode);
    Serial.print(" from ");
    Serial.println(serverURL);
    http.end();
    return false;
  }

  String payload = http.getString();
  payload.trim();
  http.end();

  if (!parsePipeBusData(payload)) {
    Serial.println("pollBackendBusData: Invalid pipe payload");
    return false;
  }

  Serial.println(payload);
  renderBusDataScreen();
  hasBackendData = true;
  lastBackendSuccessMs = millis();
  return true;
}

void handleDisplayPost() {
  if (!server.hasArg("plain")) {
    sendJsonWithCors(400, "{\"error\":\"Missing body\"}");
    return;
  }

  DynamicJsonDocument doc(512);
  DeserializationError err = deserializeJson(doc, server.arg("plain"));
  if (err) {
    sendJsonWithCors(400, "{\"error\":\"Invalid JSON\"}");
    return;
  }

  if (doc.containsKey("busId")) {
    displayBusId = doc["busId"].as<String>();
  }
  if (doc.containsKey("passengerCount")) {
    displayPassengerCount = int(doc["passengerCount"]);
  } else if (doc.containsKey("passengers")) {
    displayPassengerCount = int(doc["passengers"]);
  }
  if (doc.containsKey("seatsAvailable")) {
    displaySeatsAvailable = int(doc["seatsAvailable"]);
  }
  if (doc.containsKey("etaMin")) {
    displayEta = doc["etaMin"].as<String>();
  } else if (doc.containsKey("eta")) {
    displayEta = doc["eta"].as<String>();
  }
  if (doc.containsKey("nextBusId")) {
    displayNextBusId = doc["nextBusId"].as<String>();
  } else if (doc.containsKey("nextBus")) {
    displayNextBusId = doc["nextBus"].as<String>();
  }
  if (doc.containsKey("nextBusEta")) {
    displayNextEta = doc["nextBusEta"].as<String>();
  } else if (doc.containsKey("nextEta")) {
    displayNextEta = doc["nextEta"].as<String>();
  }

  renderBusDataScreen();
  lastDisplayUpdateMs = millis();
  // Treat direct /display payload as valid live data even if backend poll is temporarily down.
  hasBackendData = true;
  lastBackendSuccessMs = millis();

  // Keep polling target aligned with the latest pushed bus ID.
  String incomingBusId = displayBusId;
  incomingBusId.trim();
  incomingBusId.toUpperCase();
  if (incomingBusId.length() > 0 && incomingBusId != "--" && incomingBusId != busId) {
    busId = incomingBusId;
    rebuildServerUrl();
    Serial.print("Updated polling busId to: ");
    Serial.println(busId);
  }

  if (!pushCurrentDisplayToBackend()) {
    Serial.println("pushCurrentDisplayToBackend: failed");
  }

  DynamicJsonDocument res(256);
  res["ok"] = true;
  res["busId"] = displayBusId;
  res["passengerCount"] = displayPassengerCount;
  res["seatsAvailable"] = displaySeatsAvailable;
  res["etaMin"] = displayEta;
  res["nextBusId"] = displayNextBusId;
  res["nextBusEta"] = displayNextEta;

  String body;
  serializeJson(res, body);
  sendJsonWithCors(200, body);
}

void handleConfigPost() {
  if (!server.hasArg("plain")) {
    sendJsonWithCors(400, "{\"error\":\"Missing body\"}");
    return;
  }

  DynamicJsonDocument doc(512);
  DeserializationError err = deserializeJson(doc, server.arg("plain"));
  if (err) {
    sendJsonWithCors(400, "{\"error\":\"Invalid JSON\"}");
    return;
  }

  if (doc.containsKey("serverBaseUrl")) {
    serverBaseUrl = doc["serverBaseUrl"].as<String>();
  } else if (doc.containsKey("serverUrl")) {
    serverBaseUrl = doc["serverUrl"].as<String>();
  }

  if (doc.containsKey("busId")) {
    busId = doc["busId"].as<String>();
  }

  rebuildServerUrl();

  DynamicJsonDocument res(384);
  res["ok"] = true;
  res["serverBaseUrl"] = serverBaseUrl;
  res["busId"] = busId;
  res["serverURL"] = serverURL;
  String body;
  serializeJson(res, body);
  sendJsonWithCors(200, body);
}

void handleConfigGet() {
  DynamicJsonDocument res(384);
  res["status"] = "ok";
  res["serverBaseUrl"] = serverBaseUrl;
  res["busId"] = busId;
  res["serverURL"] = serverURL;
  String body;
  serializeJson(res, body);
  sendJsonWithCors(200, body);
}

void handleHealth() {
  sendJsonWithCors(200, "{\"status\":\"ok\",\"device\":\"busstop-esp32\"}");
}

void handleNotFound() {
  if (server.method() == HTTP_OPTIONS) {
    handleCorsPreflight();
    return;
  }
  sendJsonWithCors(404, "{\"error\":\"Not found\"}");
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  lcd.init();
  lcd.backlight();

  rebuildServerUrl();

  connectWiFi();

  server.on("/display", HTTP_POST, handleDisplayPost);
  server.on("/display", HTTP_OPTIONS, handleCorsPreflight);
  server.on("/health", HTTP_GET, handleHealth);
  server.on("/health", HTTP_OPTIONS, handleCorsPreflight);
  server.on("/config", HTTP_GET, handleConfigGet);
  server.on("/config", HTTP_POST, handleConfigPost);
  server.on("/config", HTTP_OPTIONS, handleCorsPreflight);
  server.onNotFound(handleNotFound);
  server.begin();

  if (!pollBackendBusData()) {
    hasBackendData = false;
    renderWaitingScreen("Waiting for", "data...");
  }
}

void loop() {
  server.handleClient();

  if (WiFi.status() != WL_CONNECTED) {
    renderWaitingScreen("WiFi reconnect", "in progress...");
    WiFi.reconnect();
    delay(200);
    return;
  }

  unsigned long now = millis();
  if (now - lastPollMs >= POLL_INTERVAL_MS) {
    lastPollMs = now;
    if (!pollBackendBusData()) {
      unsigned long elapsedSinceSuccess = now - lastBackendSuccessMs;
      unsigned long elapsedSinceDisplay = lastDisplayUpdateMs == 0
        ? (DISPLAY_DATA_HOLD_MS + 1)
        : (now - lastDisplayUpdateMs);

      // Keep last display payload visible for a while to avoid flicker to waiting screen.
      bool allowWaitingScreen = elapsedSinceDisplay >= DISPLAY_DATA_HOLD_MS;
      if (allowWaitingScreen && (!hasBackendData || elapsedSinceSuccess >= WAITING_SCREEN_TIMEOUT_MS)) {
        renderWaitingScreen("Waiting for", "data...");
      }
    }
  }

  delay(20);
}
