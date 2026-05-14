const campusLandmarks = [
  { name: "공과대학본관 E8-1동 근처", lat: 36.6259, lng: 127.4580 },
  { name: "합동강의동 E8-2동 근처", lat: 36.6255, lng: 127.4573 },
  { name: "공과대학2호관 E8-3동 근처", lat: 36.6251, lng: 127.4582 },
  { name: "제1공장동 E8-4동 근처", lat: 36.6246, lng: 127.4584 },
  { name: "자연대4호관 S1-4동 근처", lat: 36.6257, lng: 127.4565 },
  { name: "충북Pro메이커센터 S1-7동 근처", lat: 36.6261, lng: 127.4567 },
  { name: "의과대학 2본관 근처", lat: 36.6251, lng: 127.4592 },
  { name: "종합운동장 서측 근처", lat: 36.6262, lng: 127.4596 }
];

const routes = {
  2: { name: "2 km 샘플 코스", distance: 2.1, level: "쉬움", desc: "짧은 회복 러닝 후보입니다." },
  3: { name: "3 km 샘플 코스", distance: 3.0, level: "보통", desc: "기본 러닝 후보입니다." },
  5: { name: "5 km 샘플 코스", distance: 5.2, level: "높음", desc: "장거리 훈련 후보입니다." }
};

const paceInput = document.querySelector("#pace");
const paceValue = document.querySelector("#paceValue");
const naverClientId = document.querySelector("#naverClientId");
const loadNaverMapButton = document.querySelector("#loadNaverMap");
const loadMeasuredNodesButton = document.querySelector("#loadMeasuredNodes");
const mapPanel = document.querySelector(".map-panel");
const mapStatus = document.querySelector("#mapStatus");
const nodePicker = document.querySelector("#nodePicker");
const nodeOrder = document.querySelector("#nodeOrder");
const nodeLimit = document.querySelector("#nodeLimit");
const segmentList = document.querySelector("#segmentList");
const mapSegmentSummary = document.querySelector("#mapSegmentSummary");
const routeList = document.querySelector("#routeList");

let measuredTrack = [];
let selectedNodes = [];
let naverMap = null;
let measuredPolyline = null;
let measuredDots = [];
let selectedMarkers = [];
let routePolyline = null;
let infoWindow = null;
let infoTimer = null;

function setText(selector, text) {
  const el = document.querySelector(selector);
  if (el) el.textContent = text;
}

function setMapStatus(text) {
  if (mapStatus) mapStatus.textContent = text;
}

