const baseCampusNodes = {
  main: {
    name: "충북대 정문",
    xy: [92, 116],
    latlng: [36.62595, 127.45445],
    elevation: 60,
    type: "대표 노드"
  },
  library: {
    name: "도서관",
    xy: [370, 128],
    latlng: [36.62895, 127.45555],
    elevation: 64,
    type: "대표 노드"
  },
  culture: {
    name: "개신문화관",
    xy: [569, 114],
    latlng: [36.63005, 127.45715],
    elevation: 70,
    type: "대표 노드"
  },
  engineering: {
    name: "공과대학",
    xy: [627, 227],
    latlng: [36.62935, 127.45865],
    elevation: 67,
    type: "대표 노드"
  },
  dorm: {
    name: "학생생활관",
    xy: [213, 362],
    latlng: [36.62745, 127.45435],
    elevation: 82,
    type: "대표 노드"
  },
  sports: {
    name: "CBNU스포츠센터",
    xy: [489, 428],
    latlng: [36.62735, 127.45745],
    elevation: 62,
    type: "대표 노드"
  },
  stadium: {
    name: "종합운동장",
    xy: [642, 410],
    latlng: [36.62805, 127.45905],
    elevation: 60,
    type: "대표 노드"
  }
};

const campusLandmarks = [
  { name: "공과대학본관 E8-1동 근처", lat: 36.6259, lng: 127.4580 },
  { name: "합동강의동 E8-2동 근처", lat: 36.6255, lng: 127.4573 },
  { name: "공과대학2호관 E8-3동 근처", lat: 36.6251, lng: 127.4582 },
  { name: "제1공장동 E8-4동 근처", lat: 36.6246, lng: 127.4584 },
  { name: "자연대4호관 S1-4동 근처", lat: 36.6257, lng: 127.4565 },
  { name: "충북Pro메이커센터 S1-7동 근처", lat: 36.6261, lng: 127.4567 },
  { name: "의과대학 2본관 근처", lat: 36.6251, lng: 127.4592 },
  { name: "종합운동장 서측 근처", lat: 36.6262, lng: 127.4596 },
  { name: "박물관 근처", lat: 36.6272, lng: 127.4556 },
  { name: "자연과학대학 1호관 근처", lat: 36.6274, lng: 127.4566 }
];

const paceInput = document.querySelector("#pace");
const paceValue = document.querySelector("#paceValue");
const targetDistanceInput = document.querySelector("#targetDistance");
const targetDistanceValue = document.querySelector("#targetDistanceValue");
const routeStartNodeSelect = document.querySelector("#routeStartNode");
const routeEndNodeSelect = document.querySelector("#routeEndNode");
const recommendGraphRouteButton = document.querySelector("#recommendGraphRoute");
const routePath = document.querySelector("#routePath");
const measuredBasePath = document.querySelector("#measuredBasePath");
const routePoints = document.querySelector("#routePoints");
const measuredNodeLayer = document.querySelector("#measuredNodeLayer");
const nodeTooltipLayer = document.querySelector("#nodeTooltipLayer");
const graphLayer = document.querySelector("#graphLayer");
const mapPanel = document.querySelector(".map-panel");
const naverClientId = document.querySelector("#naverClientId");
const loadNaverMapButton = document.querySelector("#loadNaverMap");
const mapStatus = document.querySelector("#mapStatus");
const nodePicker = document.querySelector("#nodePicker");
const nodeOrder = document.querySelector("#nodeOrder");
const segmentList = document.querySelector("#segmentList");
const loadMeasuredNodesButton = document.querySelector("#loadMeasuredNodes");
const showGraphOverlayButton = document.querySelector("#showGraphOverlay");
const mapSegmentSummary = document.querySelector("#mapSegmentSummary");
const nodeLimit = document.querySelector("#nodeLimit");
const measuredLogSelect = document.querySelector("#measuredLog");
const slopeMode = document.querySelector("#slopeMode");
const graphNodeNameInput = document.querySelector("#graphNodeName");
const saveGraphNodeButton = document.querySelector("#saveGraphNode");
const saveGraphEdgeButton = document.querySelector("#saveGraphEdge");
const autoConnectGraphButton = document.querySelector("#autoConnectGraph");
const clearGraphButton = document.querySelector("#clearGraph");
const exportGraphButton = document.querySelector("#exportGraph");
const importGraphButton = document.querySelector("#importGraph");
const importGraphFileInput = document.querySelector("#importGraphFile");
const graphDocument = document.querySelector("#graphDocument");
const graphEdgeFromSelect = document.querySelector("#graphEdgeFrom");
const graphEdgeToSelect = document.querySelector("#graphEdgeTo");

const graphStorageKey = "campusRunNodeGraph";

let campusNodes = { ...baseCampusNodes };
let measuredTrack = [];
let selectableMeasuredNodes = [];
let selectedNodeIds = [];
let targetDistance = Number(targetDistanceInput?.value || 5);
const MAX_TARGET_DISTANCE = 5;
let nodeGraph = loadNodeGraph();
let graphEdgeCandidates = [];
let graphCandidateMessage = "";
let naverMap = null;
let naverPolyline = null;
let naverMarkers = [];
let naverMeasuredMarkers = [];
let naverMeasuredPolyline = null;
let naverMeasuredPolylines = [];
let naverMeasuredDots = [];
let naverGraphMarkers = [];
let naverGraphPolylines = [];
let naverGraphEdgeDots = [];
let naverInfoWindow = null;
let naverInfoTimer = null;
let naverGraphRenderTimer = null;
let svgMeasuredPoints = [];
let isMeasuredTrackVisible = false;
let isGraphOverlayVisible = false;

function formatPace(value) {
  const minutes = Math.floor(Number(value));
  const seconds = Math.round((Number(value) - minutes) * 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatTargetDistance(value = targetDistance) {
  return Number(value).toFixed(1);
}

function formatTime(distance, pace) {
  const totalSeconds = Math.round(distance * Number(pace || 6) * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}분 ${String(seconds).padStart(2, "0")}초`;
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

async function loadMeasuredTrack() {
  if (measuredTrack.length) return measuredTrack;

  const selectedLog = measuredLogSelect?.value || "all";
  const logFiles = selectedLog === "all"
    ? ["gnss_log_2.csv", "gnss_log_3.csv", "gnss_log_4.csv", "gnss_log_5.csv"]
    : [selectedLog];
  const tracks = await Promise.all(logFiles.map(async (logFile, logOrder) => {
    const response = await fetch(logFile);
    const csv = await response.text();
    const rawPoints = parseCsv(csv)
      .map((row) => ({
        time: row.PC_Time,
        lat: nmeaToDecimal(row.Latitude_NMEA, row.Lat_Direction),
        lng: nmeaToDecimal(row.Longitude_NMEA, row.Lon_Direction),
        fix: Number(row.Fix || 0),
        satellites: Number(row.Satellites || 0),
        altitude: Number(row.Altitude_m),
        source: logFile,
        sourceOrder: logOrder
      }))
      .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));

    return rawPoints;
  }));

  measuredTrack = tracks.flat().map((point, index) => ({ ...point, index }));
  return measuredTrack;
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

function distanceLatLngKm(latlng, point) {
  return distanceKm(
    { lat: latlng[0], lng: latlng[1] },
    { lat: point.lat, lng: point.lng }
  );
}

function getElevationStats(path) {
  const altitudes = path
    .map((point) => point.altitude)
    .filter(Number.isFinite);
  if (altitudes.length < 2) {
    return { climb: 0, descent: 0, minAltitude: null, maxAltitude: null };
  }

  let climb = 0;
  let descent = 0;
  const noiseThreshold = 0.5;
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1].altitude;
    const current = path[index].altitude;
    if (!Number.isFinite(previous) || !Number.isFinite(current)) continue;
    const diff = current - previous;
    if (diff > noiseThreshold) climb += diff;
    if (diff < -noiseThreshold) descent += Math.abs(diff);
  }

  return {
    climb,
    descent,
    minAltitude: Math.min(...altitudes),
    maxAltitude: Math.max(...altitudes)
  };
}

function formatElevationChange(climb, descent) {
  return `+${Math.round(climb)} m / -${Math.round(descent)} m`;
}

function formatAltitudeRange(minAltitude, maxAltitude) {
  if (!Number.isFinite(minAltitude) || !Number.isFinite(maxAltitude)) return "-";
  return `${Math.round(minAltitude)}-${Math.round(maxAltitude)} m`;
}

function getPathDistance(path) {
  if (!Array.isArray(path) || path.length < 2) return 0;
  return path.slice(1).reduce((sum, point, index) => sum + distanceKm(path[index], point), 0);
}

function getTargetMatchInfo(distance, target = targetDistance) {
  const delta = distance - target;
  const absDelta = Math.abs(delta);
  const percent = target ? (absDelta / target) * 100 : 0;
  const band = getRouteDistanceBand(target);
  const direction = delta >= 0 ? "초과" : "부족";
  const grade = distance >= band.min && distance <= band.max
    ? "목표 범위 내"
    : absDelta <= 0.15
    ? "목표 거의 일치"
    : absDelta <= 0.5
      ? `목표 대비 ${absDelta.toFixed(3)} km ${direction}`
      : `목표와 차이 큼: ${absDelta.toFixed(3)} km ${direction}`;
  return {
    delta,
    absDelta,
    percent,
    direction,
    grade
  };
}

function describeMeasuredPoint(point) {
  const nearest = campusLandmarks
    .map((landmark) => ({
      ...landmark,
      distance: distanceLatLngKm([point.lat, point.lng], landmark)
    }))
    .sort((a, b) => a.distance - b.distance)[0];

  if (!nearest || nearest.distance > 0.18) {
    return "실측 경로 지점";
  }

  return `${nearest.name} · 랜드마크까지 약 ${Math.round(nearest.distance * 1000)}m`;
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

function latlngToSvgXY(point) {
  const bounds = measuredTrack.length ? getBounds(measuredTrack) : {
    minLat: 36.6243,
    maxLat: 36.6304,
    minLng: 127.4539,
    maxLng: 127.4598
  };
  const x = 60 + ((point.lng - bounds.minLng) / ((bounds.maxLng - bounds.minLng) || 1)) * 720;
  const y = 470 - ((point.lat - bounds.minLat) / ((bounds.maxLat - bounds.minLat) || 1)) * 380;
  return [Math.max(40, Math.min(800, x)), Math.max(40, Math.min(500, y))];
}

function svgPointFromEvent(event) {
  const svg = event.currentTarget.ownerSVGElement || event.currentTarget;
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const transformed = point.matrixTransform(svg.getScreenCTM().inverse());
  return [transformed.x, transformed.y];
}

function nearestMeasuredPointBySvg(x, y) {
  return svgMeasuredPoints.reduce((best, point) => {
    const distance = Math.hypot(point.x - x, point.y - y);
    return distance < best.distance ? { point, distance } : best;
  }, { point: null, distance: Infinity });
}

function createMeasuredNodes(track) {
  if (!track.length) return {};

  const nodes = {};
  const sampleIndexes = [0];
  let lastPoint = track[0];
  let accumulated = 0;

  for (let index = 1; index < track.length; index += 1) {
    accumulated += distanceKm(lastPoint, track[index]);
    lastPoint = track[index];
    if (accumulated >= 0.08) {
      sampleIndexes.push(index);
      accumulated = 0;
    }
  }

  const lastIndex = track.length - 1;
  if (sampleIndexes[sampleIndexes.length - 1] !== lastIndex) {
    sampleIndexes.push(lastIndex);
  }

  sampleIndexes.forEach((trackIndex, order) => {
    const point = track[trackIndex];
    nodes[`measured_${trackIndex}`] = {
      name: order === 0 ? "실측 시작점" : order === sampleIndexes.length - 1 ? "실측 종료점" : `실측 지점 ${order}`,
      xy: latlngToSvgXY(point),
      latlng: [point.lat, point.lng],
      elevation: null,
      type: "실측 노드",
      trackIndex
    };
  });

  return nodes;
}

function buildSelectableMeasuredNodes(track, intervalKm = 0.025) {
  if (!track.length) return [];

  const groupedTracks = [...track.reduce((groups, point) => {
    const key = point.source || "measured";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(point);
    return groups;
  }, new Map()).values()];

  return groupedTracks.flatMap((group) => {
    if (!group.length) return [];
    const nodes = [group[0]];
    let previous = group[0];
    let accumulated = 0;

    for (let index = 1; index < group.length; index += 1) {
      const current = group[index];
      accumulated += distanceKm(previous, current);
      previous = current;
      if (accumulated >= intervalKm) {
        nodes.push(current);
        accumulated = 0;
      }
    }

    const last = group[group.length - 1];
    if (nodes[nodes.length - 1]?.index !== last.index) nodes.push(last);
    return nodes;
  });
}

function renderMeasuredBasePath() {
  if (!measuredTrack.length) return;

  svgMeasuredPoints = measuredTrack.map((point) => {
    const [x, y] = latlngToSvgXY(point);
    return { ...point, x, y };
  });

  measuredBasePath.setAttribute("d", svgMeasuredPoints.map((point, index) => {
    return `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }).join(" "));
}

function clearNaverMeasuredOverlay() {
  if (naverMeasuredPolyline) {
    naverMeasuredPolyline.setMap(null);
    naverMeasuredPolyline = null;
  }
  naverMeasuredPolylines.forEach((polyline) => polyline.setMap(null));
  naverMeasuredPolylines = [];
  naverMeasuredDots.forEach((dot) => dot.setMap(null));
  naverMeasuredDots = [];
  naverMeasuredMarkers.forEach((marker) => marker.setMap(null));
  naverMeasuredMarkers = [];
}

function clearMeasuredOverlay() {
  measuredBasePath?.setAttribute("d", "");
  if (measuredNodeLayer) measuredNodeLayer.innerHTML = "";
  clearNaverMeasuredOverlay();
}

function updateOverlayButtons() {
  if (loadMeasuredNodesButton) {
    loadMeasuredNodesButton.textContent = `GNSS: ${isMeasuredTrackVisible ? "ON" : "OFF"}`;
  }
  if (showGraphOverlayButton) {
    showGraphOverlayButton.textContent = `연결 노드: ${isGraphOverlayVisible ? "ON" : "OFF"}`;
  }
}

