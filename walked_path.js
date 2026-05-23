const walkTrack = document.querySelector("#walkTrack");
const walkPoints = document.querySelector("#walkPoints");
const walkTitle = document.querySelector("#walkTitle");
const walkBadge = document.querySelector("#walkBadge");
const walkPanel = document.querySelector(".walk-map-panel");
const walkNaverClientId = document.querySelector("#walkNaverClientId");
const loadWalkNaverMapButton = document.querySelector("#loadWalkNaverMap");
const walkMeasuredLog = document.querySelector("#walkMeasuredLog");

let measuredPoints = [];
let walkMap = null;
let walkPolyline = null;
let walkPolylines = [];
let walkMarkers = [];

const measuredLogFiles = [
  "gnss_log_2.csv",
  "gnss_log_3.csv",
  "gnss_log_4.csv",
  "gnss_log_5.csv",
];

const measuredLogGroups = {
  all: measuredLogFiles,
  "1+2": measuredLogFiles.slice(0, 2),
  "1+2+3": measuredLogFiles.slice(0, 3),
  "1+2+3+4": measuredLogFiles,
};

function getSelectedLogFiles(selectedLog) {
  return measuredLogGroups[selectedLog] || [selectedLog];
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    return Object.fromEntries(values.map((value, index) => [headers[index], value]));
  });
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

function normalizeAltitudes(points, targetStartAltitude = 60) {
  const stableIndex = Math.min(15, Math.max(0, points.length - 1));
  const stableAltitude = points[stableIndex]?.altitude;
  if (!Number.isFinite(stableAltitude)) return points;
  const offset = targetStartAltitude - stableAltitude;
  const corrected = points.map((point, index) => ({
    ...point,
    altitude: Number.isFinite(point.altitude)
      ? index < stableIndex ? targetStartAltitude : point.altitude + offset
      : point.altitude
  }));

  return corrected.map((point, index) => {
    const window = corrected
      .slice(Math.max(0, index - 2), Math.min(corrected.length, index + 3))
      .map((sample) => sample.altitude)
      .filter(Number.isFinite);
    const altitude = window.length
      ? window.reduce((sum, value) => sum + value, 0) / window.length
      : point.altitude;
    return { ...point, altitude: Math.max(55, altitude) };
  });
}

