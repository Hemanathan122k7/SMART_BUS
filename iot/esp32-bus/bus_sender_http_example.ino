#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include <ESP32Servo.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ---------------- WIFI CONFIG ----------------
const char* WIFI_SSID = "AQUA";
const char* WIFI_PASS = "yourname";

// Backend for persistent telemetry storage
String backendBaseUrl = "http://10.239.124.81:3000";
String busId = "BUS001";
String backendUpdateUrl = backendBaseUrl + "/updateBus";

// ---------------- PIN DEFINITIONS ----------------
#define TRIG_PIN 5
#define ECHO_PIN 18
#define SERVO_PIN 13
#define BUZZER_PIN 12
#define RED_LED 25
#define BLUE_LED 26
#define GPS_LED 2

#define GPS_RX 16
#define GPS_TX 17

// ---------------- CONSTANTS ----------------
#define SAFE_DISTANCE_CM 40
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

const unsigned long GPS_UPDATE_INTERVAL_MS = 3000;
const unsigned long BACKEND_PUSH_INTERVAL_MS = 3000;
const unsigned long GPS_LED_ON_MS = 5000;
const int BACKEND_HTTP_TIMEOUT_MS = 1800;
const unsigned long WIFI_RETRY_INTERVAL_MS = 3000;
const unsigned long DISPLAY_OVERRIDE_MS = 1800;
const unsigned long SAFETY_ALERT_HOLD_MS = 1500;
const unsigned long BACKEND_ERROR_LOG_INTERVAL_MS = 10000;

// ---------------- OBJECTS ----------------
Adafruit_SH1106G display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
Servo doorServo;
TinyGPSPlus gps;
HardwareSerial gpsSerial(1);
WebServer server(80);

// ---------------- STATE ----------------
bool doorOpen = false;
bool safetyBlocked = false;
bool lastSafetyBlocked = false;
float latitude = 0;
float longitude = 0;
float speedKmph = 0;
int passengerCount = 0;

unsigned long lastGPSUpdate = 0;
unsigned long gpsLedStart = 0;
bool gpsLedActive = false;
unsigned long lastBackendPush = 0;
unsigned long lastWifiReconnectAttempt = 0;
bool wasWifiConnected = false;
unsigned long safetyAlertUntil = 0;
unsigned long lastBackendErrorLog = 0;

float prevLat = 0;
float prevLng = 0;
unsigned long prevGpsTs = 0;

unsigned long displayOverrideUntil = 0;
String displayOverrideLine1 = "";
String displayOverrideLine2 = "";
String lastOledLine1 = "";
String lastOledLine2 = "";

String serialBuffer = "";

// ---------------- HELPERS ----------------
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

void rebuildBackendUrl() {
  backendBaseUrl = normalizeBaseUrl(backendBaseUrl);
  busId.trim();
  busId.toUpperCase();
  if (busId.length() == 0) busId = "BUS001";
  backendUpdateUrl = backendBaseUrl + "/updateBus";
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

double toRadians(double deg) {
  return deg * 0.017453292519943295;
}

double haversineKm(double lat1, double lon1, double lat2, double lon2) {
  const double earthRadiusKm = 6371.0;
  const double dLat = toRadians(lat2 - lat1);
  const double dLon = toRadians(lon2 - lon1);
  const double a =
    sin(dLat / 2.0) * sin(dLat / 2.0) +
    cos(toRadians(lat1)) * cos(toRadians(lat2)) *
    sin(dLon / 2.0) * sin(dLon / 2.0);
  const double c = 2.0 * atan2(sqrt(a), sqrt(1.0 - a));
  return earthRadiusKm * c;
}

// ---------------- ULTRASONIC ----------------
long readDistanceCM() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) return 999;
  return duration * 0.034 / 2;
}

// ---------------- OLED DISPLAY ----------------
void oledShow(const String& line1, const String& line2) {
  if (line1 == lastOledLine1 && line2 == lastOledLine2) {
    return;
  }

  lastOledLine1 = line1;
  lastOledLine2 = line2;

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SH110X_WHITE);

  display.setCursor(0, 10);
  display.println(line1);

  display.setCursor(0, 30);
  display.println(line2);

  display.display();
}

void setDisplayOverride(const String& line1, const String& line2, unsigned long durationMs = DISPLAY_OVERRIDE_MS) {
  displayOverrideLine1 = line1;
  displayOverrideLine2 = line2;
  displayOverrideUntil = millis() + durationMs;
  oledShow(line1, line2);
}