function setMapStatus(message) {
  if (mapStatus) {
    mapStatus.textContent = message;
  }
}

function normalizeNodeGraph(data) {
  return {
    nodes: Array.isArray(data?.nodes) ? data.nodes : [],
    edges: Array.isArray(data?.edges) ? data.edges : []
  };
}

function loadNodeGraph() {
  try {
    const saved = localStorage.getItem(graphStorageKey);
    if (!saved) return { nodes: [], edges: [] };
    return normalizeNodeGraph(JSON.parse(saved));
  } catch {
    return { nodes: [], edges: [] };
  }
}

function saveNodeGraph() {
  localStorage.setItem(graphStorageKey, JSON.stringify(nodeGraph, null, 2));
  renderGraphNodeSelects();
  renderGraphDocument();
  renderGraphOverlay();
}

function exportNodeGraph() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    ...nodeGraph
  };
  if (!payload.nodes.length && !payload.edges.length) {
    setMapStatus("내보낼 대표 노드 그래프가 없습니다.");
    return;
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "node_graph.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setMapStatus("노드 그래프를 node_graph.json 파일로 내보냈습니다. GitHub에 함께 올리거나 다른 페이지에서 불러올 수 있습니다.");
}

function importNodeGraphData(data, sourceLabel = "파일") {
  const nextGraph = normalizeNodeGraph(data);
  nodeGraph = nextGraph;
  graphEdgeCandidates = [];
  graphCandidateMessage = "";
  saveNodeGraph();
  setMapStatus(`${sourceLabel}에서 대표 노드 ${nodeGraph.nodes.length}개, 연결 구간 ${nodeGraph.edges.length}개를 불러왔습니다.`);
}

function importNodeGraphFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      importNodeGraphData(JSON.parse(String(reader.result || "")), file.name);
    } catch {
      setMapStatus("노드 그래프 JSON 파일을 읽지 못했습니다. 파일 형식을 확인해 주세요.");
    }
  };
  reader.readAsText(file, "utf-8");
}

async function loadDefaultNodeGraphFile() {
  try {
    const response = await fetch("node_graph.json", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    const bundledGraph = normalizeNodeGraph(data);
    const hasNoLocalGraph = !nodeGraph.nodes.length && !nodeGraph.edges.length;
    const bundledIsNewer = bundledGraph.edges.length > nodeGraph.edges.length
      || bundledGraph.nodes.length > nodeGraph.nodes.length;

    if (hasNoLocalGraph || bundledIsNewer) {
      importNodeGraphData(bundledGraph, "node_graph.json");
    }
  } catch {
    // node_graph.json is optional. Ignore when the file is not present on GitHub Pages.
  }
}

function nextGraphNodeId() {
  const maxId = nodeGraph.nodes.reduce((max, node) => {
    const number = Number(String(node.id || "").replace("N", ""));
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0);
  return `N${String(maxId + 1).padStart(3, "0")}`;
}

function getGraphSourceKey(node) {
  if (Number.isInteger(node.trackIndex)) return `track:${node.trackIndex}`;
  return `latlng:${node.latlng[0].toFixed(6)},${node.latlng[1].toFixed(6)}`;
}

function ensureGraphNodeFromCampusNode(campusNode, preferredName = "") {
  const sourceKey = getGraphSourceKey(campusNode);
  const existing = nodeGraph.nodes.find((node) => node.sourceKey === sourceKey);
  if (existing) {
    if (preferredName) existing.name = preferredName;
    return existing;
  }

  const graphNode = {
    id: nextGraphNodeId(),
    name: preferredName || campusNode.placeLabel || campusNode.name,
    lat: Number(campusNode.latlng[0].toFixed(7)),
    lng: Number(campusNode.latlng[1].toFixed(7)),
    altitude: Number.isFinite(campusNode.elevation) ? Number(campusNode.elevation.toFixed(2)) : null,
    sourceKey,
    sourceIndex: Number.isInteger(campusNode.trackIndex) ? campusNode.trackIndex : null,
    sourceLog: Number.isInteger(campusNode.trackIndex) ? measuredTrack[campusNode.trackIndex]?.source || null : null
  };
  nodeGraph.nodes.push(graphNode);
  return graphNode;
}

function saveSelectedGraphNode() {
  if (!selectedNodeIds.length) {
    setMapStatus("먼저 지도 위에서 저장할 노드를 선택해 주세요.");
    return;
  }
  const selectedId = selectedNodeIds[selectedNodeIds.length - 1];
  const campusNode = campusNodes[selectedId];
  if (!campusNode) return;

  const preferredName = graphNodeNameInput.value.trim();
  const graphNode = ensureGraphNodeFromCampusNode(campusNode, preferredName);
  saveNodeGraph();
  graphNodeNameInput.value = "";
  setMapStatus(`${graphNode.id} ${graphNode.name} 노드를 저장했습니다.`);
}

function makeEdgeKey(from, to) {
  return [from, to].sort().join("--");
}

function graphNodeToRouteNode(graphNode) {
  return {
    name: graphNode.name,
    latlng: [graphNode.lat, graphNode.lng],
    elevation: graphNode.altitude,
    trackIndex: Number.isInteger(graphNode.sourceIndex) ? graphNode.sourceIndex : null
  };
}

function upsertGraphEdge(fromGraphNode, toGraphNode, segment) {
  const path = (segment.path || [])
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
    .map((point) => ({
      lat: Number(point.lat.toFixed(7)),
      lng: Number(point.lng.toFixed(7)),
      altitude: Number.isFinite(point.altitude) ? Number(point.altitude.toFixed(2)) : null
    }));
  const edgeKey = makeEdgeKey(fromGraphNode.id, toGraphNode.id);
  const edgeData = {
    id: `E${edgeKey.replace("--", "-")}`,
    from: fromGraphNode.id,
    to: toGraphNode.id,
    distanceKm: Number(segment.distance.toFixed(3)),
    climbM: Math.round(segment.climb || 0),
    descentM: Math.round(segment.descent || 0),
    altitudeRange: Number.isFinite(segment.minAltitude) && Number.isFinite(segment.maxAltitude)
      ? `${Math.round(segment.minAltitude)}-${Math.round(segment.maxAltitude)} m`
      : "-",
    method: segment.auxiliary ? "GNSS 보조 노드 최단 경로" : segment.direct ? "직선 연결" : "GNSS 실측 구간",
    path
  };

  const existingIndex = nodeGraph.edges.findIndex((edge) => makeEdgeKey(edge.from, edge.to) === edgeKey);
  if (existingIndex >= 0) {
    nodeGraph.edges[existingIndex] = { ...nodeGraph.edges[existingIndex], ...edgeData };
    return false;
  }

  nodeGraph.edges.push(edgeData);
  return true;
}

function saveGraphEdgeFromSelects() {
  const fromId = graphEdgeFromSelect?.value;
  const toId = graphEdgeToSelect?.value;
  if (!fromId || !toId) {
    setMapStatus("연결할 대표 노드 2개를 선택해 주세요.");
    return;
  }
  if (fromId === toId) {
    setMapStatus("서로 다른 대표 노드 2개를 선택해 주세요.");
    return;
  }

  const fromGraphNode = nodeGraph.nodes.find((node) => node.id === fromId);
  const toGraphNode = nodeGraph.nodes.find((node) => node.id === toId);
  if (!fromGraphNode || !toGraphNode) return;

  const fromRouteNode = graphNodeToRouteNode(fromGraphNode);
  const toRouteNode = graphNodeToRouteNode(toGraphNode);
  const segment = findShortestAuxiliaryPath(fromRouteNode, toRouteNode) || getSegmentSummary(
    fromRouteNode,
    toRouteNode,
    {
      maxSnapDistance: 0.09,
      allowLongMeasuredPath: true
    }
  );

  const added = upsertGraphEdge(fromGraphNode, toGraphNode, segment);
  saveNodeGraph();
  const pathText = segment.auxiliary
    ? `GNSS 보조 노드 최단 경로 ${segment.path.length}개 좌표`
    : segment.direct ? "직선 연결" : `GNSS 실측 경로 ${segment.path.length}개 좌표`;
  setMapStatus(`${fromGraphNode.id} → ${toGraphNode.id} 연결 구간을 ${pathText}로 ${added ? "저장" : "갱신"}했습니다.`);
}

function saveSelectedGraphEdges() {
  if (graphEdgeFromSelect?.value && graphEdgeToSelect?.value) {
    saveGraphEdgeFromSelects();
    return;
  }

  const segments = getSelectedSegments();
  if (!segments.length) {
    setMapStatus("연결 구간을 저장하려면 노드를 2개 이상 선택해 주세요.");
    return;
  }

  let savedCount = 0;
  segments.forEach((segment, index) => {
    const fromCampusNode = campusNodes[selectedNodeIds[index]];
    const toCampusNode = campusNodes[selectedNodeIds[index + 1]];
    const fromGraphNode = ensureGraphNodeFromCampusNode(fromCampusNode);
    const toGraphNode = ensureGraphNodeFromCampusNode(toCampusNode);
    const added = upsertGraphEdge(fromGraphNode, toGraphNode, segment);
    if (added) savedCount += 1;
  });

  saveNodeGraph();
  setMapStatus(`선택한 경로에서 연결 구간 ${segments.length}개를 저장했습니다. 새 구간 ${savedCount}개가 추가됐습니다.`);
}

function autoConnectGraphNodes() {
  if (nodeGraph.nodes.length < 2) {
    graphEdgeCandidates = [];
    graphCandidateMessage = "대표 노드가 2개 이상 있어야 가까운 연결 후보를 만들 수 있습니다.";
    renderGraphDocument();
    renderGraphOverlay();
    setMapStatus("연결 후보를 만들려면 대표 노드가 2개 이상 필요합니다.");
    return;
  }
  if (!measuredTrack.length) {
    graphEdgeCandidates = [];
    graphCandidateMessage = "실측 GNSS 경로를 먼저 불러와야 후보 경로를 계산할 수 있습니다.";
    renderGraphDocument();
    renderGraphOverlay();
    setMapStatus("먼저 실측 GNSS 경로를 불러와 주세요. GNSS 보조 노드망을 기준으로 연결 후보를 만듭니다.");
    return;
  }

  const maxDirectDistance = 0.25;
  const maxRouteDistance = 0.8;
  const candidates = [];
  for (let i = 0; i < nodeGraph.nodes.length; i += 1) {
    for (let j = i + 1; j < nodeGraph.nodes.length; j += 1) {
      const from = nodeGraph.nodes[i];
      const to = nodeGraph.nodes[j];
      if (nodeGraph.edges.some((edge) => makeEdgeKey(edge.from, edge.to) === makeEdgeKey(from.id, to.id))) continue;

      const directDistance = distanceKm(
        { lat: from.lat, lng: from.lng },
        { lat: to.lat, lng: to.lng }
      );
      if (directDistance > maxDirectDistance) continue;

      const segment = findShortestAuxiliaryPath(
        graphNodeToRouteNode(from),
        graphNodeToRouteNode(to)
      );
      if (!segment || segment.distance > maxRouteDistance) continue;
      candidates.push({
        id: `C${String(candidates.length + 1).padStart(3, "0")}`,
        fromId: from.id,
        toId: to.id,
        fromName: from.name,
        toName: to.name,
        distanceKm: Number(segment.distance.toFixed(3)),
        climbM: Math.round(segment.climb || 0),
        descentM: Math.round(segment.descent || 0),
        altitudeRange: formatAltitudeRange(segment.minAltitude, segment.maxAltitude),
        pointCount: segment.path.length,
        directDistance,
        segment
      });
    }
  }

  candidates.sort((a, b) => a.segment.distance - b.segment.distance || a.directDistance - b.directDistance);
  graphEdgeCandidates = candidates.slice(0, 80);
  graphCandidateMessage = graphEdgeCandidates.length
    ? "아래 후보는 GNSS 경로를 따라 계산한 연결 후보입니다. '노드 간 거리'는 후보를 고를 때 참고한 두 대표 노드 사이의 가까운 정도입니다."
    : "조건에 맞는 가까운 연결 후보가 없습니다. 이미 저장된 연결이 많거나, 대표 노드 사이가 너무 멀거나, GNSS 보조 노드망에서 이어지는 길을 찾지 못한 상태입니다.";
  renderGraphDocument();
  renderGraphOverlay();
  setMapStatus(`가까운 대표 노드 연결 후보 ${graphEdgeCandidates.length}개를 만들었습니다. 표에서 확인 후 승인해 주세요.`);
}

function approveGraphCandidate(candidateId) {
  const candidate = graphEdgeCandidates.find((item) => item.id === candidateId);
  if (!candidate) return;
  const from = nodeGraph.nodes.find((node) => node.id === candidate.fromId);
  const to = nodeGraph.nodes.find((node) => node.id === candidate.toId);
  if (!from || !to) return;

  const added = upsertGraphEdge(from, to, candidate.segment);
  graphEdgeCandidates = graphEdgeCandidates.filter((item) => item.id !== candidateId);
  graphCandidateMessage = graphEdgeCandidates.length ? graphCandidateMessage : "남은 연결 후보가 없습니다.";
  saveNodeGraph();
  setMapStatus(`${from.id} → ${to.id} 후보를 ${added ? "연결 구간으로 저장" : "기존 연결 구간으로 갱신"}했습니다.`);
}

function rejectGraphCandidate(candidateId) {
  graphEdgeCandidates = graphEdgeCandidates.filter((item) => item.id !== candidateId);
  graphCandidateMessage = graphEdgeCandidates.length ? graphCandidateMessage : "남은 연결 후보가 없습니다.";
  renderGraphDocument();
  renderGraphOverlay();
  setMapStatus("선택한 연결 후보를 제외했습니다.");
}

function renderGraphNodeSelects() {
  const options = nodeGraph.nodes.map((node) => (
    `<option value="${node.id}">${node.id} · ${node.name}</option>`
  )).join("");
  const emptyOption = `<option value="">대표 노드 선택</option>`;

  if (graphEdgeFromSelect && graphEdgeToSelect) {
    const previousFrom = graphEdgeFromSelect.value;
    const previousTo = graphEdgeToSelect.value;
    graphEdgeFromSelect.innerHTML = emptyOption + options;
    graphEdgeToSelect.innerHTML = emptyOption + options;
    if (nodeGraph.nodes.some((node) => node.id === previousFrom)) graphEdgeFromSelect.value = previousFrom;
    if (nodeGraph.nodes.some((node) => node.id === previousTo)) graphEdgeToSelect.value = previousTo;
  }

  if (routeStartNodeSelect && routeEndNodeSelect) {
    const previousStart = routeStartNodeSelect.value;
    const previousEnd = routeEndNodeSelect.value;
    routeStartNodeSelect.innerHTML = emptyOption + options;
    routeEndNodeSelect.innerHTML = emptyOption + options;
    if (nodeGraph.nodes.some((node) => node.id === previousStart)) routeStartNodeSelect.value = previousStart;
    if (nodeGraph.nodes.some((node) => node.id === previousEnd)) routeEndNodeSelect.value = previousEnd;
  }
}

function graphNodeToPoint(node) {
  return { lat: node.lat, lng: node.lng, altitude: node.altitude };
}

function graphNodeToSvgXY(node) {
  return latlngToSvgXY(graphNodeToPoint(node));
}

function getEdgePath(edge, from, to) {
  if (Array.isArray(edge.path) && edge.path.length >= 2) {
    return edge.path.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  }

  if (from && to && measuredTrack.length) {
    const segment = getSegmentSummary(graphNodeToRouteNode(from), graphNodeToRouteNode(to));
    if (segment?.path?.length >= 2) {
      return segment.path.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
    }
  }

  return from && to ? [graphNodeToPoint(from), graphNodeToPoint(to)] : [];
}

function clearNaverGraphOverlay() {
  naverGraphMarkers.forEach((marker) => marker.setMap(null));
  naverGraphMarkers = [];
  naverGraphPolylines.forEach((polyline) => polyline.setMap(null));
  naverGraphPolylines = [];
  naverGraphEdgeDots.forEach((dot) => dot.setMap(null));
  naverGraphEdgeDots = [];
}

function clearSvgGraphOverlay() {
  if (graphLayer) graphLayer.innerHTML = "";
}

function clearGraphOverlay() {
  clearSvgGraphOverlay();
  clearNaverGraphOverlay();
}

function renderSvgGraphNodesOnly() {
  if (!graphLayer) return;
  const nodeMarkup = nodeGraph.nodes.map((node) => {
    const [x, y] = graphNodeToSvgXY(node);
    return `
      <circle class="graph-node" cx="${x}" cy="${y}" r="13"></circle>
      <text class="graph-node-label" x="${x}" y="${y}">${node.id.replace("N", "")}</text>
    `;
  }).join("");
  graphLayer.innerHTML = nodeMarkup;
}

function renderNaverGraphNodesOnly() {
  clearNaverGraphOverlay();
  if (!naverMap || !window.naver?.maps) return;

  nodeGraph.nodes.forEach((node) => {
    const marker = new naver.maps.Marker({
      map: naverMap,
      position: new naver.maps.LatLng(node.lat, node.lng),
      title: `${node.id} ${node.name}`,
      icon: {
        content: `
          <div style="
            width:28px;height:28px;border-radius:50%;
            background:#2f80ed;color:white;border:3px solid white;
            box-shadow:0 4px 10px rgba(34,74,132,.3);
            display:flex;align-items:center;justify-content:center;
            font-weight:900;font-size:11px;">${node.id.replace("N", "")}</div>
        `,
        anchor: new naver.maps.Point(14, 14)
      }
    });
    naverGraphMarkers.push(marker);
  });
}

function renderDefaultGraphNodes() {
  if (isGraphOverlayVisible) {
    renderGraphOverlay();
    return;
  }
  renderSvgGraphNodesOnly();
  renderNaverGraphNodesOnly();
}

function sampleEdgeDotPoints(path, spacingMeters = 10, maxDots = 120) {
  if (!Array.isArray(path) || path.length < 2) return [];

  const samples = [];
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1];
    const to = path[index];
    const segmentMeters = distanceKm(from, to) * 1000;
    const count = Math.max(1, Math.floor(segmentMeters / spacingMeters));

    for (let step = 1; step <= count; step += 1) {
      const ratio = step / (count + 1);
      samples.push({
        lat: from.lat + (to.lat - from.lat) * ratio,
        lng: from.lng + (to.lng - from.lng) * ratio
      });
    }
  }

  if (samples.length <= maxDots) return samples;
  const stride = Math.ceil(samples.length / maxDots);
  return samples.filter((_, index) => index % stride === 0);
}