function distanceKm(a, b) {
  const radius = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) *
    Math.cos(b.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function parseTime(value) {
  const normalized = value.replace(" ", "T");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getBounds(points) {
  return points.reduce((bounds, point) => ({
    minLat: Math.min(bounds.minLat, point.lat),
    maxLat: Math.max(bounds.maxLat, point.lat),
    minLng: Math.min(bounds.minLng, point.lng),
    maxLng: Math.max(bounds.maxLng, point.lng)
  }), {
    minLat: Infinity,
    maxLat: -Infinity,
    minLng: Infinity,
    maxLng: -Infinity
  });
}

function projectPoints(points) {
  const bounds = getBounds(points);
  const width = 780;
  const height = 440;
  const padX = 60;
  const padY = 60;
  const latRange = bounds.maxLat - bounds.minLat || 1;
  const lngRange = bounds.maxLng - bounds.minLng || 1;

  return points.map((point) => ({
    ...point,
    x: padX + ((point.lng - bounds.minLng) / lngRange) * width,
    y: padY + (1 - ((point.lat - bounds.minLat) / latRange)) * height
  }));
}

function summarize(points) {
  const groups = groupBySource(points);
  const totalDistance = groups.reduce((total, group) => {
    return total + group.slice(1).reduce((sum, point, index) => {
      return sum + distanceKm(group[index], point);
    }, 0);
  }, 0);
  const start = parseTime(points[0].time);
  const end = parseTime(points[points.length - 1].time);
  const durationMin = start && end ? Math.round((end - start) / 60000) : null;
  const satellites = points.map((point) => point.satellites).filter(Number.isFinite);
  const avgSat = satellites.reduce((sum, value) => sum + value, 0) / satellites.length;
  document.querySelector("#pointCount").textContent = `${points.length}개`;
  document.querySelector("#walkDistance").textContent = `${totalDistance.toFixed(3)} km`;
  document.querySelector("#walkDuration").textContent = durationMin === null ? "-" : `${durationMin}분`;
  document.querySelector("#avgSatellites").textContent = `${avgSat.toFixed(1)}개`;
  document.querySelector("#altRange").textContent = "이번 버전 미사용";
  document.querySelector("#startEnd").textContent = `${points[0].time.slice(11, 16)} / ${points[points.length - 1].time.slice(11, 16)}`;
  walkTitle.textContent = `실측 경로 ${groups.length}개 · ${totalDistance.toFixed(3)} km`;
  walkBadge.textContent = `${points[0].fix}→${points[points.length - 1].fix} Fix`;
}

function groupBySource(points) {
  return [...points.reduce((groups, point) => {
    const key = point.source || "measured";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(point);
    return groups;
  }, new Map()).values()];
}

function renderSvgTrack(points) {
  const projected = projectPoints(points);
  walkTrack.setAttribute("d", groupBySource(projected).map((group) => {
    return group.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  }).join(" "));

  const start = projected[0];
  const end = projected[projected.length - 1];
  const measuredDots = projected.map((point) => `
    <circle
      cx="${point.x.toFixed(1)}"
      cy="${point.y.toFixed(1)}"
      r="3.6"
      fill="#ffffff"
      stroke="#ff3b30"
      stroke-width="2.4"
      opacity="0.96"></circle>
  `).join("");

  walkPoints.innerHTML = `
    ${measuredDots}
    <circle class="route-point" cx="${start.x}" cy="${start.y}" r="13"></circle>
    <text class="walk-label" x="${start.x + 18}" y="${start.y - 14}">Start</text>
    <circle class="route-point end" cx="${end.x}" cy="${end.y}" r="13"></circle>
    <text class="walk-label" x="${end.x + 18}" y="${end.y + 24}">End</text>
  `;
}

function loadNaverScript(clientId) {
  return new Promise((resolve, reject) => {
    if (window.naver?.maps) {
      resolve();
      return;
    }

    const existing = document.querySelector("script[data-naver-map]");
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

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
  walkPolylines.forEach((polyline) => polyline.setMap(null));
  walkPolylines = [];

  const groups = groupBySource(points);
  groups.forEach((group) => {
    const path = group.map((point) => new naver.maps.LatLng(point.lat, point.lng));
    walkPolylines.push(new naver.maps.Polyline({
      map: walkMap,
      path,
      strokeColor: "#ff3b30",
      strokeOpacity: 0.58,
      strokeWeight: 5,
      strokeLineCap: "round",
      strokeLineJoin: "round"
    }));
  });

  points.forEach((point) => {
    const marker = new naver.maps.Marker({
      map: walkMap,
      position: new naver.maps.LatLng(point.lat, point.lng),
      icon: {
        content: `
          <div style="
            width:9px;height:9px;border-radius:50%;
            background:#ff3b30;border:2px solid #ffffff;
            box-shadow:0 0 0 2px rgba(255,59,48,.22);
            box-sizing:border-box;"></div>
        `,
        anchor: new naver.maps.Point(4, 4)
      },
      zIndex: 15000
    });
    walkMarkers.push(marker);
  });

  const path = points.map((point) => new naver.maps.LatLng(point.lat, point.lng));
  walkMarkers.push(new naver.maps.Marker({ map: walkMap, position: path[0], title: "Start" }));
  walkMarkers.push(new naver.maps.Marker({ map: walkMap, position: path[path.length - 1], title: "End" }));

  const bounds = new naver.maps.LatLngBounds(path[0], path[0]);
  path.forEach((position) => bounds.extend(position));
  walkMap.fitBounds(bounds);
}

async function initNaverMap() {
  const clientId = walkNaverClientId.value.trim() || localStorage.getItem("naverMapClientId");
  if (!clientId) {
    walkNaverClientId.focus();
    return;
  }

  localStorage.setItem("naverMapClientId", clientId);
  loadWalkNaverMapButton.textContent = "불러오는 중";
  loadWalkNaverMapButton.disabled = true;

  try {
    await loadNaverScript(clientId);
    walkPanel.classList.add("naver-ready");
    walkMap = new naver.maps.Map("walkNaverMap", {
      center: new naver.maps.LatLng(36.6254, 127.4586),
      zoom: 17,
      mapTypeControl: true,
      scaleControl: true,
      logoControl: true,
      zoomControl: true
    });
    naver.maps.Event.trigger(walkMap, "resize");
    renderNaverTrack(measuredPoints);
    loadWalkNaverMapButton.textContent = "지도 연결됨";
  } catch {
    loadWalkNaverMapButton.textContent = "키 확인 필요";
    loadWalkNaverMapButton.disabled = false;
  }
}

async function loadTrack() {
  const selectedLog = walkMeasuredLog?.value || "all";
  const logFiles = getSelectedLogFiles(selectedLog);
  const groups = await Promise.all(logFiles.map(async (logFile) => {
    const response = await fetch(logFile);
    const csv = await response.text();
    return normalizeAltitudes(parseCsv(csv)
      .map((row) => ({
        time: row.PC_Time,
        lat: nmeaToDecimal(row.Latitude_NMEA, row.Lat_Direction),
        lng: nmeaToDecimal(row.Longitude_NMEA, row.Lon_Direction),
        fix: Number(row.Fix || 0),
        satellites: Number(row.Satellites || 0),
        altitude: Number(row.Altitude_m),
        source: logFile
      }))
      .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)), 60);
  }));
  measuredPoints = groups.flat();

  summarize(measuredPoints);
  renderSvgTrack(measuredPoints);
  renderNaverTrack(measuredPoints);
}

const savedClientId = localStorage.getItem("naverMapClientId");
if (savedClientId) {
  walkNaverClientId.value = savedClientId;
}

loadWalkNaverMapButton.addEventListener("click", initNaverMap);
walkMeasuredLog?.addEventListener("change", loadTrack);
loadTrack();