void updateDriverDisplay() {
  if (millis() < displayOverrideUntil) {
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    oledShow("WiFi Disconnected", "Reconnecting...");
    return;
  }

  if (safetyBlocked) {
    oledShow("DOOR ALERT", "Passenger Near");
    return;
  }

  String line1 = String("Door ") + (doorOpen ? "OPEN" : "CLOSED");
  String line2 = gps.location.isValid() ? "Safe + GPS OK" : "Safe, waiting GPS";
  oledShow(line1, line2);
}

// ---------------- WIFI ----------------
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print('.');
  }

  Serial.println();
  Serial.print("WiFi connected. Bus ESP32 IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("Use this in Operator Dashboard (Bus ESP32 IP): http://");
  Serial.println(WiFi.localIP());
  Serial.print("Backend target: ");
  Serial.println(backendBaseUrl);
  wasWifiConnected = true;
}

void maintainWiFiConnection() {
  bool connected = (WiFi.status() == WL_CONNECTED);

  if (connected && !wasWifiConnected) {
    wasWifiConnected = true;
    Serial.print("WiFi reconnected. IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("Dashboard Bus ESP32 IP: http://");
    Serial.println(WiFi.localIP());
    setDisplayOverride("WiFi Reconnected", WiFi.localIP().toString());
  }

  if (!connected && wasWifiConnected) {
    wasWifiConnected = false;
    Serial.println("WiFi disconnected, retrying...");
    setDisplayOverride("WiFi Disconnected", "Retrying...");
  }

  if (!connected && millis() - lastWifiReconnectAttempt >= WIFI_RETRY_INTERVAL_MS) {
    lastWifiReconnectAttempt = millis();
    WiFi.reconnect();
    Serial.println("WiFi reconnect attempt...");
  }
}

// ---------------- GPS ----------------
void updateSpeedEstimate(float lat, float lng, unsigned long tsMs) {
  if (prevGpsTs == 0) {
    prevLat = lat;
    prevLng = lng;
    prevGpsTs = tsMs;
    speedKmph = 0;
    return;
  }

  unsigned long dtMs = tsMs - prevGpsTs;
  if (dtMs < 1000) return;

  double distKm = haversineKm(prevLat, prevLng, lat, lng);
  double dtHours = (double)dtMs / 3600000.0;
  if (dtHours > 0) {
    speedKmph = distKm / dtHours;
    if (speedKmph < 0) speedKmph = 0;
    if (speedKmph > 120) speedKmph = 120;
  }

  prevLat = lat;
  prevLng = lng;
  prevGpsTs = tsMs;
}

void updateGPS() {
  while (gpsSerial.available()) {
    gps.encode(gpsSerial.read());
  }

  if (millis() - lastGPSUpdate < GPS_UPDATE_INTERVAL_MS) {
    return;
  }

  lastGPSUpdate = millis();

  if (gps.location.isValid()) {
    latitude = gps.location.lat();
    longitude = gps.location.lng();
    updateSpeedEstimate(latitude, longitude, millis());

    Serial.print("Lat: ");
    Serial.println(latitude, 6);
    Serial.print("Lng: ");
    Serial.println(longitude, 6);
    Serial.print("Speed(kmph): ");
    Serial.println(speedKmph, 2);

    digitalWrite(GPS_LED, HIGH);
    gpsLedStart = millis();
    gpsLedActive = true;
  } else {
    Serial.println("Waiting for GPS...");
  }
}

// ---------------- SAFETY ----------------
bool evaluateDoorSafety(bool showWarning) {
  long dist = readDistanceCM();
  safetyBlocked = (dist < SAFE_DISTANCE_CM);

  if (safetyBlocked != lastSafetyBlocked) {
    if (safetyBlocked) {
      Serial.println("Safety ALERT: passenger near door");
    } else {
      Serial.println("Safety CLEAR: door area safe");
    }
    lastSafetyBlocked = safetyBlocked;
  }

  if (safetyBlocked) {
    digitalWrite(RED_LED, HIGH);
    digitalWrite(BLUE_LED, LOW);
    digitalWrite(BUZZER_PIN, HIGH);
    safetyAlertUntil = millis() + SAFETY_ALERT_HOLD_MS;
    if (showWarning) {
      setDisplayOverride("WARNING", "Passenger Near");
    }
    return false;
  }

  safetyAlertUntil = 0;
  digitalWrite(RED_LED, LOW);
  digitalWrite(BLUE_LED, HIGH);
  digitalWrite(BUZZER_PIN, LOW);
  return true;
}

void updateSafetyAlertHold() {
  if (safetyAlertUntil == 0 || millis() < safetyAlertUntil) {
    return;
  }

  safetyAlertUntil = 0;
  safetyBlocked = false;
  lastSafetyBlocked = false;
  digitalWrite(RED_LED, LOW);
  digitalWrite(BLUE_LED, HIGH);
  digitalWrite(BUZZER_PIN, LOW);
}

// ---------------- BACKEND SYNC ----------------
bool pushTelemetryToBackend() {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  HTTPClient http;
  http.setTimeout(BACKEND_HTTP_TIMEOUT_MS);
  http.begin(backendUpdateUrl);
  http.addHeader("Content-Type", "application/json");

  DynamicJsonDocument doc(512);
  doc["busId"] = busId;
  doc["latitude"] = latitude;
  doc["longitude"] = longitude;
  doc["doorStatus"] = doorOpen ? "OPEN" : "CLOSED";
  doc["safetyStatus"] = safetyBlocked ? "BLOCKED" : "SAFE";
  doc["speedKmph"] = speedKmph;
  doc["passengerCount"] = passengerCount;

  String body;
  serializeJson(doc, body);

  int httpCode = http.POST(body);
  if (httpCode != HTTP_CODE_OK) {
    if (millis() - lastBackendErrorLog >= BACKEND_ERROR_LOG_INTERVAL_MS) {
      lastBackendErrorLog = millis();
      Serial.print("pushTelemetryToBackend: HTTP error ");
      Serial.println(httpCode);
      Serial.print("Backend URL: ");
      Serial.println(backendUpdateUrl);
      Serial.println("Tip: Ensure backend is running and set BACKEND http://<laptop-ip>:3000 if IP changed");
    }
    http.end();
    return false;
  }

  http.end();
  return true;
}

bool openDoorWithSafety() {
  if (!evaluateDoorSafety(true)) {
    Serial.println("OPEN rejected: passenger near door");
    return false;
  }

  doorServo.write(90);
  doorOpen = true;
  Serial.println("Door command: OPEN");
  setDisplayOverride("Door Opened", "Safe");
  pushTelemetryToBackend();
  return true;
}

bool closeDoorWithSafety() {
  if (!evaluateDoorSafety(true)) {
    Serial.println("CLOSE rejected: passenger near door");
    return false;
  }

  doorServo.write(0);
  doorOpen = false;
  Serial.println("Door command: CLOSE");
  setDisplayOverride("Door Closed", "Safe");
  pushTelemetryToBackend();
  return true;
}

void printSerialHelp() {
  Serial.println("=== Smart Bus Commands ===");
  Serial.println("OPEN  -> open door if safe");
  Serial.println("CLOSE -> close door if safe");
  Serial.println("IP -> print bus and backend URLs");
  Serial.println("STATUS -> print bus status");
  Serial.println("PAX <n> -> set passenger count");
  Serial.println("BUSID <id> -> set bus id");
  Serial.println("BACKEND <url> -> set backend base url");
  Serial.println("HELP -> show commands");
}

void printBusStatus() {
  Serial.println("--- Bus Status ---");
  Serial.print("Bus ID: ");
  Serial.println(busId);
  Serial.print("WiFi: ");
  Serial.println(WiFi.status() == WL_CONNECTED ? "CONNECTED" : "DISCONNECTED");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("Door: ");
  Serial.println(doorOpen ? "OPEN" : "CLOSED");
  Serial.print("Safety: ");
  Serial.println(safetyBlocked ? "BLOCKED" : "SAFE");
  Serial.print("Passengers: ");
  Serial.println(passengerCount);
  Serial.print("Lat: ");
  Serial.println(latitude, 6);
  Serial.print("Lng: ");
  Serial.println(longitude, 6);
  Serial.print("Speed(kmph): ");
  Serial.println(speedKmph, 2);
  Serial.print("Backend: ");
  Serial.println(backendBaseUrl);
}

void handleSerialCommand(const String& rawCommand) {
  String cmd = rawCommand;
  cmd.trim();
  if (cmd.length() == 0) return;

  String upper = cmd;
  upper.toUpperCase();

  if (upper == "OPEN") {
    openDoorWithSafety();
    return;
  }
  if (upper == "CLOSE") {
    closeDoorWithSafety();
    return;
  }
  if (upper == "STATUS") {
    printBusStatus();
    return;
  }
  if (upper == "IP") {
    Serial.print("Bus ESP32 URL: http://");
    Serial.println(WiFi.localIP());
    Serial.print("Backend URL: ");
    Serial.println(backendBaseUrl);
    return;
  }
  if (upper == "HELP") {
    printSerialHelp();
    return;
  }

  if (upper.startsWith("PAX ")) {
    int value = cmd.substring(4).toInt();
    if (value < 0) value = 0;
    passengerCount = value;
    Serial.print("Passenger count set to ");
    Serial.println(passengerCount);
    pushTelemetryToBackend();
    return;
  }

  if (upper.startsWith("BUSID ")) {
    String nextBusId = cmd.substring(6);
    nextBusId.trim();
    nextBusId.toUpperCase();
    if (nextBusId.length() == 0) {
      Serial.println("BUSID rejected: empty value");
      return;
    }
    busId = nextBusId;
    rebuildBackendUrl();
    Serial.print("Bus ID set to ");
    Serial.println(busId);
    pushTelemetryToBackend();
    return;
  }

  if (upper.startsWith("BACKEND ")) {
    String nextBase = cmd.substring(8);
    nextBase.trim();
    if (nextBase.length() == 0) {
      Serial.println("BACKEND rejected: empty value");
      return;
    }
    backendBaseUrl = nextBase;
    rebuildBackendUrl();
    Serial.print("Backend URL set to ");
    Serial.println(backendBaseUrl);
    pushTelemetryToBackend();
    return;
  }

  Serial.print("Unknown command: ");
  Serial.println(cmd);
  printSerialHelp();
}

void handleSerialInput() {
  while (Serial.available()) {
    char ch = (char)Serial.read();
    if (ch == '\n' || ch == '\r') {
      if (serialBuffer.length() > 0) {
        handleSerialCommand(serialBuffer);
        serialBuffer = "";
      }
    } else {
      serialBuffer += ch;
      if (serialBuffer.length() > 120) {
        serialBuffer = "";
      }
    }
  }
}

// ---------------- API ----------------
void handleData() {
  DynamicJsonDocument doc(512);
  doc["busId"] = busId;
  doc["latitude"] = latitude;
  doc["longitude"] = longitude;
  doc["doorStatus"] = doorOpen ? "OPEN" : "CLOSED";
  doc["door"] = doorOpen ? "OPEN" : "CLOSED";
  doc["safetyStatus"] = safetyBlocked ? "BLOCKED" : "SAFE";
  doc["safetyBlocked"] = safetyBlocked;
  doc["passengerCount"] = passengerCount;
  doc["speedKmph"] = speedKmph;
  doc["timestamp"] = millis();

  String body;
  serializeJson(doc, body);
  sendJsonWithCors(200, body);
}

void handleHealth() {
  sendJsonWithCors(200, "{\"status\":\"ok\",\"device\":\"bus-esp32\"}");
}

void handleConfigGet() {
  DynamicJsonDocument doc(256);
  doc["status"] = "ok";
  doc["busId"] = busId;
  doc["backendBaseUrl"] = backendBaseUrl;
  doc["backendUpdateUrl"] = backendUpdateUrl;

  String body;
  serializeJson(doc, body);
  sendJsonWithCors(200, body);
}

void handleConfigPost() {
  if (!server.hasArg("plain")) {
    sendJsonWithCors(400, "{\"error\":\"Missing body\"}");
    return;
  }

  DynamicJsonDocument doc(384);
  DeserializationError err = deserializeJson(doc, server.arg("plain"));
  if (err) {
    sendJsonWithCors(400, "{\"error\":\"Invalid JSON\"}");
    return;
  }

  if (doc.containsKey("busId")) {
    busId = doc["busId"].as<String>();
  }
  if (doc.containsKey("backendBaseUrl")) {
    backendBaseUrl = doc["backendBaseUrl"].as<String>();
  } else if (doc.containsKey("serverBaseUrl")) {
    backendBaseUrl = doc["serverBaseUrl"].as<String>();
  }

  rebuildBackendUrl();

  DynamicJsonDocument res(256);
  res["ok"] = true;
  res["busId"] = busId;
  res["backendBaseUrl"] = backendBaseUrl;
  res["backendUpdateUrl"] = backendUpdateUrl;

  String body;
  serializeJson(res, body);
  sendJsonWithCors(200, body);
}

// ---------------- WEB UI ----------------
void handleRoot() {
  String page = "<html><head><title>Smart Bus Node</title>";
  page += "<style>body{font-family:Arial;padding:16px} .ok{color:#0a7a2e} .warn{color:#c62828;font-weight:700} button{margin-right:8px;padding:8px 12px}</style>";
  page += "</head><body>";
  page += "<h2>Smart Bus Node</h2>";
  page += "<p><b>Bus:</b> " + busId + "</p>";
  page += "<p><b>Latitude:</b> " + String(latitude, 6) + "</p>";
  page += "<p><b>Longitude:</b> " + String(longitude, 6) + "</p>";
  page += "<p><b>Door:</b> " + String(doorOpen ? "OPEN" : "CLOSED") + "</p>";
  page += "<p><b>Safety:</b> <span class='" + String(safetyBlocked ? "warn" : "ok") + "'>" + String(safetyBlocked ? "Passenger Near Door" : "Safe to Operate") + "</span></p>";
  page += "<p><b>Speed:</b> " + String(speedKmph, 1) + " kmph</p>";
  page += "<button onclick=\"fetch('/open').then(()=>location.reload())\">Open Door</button>";
  page += "<button onclick=\"fetch('/close').then(()=>location.reload())\">Close Door</button>";
  page += "<script>setTimeout(()=>location.reload(),2500);</script>";
  page += "</body></html>";

  addCorsHeaders();
  server.send(200, "text/html", page);
}

// ---------------- CONTROL ROUTES ----------------
void handleOpen() {
  if (!openDoorWithSafety()) {
    sendJsonWithCors(409, "{\"ok\":false,\"message\":\"Door blocked\"}");
    return;
  }
  sendJsonWithCors(200, "{\"ok\":true,\"doorStatus\":\"OPEN\"}");
}

void handleClose() {
  if (!closeDoorWithSafety()) {
    sendJsonWithCors(409, "{\"ok\":false,\"message\":\"Door blocked\"}");
    return;
  }
  sendJsonWithCors(200, "{\"ok\":true,\"doorStatus\":\"CLOSED\"}");
}

void handleNotFound() {
  if (server.method() == HTTP_OPTIONS) {
    handleCorsPreflight();
    return;
  }
  sendJsonWithCors(404, "{\"error\":\"Not found\"}");
}

// ---------------- SETUP ----------------
void setup() {
  Serial.begin(115200);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(BLUE_LED, OUTPUT);
  pinMode(GPS_LED, OUTPUT);

  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(RED_LED, LOW);
  digitalWrite(BLUE_LED, HIGH);
  digitalWrite(GPS_LED, LOW);

  doorServo.attach(SERVO_PIN);
  doorServo.write(0);
  doorOpen = false;

  Wire.begin(21, 22);
  display.begin(0x3C, true);
  oledShow("SMART BUS NODE", "Starting...");

  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);

  rebuildBackendUrl();
  connectWiFi();

  oledShow("WiFi Connected", WiFi.localIP().toString());
  printSerialHelp();
  Serial.print("Operator dashboard Bus ESP32 IP should be: http://");
  Serial.println(WiFi.localIP());

  server.on("/", HTTP_GET, handleRoot);
  server.on("/", HTTP_OPTIONS, handleCorsPreflight);
  server.on("/data", HTTP_GET, handleData);
  server.on("/data", HTTP_OPTIONS, handleCorsPreflight);
  server.on("/health", HTTP_GET, handleHealth);
  server.on("/health", HTTP_OPTIONS, handleCorsPreflight);
  server.on("/open", HTTP_GET, handleOpen);
  server.on("/open", HTTP_OPTIONS, handleCorsPreflight);
  server.on("/close", HTTP_GET, handleClose);
  server.on("/close", HTTP_OPTIONS, handleCorsPreflight);
  server.on("/config", HTTP_GET, handleConfigGet);
  server.on("/config", HTTP_POST, handleConfigPost);
  server.on("/config", HTTP_OPTIONS, handleCorsPreflight);
  server.onNotFound(handleNotFound);
  server.begin();

  Serial.println("Bus telemetry server started. Use /data and /health");
}

// ---------------- LOOP ----------------
void loop() {
  server.handleClient();
  handleSerialInput();

  updateGPS();
  updateSafetyAlertHold();

  if (gpsLedActive && millis() - gpsLedStart >= GPS_LED_ON_MS) {
    digitalWrite(GPS_LED, LOW);
    gpsLedActive = false;
  }

  maintainWiFiConnection();

  if (WiFi.status() == WL_CONNECTED && millis() - lastBackendPush >= BACKEND_PUSH_INTERVAL_MS) {
    lastBackendPush = millis();
    pushTelemetryToBackend();
  }

  updateDriverDisplay();

  delay(20);
}