function samplePathPoints(path, maxPoints = 1200) {
  if (!Array.isArray(path) || path.length <= maxPoints) return path;
  const stride = Math.ceil(path.length / maxPoints);
  return path.filter((_, index) => index % stride === 0 || index === path.length - 1);
}

function shouldRenderGraphDots() {
  if (!naverMap?.getZoom) return false;
  return naverMap.getZoom() >= 16;
}

function getGraphDotBudget() {
  if (!naverMap?.getZoom) return 0;
  if (nodeGraph.edges.length <= 20 && naverMap.getZoom() >= 18) return 36;
  if (nodeGraph.edges.length <= 45 && naverMap.getZoom() >= 18) return 12;
  if (naverMap.getZoom() >= 18) return 4;
  if (naverMap.getZoom() >= 16) return 2;
  return 0;
}

function shouldRenderGraphLabels() {
  if (!naverMap?.getZoom) return false;
  return naverMap.getZoom() >= 18 && nodeGraph.edges.length <= 30;
}

function scheduleNaverGraphOverlayRender() {
  clearTimeout(naverGraphRenderTimer);
  naverGraphRenderTimer = setTimeout(renderNaverGraphOverlay, 180);
}

function renderSvgGraphOverlay() {
  if (!isGraphOverlayVisible) {
    renderSvgGraphNodesOnly();
    return;
  }
  if (!graphLayer) return;
  const edgeMarkup = nodeGraph.edges.map((edge) => {
    const from = nodeGraph.nodes.find((node) => node.id === edge.from);
    const to = nodeGraph.nodes.find((node) => node.id === edge.to);
    if (!from || !to) return "";
    const path = getEdgePath(edge, from, to).map(latlngToSvgXY);
    if (path.length < 2) return "";
    const d = path.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    return `<path class="graph-edge" d="${d}"></path>`;
  }).join("");

  const candidateMarkup = graphEdgeCandidates.map((candidate) => {
    const path = candidate.segment?.path?.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)) || [];
    const svgPath = path.map(latlngToSvgXY);
    if (svgPath.length < 2) return "";
    const d = svgPath.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    return `<path class="graph-edge-candidate" d="${d}"></path>`;
  }).join("");

  const nodeMarkup = nodeGraph.nodes.map((node) => {
    const [x, y] = graphNodeToSvgXY(node);
    return `
      <circle class="graph-node" cx="${x}" cy="${y}" r="13"></circle>
      <text class="graph-node-label" x="${x}" y="${y}">${node.id.replace("N", "")}</text>
    `;
  }).join("");

  graphLayer.innerHTML = candidateMarkup + edgeMarkup + nodeMarkup;
}

function renderNaverGraphOverlay() {
  if (!isGraphOverlayVisible) {
    renderNaverGraphNodesOnly();
    return;
  }
  if (!naverMap || !window.naver?.maps) return;
  clearNaverGraphOverlay();

  let renderedEdgeCount = 0;
  const renderDots = shouldRenderGraphDots();
  const renderLabels = shouldRenderGraphLabels();
  const dotBudget = getGraphDotBudget();
  const edgeCount = Math.max(1, nodeGraph.edges.length + graphEdgeCandidates.length);
  const totalDotBudget = naverMap.getZoom() >= 18 ? 520 : 280;
  const perEdgeDotBudget = renderDots ? Math.max(1, Math.min(dotBudget, Math.floor(totalDotBudget / edgeCount))) : 0;
  nodeGraph.edges.forEach((edge) => {
    const from = nodeGraph.nodes.find((node) => node.id === edge.from);
    const to = nodeGraph.nodes.find((node) => node.id === edge.to);
    if (!from || !to) return;
    const edgePath = getEdgePath(edge, from, to);
    if (edgePath.length < 2) return;
    renderedEdgeCount += 1;
    const polyline = new naver.maps.Polyline({
      map: naverMap,
      path: samplePathPoints(edgePath).map((point) => new naver.maps.LatLng(point.lat, point.lng)),
      strokeColor: "#f1a638",
      strokeOpacity: 0.88,
      strokeWeight: 7,
      strokeLineCap: "round",
      strokeLineJoin: "round",
      zIndex: 1000
    });
    naverGraphPolylines.push(polyline);

    if (renderDots && perEdgeDotBudget > 0) {
      sampleEdgeDotPoints(edgePath, 26, perEdgeDotBudget).forEach((point) => {
        const dot = new naver.maps.Marker({
          map: naverMap,
          position: new naver.maps.LatLng(point.lat, point.lng),
          icon: {
            content: `
              <div style="
                width:10px;height:10px;border-radius:50%;
                background:#f1a638;border:2px solid #ffffff;
                box-shadow:0 2px 6px rgba(97,64,0,.32);"></div>
            `,
            anchor: new naver.maps.Point(5, 5)
          },
          zIndex: 20000
        });
        naverGraphEdgeDots.push(dot);
      });
    }

    if (renderLabels) {
      const midPoint = edgePath[Math.floor(edgePath.length / 2)];
      const label = new naver.maps.Marker({
        map: naverMap,
        position: new naver.maps.LatLng(midPoint.lat, midPoint.lng),
        icon: {
          content: `
            <div style="
              padding:4px 7px;border-radius:999px;
              background:#f1a638;color:#17211d;border:2px solid #ffffff;
              box-shadow:0 4px 10px rgba(97,64,0,.28);
              font-size:11px;font-weight:900;white-space:nowrap;">
              ${edge.from}-${edge.to} · ${edge.distanceKm.toFixed(3)}km
            </div>
          `,
          anchor: new naver.maps.Point(46, 14)
        },
        zIndex: 21000
      });
      naverGraphEdgeDots.push(label);
    }
  });

  graphEdgeCandidates.forEach((candidate) => {
    const edgePath = candidate.segment?.path?.filter((point) => (
      Number.isFinite(point.lat) && Number.isFinite(point.lng)
    )) || [];
    if (edgePath.length < 2) return;

    const candidatePolyline = new naver.maps.Polyline({
      map: naverMap,
      path: samplePathPoints(edgePath, 500).map((point) => new naver.maps.LatLng(point.lat, point.lng)),
      strokeColor: "#ffd166",
      strokeOpacity: 0.72,
      strokeWeight: 5,
      strokeLineCap: "round",
      strokeLineJoin: "round",
      zIndex: 900
    });
    naverGraphPolylines.push(candidatePolyline);

    if (renderDots && perEdgeDotBudget > 0) {
      sampleEdgeDotPoints(edgePath, 26, Math.min(8, perEdgeDotBudget)).forEach((point) => {
        const dot = new naver.maps.Marker({
          map: naverMap,
          position: new naver.maps.LatLng(point.lat, point.lng),
          icon: {
            content: `
              <div style="
                width:10px;height:10px;border-radius:50%;
                background:#ffd166;border:2px solid #ffffff;
                box-shadow:0 2px 6px rgba(97,64,0,.28);opacity:.95;"></div>
            `,
            anchor: new naver.maps.Point(5, 5)
          },
          zIndex: 18000
        });
        naverGraphEdgeDots.push(dot);
      });
    }

    if (renderLabels && graphEdgeCandidates.length <= 20) {
      const midPoint = edgePath[Math.floor(edgePath.length / 2)];
      const label = new naver.maps.Marker({
        map: naverMap,
        position: new naver.maps.LatLng(midPoint.lat, midPoint.lng),
        icon: {
          content: `
            <div style="
              padding:3px 7px;border-radius:999px;
              background:#fff2bf;color:#765100;border:2px solid #f1a638;
              box-shadow:0 3px 9px rgba(97,64,0,.18);
              font-size:10px;font-weight:900;white-space:nowrap;">
              후보 ${candidate.id} · ${candidate.distanceKm.toFixed(3)}km
            </div>
          `,
          anchor: new naver.maps.Point(46, 14)
        },
        zIndex: 18500
      });
      naverGraphEdgeDots.push(label);
    }
  });

  nodeGraph.nodes.forEach((node) => {
    const marker = new naver.maps.Marker({
      map: naverMap,
      position: new naver.maps.LatLng(node.lat, node.lng),
      title: `${node.id} ${node.name}`,
      icon: {
        content: `
          <div style="
            width:28px;height:28px;border-radius:50%;
            background:#2f80ed;color:white;border:3px solid white;
            box-shadow:0 4px 10px rgba(34,74,132,.3);
            display:flex;align-items:center;justify-content:center;
            font-weight:900;font-size:11px;">${node.id.replace("N", "")}</div>
        `,
        anchor: new naver.maps.Point(14, 14)
      }
    });
    naver.maps.Event.addListener(marker, "click", () => {
      if (!naverInfoWindow) {
        naverInfoWindow = new naver.maps.InfoWindow();
      }
      naverInfoWindow.setContent(`
        <div style="padding:10px 12px;font-weight:800;line-height:1.45;min-width:200px">
          <div>${node.id} · ${node.name}</div>
          <div style="font-size:12px;color:#60706a">${node.lat.toFixed(6)}, ${node.lng.toFixed(6)}${Number.isFinite(node.altitude) ? ` · 고도 ${node.altitude.toFixed(1)} m` : ""}</div>
        </div>
      `);
      naverInfoWindow.open(naverMap, new naver.maps.LatLng(node.lat, node.lng));
    });
    naverGraphMarkers.push(marker);
  });

  setTimeout(() => {
    naverGraphEdgeDots.forEach((dot) => {
      dot.setMap(naverMap);
    });
  }, 50);

  if (renderedEdgeCount) {
    setMapStatus(`저장된 연결 구간 ${renderedEdgeCount}개를 노란 점으로 표시했습니다. 선이 안 보이는 환경에서도 확인할 수 있게 점 표시를 유지합니다.`);
  }
}

