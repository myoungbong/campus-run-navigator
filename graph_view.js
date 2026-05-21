const graphMapPanel = document.querySelector("#graphMapPanel");
const graphViewTitle = document.querySelector("#graphViewTitle");
const graphViewBadge = document.querySelector("#graphViewBadge");
const graphNodeCount = document.querySelector("#graphNodeCount");
const graphEdgeCount = document.querySelector("#graphEdgeCount");
const graphTotalDistance = document.querySelector("#graphTotalDistance");
const graphAltitudeRange = document.querySelector("#graphAltitudeRange");
const graphNaverClientId = document.querySelector("#graphNaverClientId");
const loadGraphNaverMapButton = document.querySelector("#loadGraphNaverMap");
const graphViewEdges = document.querySelector("#graphViewEdges");
const graphViewDots = document.querySelector("#graphViewDots");
const graphViewNodes = document.querySelector("#graphViewNodes");

let nodeGraph = { nodes: [], edges: [] };
let graphMap = null;
let graphMarkers = [];
let graphPolylines = [];

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function distanceKm(a, b) {
  const radius = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function getEdgePath(edge) {
  const path = Array.isArray(edge.path) ? edge.path : [];
  return path
    .map((point) => ({
      lat: toNumber(point.lat),
      lng: toNumber(point.lng),
      altitude: toNumber(point.altitude)
    }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
}

function getNodePoint(node) {
  return {
    id: node.id,
    name: node.name || node.label || node.id,
    lat: toNumber(node.lat),
    lng: toNumber(node.lng),
    altitude: toNumber(node.altitude)
  };
}

function getAllGraphPoints() {
  const edgePoints = nodeGraph.edges.flatMap(getEdgePath);
  const nodePoints = nodeGraph.nodes.map(getNodePoint)
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  return edgePoints.length ? edgePoints.concat(nodePoints) : nodePoints;
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

function makeProjector(points) {
  const bounds = getBounds(points);
  const width = 780;
  const height = 440;
  const padX = 60;
  const padY = 60;
  const latRange = bounds.maxLat - bounds.minLat || 1;
  const lngRange = bounds.maxLng - bounds.minLng || 1;

  return (point) => ({
    ...point,
    x: padX + ((point.lng - bounds.minLng) / lngRange) * width,
    y: padY + (1 - ((point.lat - bounds.minLat) / latRange)) * height
  });
}

function sampleEdgeDotPoints(path, spacingMeters = 12, maxDots = 28) {
  if (path.length <= 2) return path;
  const samples = [path[0]];
  let distanceSinceLast = 0;

  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const current = path[index];
    distanceSinceLast += distanceKm(previous, current) * 1000;
    if (distanceSinceLast >= spacingMeters) {
      samples.push(current);
      distanceSinceLast = 0;
    }
  }

  const last = path[path.length - 1];
  if (samples[samples.length - 1] !== last) samples.push(last);
  if (samples.length <= maxDots) return samples;

  const step = (samples.length - 1) / (maxDots - 1);
  return Array.from({ length: maxDots }, (_, index) => samples[Math.round(index * step)]);
}

function getEdgeDistance(edge) {
  const stored = toNumber(edge.distanceKm);
  if (stored !== null) return stored;
  const path = getEdgePath(edge);
  return path.slice(1).reduce((sum, point, index) => sum + distanceKm(path[index], point), 0);
}

function summarizeGraph() {
  const totalDistance = nodeGraph.edges.reduce((sum, edge) => sum + getEdgeDistance(edge), 0);
  const altitudes = [
    ...nodeGraph.nodes.map((node) => toNumber(node.altitude)),
    ...nodeGraph.edges.flatMap((edge) => getEdgePath(edge).map((point) => point.altitude))
  ].filter(Number.isFinite);
  const minAltitude = altitudes.length ? Math.min(...altitudes) : null;
  const maxAltitude = altitudes.length ? Math.max(...altitudes) : null;

  graphNodeCount.textContent = `${nodeGraph.nodes.length}개`;
  graphEdgeCount.textContent = `${nodeGraph.edges.length}개`;
  graphTotalDistance.textContent = `${totalDistance.toFixed(3)} km`;
  graphAltitudeRange.textContent = minAltitude === null
    ? "-"
    : `${Math.round(minAltitude)}-${Math.round(maxAltitude)} m`;
  graphViewTitle.textContent = `대표 노드 ${nodeGraph.nodes.length}개 · 연결 구간 ${nodeGraph.edges.length}개`;
  graphViewBadge.textContent = `${totalDistance.toFixed(3)} km`;
}

function renderSvgGraph() {
  const allPoints = getAllGraphPoints();
  if (!allPoints.length) return;

  const project = makeProjector(allPoints);
  const pathCommands = nodeGraph.edges.map((edge) => {
    const points = getEdgePath(edge).map(project);
    return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  }).join(" ");
  graphViewEdges.setAttribute("d", pathCommands);

  graphViewDots.innerHTML = nodeGraph.edges.flatMap((edge) => {
    return sampleEdgeDotPoints(getEdgePath(edge), 10, 28).map((point) => {
      const projected = project(point);
      return `<circle cx="${projected.x.toFixed(1)}" cy="${projected.y.toFixed(1)}" r="5.8" fill="#f2a323" stroke="#ffffff" stroke-width="2.4"></circle>`;
    });
  }).join("");

  graphViewNodes.innerHTML = nodeGraph.nodes.map((node, index) => {
    const point = project(getNodePoint(node));
    const label = String(index + 1).padStart(3, "0");
    return `
      <g>
        <circle class="graph-node" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="16"></circle>
        <text class="graph-node-label" x="${point.x.toFixed(1)}" y="${(point.y + 4).toFixed(1)}" text-anchor="middle">${label}</text>
      </g>
    `;
  }).join("");
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

function clearNaverGraph() {
  graphMarkers.forEach((marker) => marker.setMap(null));
  graphPolylines.forEach((polyline) => polyline.setMap(null));
  graphMarkers = [];
  graphPolylines = [];
}

function makeDotMarker(point, color = "#f2a323", zIndex = 12000) {
  return new naver.maps.Marker({
    map: graphMap,
    position: new naver.maps.LatLng(point.lat, point.lng),
    icon: {
      content: `
        <div style="
          width:12px;height:12px;border-radius:50%;
          background:${color};border:3px solid #ffffff;
          box-shadow:0 1px 7px rgba(0,0,0,.22);"></div>
      `,
      anchor: new naver.maps.Point(6, 6)
    },
    zIndex
  });
}

function makeNodeMarker(node, index) {
  const point = getNodePoint(node);
  return new naver.maps.Marker({
    map: graphMap,
    position: new naver.maps.LatLng(point.lat, point.lng),
    title: point.name,
    icon: {
      content: `
        <div style="
          display:flex;align-items:center;justify-content:center;
          width:34px;height:34px;border-radius:50%;
          background:#2f80ed;color:#ffffff;border:4px solid #ffffff;
          box-shadow:0 3px 12px rgba(0,0,0,.28);
          font-weight:900;font-size:14px;line-height:1;">
          ${String(index + 1).padStart(3, "0")}
        </div>
      `,
      anchor: new naver.maps.Point(17, 17)
    },
    zIndex: 16000
  });
}

function renderNaverGraph() {
  if (!graphMap || !window.naver?.maps) return;
  clearNaverGraph();

  const allPositions = [];
  nodeGraph.edges.forEach((edge) => {
    const path = getEdgePath(edge);
    if (path.length < 2) return;

    const naverPath = path.map((point) => new naver.maps.LatLng(point.lat, point.lng));
    graphPolylines.push(new naver.maps.Polyline({
      map: graphMap,
      path: naverPath,
      strokeColor: "#f2a323",
      strokeOpacity: 0.35,
      strokeWeight: 6,
      strokeLineCap: "round",
      strokeLineJoin: "round"
    }));

    sampleEdgeDotPoints(path, 12, 26).forEach((point) => {
      graphMarkers.push(makeDotMarker(point));
      allPositions.push(new naver.maps.LatLng(point.lat, point.lng));
    });
  });

  nodeGraph.nodes.forEach((node, index) => {
    const point = getNodePoint(node);
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return;
    graphMarkers.push(makeNodeMarker(node, index));
    allPositions.push(new naver.maps.LatLng(point.lat, point.lng));
  });

  if (allPositions.length) {
    const bounds = new naver.maps.LatLngBounds(allPositions[0], allPositions[0]);
    allPositions.forEach((position) => bounds.extend(position));
    graphMap.fitBounds(bounds);
  }
}

async function initNaverMap() {
  const clientId = graphNaverClientId.value.trim() || localStorage.getItem("naverMapClientId");
  if (!clientId) {
    graphNaverClientId.focus();
    return;
  }

  localStorage.setItem("naverMapClientId", clientId);
  loadGraphNaverMapButton.textContent = "불러오는 중";
  loadGraphNaverMapButton.disabled = true;

  try {
    await loadNaverScript(clientId);
    graphMapPanel.classList.add("naver-ready");
    graphMap = new naver.maps.Map("graphNaverMap", {
      center: new naver.maps.LatLng(36.6254, 127.4586),
      zoom: 16,
      mapTypeControl: true,
      scaleControl: true,
      logoControl: true,
      zoomControl: true
    });
    naver.maps.Event.trigger(graphMap, "resize");
    renderNaverGraph();
    loadGraphNaverMapButton.textContent = "지도 연결됨";
  } catch {
    loadGraphNaverMapButton.textContent = "키 확인 필요";
    loadGraphNaverMapButton.disabled = false;
  }
}

async function loadGraph() {
  const response = await fetch("node_graph.json");
  nodeGraph = await response.json();
  if (!Array.isArray(nodeGraph.nodes)) nodeGraph.nodes = [];
  if (!Array.isArray(nodeGraph.edges)) nodeGraph.edges = [];
  summarizeGraph();
  renderSvgGraph();
  renderNaverGraph();
}

const savedClientId = localStorage.getItem("naverMapClientId");
if (savedClientId) graphNaverClientId.value = savedClientId;

loadGraphNaverMapButton.addEventListener("click", initNaverMap);
loadGraph();