function formatPace(value) {
  const minutes = Math.floor(Number(value));
  const seconds = Math.round((Number(value) - minutes) * 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatTime(distanceKm, pace) {
  const totalSeconds = Math.round(distanceKm * Number(pace) * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}분 ${String(seconds).padStart(2, "0")}초`;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(",");
  return lines.map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
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

function distanceKm(a, b) {
  const radius = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function describePoint(point) {
  const nearest = campusLandmarks
    .map((landmark) => ({ ...landmark, distance: distanceKm(point, landmark) }))
    .sort((a, b) => a.distance - b.distance)[0];
  if (!nearest || nearest.distance > 0.18) return "실측 경로 지점";
  return `${nearest.name} · 약 ${Math.round(nearest.distance * 1000)}m`;
}

function getTrackDistance(fromIndex, toIndex) {
  if (fromIndex === toIndex) return 0;
  const step = fromIndex < toIndex ? 1 : -1;
  let total = 0;
  for (let i = fromIndex; i !== toIndex; i += step) {
    total += distanceKm(measuredTrack[i], measuredTrack[i + step]);
  }
  return total;
}

function getSelectedDistance() {
  if (selectedNodes.length < 2) return null;
  return getTrackDistance(selectedNodes[0].index, selectedNodes[selectedNodes.length - 1].index);
}

function updateSummary() {
  const limit = Number(nodeLimit.value || 2);
  const distance = getSelectedDistance();

  if (selectedNodes.length === 0) {
    nodeOrder.textContent = "선택 순서: 아직 선택된 노드가 없습니다.";
    segmentList.textContent = `노드를 ${limit}개까지 선택할 수 있습니다. 거리는 첫 노드와 마지막 노드 사이로 계산됩니다.`;
    mapSegmentSummary.textContent = `네이버 지도에서 실측 경로 위 노드를 선택하세요. 0/${limit}개 선택됨.`;
    setText("#metricDistance", "-");
    setText("#metricTime", "-");
    setText("#metricClimb", "-");
    setText("#metricLevel", "-");
    setText("#routeName", "네이버 지도 위 실측 경로를 불러온 뒤 경로 위를 클릭해 주세요.");
    setText("#routeBadge", "대기 중");
    return;
  }

  nodeOrder.textContent = `선택 순서: ${selectedNodes.map((node, index) => `${index + 1}. ${node.name}`).join(" → ")}`;

  if (distance === null) {
    segmentList.textContent = "노드를 1개 더 선택하면 첫 노드와 마지막 노드 사이 거리가 표시됩니다.";
    mapSegmentSummary.textContent = `네이버 지도에서 실측 경로 위 노드를 선택하세요. ${selectedNodes.length}/${limit}개 선택됨.`;
    setText("#metricDistance", "-");
    setText("#metricTime", "-");
    setText("#metricClimb", "GNSS 로그");
    setText("#metricLevel", "노드 1개 선택됨");
    return;
  }

  const first = selectedNodes[0];
  const last = selectedNodes[selectedNodes.length - 1];
  segmentList.innerHTML = `<div class="segment-item"><span>첫 노드 → 마지막 노드<em>${first.name} → ${last.name}</em><em>GNSS 로그 구간 기준</em></span><strong>${distance.toFixed(2)} km</strong></div>`;
  mapSegmentSummary.textContent = `첫 노드부터 마지막 노드까지 실측 거리: ${distance.toFixed(2)} km (${selectedNodes.length}/${limit}개 선택됨)`;
  setText("#metricDistance", `${distance.toFixed(2)} km`);
  setText("#metricTime", formatTime(distance, paceInput.value));
  setText("#metricClimb", "GNSS 로그");
  setText("#metricLevel", "거리 계산 완료");
  setText("#routeName", `${first.name} → ${last.name} 실측 기반 코스`);
  setText("#routeBadge", "실측 기반");
  drawSelectedRoute();
}

function renderNodePicker() {
  if (!selectedNodes.length) {
    nodePicker.innerHTML = `<div class="node-order">네이버 지도 위 빨간 실측 경로를 클릭하면 노드가 여기에 추가됩니다.</div>`;
    return;
  }
  nodePicker.innerHTML = `<div class="node-group-title">선택한 노드</div>${selectedNodes.map((node, index) => `
    <button class="node-option selected-node-button" data-node-id="${node.id}">
      <span>${index + 1}. ${node.name}</span>
      <b class="delete-node" data-node-id="${node.id}">삭제</b>
    </button>`).join("")}`;

  nodePicker.querySelectorAll(".delete-node").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      selectedNodes = selectedNodes.filter((node) => node.id !== button.dataset.nodeId);
      renderSelectedMarkers();
      renderNodePicker();
      updateSummary();
    });
  });

  nodePicker.querySelectorAll(".selected-node-button").forEach((button) => {
    button.addEventListener("click", () => showNodeInfo(selectedNodes.find((node) => node.id === button.dataset.nodeId)));
  });
}

function showNodeInfo(node) {
  if (!node || !naverMap || !window.naver?.maps) return;
  const content = `<div style="padding:10px 12px;font-weight:800;line-height:1.45;min-width:220px"><div>${node.place}</div><div style="font-size:12px;color:#60706a">${node.time?.slice(11, 19) || "실측"} · ${node.lat.toFixed(6)}, ${node.lng.toFixed(6)}</div></div>`;
  if (!infoWindow) infoWindow = new naver.maps.InfoWindow({ content });
  else infoWindow.setContent(content);
  infoWindow.open(naverMap, new naver.maps.LatLng(node.lat, node.lng));
  clearTimeout(infoTimer);
  infoTimer = setTimeout(() => infoWindow?.close(), 3500);
}

function addNode(point) {
  const limit = Number(nodeLimit.value || 2);
  const id = `node_${point.index}`;
  const existing = selectedNodes.find((node) => node.id === id);
  if (existing) {
    showNodeInfo(existing);
    return;
  }
  if (selectedNodes.length >= limit) {
    setMapStatus(`노드는 최대 ${limit}개까지 선택할 수 있습니다. 삭제하거나 개수를 바꿔 주세요.`);
    return;
  }
  const place = describePoint(point);
  const node = {
    ...point,
    id,
    place,
    name: selectedNodes.length === 0 ? `시작점 (${place})` : `경유지 ${selectedNodes.length} (${place})`
  };
  selectedNodes.push(node);
  renderSelectedMarkers();
  renderNodePicker();
  updateSummary();
  showNodeInfo(node);
}

function nearestMeasuredPoint(latlng) {
  return measuredTrack.reduce((best, point) => {
    const distance = distanceKm({ lat: latlng[0], lng: latlng[1] }, point);
    return distance < best.distance ? { point, distance } : best;
  }, { point: null, distance: Infinity });
}

function clearSelectedMarkers() {
  selectedMarkers.forEach((marker) => marker.setMap(null));
  selectedMarkers = [];
  if (routePolyline) {
    routePolyline.setMap(null);
    routePolyline = null;
  }
}

function renderSelectedMarkers() {
  if (!naverMap || !window.naver?.maps) return;
  clearSelectedMarkers();
  selectedNodes.forEach((node, index) => {
    const marker = new naver.maps.Marker({
      map: naverMap,
      position: new naver.maps.LatLng(node.lat, node.lng),
      icon: {
        content: `<div style="width:28px;height:28px;border-radius:50%;background:#17a673;color:white;border:3px solid white;box-shadow:0 4px 10px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;">${index + 1}</div>`,
        anchor: new naver.maps.Point(14, 14)
      }
    });
    naver.maps.Event.addListener(marker, "click", () => showNodeInfo(node));
    selectedMarkers.push(marker);
  });
  drawSelectedRoute();
}

function drawSelectedRoute() {
  if (!naverMap || !window.naver?.maps || selectedNodes.length < 2) return;
  if (routePolyline) routePolyline.setMap(null);
  const from = selectedNodes[0].index;
  const to = selectedNodes[selectedNodes.length - 1].index;
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  const slice = measuredTrack.slice(start, end + 1);
  const path = (from <= to ? slice : slice.reverse()).map((point) => new naver.maps.LatLng(point.lat, point.lng));
  routePolyline = new naver.maps.Polyline({
    map: naverMap,
    path,
    strokeColor: "#17a673",
    strokeOpacity: 0.95,
    strokeWeight: 7,
    strokeLineCap: "round",
    strokeLineJoin: "round"
  });
}

function loadNaverScript(clientId) {
  return new Promise((resolve, reject) => {
    if (window.naver?.maps) return resolve();
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

async function initNaverMap() {
  const clientId = naverClientId.value.trim() || localStorage.getItem("naverMapClientId");
  if (!clientId) {
    naverClientId.focus();
    return;
  }
  localStorage.setItem("naverMapClientId", clientId);
  loadNaverMapButton.textContent = "불러오는 중";
  loadNaverMapButton.disabled = true;
  try {
    await loadNaverScript(clientId);
    mapPanel.classList.add("naver-ready");
    naverMap = new naver.maps.Map("naverMap", {
      center: new naver.maps.LatLng(36.6254, 127.4586),
      zoom: 17,
      mapTypeControl: true,
      scaleControl: true,
      logoControl: true,
      zoomControl: true
    });
    naver.maps.Event.addListener(naverMap, "click", (event) => {
      infoWindow?.close();
      if (!measuredTrack.length) return;
      const nearest = nearestMeasuredPoint([event.coord.lat(), event.coord.lng()]);
      if (nearest.point && nearest.distance <= 0.035) addNode(nearest.point);
    });
    naver.maps.Event.trigger(naverMap, "resize");
    loadNaverMapButton.textContent = "지도 연결됨";
    setMapStatus("지도 연결됨. 이제 실측 GNSS 노드 불러오기를 눌러 주세요.");
    if (measuredTrack.length) renderMeasuredTrack();
  } catch {
    loadNaverMapButton.textContent = "키 확인 필요";
    loadNaverMapButton.disabled = false;
  }
}

async function loadMeasuredTrack() {
  const response = await fetch("gnss_log_2.csv");
  const csv = await response.text();
  measuredTrack = parseCsv(csv)
    .map((row) => ({
      time: row.PC_Time,
      lat: nmeaToDecimal(row.Latitude_NMEA, row.Lat_Direction),
      lng: nmeaToDecimal(row.Longitude_NMEA, row.Lon_Direction),
      fix: Number(row.Fix || 0),
      satellites: Number(row.Satellites || 0)
    }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
    .map((point, index) => ({ ...point, index }));
  return measuredTrack;
}

function renderMeasuredTrack() {
  if (!naverMap || !window.naver?.maps || !measuredTrack.length) return;
  if (measuredPolyline) measuredPolyline.setMap(null);
  measuredDots.forEach((dot) => dot.setMap(null));
  measuredDots = [];

  const path = measuredTrack.map((point) => new naver.maps.LatLng(point.lat, point.lng));
  measuredPolyline = new naver.maps.Polyline({
    map: naverMap,
    path,
    strokeColor: "#ff3b30",
    strokeOpacity: 1,
    strokeWeight: 10,
    strokeLineCap: "round",
    strokeLineJoin: "round",
    clickable: true
  });
  naver.maps.Event.addListener(measuredPolyline, "click", (event) => {
    const nearest = nearestMeasuredPoint([event.coord.lat(), event.coord.lng()]);
    if (nearest.point) addNode(nearest.point);
  });

  measuredTrack.forEach((point, index) => {
    if (index % 2 !== 0 && index !== measuredTrack.length - 1) return;
    const dot = new naver.maps.Marker({
      map: naverMap,
      position: new naver.maps.LatLng(point.lat, point.lng),
      icon: {
        content: `<div style="width:8px;height:8px;border-radius:50%;background:#ff3b30;border:1px solid #fff;box-shadow:0 0 0 2px rgba(255,59,48,.25);"></div>`,
        anchor: new naver.maps.Point(4, 4)
      }
    });
    naver.maps.Event.addListener(dot, "click", () => addNode(point));
    measuredDots.push(dot);
  });

  const bounds = new naver.maps.LatLngBounds(path[0], path[0]);
  path.forEach((position) => bounds.extend(position));
  naverMap.fitBounds(bounds);
  setMapStatus(`GNSS 로그 ${measuredTrack.length}개 좌표를 불러왔습니다. 빨간 실측 경로 위를 클릭해 노드를 선택하세요.`);
}

async function loadMeasuredNodes() {
  loadMeasuredNodesButton.textContent = "불러오는 중";
  setMapStatus("GNSS CSV를 불러오는 중입니다.");
  selectedNodes = [];
  await loadMeasuredTrack();
  renderNodePicker();
  renderSelectedMarkers();
  updateSummary();
  renderMeasuredTrack();
  loadMeasuredNodesButton.textContent = "실측 경로 클릭 가능";
  if (!naverMap) setMapStatus("GNSS 로그를 불러왔습니다. 네이버 지도를 먼저 연결해 주세요.");
}

function renderCandidates() {
  routeList.innerHTML = Object.entries(routes).map(([distance, route]) => `
    <button class="route-card" data-distance="${distance}">
      <h3>${distance} km 후보</h3>
      <p>${route.desc}</p>
      <div class="chip-row"><span class="chip">${route.distance.toFixed(1)} km</span><span class="chip">${route.level}</span></div>
    </button>
  `).join("");
  routeList.querySelectorAll(".route-card").forEach((card) => {
    card.addEventListener("click", () => {
      const route = routes[card.dataset.distance];
      setText("#routeName", route.name);
      setText("#routeBadge", "샘플 코스");
      setText("#metricDistance", `${route.distance.toFixed(1)} km`);
      setText("#metricTime", formatTime(route.distance, paceInput.value));
      setText("#metricClimb", "샘플 코스");
      setText("#metricLevel", route.level);
    });
  });
}

paceInput.addEventListener("input", () => {
  paceValue.textContent = formatPace(paceInput.value);
  const distance = getSelectedDistance();
  if (distance !== null) setText("#metricTime", formatTime(distance, paceInput.value));
});

nodeLimit.addEventListener("change", () => {
  selectedNodes = [];
  renderSelectedMarkers();
  renderNodePicker();
  updateSummary();
});

loadNaverMapButton.addEventListener("click", initNaverMap);
loadMeasuredNodesButton.addEventListener("click", loadMeasuredNodes);
document.querySelector("#recommendBtn").addEventListener("click", updateSummary);

document.querySelectorAll(".distance-btn").forEach((button) => {
  button.addEventListener("click", () => routeList.querySelector(`[data-distance="${button.dataset.distance}"]`)?.click());
});

const savedClientId = localStorage.getItem("naverMapClientId");
if (savedClientId) naverClientId.value = savedClientId;

renderCandidates();
renderNodePicker();
updateSummary();