function renderGraphOverlay() {
  if (!isGraphOverlayVisible) {
    renderDefaultGraphNodes();
    return;
  }
  renderSvgGraphOverlay();
  renderNaverGraphOverlay();
}

function clearNodeGraph() {
  if (!confirm("저장된 노드 그래프를 모두 삭제할까요?")) return;
  nodeGraph = { nodes: [], edges: [] };
  saveNodeGraph();
  setMapStatus("저장된 노드 그래프를 초기화했습니다.");
}

function deleteGraphNode(nodeId) {
  const node = nodeGraph.nodes.find((item) => item.id === nodeId);
  if (!node) return;
  if (!confirm(`${node.id} ${node.name} 노드를 삭제할까요? 연결된 구간도 함께 삭제됩니다.`)) return;
  nodeGraph.nodes = nodeGraph.nodes.filter((item) => item.id !== nodeId);
  nodeGraph.edges = nodeGraph.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId);
  saveNodeGraph();
  setMapStatus(`${node.id} 노드와 연결 구간을 삭제했습니다.`);
}

function deleteGraphEdge(edgeId) {
  const edge = nodeGraph.edges.find((item) => item.id === edgeId);
  if (!edge) return;
  if (!confirm(`${edge.id} 연결 구간을 삭제할까요?`)) return;
  nodeGraph.edges = nodeGraph.edges.filter((item) => item.id !== edgeId);
  saveNodeGraph();
  setMapStatus(`${edge.id} 연결 구간을 삭제했습니다.`);
}

function renderGraphDocument() {
  if (!graphDocument) return;
  if (!nodeGraph.nodes.length && !nodeGraph.edges.length) {
    graphDocument.innerHTML = `<div class="graph-empty">아직 저장된 대표 노드나 연결 구간이 없습니다.</div>`;
    return;
  }

  const nodeRows = nodeGraph.nodes.map((node) => `
    <tr>
      <td>${node.id}</td>
      <td>${node.name}</td>
      <td>${node.lat.toFixed(6)}, ${node.lng.toFixed(6)}</td>
      <td>${Number.isFinite(node.altitude) ? `${node.altitude.toFixed(1)} m` : "-"}</td>
      <td><button class="graph-delete" data-delete-node="${node.id}">삭제</button></td>
    </tr>
  `).join("");

  const edgeRows = nodeGraph.edges.map((edge) => {
    const from = nodeGraph.nodes.find((node) => node.id === edge.from);
    const to = nodeGraph.nodes.find((node) => node.id === edge.to);
    const pathCount = Array.isArray(edge.path) ? edge.path.length : 0;
    const methodText = pathCount >= 3 ? `${edge.method || "GNSS 실측 구간"} · ${pathCount}점` : "직선 연결";
    return `
      <tr>
        <td>${edge.id}</td>
        <td>${from?.name || edge.from} → ${to?.name || edge.to}</td>
        <td>${edge.distanceKm.toFixed(3)} km</td>
        <td>+${edge.climbM} m / -${edge.descentM} m</td>
        <td>${methodText}</td>
        <td class="graph-manage">
          <button class="graph-delete" data-delete-edge="${edge.id}">삭제</button>
        </td>
      </tr>
    `;
  }).join("");

  const candidateRows = graphEdgeCandidates.map((candidate) => `
    <tr>
      <td>${candidate.id}</td>
      <td>${candidate.fromName} → ${candidate.toName}</td>
      <td>${candidate.distanceKm.toFixed(3)} km</td>
      <td>+${candidate.climbM} m / -${candidate.descentM} m</td>
      <td>${candidate.altitudeRange || "-"}</td>
      <td>${Math.round(candidate.directDistance * 1000)} m</td>
      <td>${candidate.pointCount}점</td>
      <td>GNSS 후보</td>
      <td class="graph-manage">
        <button class="graph-approve" data-approve-candidate="${candidate.id}">승인</button>
        <button class="graph-delete" data-reject-candidate="${candidate.id}">제외</button>
      </td>
    </tr>
  `).join("");

  const candidateSection = (graphEdgeCandidates.length || graphCandidateMessage) ? `
    <div>
      <h3>가까운 연결 후보 (${graphEdgeCandidates.length}개)</h3>
      ${graphCandidateMessage ? `<div class="graph-note">${graphCandidateMessage}</div>` : ""}
      <table class="graph-table">
        <thead><tr><th>ID</th><th>후보 연결</th><th>실측 거리</th><th>고도 변화</th><th>고도 범위</th><th>노드 간 거리</th><th>GNSS 점</th><th>계산 방식</th><th>관리</th></tr></thead>
        <tbody>${candidateRows || `<tr><td colspan="9">표시할 후보가 없습니다.</td></tr>`}</tbody>
      </table>
    </div>
  ` : "";

  graphDocument.innerHTML = `
    ${candidateSection}
    <div>
      <h3>대표 노드 (${nodeGraph.nodes.length}개)</h3>
      <table class="graph-table">
        <thead><tr><th>ID</th><th>이름</th><th>좌표</th><th>고도</th><th>관리</th></tr></thead>
        <tbody>${nodeRows || `<tr><td colspan="5">저장된 노드가 없습니다.</td></tr>`}</tbody>
      </table>
    </div>
    <div>
      <h3>연결 구간 (${nodeGraph.edges.length}개)</h3>
      <table class="graph-table">
        <thead><tr><th>ID</th><th>연결</th><th>거리</th><th>고도 변화</th><th>계산 방식</th><th>관리</th></tr></thead>
        <tbody>${edgeRows || `<tr><td colspan="6">저장된 연결 구간이 없습니다.</td></tr>`}</tbody>
      </table>
    </div>
  `;

  graphDocument.querySelectorAll("[data-delete-node]").forEach((button) => {
    button.addEventListener("click", () => deleteGraphNode(button.dataset.deleteNode));
  });

  graphDocument.querySelectorAll("[data-delete-edge]").forEach((button) => {
    button.addEventListener("click", () => deleteGraphEdge(button.dataset.deleteEdge));
  });

  graphDocument.querySelectorAll("[data-approve-candidate]").forEach((button) => {
    button.addEventListener("click", () => approveGraphCandidate(button.dataset.approveCandidate));
  });

  graphDocument.querySelectorAll("[data-reject-candidate]").forEach((button) => {
    button.addEventListener("click", () => rejectGraphCandidate(button.dataset.rejectCandidate));
  });
}

function updateNodeStats(status = "대기") {
  if (selectedNodeIds.length >= 2) return;
  document.querySelector("#metricDistance").textContent = "-";
  document.querySelector("#metricTime").textContent = formatTime(targetDistance, paceInput?.value || 6);
  document.querySelector("#metricClimb").textContent = "-";
  document.querySelector("#metricLevel").textContent = "-";
}

function addMeasuredNodeFromPoint(point) {
  const existingId = `measured_${point.index}`;
  const limit = Number(nodeLimit.value || 2);
  if (!campusNodes[existingId]) {
    const placeLabel = describeMeasuredPoint(point);
    campusNodes[existingId] = {
      name: selectedNodeIds.length === 0 ? `시작점 (${placeLabel})` : `경유지 ${selectedNodeIds.length} (${placeLabel})`,
      xy: [point.x, point.y],
      latlng: [point.lat, point.lng],
      elevation: point.altitude,
      type: "실측 노드",
      trackIndex: point.index,
      time: point.time,
      placeLabel
    };
  }

  if (selectedNodeIds.includes(existingId)) {
    if (graphNodeNameInput) graphNodeNameInput.value = campusNodes[existingId]?.placeLabel || campusNodes[existingId]?.name || "";
    showNodeTooltip(existingId);
    showNaverNodeInfo(existingId);
    updateNodeOrder();
    updateCustomRoute();
    renderNaverMeasuredNodes();
    updateMapSegmentSummary();
    updateNodeStats("선택됨");
    return;
  }

  if (selectedNodeIds.length >= limit) {
    setMapStatus(`노드는 최대 ${limit}개까지 선택할 수 있습니다. 개수를 바꾸거나 다시 불러와 주세요.`);
    updateNodeStats("개수 초과");
    return;
  }

  selectedNodeIds.push(existingId);

  renderNodePicker();
  renderMeasuredNodes();
  updateNodeOrder();
  updateCustomRoute();
  renderNaverMeasuredNodes();
  updateMapSegmentSummary();
  updateNodeStats("선택됨");
  graphNodeNameInput.value = campusNodes[existingId]?.placeLabel || campusNodes[existingId]?.name || "";
  showNodeTooltip(existingId);
  showNaverNodeInfo(existingId);
}

function removeSelectedNode(id) {
  selectedNodeIds = selectedNodeIds.filter((nodeId) => nodeId !== id);
  renderNodePicker();
  renderMeasuredNodes();
  renderNaverMeasuredNodes();
  updateNodeOrder();
  routePath.setAttribute("d", "");
  routePoints.innerHTML = "";

  if (selectedNodeIds.length >= 2) {
    updateCustomRoute();
    updateMapSegmentSummary();
  } else {
    updateMapSegmentSummary();
  }
  updateNodeStats("삭제됨");
}

function renderMeasuredNodes() {
  const candidateMarkup = selectableMeasuredNodes
    .map((point) => {
      const [x, y] = latlngToSvgXY(point);
      const isSelected = selectedNodeIds.includes(`measured_${point.index}`);
      return `<circle class="measured-node candidate${isSelected ? " chosen" : ""}" data-track-index="${point.index}" cx="${x}" cy="${y}" r="5"></circle>`;
    })
    .join("");

  const selectedMarkup = selectedNodeIds
    .filter((id) => campusNodes[id]?.type === "실측 노드")
    .map((id) => {
      const node = campusNodes[id];
      const [x, y] = node.xy;
      return `
        <circle class="measured-node selected" data-node-id="${id}" cx="${x}" cy="${y}" r="12"></circle>
        <text class="walk-label" x="${x + 15}" y="${y - 12}">${selectedNodeIds.indexOf(id) + 1}</text>
      `;
    })
    .join("");

  measuredNodeLayer.innerHTML = candidateMarkup + selectedMarkup;

  measuredNodeLayer.querySelectorAll(".measured-node.candidate").forEach((nodeEl) => {
    nodeEl.addEventListener("click", (event) => {
      event.stopPropagation();
      const point = selectableMeasuredNodes.find((candidate) => candidate.index === Number(nodeEl.dataset.trackIndex));
      if (!point) return;
      const [x, y] = latlngToSvgXY(point);
      addMeasuredNodeFromPoint({ ...point, x, y });
    });
  });

  measuredNodeLayer.querySelectorAll(".measured-node").forEach((nodeEl) => {
    nodeEl.addEventListener("click", (event) => {
      event.stopPropagation();
      if (nodeEl.dataset.nodeId) showNodeTooltip(nodeEl.dataset.nodeId);
    });
  });
}

function showNodeTooltip(id) {
  const node = campusNodes[id];
  if (!node) return;

  const [x, y] = node.xy;
  const label = node.placeLabel || node.name;
  const altitudeText = Number.isFinite(node.elevation) ? ` · 고도 ${node.elevation.toFixed(1)} m` : "";
  const subLabel = `${node.time?.slice(11, 19) || "실측"} · ${node.latlng[0].toFixed(6)}, ${node.latlng[1].toFixed(6)}${altitudeText}`;
  const width = Math.max(260, Math.max(label.length, subLabel.length) * 9);
  const tx = Math.min(820 - width, Math.max(20, x + 18));
  const ty = Math.max(20, y - 72);

  nodeTooltipLayer.innerHTML = `
    <g class="node-tooltip">
      <rect x="${tx}" y="${ty}" width="${width}" height="58" rx="8"></rect>
      <text x="${tx + 12}" y="${ty + 24}">${label}</text>
      <text class="node-tooltip-sub" x="${tx + 12}" y="${ty + 45}">${subLabel}</text>
    </g>
  `;
}

function showNaverNodeInfo(id) {
  if (!naverMap || !window.naver?.maps) return;
  const node = campusNodes[id];
  if (!node) return;

  const content = `
    <div style="padding:10px 12px;font-weight:800;line-height:1.45;min-width:220px">
      <div>${node.placeLabel || node.name}</div>
      <div style="font-size:12px;color:#60706a">${node.time?.slice(11, 19) || "실측"} · ${node.latlng[0].toFixed(6)}, ${node.latlng[1].toFixed(6)}${Number.isFinite(node.elevation) ? ` · 고도 ${node.elevation.toFixed(1)} m` : ""}</div>
    </div>
  `;

  if (!naverInfoWindow) {
    naverInfoWindow = new naver.maps.InfoWindow({ content });
  } else {
    naverInfoWindow.setContent(content);
  }

  naverInfoWindow.open(naverMap, new naver.maps.LatLng(node.latlng[0], node.latlng[1]));
  clearTimeout(naverInfoTimer);
  naverInfoTimer = setTimeout(() => {
    if (naverInfoWindow) {
      naverInfoWindow.close();
    }
  }, 3500);
}

function summarizeTrackSlice(fromIndex, toIndex) {
  if (!measuredTrack.length) return { distance: 0, climb: 0, path: [] };
  const safeFrom = Math.max(0, Math.min(measuredTrack.length - 1, fromIndex));
  const safeTo = Math.max(0, Math.min(measuredTrack.length - 1, toIndex));
  const step = safeFrom <= safeTo ? 1 : -1;
  const path = [measuredTrack[safeFrom]];
  let distance = 0;
  let previous = measuredTrack[safeFrom];

  for (let index = safeFrom + step; step > 0 ? index <= safeTo : index >= safeTo; index += step) {
    const current = measuredTrack[index];
    distance += distanceKm(previous, current);
    path.push(current);
    previous = current;
  }

  return { distance, path, ...getElevationStats(path) };
}

