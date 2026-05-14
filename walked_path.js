const walkTrack = document.querySelector("#walkTrack");
const walkPoints = document.querySelector("#walkPoints");
const walkTitle = document.querySelector("#walkTitle");
const walkBadge = document.querySelector("#walkBadge");
const walkPanel = document.querySelector(".walk-map-panel");
const walkNaverClientId = document.querySelector("#walkNaverClientId");
const loadWalkNaverMapButton = document.querySelector("#loadWalkNaverMap");

let measuredPoints = [];
let walkMap = null;
let walkPolyline = null;
let walkMarkers = [];

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(",");
  return lines.map((line) => Object.fromEntries(line.split(",").map((value, index) => [headers[index], value])));
}

function nmeaToDecimal(value, direction) {
  if (!value || !direction) return null;
  const raw = Number(value);
  if (!Number.isFinite(raw)) return null;
  const degrees = Math.floor(raw / 100);
  const minutes = raw - degrees * 100;
  let decimal = degrees + minutes / 60;
  if (direction === "S" || direction === "W") decimal *= -1;
  return decimal;
}

function distanceKm(a, b) {
  const radius = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function parseTime(value) {
  const parsed = new Date(value.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getBounds(points) {
  return points.reduce((bounds, point) => ({
    minLat: Math.min(bounds.minLat, point.lat),
    maxLat: Math.max(bounds.maxLat, point.lat),
    minLng: Math.min(bounds.minLng, point.lng),
    maxLng: Math.max(bounds.maxLng, point.lng)
  }), { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity });
}

function projectPoints(points) {
  const bounds = getBounds(points);
  const latRange = bounds.maxLat - bounds.minLat || 1;
  const lngRange = bounds.maxLng - bounds.minLng || 1;
  return points.map((point) => ({
    ...point,
    x: 60 + ((point.lng - bounds.minLng) / lngRange) * 780,
    y: 60 + (1 - ((point.lat - bounds.minLat) / latRange)) * 440
  }));
}

function summarize(points) {
  const totalDistance = points.slice(1).reduce((sum, point, index) => sum + distanceKm(points[index], point), 0);
  const start = parseTime(points[0].time);
  const end = parseTime(points[points.length - 1].time);
  const durationMin = start && end ? Math.round((end - start) / 60000) : null;
  const satellites = points.map((point) => point.satellites).filter(Number.isFinite);
  const avgSat = satellites.reduce((sum, value) => sum + value, 0) / satellites.length;
  document.querySelector("#pointCount").textContent = `${points.length}개`;
  document.querySelector("#walkDistance").textContent = `${totalDistance.toFixed(2)} km`;
  document.querySelector("#walkDuration").textContent = durationMin === null ? "-" : `${durationMin}분`;
  document.querySelector("#avgSatellites").textContent = `${avgSat.toFixed(1)}개`;
  document.querySelector("#startEnd").textContent = `${points[0].time.slice(11, 16)} / ${points[points.length - 1].time.slice(11, 16)}`;
  walkTitle.textContent = `실측 경로 ${totalDistance.toFixed(2)} km`;
  walkBadge.textContent = `${points[0].fix}→${points[points.length - 1].fix} Fix`;
}

function renderSvgTrack(points) {
  const projected = projectPoints(points);
  walkTrack.setAttribute("d", projected.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" "));
  const start = projected[0];
  const end = projected[projected.length - 1];
  walkPoints.innerHTML = `<circle class="route-point" cx="${start.x}" cy="${start.y}" r="13"></circle><text class="walk-label" x="${start.x + 18}" y="${start.y - 14}">Start</text><circle class="route-point end" cx="${end.x}" cy="${end.y}" r="13"></circle><text class="walk-label" x="${end.x + 18}" y="${end.y + 24}">End</text>`;
}

function loadNaverScript(clientId) {
  return new Promise((resolve, reject) => {
    if (window.naver?.maps) return resolve();
    const script = document.createElement("script");
    script.dataset.naverMap = "true";
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function renderNaverTrack(points) {
  if (!walkMap || !window.naver?.maps) return;
  walkMarkers.forEach((marker) => marker.setMap(null));
  walkMarkers = [];
  if (walkPolyline) walkPolyline.setMap(null);
  const path = points.map((point) => new naver.maps.LatLng(point.lat, point.lng));
  walkPolyline = new naver.maps.Polyline({ map: walkMap, path, strokeColor: "#e96754", strokeOpacity: 0.95, strokeWeight: 7, strokeLineCap: "round", strokeLineJoin: "round" });
  walkMarkers.push(new naver.maps.Marker({ map: walkMap, position: path[0], title: "Start" }));
  walkMarkers.push(new naver.maps.Marker({ map: walkMap, position: path[path.length - 1], title: "End" }));
  const bounds = new naver.maps.LatLngBounds(path[0], path[0]);
  path.forEach((position) => bounds.extend(position));
  walkMap.fitBounds(bounds);
}

async function initNaverMap() {
  const clientId = walkNaverClientId.value.trim() || localStorage.getItem("naverMapClientId");
  if (!clientId) return walkNaverClientId.focus();
  localStorage.setItem("naverMapClientId", clientId);
  loadWalkNaverMapButton.textContent = "불러오는 중";
  loadWalkNaverMapButton.disabled = true;
  try {
    await loadNaverScript(clientId);
    walkPanel.classList.add("naver-ready");
    walkMap = new naver.maps.Map("walkNaverMap", { center: new naver.maps.LatLng(36.6254, 127.4586), zoom: 17, mapTypeControl: true, scaleControl: true, logoControl: true, zoomControl: true });
    naver.maps.Event.trigger(walkMap, "resize");
    renderNaverTrack(measuredPoints);
    loadWalkNaverMapButton.textContent = "지도 연결됨";
  } catch {
    loadWalkNaverMapButton.textContent = "키 확인 필요";
    loadWalkNaverMapButton.disabled = false;
  }
}

async function loadTrack() {
  const response = await fetch("gnss_log_2.csv");
  const csv = await response.text();
  measuredPoints = parseCsv(csv)
    .map((row) => ({
      time: row.PC_Time,
      lat: nmeaToDecimal(row.Latitude_NMEA, row.Lat_Direction),
      lng: nmeaToDecimal(row.Longitude_NMEA, row.Lon_Direction),
      fix: Number(row.Fix || 0),
      satellites: Number(row.Satellites || 0)
    }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  summarize(measuredPoints);
  renderSvgTrack(measuredPoints);
}

const savedClientId = localStorage.getItem("naverMapClientId");
if (savedClientId) walkNaverClientId.value = savedClientId;
loadWalkNaverMapButton.addEventListener("click", initNaverMap);
loadTrack();