function summarizePointSlice(points, fromIndex, toIndex) {
  if (!points.length) return { distance: 0, climb: 0, path: [] };
  const safeFrom = Math.max(0, Math.min(points.length - 1, fromIndex));
  const safeTo = Math.max(0, Math.min(points.length - 1, toIndex));
  const step = safeFrom <= safeTo ? 1 : -1;
  const path = [points[safeFrom]];
  let distance = 0;
  let previous = points[safeFrom];

  for (let index = safeFrom + step; step > 0 ? index <= safeTo : index >= safeTo; index += step) {
    const current = points[index];
    distance += distanceKm(previous, current);
    path.push(current);
    previous = current;
  }

  return { distance, path, ...getElevationStats(path) };
}

function nearestPointIndex(points, target) {
  return points.reduce((best, point, index) => {
    const distance = distanceKm(point, target);
    return distance < best.distance ? { index, distance } : best;
  }, { index: -1, distance: Infinity });
}

function getGroupedMeasuredTracks() {
  return [...measuredTrack.reduce((groups, point) => {
    const key = point.source || "measured";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(point);
    return groups;
  }, new Map()).values()];
}

function buildAuxiliaryGraph() {
  const auxNodes = selectableMeasuredNodes.length
    ? selectableMeasuredNodes
    : buildSelectableMeasuredNodes(measuredTrack);
  const adjacency = auxNodes.map(() => []);
  const indexByTrackIndex = new Map(auxNodes.map((point, index) => [point.index, index]));

  getGroupedMeasuredTracks().forEach((track) => {
    const sampled = track
      .map((point) => indexByTrackIndex.get(point.index))
      .filter((index) => Number.isInteger(index));

    for (let index = 1; index < sampled.length; index += 1) {
      const from = sampled[index - 1];
      const to = sampled[index];
      const distance = distanceKm(auxNodes[from], auxNodes[to]);
      adjacency[from].push({ to, distance });
      adjacency[to].push({ to: from, distance });
    }
  });

  const crossConnectDistance = 0.018;
  for (let i = 0; i < auxNodes.length; i += 1) {
    for (let j = i + 1; j < auxNodes.length; j += 1) {
      if (auxNodes[i].source === auxNodes[j].source) continue;
      const distance = distanceKm(auxNodes[i], auxNodes[j]);
      if (distance <= crossConnectDistance) {
        adjacency[i].push({ to: j, distance });
        adjacency[j].push({ to: i, distance });
      }
    }
  }

  return { auxNodes, adjacency };
}

function nearestAuxNodeIndexes(auxNodes, target, maxDistance = 0.09, limit = 4) {
  return auxNodes
    .map((point, index) => ({
      index,
      distance: distanceKm(point, target)
    }))
    .filter((item) => item.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

function findShortestAuxiliaryPath(fromNode, toNode) {
  if (!measuredTrack.length) return null;
  const { auxNodes, adjacency } = buildAuxiliaryGraph();
  if (!auxNodes.length) return null;

  const fromTarget = { lat: fromNode.latlng[0], lng: fromNode.latlng[1] };
  const toTarget = { lat: toNode.latlng[0], lng: toNode.latlng[1] };
  const starts = nearestAuxNodeIndexes(auxNodes, fromTarget);
  const goals = nearestAuxNodeIndexes(auxNodes, toTarget);
  if (!starts.length || !goals.length) return null;

  const goalSet = new Set(goals.map((item) => item.index));
  const distances = Array(auxNodes.length).fill(Infinity);
  const previous = Array(auxNodes.length).fill(null);
  const visited = new Set();

  starts.forEach((start) => {
    distances[start.index] = start.distance;
  });

  while (visited.size < auxNodes.length) {
    let current = -1;
    let currentDistance = Infinity;
    for (let index = 0; index < distances.length; index += 1) {
      if (!visited.has(index) && distances[index] < currentDistance) {
        current = index;
        currentDistance = distances[index];
      }
    }

    if (current === -1) break;
    if (goalSet.has(current)) break;
    visited.add(current);

    adjacency[current].forEach((edge) => {
      const nextDistance = currentDistance + edge.distance;
      if (nextDistance < distances[edge.to]) {
        distances[edge.to] = nextDistance;
        previous[edge.to] = current;
      }
    });
  }

  const bestGoal = goals
    .map((goal) => ({
      ...goal,
      totalDistance: distances[goal.index] + goal.distance
    }))
    .sort((a, b) => a.totalDistance - b.totalDistance)[0];
  if (!bestGoal || !Number.isFinite(bestGoal.totalDistance)) return null;

  const indexes = [];
  for (let cursor = bestGoal.index; cursor !== null; cursor = previous[cursor]) {
    indexes.push(cursor);
  }
  indexes.reverse();

  const path = [
    { lat: fromTarget.lat, lng: fromTarget.lng, altitude: fromNode.elevation },
    ...indexes.map((index) => auxNodes[index]),
    { lat: toTarget.lat, lng: toTarget.lng, altitude: toNode.elevation }
  ];
  let distance = 0;
  for (let index = 1; index < path.length; index += 1) {
    distance += distanceKm(path[index - 1], path[index]);
  }

  return {
    distance,
    path,
    ...getElevationStats(path),
    direct: false,
    auxiliary: true
  };
}

function getBestMeasuredSegment(fromNode, toNode, options = {}) {
  if (!measuredTrack.length) return null;

  const fromTarget = { lat: fromNode.latlng[0], lng: fromNode.latlng[1] };
  const toTarget = { lat: toNode.latlng[0], lng: toNode.latlng[1] };
  const directDistance = distanceKm(fromTarget, toTarget);
  const maxSnapDistance = options.maxSnapDistance ?? 0.09;
  const allowLongMeasuredPath = options.allowLongMeasuredPath ?? false;

  const candidates = getGroupedMeasuredTracks()
    .map((track) => {
      const fromNearest = nearestPointIndex(track, fromTarget);
      const toNearest = nearestPointIndex(track, toTarget);
      if (fromNearest.index < 0 || toNearest.index < 0) return null;
      if (fromNearest.distance > maxSnapDistance || toNearest.distance > maxSnapDistance) return null;
      const summary = summarizePointSlice(track, fromNearest.index, toNearest.index);
      return {
        ...summary,
        snapDistance: fromNearest.distance + toNearest.distance
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance || a.snapDistance - b.snapDistance);

  const best = candidates[0];
  if (!best) return null;

  const suspiciouslyLong = best.distance > Math.max(directDistance * 3, directDistance + 0.3);
  return suspiciouslyLong && !allowLongMeasuredPath ? null : best;
}

function getSegmentSummary(fromNode, toNode, options = {}) {
  const bestMeasuredSegment = getBestMeasuredSegment(fromNode, toNode, options);
  if (bestMeasuredSegment) return bestMeasuredSegment;

  const path = [
    { lat: fromNode.latlng[0], lng: fromNode.latlng[1], altitude: fromNode.elevation },
    { lat: toNode.latlng[0], lng: toNode.latlng[1], altitude: toNode.elevation }
  ];
  return {
    distance: distanceKm(
      { lat: fromNode.latlng[0], lng: fromNode.latlng[1] },
      { lat: toNode.latlng[0], lng: toNode.latlng[1] }
    ),
    path,
    ...getElevationStats(path),
    direct: true
  };
}

function getSelectedSegments() {
  if (selectedNodeIds.length < 2) return [];
  return selectedNodeIds.slice(1).map((id, index) => {
    const fromNode = campusNodes[selectedNodeIds[index]];
    const toNode = campusNodes[id];
    const summary = getSegmentSummary(fromNode, toNode);

    return {
      from: fromNode.name,
      to: toNode.name,
      distance: summary.distance,
      climb: summary.climb,
      descent: summary.descent,
      minAltitude: summary.minAltitude,
      maxAltitude: summary.maxAltitude,
      path: summary.path,
      direct: summary.direct
    };
  });
}

function getCustomRoute() {
  const segments = getSelectedSegments();
  if (!segments.length) return null;

  const fullPath = [];
  segments.forEach((segment, segmentIndex) => {
    segment.path.forEach((point, pointIndex) => {
      if (segmentIndex > 0 && pointIndex === 0) return;
      fullPath.push(point);
    });
  });

  const distance = segments.reduce((sum, segment) => sum + segment.distance, 0);
  const climb = segments.reduce((sum, segment) => sum + (segment.climb || 0), 0);
  const descent = segments.reduce((sum, segment) => sum + (segment.descent || 0), 0);
  const altitudes = segments
    .flatMap((segment) => [segment.minAltitude, segment.maxAltitude])
    .filter(Number.isFinite);
  const minAltitude = altitudes.length ? Math.min(...altitudes) : null;
  const maxAltitude = altitudes.length ? Math.max(...altitudes) : null;
  const level = formatAltitudeRange(minAltitude, maxAltitude);
  const firstNode = campusNodes[selectedNodeIds[0]];
  const lastNode = campusNodes[selectedNodeIds[selectedNodeIds.length - 1]];
  const svgPoints = fullPath.map(latlngToSvgXY);

  return {
    name: `${firstNode.name} → ${lastNode.name} 실측 기반 코스`,
    distance,
    climb,
    descent,
    minAltitude,
    maxAltitude,
    level,
    path: svgPoints.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" "),
    points: selectedNodeIds.map((id) => campusNodes[id].xy),
    latlng: fullPath.map((point) => [point.lat, point.lng]),
    description: selectedNodeIds.map((id) => campusNodes[id].name).join(" → ")
  };
}

function buildGraphAdjacency() {
  const adjacency = new Map(nodeGraph.nodes.map((node) => [node.id, []]));
  nodeGraph.edges.forEach((edge) => {
    if (!adjacency.has(edge.from) || !adjacency.has(edge.to)) return;
    adjacency.get(edge.from).push({ edge, to: edge.to, reversed: false });
    adjacency.get(edge.to).push({ edge, to: edge.from, reversed: true });
  });
  adjacency.forEach((edges) => {
    edges.sort((a, b) => a.edge.distanceKm - b.edge.distanceKm);
  });
  return adjacency;
}

function orientedEdgePath(edge, reversed) {
  const path = Array.isArray(edge.path) ? edge.path : [];
  const cleanPath = path.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  return reversed ? [...cleanPath].reverse() : cleanPath;
}

function scoreGraphRoute(candidate, difficulty) {
  const band = getRouteDistanceBand(targetDistance);
  const tuning = getDistanceTuning(targetDistance);
  const absoluteDistanceError = Math.abs(candidate.distance - targetDistance);
  const underDistance = Math.max(0, band.min - candidate.distance);
  const overDistance = Math.max(0, candidate.distance - band.max);
  const distancePenalty = absoluteDistanceError * tuning.distanceWeight + underDistance * 180 + overDistance * 220;
  const climbTotal = candidate.climb + candidate.descent;
  const climbDensity = climbTotal / Math.max(candidate.distance, 0.1);
  const spreadProfile = getRouteSpreadProfile(candidate);
  const qualityProfile = getRouteQualityProfile(candidate);
  const repeatPenalty = spreadProfile.repeatedNodeCount * 90 + spreadProfile.repeatedEdgeCount * 180;
  const spreadBonus = Math.min(22, (spreadProfile.spreadKm * 4 + spreadProfile.uniqueNodeRatio * 8) * tuning.spreadWeight);
  const movementQuality = qualityProfile.qualityPenalty * 4.5 + Math.max(0, spreadProfile.concentrationPenalty) * 1.35;
  if (difficulty === "easy") {
    return distancePenalty + repeatPenalty + movementQuality + climbDensity * 0.14 + candidate.climb * 0.16 - spreadBonus;
  }
  if (difficulty === "hard") {
    return distancePenalty + repeatPenalty + movementQuality - candidate.climb * 0.12 - climbDensity * 0.055 - spreadBonus;
  }
  const targetClimbDensity = 35;
  return distancePenalty + repeatPenalty + movementQuality + Math.abs(climbDensity - targetClimbDensity) * 0.08 - spreadBonus;
}

function getRouteDistanceBand(target = targetDistance) {
  const tolerance = target <= 2 ? 0.18 : target <= 3.5 ? 0.24 : 0.3;
  return {
    min: Math.max(0.5, target - tolerance),
    max: Math.min(MAX_TARGET_DISTANCE + 0.08, target + tolerance)
  };
}

function getDistanceTuning(target = targetDistance) {
  if (target <= 2) {
    return {
      spreadWeight: 0.12,
      farWeight: 0.12,
      zoneWeight: 0.18,
      turnWeight: 2.9,
      shortHopWeight: 2.6,
      clusterWeight: 1.7,
      compactWeight: 1.15,
      distanceWeight: 145,
      poolLimit: 80
    };
  }
  if (target <= 3.5) {
    return {
      spreadWeight: 0.18,
      farWeight: 0.22,
      zoneWeight: 0.32,
      turnWeight: 3.4,
      shortHopWeight: 3,
      clusterWeight: 2.5,
      compactWeight: 1.45,
      distanceWeight: 125,
      poolLimit: 100
    };
  }
  return {
    spreadWeight: 0.28,
    farWeight: 0.42,
    zoneWeight: 0.5,
    turnWeight: 3.1,
    shortHopWeight: 2.8,
    clusterWeight: 2.2,
    compactWeight: 1.35,
    distanceWeight: 110,
    poolLimit: 120
  };
}

function getCampusBounds() {
  const nodes = nodeGraph.nodes.filter((node) => Number.isFinite(node.lat) && Number.isFinite(node.lng));
  if (!nodes.length) return null;
  return {
    minLat: Math.min(...nodes.map((node) => node.lat)),
    maxLat: Math.max(...nodes.map((node) => node.lat)),
    minLng: Math.min(...nodes.map((node) => node.lng)),
    maxLng: Math.max(...nodes.map((node) => node.lng))
  };
}

function getCampusZoneKey(node) {
  const bounds = getCampusBounds();
  if (!bounds) return "unknown";
  const latRange = Math.max(0.000001, bounds.maxLat - bounds.minLat);
  const lngRange = Math.max(0.000001, bounds.maxLng - bounds.minLng);
  const row = Math.max(0, Math.min(2, Math.floor(((node.lat - bounds.minLat) / latRange) * 3)));
  const col = Math.max(0, Math.min(2, Math.floor(((node.lng - bounds.minLng) / lngRange) * 3)));
  return `${row}-${col}`;
}

function getTurnAngleDegrees(prev, current, next) {
  const ax = current.lng - prev.lng;
  const ay = current.lat - prev.lat;
  const bx = next.lng - current.lng;
  const by = next.lat - current.lat;
  const aLength = Math.hypot(ax, ay);
  const bLength = Math.hypot(bx, by);
  if (!aLength || !bLength) return 0;
  const dot = (ax * bx + ay * by) / (aLength * bLength);
  return Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
}

function getRouteQualityProfile(candidate) {
  if (candidate._qualityProfile) return candidate._qualityProfile;
  const tuning = getDistanceTuning(targetDistance);

  const nodesById = new Map(nodeGraph.nodes.map((node) => [node.id, node]));
  const routeNodes = candidate.nodeIds
    .map((id) => nodesById.get(id))
    .filter((node) => Number.isFinite(node?.lat) && Number.isFinite(node?.lng));

  if (routeNodes.length < 2) {
    candidate._qualityProfile = {
      sharpTurnPenalty: 0,
      shortHopPenalty: 0,
      clusterPenalty: 0,
      zoneBonus: 0,
      farBonus: 0,
      qualityPenalty: 0,
      zoneCount: 0,
      farthestFromStartKm: 0
    };
    return candidate._qualityProfile;
  }

  let sharpTurnPenalty = 0;
  for (let index = 1; index < routeNodes.length - 1; index += 1) {
    const angle = getTurnAngleDegrees(routeNodes[index - 1], routeNodes[index], routeNodes[index + 1]);
    if (angle > 75) sharpTurnPenalty += ((angle - 75) / 35) ** 2 * 8;
    if (angle > 125) sharpTurnPenalty += 8;
    if (angle > 155) sharpTurnPenalty += 14;
  }

  const edgeDistances = candidate.edgeSteps?.map((step) => step.edge.distanceKm || 0) || [];
  let shortHopPenalty = 0;
  let shortHopRun = 0;
  edgeDistances.forEach((distance) => {
    if (distance < 0.22) {
      shortHopPenalty += (0.22 - distance) * 85;
      shortHopRun += 1;
      if (shortHopRun >= 3) shortHopPenalty += 16;
    } else {
      shortHopRun = 0;
    }
  });

  let clusterPenalty = 0;
  for (let index = 0; index <= routeNodes.length - 4; index += 1) {
    const windowNodes = routeNodes.slice(index, index + 4);
    const lats = windowNodes.map((node) => node.lat);
    const lngs = windowNodes.map((node) => node.lng);
    const diagonal = distanceKm(
      { lat: Math.min(...lats), lng: Math.min(...lngs) },
      { lat: Math.max(...lats), lng: Math.max(...lngs) }
    );
    if (diagonal < 0.42) clusterPenalty += (0.42 - diagonal) * 32;
  }

  const zoneCount = new Set(routeNodes.map(getCampusZoneKey)).size;
  const farthestFromStartKm = Math.max(...routeNodes.map((node) => distanceKm(routeNodes[0], node)));
  sharpTurnPenalty *= tuning.turnWeight;
  shortHopPenalty *= tuning.shortHopWeight;
  clusterPenalty *= tuning.clusterWeight;
  const zoneBonus = zoneCount * 6 * tuning.zoneWeight;
  const farBonus = farthestFromStartKm * 8 * tuning.farWeight;
  const qualityPenalty = sharpTurnPenalty + shortHopPenalty + clusterPenalty - zoneBonus - farBonus;

  candidate._qualityProfile = {
    sharpTurnPenalty,
    shortHopPenalty,
    clusterPenalty,
    zoneBonus,
    farBonus,
    qualityPenalty,
    zoneCount,
    farthestFromStartKm
  };
  return candidate._qualityProfile;
}

function getRouteSpreadProfile(candidate) {
  const tuning = getDistanceTuning(targetDistance);
  const nodesById = new Map(nodeGraph.nodes.map((node) => [node.id, node]));
  const routeNodes = candidate.nodeIds
    .map((id) => nodesById.get(id))
    .filter((node) => Number.isFinite(node?.lat) && Number.isFinite(node?.lng));
  const uniqueNodeCount = new Set(candidate.nodeIds).size;
  const repeatedNodeCount = Math.max(0, candidate.nodeIds.length - uniqueNodeCount);
  const repeatedEdgeCount = Object.values(candidate.edgeUses || {})
    .reduce((sum, count) => sum + Math.max(0, count - 1), 0);

  if (routeNodes.length < 2) {
    return {
      repeatedNodeCount,
      repeatedEdgeCount,
      uniqueNodeRatio: 1,
      spreadKm: 0,
      concentrationPenalty: repeatedNodeCount + repeatedEdgeCount
    };
  }

  const lats = routeNodes.map((node) => node.lat);
  const lngs = routeNodes.map((node) => node.lng);
  const southWest = { lat: Math.min(...lats), lng: Math.min(...lngs) };
  const northEast = { lat: Math.max(...lats), lng: Math.max(...lngs) };
  const spreadKm = distanceKm(southWest, northEast);
  const uniqueNodeRatio = uniqueNodeCount / Math.max(1, candidate.nodeIds.length);
  const compactLoopPenalty = Math.max(0, targetDistance * 0.16 - spreadKm) * 2.6 * tuning.compactWeight;

  return {
    repeatedNodeCount,
    repeatedEdgeCount,
    uniqueNodeRatio,
    spreadKm,
    concentrationPenalty: repeatedNodeCount * 8 + repeatedEdgeCount * 18 + compactLoopPenalty * 4 - uniqueNodeRatio * 4 - spreadKm * 1.2 * tuning.spreadWeight
  };
}

function selectRecommendedCandidate(candidates, difficulty) {
  const band = getRouteDistanceBand(targetDistance);
  const tuning = getDistanceTuning(targetDistance);
  const distanceError = (candidate) => Math.abs(candidate.distance - targetDistance);
  const byDistance = [...candidates].sort((a, b) => distanceError(a) - distanceError(b));
  const inRange = byDistance.filter((candidate) => candidate.distance >= band.min && candidate.distance <= band.max);
  const nearRange = byDistance.filter((candidate) => distanceError(candidate) <= Math.max(0.45, targetDistance * 0.16));
  const pool = (inRange.length ? inRange : nearRange.length ? nearRange : byDistance)
    .slice(0, Math.min(tuning.poolLimit, byDistance.length));
  const climbScore = (candidate) => (candidate.climb || 0) + (candidate.descent || 0) * 0.65;
  const climbDensityScore = (candidate) => climbScore(candidate) / Math.max(candidate.distance, 0.1);
  const routeVarietyScore = (candidate) => getRouteSpreadProfile(candidate).concentrationPenalty;
  const routeQualityScore = (candidate) => getRouteQualityProfile(candidate).qualityPenalty;
  const overallScore = (candidate) => scoreGraphRoute(candidate, difficulty);
  const shapeScore = (candidate) => routeQualityScore(candidate) + Math.max(0, routeVarietyScore(candidate)) * 0.9;
  const bestShapeScore = Math.min(...pool.map(shapeScore));
  const shapeWindow = targetDistance <= 2 ? 36 : targetDistance <= 3.5 ? 48 : 62;
  const naturalPool = pool.filter((candidate) => shapeScore(candidate) <= bestShapeScore + shapeWindow);
  const rankingPool = naturalPool.length >= 6
    ? naturalPool
    : pool.slice(0, Math.min(48, pool.length));
  const distanceBucket = (candidate) => Math.round(distanceError(candidate) / 0.05);
  const compareQuality = (a, b, difficultyCompare) => {
    const distanceCompare = distanceBucket(a) - distanceBucket(b);
    const shapeCompare = shapeScore(a) - shapeScore(b);
    const rawDistanceCompare = distanceError(a) - distanceError(b);
    return distanceCompare || difficultyCompare || shapeCompare || rawDistanceCompare || overallScore(a) - overallScore(b);
  };

  if (difficulty === "easy") {
    return [...rankingPool].sort((a, b) => {
      return compareQuality(a, b, climbDensityScore(a) - climbDensityScore(b));
    })[0];
  }

  if (difficulty === "hard") {
    return [...rankingPool].sort((a, b) => {
      return compareQuality(a, b, climbDensityScore(b) - climbDensityScore(a));
    })[0];
  }

  const sortedByClimb = [...rankingPool].sort((a, b) => climbDensityScore(a) - climbDensityScore(b));
  const medianClimb = climbDensityScore(sortedByClimb[Math.floor(sortedByClimb.length / 2)]);
  return [...rankingPool].sort((a, b) => {
    const balancedClimbCompare = Math.abs(climbDensityScore(a) - medianClimb) - Math.abs(climbDensityScore(b) - medianClimb);
    return compareQuality(a, b, balancedClimbCompare);
  })[0];
}

function findRecommendedGraphRoute() {
  const startId = routeStartNodeSelect?.value;
  const endId = routeEndNodeSelect?.value;
  if (!startId || !endId) {
    setMapStatus("추천 경로를 만들려면 출발점과 도착점을 선택해 주세요.");
    return null;
  }
  if (!nodeGraph.nodes.length || !nodeGraph.edges.length) {
    setMapStatus("노드 그래프가 비어 있습니다. node_graph.json을 불러오거나 대표 노드 그래프를 저장해 주세요.");
    return null;
  }

  const adjacency = buildGraphAdjacency();
  const difficulty = slopeMode?.value || "medium";
  const distanceBand = getRouteDistanceBand(targetDistance);
  const maxDistance = distanceBand.max;
  const maxDepth = targetDistance <= 2
    ? Math.max(12, Math.ceil(targetDistance / 0.17) + 5)
    : Math.max(24, Math.ceil(targetDistance / 0.2) + 7);
  const beamLimit = targetDistance <= 2 ? 1400 : targetDistance <= 3.5 ? 2400 : 3600;
  const maxCandidateCount = targetDistance <= 2 ? 900 : targetDistance <= 3.5 ? 1400 : 2100;
  const maxNodeVisits = 1;
  const maxEdgeUses = 1;
  let states = [{
    nodeId: startId,
    nodeIds: [startId],
    edgeSteps: [],
    distance: 0,
    climb: 0,
    descent: 0,
    minAltitude: null,
    maxAltitude: null,
    visits: { [startId]: 1 },
    edgeUses: {}
  }];
  const candidates = [];

  for (let depth = 0; depth < maxDepth; depth += 1) {
    const nextStates = [];
    states.forEach((state) => {
      const neighbors = adjacency.get(state.nodeId) || [];
      neighbors.forEach((step) => {
        const lastStep = state.edgeSteps[state.edgeSteps.length - 1];
        const isImmediateBacktrack = lastStep && makeEdgeKey(lastStep.edge.from, lastStep.edge.to) === makeEdgeKey(step.edge.from, step.edge.to);
        const nextVisitCount = (state.visits[step.to] || 0) + 1;
        const canFinishAtStart = step.to === startId && endId === startId && state.edgeSteps.length >= 2;
        if (step.to === startId && !canFinishAtStart && nextVisitCount > 1) return;
        if (step.to !== endId && nextVisitCount > maxNodeVisits) return;

        const edgeKey = makeEdgeKey(step.edge.from, step.edge.to);
        const nextEdgeUseCount = (state.edgeUses[edgeKey] || 0) + 1;
        if (nextEdgeUseCount > maxEdgeUses) return;
        if (isImmediateBacktrack && nextEdgeUseCount > 1 && state.distance < targetDistance - 0.4) return;

        const nextDistance = state.distance + step.edge.distanceKm;
        if (nextDistance > maxDistance) return;

        const altitudes = String(step.edge.altitudeRange || "")
          .match(/-?\d+/g)
          ?.map(Number) || [];
        const edgeMin = altitudes.length >= 2 ? Math.min(...altitudes) : null;
        const edgeMax = altitudes.length >= 2 ? Math.max(...altitudes) : null;
        const nextState = {
          nodeId: step.to,
          nodeIds: [...state.nodeIds, step.to],
          edgeSteps: [...state.edgeSteps, step],
          distance: nextDistance,
          climb: state.climb + (step.edge.climbM || 0),
          descent: state.descent + (step.edge.descentM || 0),
          minAltitude: Number.isFinite(state.minAltitude) && Number.isFinite(edgeMin) ? Math.min(state.minAltitude, edgeMin) : edgeMin ?? state.minAltitude,
          maxAltitude: Number.isFinite(state.maxAltitude) && Number.isFinite(edgeMax) ? Math.max(state.maxAltitude, edgeMax) : edgeMax ?? state.maxAltitude,
          visits: { ...state.visits, [step.to]: nextVisitCount },
          edgeUses: { ...state.edgeUses, [edgeKey]: nextEdgeUseCount }
        };

        if (step.to === endId && nextState.edgeSteps.length >= 1) {
          candidates.push(nextState);
          if (candidates.length > maxCandidateCount) {
            candidates.sort((a, b) => {
              const scoreCompare = scoreGraphRoute(a, difficulty) - scoreGraphRoute(b, difficulty);
              const qualityCompare = getRouteQualityProfile(a).qualityPenalty - getRouteQualityProfile(b).qualityPenalty;
              const spreadCompare = getRouteSpreadProfile(a).concentrationPenalty - getRouteSpreadProfile(b).concentrationPenalty;
              return scoreCompare || qualityCompare || spreadCompare;
            });
            candidates.length = Math.floor(maxCandidateCount * 0.75);
          }
        }
        const shouldKeepExploring = step.to !== endId && nextState.distance < distanceBand.max;
        if (shouldKeepExploring) {
          nextStates.push(nextState);
        }
      });
    });

    states = nextStates
      .sort((a, b) => {
        const aSpread = getRouteSpreadProfile(a);
        const bSpread = getRouteSpreadProfile(b);
        const scoreCompare = scoreGraphRoute(a, difficulty) - scoreGraphRoute(b, difficulty);
        const qualityCompare = getRouteQualityProfile(a).qualityPenalty - getRouteQualityProfile(b).qualityPenalty;
        const varietyCompare = aSpread.concentrationPenalty - bSpread.concentrationPenalty;
        return scoreCompare || qualityCompare || varietyCompare;
      })
      .slice(0, beamLimit);
    if (!states.length) break;
  }

  if (!candidates.length) {
    setMapStatus("선택한 출발점과 도착점 사이에서 목표 거리 조건에 맞는 경로를 찾지 못했습니다.");
    return null;
  }

  const best = selectRecommendedCandidate(candidates, difficulty);
  const spreadProfile = getRouteSpreadProfile(best);
  const qualityProfile = getRouteQualityProfile(best);
  const nodesById = new Map(nodeGraph.nodes.map((node) => [node.id, node]));
  const fullPath = [];
  best.edgeSteps.forEach((step, stepIndex) => {
    const path = orientedEdgePath(step.edge, step.reversed);
    path.forEach((point, pointIndex) => {
      if (stepIndex > 0 && pointIndex === 0) return;
      fullPath.push(point);
    });
  });

  const difficultyLabel = {
    easy: "쉬움",
    medium: "중간",
    hard: "어려움"
  }[difficulty] || "중간";
  const startNode = nodesById.get(startId);
  const endNode = nodesById.get(endId);
  const fullStats = getElevationStats(fullPath);
  const routeDistance = getPathDistance(fullPath) || best.distance;
  const targetMatch = getTargetMatchInfo(routeDistance);
  const svgPoints = fullPath.map(latlngToSvgXY);
  const stops = best.nodeIds.map((id) => {
    const node = nodesById.get(id);
    return node ? {
      id,
      name: node.name,
      lat: node.lat,
      lng: node.lng,
      altitude: node.altitude
    } : { id, name: id };
  });
  const guideSegments = best.edgeSteps.map((step, index) => {
    const fromId = best.nodeIds[index];
    const toId = best.nodeIds[index + 1];
    return {
      from: nodesById.get(fromId)?.name || fromId,
      to: nodesById.get(toId)?.name || toId,
      distance: step.edge.distanceKm || getPathDistance(orientedEdgePath(step.edge, step.reversed)),
      climb: step.edge.climbM || 0,
      descent: step.edge.descentM || 0
    };
  });

  return {
    name: `${startNode?.name || startId} → ${endNode?.name || endId} ${formatTargetDistance()} km 이내 · 실제 ${routeDistance.toFixed(3)} km ${difficultyLabel} 추천 코스`,
    distance: routeDistance,
    targetDistance,
    targetMatch,
    climb: fullStats.climb || best.climb,
    descent: fullStats.descent || best.descent,
    minAltitude: Number.isFinite(fullStats.minAltitude) ? fullStats.minAltitude : best.minAltitude,
    maxAltitude: Number.isFinite(fullStats.maxAltitude) ? fullStats.maxAltitude : best.maxAltitude,
    level: difficultyLabel,
    path: svgPoints.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" "),
    points: best.nodeIds.map((id) => {
      const node = nodesById.get(id);
      return node ? latlngToSvgXY(node) : [0, 0];
    }),
    stops,
    guideSegments,
    spreadProfile,
    qualityProfile,
    latlng: fullPath.map((point) => [point.lat, point.lng]),
    description: best.nodeIds.map((id) => nodesById.get(id)?.name || id).join(" → ")
  };
}

function recommendGraphRoute() {
  const route = findRecommendedGraphRoute();
  if (!route) return;
  renderRoute(route);
  const match = route.targetMatch || getTargetMatchInfo(route.distance);
  const spreadText = route.spreadProfile
    ? `, 동선 분산 약 ${route.spreadProfile.spreadKm.toFixed(2)} km, 반복 구간 ${route.spreadProfile.repeatedEdgeCount}개`
    : "";
  const qualityText = route.qualityProfile
    ? `, 통과 구역 ${route.qualityProfile.zoneCount}개, 출발점 기준 최대 이격 ${route.qualityProfile.farthestFromStartKm.toFixed(2)} km`
    : "";
  setMapStatus(`${route.level} 난이도 추천 경로를 만들었습니다. ${formatTargetDistance(route.targetDistance || targetDistance)} km 이내 / 실제 ${route.distance.toFixed(3)} km (${match.grade}), 누적 상승/하강 ${formatElevationChange(route.climb, route.descent)}, 고도 범위 ${formatAltitudeRange(route.minAltitude, route.maxAltitude)}${spreadText}${qualityText}.`);
}

function drawPoints(points) {
  const grouped = points.reduce((groups, [x, y], index) => {
    const key = `${Math.round(x)},${Math.round(y)}`;
    if (!groups.has(key)) groups.set(key, { x, y, indexes: [] });
    groups.get(key).indexes.push(index + 1);
    return groups;
  }, new Map());

  routePoints.innerHTML = [...grouped.values()]
    .map(({ x, y, indexes }) => {
      const endClass = indexes.includes(points.length) ? " end" : "";
      const label = indexes.join("/");
      return `
        <circle class="route-point recommended${endClass}" cx="${x}" cy="${y}" r="14"></circle>
        <text class="graph-node-label" x="${x}" y="${y + 4}" text-anchor="middle">${label}</text>
      `;
    })
    .join("");
}

function renderRouteGuide(route) {
  if (!route?.stops?.length) return;
  nodeOrder.textContent = `추천 방문 순서: ${route.stops.map((stop, index) => `${index + 1}. ${stop.name}`).join(" → ")}`;
  segmentList.innerHTML = (route.guideSegments || []).map((segment, index) => `
    <div class="segment-item">
      <span>${index + 1}구간<em>${segment.from} → ${segment.to}</em></span>
      <strong>${segment.distance.toFixed(3)} km<br>${formatElevationChange(segment.climb, segment.descent)}</strong>
    </div>
  `).join("");
  if (mapSegmentSummary) {
    mapSegmentSummary.textContent = `추천 경로 순서: ${route.stops.map((stop, index) => `${index + 1}. ${stop.name}`).join(" → ")} / 총 ${route.distance.toFixed(3)} km`;
  }
}

function clearNaverRoute() {
  naverMarkers.forEach((marker) => marker.setMap(null));
  naverMarkers = [];
  if (naverPolyline) {
    naverPolyline.setMap(null);
    naverPolyline = null;
  }
}

function clearRoute(message = "노드를 선택하면 경로가 표시됩니다.") {
  routePath.setAttribute("d", "");
  routePoints.innerHTML = "";
  document.querySelector("#routeName").textContent = message;
  document.querySelector("#routeBadge").textContent = "대기 중";
  updateNodeStats(measuredTrack.length ? "노드 확인" : "대기");
  clearNaverRoute();
}

function renderRoute(route) {
  if (!route) {
    clearRoute();
    return;
  }

  routePath.setAttribute("d", route.path);
  drawPoints(route.points);
  const match = route.targetMatch || getTargetMatchInfo(route.distance);
  document.querySelector("#routeName").textContent = route.name;
  document.querySelector("#routeBadge").textContent = match.grade;
  document.querySelector("#metricDistance").textContent = `${route.distance.toFixed(3)} km`;
  document.querySelector("#metricTime").textContent = formatTime(route.distance, paceInput?.value || 6);
  document.querySelector("#metricClimb").textContent = formatElevationChange(route.climb || 0, route.descent || 0);
  document.querySelector("#metricLevel").textContent = formatAltitudeRange(route.minAltitude, route.maxAltitude);

  renderRouteGuide(route);
  updateNaverRoute(route);
}

function updateCustomRoute() {
  renderRoute(getCustomRoute(), { custom: true });
}

function setTargetDistance(distance) {
  targetDistance = Math.min(MAX_TARGET_DISTANCE, Number(distance));
  if (targetDistanceInput && Number(targetDistanceInput.value) !== targetDistance) {
    targetDistanceInput.value = String(targetDistance);
  }
  if (targetDistanceValue) targetDistanceValue.textContent = formatTargetDistance(targetDistance);
  if (selectedNodeIds.length < 2) {
    document.querySelector("#routeBadge").textContent = `${formatTargetDistance()} km 기준`;
    document.querySelector("#metricTime").textContent = formatTime(targetDistance, paceInput?.value || 6);
  }
}

function renderNodePicker() {
  if (!selectedNodeIds.length) {
    nodePicker.innerHTML = `<div class="node-order">네이버 지도 위 빨간 실측 경로를 클릭하면 노드가 여기에 추가됩니다.</div>`;
    return;
  }

  nodePicker.innerHTML = `
    <div class="node-group-title">선택한 노드</div>
    ${selectedNodeIds.map((id, index) => {
      const node = campusNodes[id];
      return `
        <button class="node-option selected-node-button" data-node-id="${id}">
          <span>${index + 1}. ${node.name}</span>
          <b class="delete-node" data-node-id="${id}" aria-label="노드 삭제">삭제</b>
        </button>
      `;
    }).join("")}
  `;

  nodePicker.querySelectorAll(".delete-node").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      removeSelectedNode(button.dataset.nodeId);
    });
  });

  nodePicker.querySelectorAll(".selected-node-button").forEach((button) => {
    button.addEventListener("click", () => {
      showNodeTooltip(button.dataset.nodeId);
      showNaverNodeInfo(button.dataset.nodeId);
    });
  });
}

function updateNodeOrder() {
  if (!selectedNodeIds.length) {
    document.querySelector("#routeName").textContent = measuredTrack.length
      ? `실측 경로 위에서 노드 ${nodeLimit.value}개를 선택해 주세요.`
      : "실측 경로 위 노드를 선택해 주세요.";
    document.querySelector("#routeBadge").textContent = targetDistance ? `${formatTargetDistance()} km 기준` : measuredTrack.length ? "노드 표시" : "대기 중";
    nodeOrder.textContent = "선택 순서: 아직 선택된 노드가 없습니다.";
    segmentList.textContent = `노드를 ${nodeLimit.value}개까지 선택할 수 있습니다. 첫 노드는 출발점, 마지막 노드는 도착점입니다.`;
    updateMapSegmentSummary();
    return;
  }

  document.querySelector("#routeName").textContent = `실측 노드 ${selectedNodeIds.length}개 선택됨`;
  document.querySelector("#routeBadge").textContent = selectedNodeIds.length >= 2 ? "실측 기반" : "노드 확인";
  nodeOrder.textContent = `선택 순서: ${selectedNodeIds.map((id, index) => `${index + 1}. ${campusNodes[id].name}`).join(" → ")}`;
  const segments = getSelectedSegments();
  if (!segments.length) {
    segmentList.textContent = "노드를 1개 더 선택하면 선택한 두 노드 사이의 실측 거리가 표시됩니다.";
    updateMapSegmentSummary();
    return;
  }

  segmentList.innerHTML = segments.map((segment) => `
    <div class="segment-item">
      <span>${segment.direct ? "경로 간 연결" : "실측 구간"}<em>${segment.from} → ${segment.to}</em><em>${segment.direct ? "서로 다른 로그라 직선 거리 기준" : "GNSS 로그 구간 기준"}</em></span>
      <strong>${segment.distance.toFixed(3)} km<br>${formatElevationChange(segment.climb || 0, segment.descent || 0)}</strong>
    </div>
  `).join("");
  updateMapSegmentSummary();
}

function updateMapSegmentSummary() {
  if (!mapSegmentSummary) return;
  if (!measuredTrack.length) {
    mapSegmentSummary.textContent = "실측 GNSS 경로를 불러오면 선택 가능한 노드가 지도 위에 표시됩니다.";
    return;
  }
  const segments = getSelectedSegments();
  if (!segments.length) {
    mapSegmentSummary.textContent = `불러온 좌표 ${measuredTrack.length}개 중 선택 가능한 노드 ${selectableMeasuredNodes.length}개를 표시했습니다. 현재 ${selectedNodeIds.length}/${nodeLimit.value}개 선택됨.`;
    return;
  }
  const total = segments.reduce((sum, segment) => sum + segment.distance, 0);
  const climb = segments.reduce((sum, segment) => sum + (segment.climb || 0), 0);
  const descent = segments.reduce((sum, segment) => sum + (segment.descent || 0), 0);
  const directCount = segments.filter((segment) => segment.direct).length;
  const altitudes = segments
    .flatMap((segment) => [segment.minAltitude, segment.maxAltitude])
    .filter(Number.isFinite);
  const altitudeText = altitudes.length
    ? `, 고도 ${formatAltitudeRange(Math.min(...altitudes), Math.max(...altitudes))}`
    : "";
  mapSegmentSummary.textContent = `선택한 노드 순서 기준 총 거리: ${total.toFixed(3)} km, 누적 상승/하강 ${formatElevationChange(climb, descent)}${altitudeText} (${selectedNodeIds.length}/${nodeLimit.value}개 선택됨${directCount ? `, 직선 연결 ${directCount}개 포함` : ""})`;
}

async function loadMeasuredNodes() {
  if (isMeasuredTrackVisible) {
    isMeasuredTrackVisible = false;
    clearMeasuredOverlay();
    updateOverlayButtons();
    updateNodeStats("GNSS OFF");
    setMapStatus("실측 GNSS 경로 표시를 껐습니다. 대표 노드는 그대로 유지됩니다.");
    return;
  }

  isMeasuredTrackVisible = true;
  updateOverlayButtons();
  setMapStatus("GNSS CSV를 불러오는 중입니다.");

  const track = measuredTrack.length ? measuredTrack : await loadMeasuredTrack();
  if (!selectableMeasuredNodes.length) selectableMeasuredNodes = buildSelectableMeasuredNodes(track);
  renderMeasuredBasePath();
  renderNaverMeasuredTrack();
  renderGraphOverlay();
  campusNodes = { ...baseCampusNodes };
  selectedNodeIds = [];
  renderNodePicker();
  renderMeasuredNodes();
  clearRoute(`실측 경로 위에서 노드 ${nodeLimit.value}개를 선택해 주세요.`);
  updateNodeOrder();
  updateOverlayButtons();
  updateNodeStats("노드 표시");
  setMapStatus(`GNSS 로그 ${track.length}개 좌표를 불러왔고, 선택 가능한 노드 ${selectableMeasuredNodes.length}개를 표시했습니다.`);
}

async function showGraphOverlay() {
  if (isGraphOverlayVisible) {
    isGraphOverlayVisible = false;
    renderDefaultGraphNodes();
    updateOverlayButtons();
    setMapStatus("연결 구간 표시를 껐습니다. 대표 노드만 표시합니다.");
    return;
  }

  if (!nodeGraph.nodes.length && !nodeGraph.edges.length) {
    await loadDefaultNodeGraphFile();
  }
  if (!nodeGraph.nodes.length && !nodeGraph.edges.length) {
    setMapStatus("표시할 연결 노드 데이터가 없습니다. node_graph.json을 확인해 주세요.");
    return;
  }
  isGraphOverlayVisible = true;
  renderGraphOverlay();
  updateOverlayButtons();
  setMapStatus(`대표 노드 ${nodeGraph.nodes.length}개와 연결 구간 ${nodeGraph.edges.length}개를 지도에 표시했습니다.`);
}

function loadNaverScript(clientId) {
  return new Promise((resolve, reject) => {
    if (window.naver?.maps) {
      resolve();
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

function updateNaverRoute(route) {
  if (!naverMap || !window.naver?.maps || !route.latlng.length) {
    setMapStatus("추천 경로를 만들었습니다. 네이버 지도에서 보려면 먼저 지도 불러오기를 눌러 주세요.");
    return;
  }

  clearNaverRoute();
  const path = route.latlng.map(([lat, lng]) => new naver.maps.LatLng(lat, lng));
  naverPolyline = new naver.maps.Polyline({
    map: naverMap,
    path,
    strokeColor: "#17a673",
    strokeOpacity: 0.96,
    strokeWeight: 10,
    strokeLineCap: "round",
    strokeLineJoin: "round",
    zIndex: 60000
  });

  sampleEdgeDotPoints(route.latlng.map(([lat, lng]) => ({ lat, lng })), 18, 180).forEach((point) => {
    naverMarkers.push(new naver.maps.Marker({
      map: naverMap,
      position: new naver.maps.LatLng(point.lat, point.lng),
      icon: {
        content: `
          <div style="
            width:13px;height:13px;border-radius:50%;
            background:#17a673;border:3px solid #ffffff;
            box-shadow:0 2px 8px rgba(0,0,0,.28);
            box-sizing:border-box;"></div>
        `,
        anchor: new naver.maps.Point(6, 6)
      },
      zIndex: 61000
    }));
  });

  const stops = route.stops?.length
    ? route.stops
    : [
      { name: "출발", lat: route.latlng[0][0], lng: route.latlng[0][1] },
      { name: "도착", lat: route.latlng[route.latlng.length - 1][0], lng: route.latlng[route.latlng.length - 1][1] }
    ];
  const groupedStops = stops.reduce((groups, stop, index) => {
    const key = `${stop.lat.toFixed(6)},${stop.lng.toFixed(6)}`;
    if (!groups.has(key)) groups.set(key, { ...stop, indexes: [] });
    groups.get(key).indexes.push(index + 1);
    return groups;
  }, new Map());
  [...groupedStops.values()].forEach((stop) => {
    const isLast = stop.indexes.includes(stops.length);
    const label = stop.indexes.join("/");
    naverMarkers.push(new naver.maps.Marker({
      map: naverMap,
      position: new naver.maps.LatLng(stop.lat, stop.lng),
      title: `${label}. ${stop.name}`,
      icon: {
        content: `
          <div style="
            display:flex;align-items:center;justify-content:center;
            min-width:34px;height:34px;padding:0 8px;border-radius:999px;
            background:#17a673;color:#ffffff;border:4px solid #ffffff;
            box-shadow:0 4px 12px rgba(0,0,0,.3);
            font-size:15px;font-weight:900;">
            ${label}
          </div>
        `,
        anchor: new naver.maps.Point(17, 17)
      },
      zIndex: 62000
    }));
  });

  const bounds = new naver.maps.LatLngBounds(path[0], path[0]);
  path.forEach((position) => bounds.extend(position));
  naverMap.fitBounds(bounds, { top: 72, right: 72, bottom: 72, left: 72 });
}

function nearestMeasuredPointByLatLng(latlng) {
  if (!measuredTrack.length) return { point: null, distance: Infinity };
  return measuredTrack.reduce((best, point) => {
    const distance = distanceKm(
      { lat: latlng[0], lng: latlng[1] },
      { lat: point.lat, lng: point.lng }
    );
    return distance < best.distance ? { point, distance } : best;
  }, { point: null, distance: Infinity });
}

function renderNaverMeasuredTrack() {
  if (!window.naver?.maps) {
    setMapStatus("네이버 지도 API가 아직 로드되지 않았습니다.");
    return;
  }
  if (!naverMap) {
    setMapStatus("네이버 지도를 먼저 불러와 주세요.");
    return;
  }
  if (!measuredTrack.length) {
    setMapStatus("GNSS 로그를 먼저 불러와 주세요.");
    return;
  }

  if (naverMeasuredPolyline) {
    naverMeasuredPolyline.setMap(null);
    naverMeasuredPolyline = null;
  }
  naverMeasuredPolylines.forEach((polyline) => polyline.setMap(null));
  naverMeasuredPolylines = [];
  naverMeasuredDots.forEach((dot) => dot.setMap(null));
  naverMeasuredDots = [];

  const groupedTracks = [...measuredTrack.reduce((groups, point) => {
    const key = point.source || "measured";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(point);
    return groups;
  }, new Map()).values()];

  groupedTracks.forEach((track) => {
    const path = track.map((point) => new naver.maps.LatLng(point.lat, point.lng));
    const polyline = new naver.maps.Polyline({
      map: naverMap,
      path,
      strokeColor: "#ff3b30",
      strokeOpacity: 1,
      strokeWeight: 10,
      strokeLineCap: "round",
      strokeLineJoin: "round",
      clickable: true
    });
    naver.maps.Event.addListener(polyline, "click", (event) => {
      const latlng = [event.coord.lat(), event.coord.lng()];
      const nearest = nearestMeasuredPointByLatLng(latlng);
      if (nearest.point) {
        const [x, y] = latlngToSvgXY(nearest.point);
        addMeasuredNodeFromPoint({
          ...nearest.point,
          x,
          y
        });
      }
    });
    naverMeasuredPolylines.push(polyline);
  });

  // 일부 환경에서 Polyline이 지도 타일 위에서 눈에 잘 안 띄는 경우가 있어,
  // GNSS 궤적을 작은 빨간 점으로도 함께 표시한다.
  const measuredDotLimit = 450;
  const measuredDotStride = Math.max(1, Math.ceil(selectableMeasuredNodes.length / measuredDotLimit));
  selectableMeasuredNodes.forEach((point, index) => {
    if (index % measuredDotStride !== 0 && index !== selectableMeasuredNodes.length - 1) return;
    const dot = new naver.maps.Marker({
      map: naverMap,
      position: new naver.maps.LatLng(point.lat, point.lng),
      icon: {
        content: `
          <div style="
            width:12px;height:12px;border-radius:50%;
            background:#ffffff;border:3px solid #ff3b30;
            box-shadow:0 0 0 2px rgba(255,59,48,.18);"></div>
        `,
        anchor: new naver.maps.Point(6, 6)
      }
    });
    naver.maps.Event.addListener(dot, "click", () => {
      const [x, y] = latlngToSvgXY(point);
      addMeasuredNodeFromPoint({ ...point, x, y });
    });
    naverMeasuredDots.push(dot);
  });

  const path = measuredTrack.map((point) => new naver.maps.LatLng(point.lat, point.lng));
  const bounds = new naver.maps.LatLngBounds(path[0], path[0]);
  path.forEach((position) => bounds.extend(position));
  naverMap.fitBounds(bounds);
  naverMap.setZoom(Math.max(naverMap.getZoom(), 17));
  setTimeout(() => {
    naverMeasuredPolylines.forEach((polyline) => {
      polyline.setMap(naverMap);
      polyline.setOptions({
        strokeColor: "#ff3b30",
        strokeOpacity: 1,
        strokeWeight: 10
      });
    });
    renderNaverGraphOverlay();
  }, 300);
  setMapStatus(`네이버 지도 위에 실측 경로 ${groupedTracks.length}개와 선택 가능한 노드 ${selectableMeasuredNodes.length}개를 불러왔습니다. 화면 렉 방지를 위해 빨간 점은 일부만 표시합니다.`);
  updateNodeStats("노드 표시");
}

function renderNaverMeasuredNodes() {
  if (!naverMap || !window.naver?.maps) return;

  naverMeasuredMarkers.forEach((marker) => marker.setMap(null));
  naverMeasuredMarkers = [];

  selectedNodeIds
    .filter((id) => campusNodes[id]?.type === "실측 노드")
    .forEach((id, index) => {
      const node = campusNodes[id];
      const marker = new naver.maps.Marker({
        map: naverMap,
        position: new naver.maps.LatLng(node.latlng[0], node.latlng[1]),
        title: node.placeLabel || node.name,
        icon: {
          content: `
            <div style="
              width:28px;height:28px;border-radius:50%;
              background:#17a673;color:white;border:3px solid white;
              box-shadow:0 4px 10px rgba(0,0,0,.25);
              display:flex;align-items:center;justify-content:center;
              font-weight:900;font-size:14px;">${index + 1}</div>
          `,
          anchor: new naver.maps.Point(14, 14)
        }
      });
      naver.maps.Event.addListener(marker, "click", () => {
        showNaverNodeInfo(id);
        updateNodeOrder();
        updateMapSegmentSummary();
        updateNodeStats("선택됨");
      });
      naverMeasuredMarkers.push(marker);
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
      if (naverInfoWindow) naverInfoWindow.close();
      if (!measuredTrack.length) return;
      const nearest = nearestMeasuredPointByLatLng([event.coord.lat(), event.coord.lng()]);
      if (!nearest.point || nearest.distance > 0.035) return;
      const [x, y] = latlngToSvgXY(nearest.point);
      addMeasuredNodeFromPoint({ ...nearest.point, x, y });
    });
    naver.maps.Event.addListener(naverMap, "zoom_changed", scheduleNaverGraphOverlayRender);
    naver.maps.Event.trigger(naverMap, "resize");
    setTimeout(() => naver.maps.Event.trigger(naverMap, "resize"), 200);
    if (isMeasuredTrackVisible && measuredTrack.length) {
      renderNaverMeasuredTrack();
      renderNaverMeasuredNodes();
    }
    renderGraphOverlay();
    updateNodeStats(measuredTrack.length ? "노드 표시" : "지도 연결");
    loadNaverMapButton.textContent = "지도 연결됨";
    setMapStatus(measuredTrack.length ? "지도 연결됨. 실측 경로를 다시 표시했습니다." : "지도 연결됨. 이제 실측 GNSS 노드 불러오기를 눌러 주세요.");
  } catch {
    loadNaverMapButton.textContent = "키 확인 필요";
    loadNaverMapButton.disabled = false;
  }
}

paceInput?.addEventListener("input", () => {
  if (paceValue) paceValue.textContent = formatPace(paceInput.value);
  if (selectedNodeIds.length >= 2) updateCustomRoute();
  else document.querySelector("#metricTime").textContent = formatTime(targetDistance, paceInput.value);
});

targetDistanceInput?.addEventListener("input", () => {
  setTargetDistance(targetDistanceInput.value);
  if (selectedNodeIds.length >= 2) updateCustomRoute();
});

slopeMode?.addEventListener("change", () => {
  if (selectedNodeIds.length < 2) {
    document.querySelector("#routeBadge").textContent = targetDistance ? `${formatTargetDistance()} km 기준` : "대기 중";
  }
});
recommendGraphRouteButton?.addEventListener("click", recommendGraphRoute);

saveGraphNodeButton?.addEventListener("click", saveSelectedGraphNode);
saveGraphEdgeButton?.addEventListener("click", saveSelectedGraphEdges);
autoConnectGraphButton?.addEventListener("click", autoConnectGraphNodes);
clearGraphButton?.addEventListener("click", clearNodeGraph);
exportGraphButton?.addEventListener("click", exportNodeGraph);
importGraphButton?.addEventListener("click", () => importGraphFileInput?.click());
importGraphFileInput?.addEventListener("change", () => {
  importNodeGraphFile(importGraphFileInput.files?.[0]);
  importGraphFileInput.value = "";
});

loadMeasuredNodesButton.addEventListener("click", loadMeasuredNodes);
showGraphOverlayButton?.addEventListener("click", showGraphOverlay);
loadNaverMapButton.addEventListener("click", initNaverMap);
measuredLogSelect?.addEventListener("change", () => {
  isMeasuredTrackVisible = false;
  measuredTrack = [];
  svgMeasuredPoints = [];
  selectableMeasuredNodes = [];
  campusNodes = { ...baseCampusNodes };
  selectedNodeIds = [];
  renderNodePicker();
  renderMeasuredNodes();
  renderNaverMeasuredNodes();
  clearMeasuredOverlay();
  updateOverlayButtons();
  updateNodeOrder();
  clearRoute("실측 로그를 바꿨습니다. 실측 GNSS 노드 불러오기를 다시 눌러 주세요.");
  updateNodeStats("로그 변경");
  setMapStatus("실측 로그를 바꿨습니다. 다시 불러오면 지도에 새 경로가 표시됩니다.");
});
nodeLimit.addEventListener("change", () => {
  selectedNodeIds = [];
  campusNodes = { ...baseCampusNodes };
  renderNodePicker();
  renderMeasuredNodes();
  renderNaverMeasuredNodes();
  updateNodeOrder();
  clearRoute(`실측 경로 위에서 노드 ${nodeLimit.value}개를 선택해 주세요.`);
  updateNodeStats("개수 변경");
});
measuredBasePath.addEventListener("click", (event) => {
  if (!measuredTrack.length) return;
  const [x, y] = svgPointFromEvent(event);
  const nearest = nearestMeasuredPointBySvg(x, y);
  if (nearest.point && nearest.distance < 45) {
    addMeasuredNodeFromPoint(nearest.point);
  }
});

const savedClientId = localStorage.getItem("naverMapClientId");
if (savedClientId) {
  naverClientId.value = savedClientId;
}

setTargetDistance(targetDistance);
renderNodePicker();
updateNodeOrder();
clearRoute("네이버 지도 위 실측 경로를 불러온 뒤 경로 위를 클릭해 주세요.");
updateNodeStats("대기");
renderGraphNodeSelects();
renderGraphDocument();
renderDefaultGraphNodes();
updateOverlayButtons();
loadDefaultNodeGraphFile();
