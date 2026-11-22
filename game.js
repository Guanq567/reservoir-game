const canvas = document.querySelector("#game-canvas");
const ctx = canvas.getContext("2d");
const statusText = document.querySelector("#status-text");
const moveCount = document.querySelector("#move-count");
const turnIndicator = document.querySelector("#turn-indicator");
const currentPlayerLabel = document.querySelector("#current-player");
const levelTitle = document.querySelector("#level-title");
const message = document.querySelector("#message");
const resetButton = document.querySelector("#reset-button");
const undoButton = document.querySelector("#undo-button");
const noMoveButton = document.querySelector("#no-move-button");
const levelButtons = [...document.querySelectorAll(".level-button")];

const MAX_DEGREE = 3;
const NODE_RADIUS = 13;
const MIN_NODE_DISTANCE = 28;
const EPSILON = 0.0001;

const LEVELS = [
  {
    title: "第 1 关：三点萌芽",
    nodes: [
      { x: 235, y: 165 },
      { x: 665, y: 165 },
      { x: 450, y: 405 },
    ],
  },
  {
    title: "第 2 关：四点方阵",
    nodes: [
      { x: 235, y: 145 },
      { x: 665, y: 145 },
      { x: 665, y: 405 },
      { x: 235, y: 405 },
    ],
  },
  {
    title: "第 3 关：五点环路",
    nodes: [
      { x: 450, y: 95 },
      { x: 700, y: 220 },
      { x: 600, y: 435 },
      { x: 300, y: 435 },
      { x: 200, y: 220 },
    ],
  },
  {
    title: "第 4 关：六点网络",
    nodes: [
      { x: 450, y: 85 },
      { x: 700, y: 170 },
      { x: 700, y: 400 },
      { x: 450, y: 475 },
      { x: 200, y: 400 },
      { x: 200, y: 170 },
    ],
  },
];

let levelIndex = 0;
let nodes;
let edges;
let selectedFirstId;
let selectedSecondId;
let moves;
let currentPlayer;
let winner;
let gameOver;
let moveHistory;

function resetGame() {
  const level = LEVELS[levelIndex];
  nodes = level.nodes.map((point, id) => ({ id, ...point, degree: 0 }));
  edges = [];
  selectedFirstId = null;
  selectedSecondId = null;
  moves = 0;
  currentPlayer = "A";
  winner = null;
  gameOver = false;
  moveHistory = [];
  setMessage("A 先手：点击一个蓝色圆点。");
  updateUi();
  draw();
}

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = "message" + (type ? " " + type : "");
}

function updateUi() {
  moveCount.textContent = String(moves);
  levelTitle.textContent = LEVELS[levelIndex].title;
  currentPlayerLabel.textContent = currentPlayer;
  turnIndicator.classList.toggle("turn-a", currentPlayer === "A");
  turnIndicator.classList.toggle("turn-b", currentPlayer === "B");
  if (gameOver) {
    statusText.textContent = `${winner} 获胜！`;
  } else if (selectedFirstId === null) {
    statusText.textContent = `当前回合：${currentPlayer}，请选择起点`;
  } else if (selectedSecondId === null) {
    statusText.textContent = `当前回合：${currentPlayer}，请选择终点`;
  } else {
    statusText.textContent = `当前回合：${currentPlayer}，请点击空白处放置新点`;
  }

  undoButton.disabled = moveHistory.length === 0 && selectedFirstId === null;
  noMoveButton.disabled = gameOver;
  levelButtons.forEach((button, index) => {
    button.classList.toggle("active", index === levelIndex);
  });
}

function getPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * canvas.width / rect.width,
    y: (event.clientY - rect.top) * canvas.height / rect.height,
  };
}

function findNodeAt(point) {
  return nodes.find((node) => Math.hypot(node.x - point.x, node.y - point.y) <= NODE_RADIUS + 6);
}

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function orientation(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a, b, p) {
  return Math.min(a.x, b.x) - EPSILON <= p.x && p.x <= Math.max(a.x, b.x) + EPSILON &&
    Math.min(a.y, b.y) - EPSILON <= p.y && p.y <= Math.max(a.y, b.y) + EPSILON &&
    Math.abs(orientation(a, b, p)) <= EPSILON;
}

function segmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);

  if (((o1 > EPSILON && o2 < -EPSILON) || (o1 < -EPSILON && o2 > EPSILON)) &&
      ((o3 > EPSILON && o4 < -EPSILON) || (o3 < -EPSILON && o4 > EPSILON))) {
    return true;
  }
  return (Math.abs(o1) <= EPSILON && onSegment(a, b, c)) ||
    (Math.abs(o2) <= EPSILON && onSegment(a, b, d)) ||
    (Math.abs(o3) <= EPSILON && onSegment(c, d, a)) ||
    (Math.abs(o4) <= EPSILON && onSegment(c, d, b));
}

function samePoint(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y) <= EPSILON;
}

function hasOnlyAllowedEndpointContact(start, end, existingStart, existingEnd, allowedPoint) {
  if (!allowedPoint) return false;
  if (!samePoint(existingStart, allowedPoint) && onSegment(start, end, existingStart)) return false;
  if (!samePoint(existingEnd, allowedPoint) && onSegment(start, end, existingEnd)) return false;
  if (!samePoint(start, allowedPoint) && onSegment(existingStart, existingEnd, start)) return false;
  if (!samePoint(end, allowedPoint) && onSegment(existingStart, existingEnd, end)) return false;
  return true;
}

function segmentHasIllegalIntersection(start, end, startId, endId, segment) {
  const existingStart = nodes.find((node) => node.id === segment.a);
  const existingEnd = nodes.find((node) => node.id === segment.b);
  if (!segmentsIntersect(start, end, existingStart, existingEnd)) return false;

  const sharesStart = startId === segment.a || startId === segment.b;
  const sharesEnd = endId === segment.a || endId === segment.b;
  if (!sharesStart && !sharesEnd) return true;

  const allowedPoint = sharesStart ? start : end;
  return !hasOnlyAllowedEndpointContact(start, end, existingStart, existingEnd, allowedPoint);
}

function isValidMove(first, second, newNode) {
  if (first.id === second.id) return "起点和终点必须是两个不同的点。";
  if (first.degree >= MAX_DEGREE || second.degree >= MAX_DEGREE) {
    return "起点或终点已经达到 3 条连接。";
  }

  for (const node of nodes) {
    if (Math.hypot(node.x - newNode.x, node.y - newNode.y) < MIN_NODE_DISTANCE) {
      return "新点离已有点太近。";
    }
  }

  const newSegments = [
    { start: first, end: newNode, startId: first.id, endId: newNode.id },
    { start: newNode, end: second, startId: newNode.id, endId: second.id },
  ];

  for (const newSegment of newSegments) {
    for (const segment of edges) {
      if (segmentHasIllegalIntersection(
        newSegment.start,
        newSegment.end,
        newSegment.startId,
        newSegment.endId,
        segment,
      )) {
        return "折线会与已有线段相交或重合。";
      }
    }
  }

  return "";
}

function captureState() {
  return {
    nodes: nodes.map((node) => ({ ...node })),
    edges: edges.map((edge) => ({ ...edge })),
    moves,
    currentPlayer,
    winner,
    gameOver,
  };
}

function restoreState(state) {
  nodes = state.nodes.map((node) => ({ ...node }));
  edges = state.edges.map((edge) => ({ ...edge }));
  moves = state.moves;
  currentPlayer = state.currentPlayer;
  winner = state.winner;
  gameOver = state.gameOver;
  selectedFirstId = null;
  selectedSecondId = null;
}

function makeMove(first, second, newNode) {
  const error = isValidMove(first, second, newNode);
  if (error) {
    setMessage(error, "error");
    return;
  }

  moveHistory.push(captureState());
  nodes.push(newNode);
  edges.push({ a: first.id, b: newNode.id }, { a: newNode.id, b: second.id });
  first.degree += 1;
  second.degree += 1;
  newNode.degree = 2;
  moves += 1;

  const playerWhoMoved = currentPlayer;
  currentPlayer = currentPlayer === "A" ? "B" : "A";
  selectedFirstId = null;
  selectedSecondId = null;

  if (!hasLegalMove()) {
    winner = playerWhoMoved;
    gameOver = true;
    setMessage(`轮到 ${currentPlayer}，但已经没有合法连线。${winner} 获胜！`, "success");
  } else {
    setMessage(`${playerWhoMoved} 完成了一步，现在轮到 ${currentPlayer}。`);
  }
  updateUi();
  draw();
}

function candidatePoints() {
  const points = [];
  const step = 30;
  for (let x = 20; x < canvas.width - 20; x += step) {
    for (let y = 20; y < canvas.height - 20; y += step) {
      points.push({ x, y });
    }
  }
  return points;
}

function hasLegalMove() {
  const availableNodes = nodes.filter((node) => node.degree < MAX_DEGREE);
  const points = candidatePoints();
  for (let i = 0; i < availableNodes.length; i += 1) {
    for (let j = i + 1; j < availableNodes.length; j += 1) {
      const first = availableNodes[i];
      const second = availableNodes[j];
      for (const point of points) {
        const candidate = { id: nodes.length, ...point };
        if (!isValidMove(first, second, candidate)) return true;
      }
    }
  }
  return false;
}

function handleUndo() {
  if (selectedFirstId !== null) {
    if (selectedSecondId !== null) {
      selectedSecondId = null;
      setMessage("已撤回终点选择，请重新选择终点。");
    } else if (selectedFirstId !== null) {
      selectedFirstId = null;
      setMessage(`已撤回起点选择，仍是 ${currentPlayer} 的回合。`);
    }
    updateUi();
    draw();
    return;
  }

  const previousState = moveHistory.pop();
  if (!previousState) return;
  restoreState(previousState);
  setMessage(`已撤回上一步，现在轮到 ${currentPlayer}。`);
  updateUi();
  draw();
}

function handleNoMoveClaim() {
  if (gameOver) return;
  if (hasLegalMove()) {
    setMessage("棋盘上仍然存在可尝试的合法连接，请继续寻找。", "error");
    return;
  }

  winner = currentPlayer === "A" ? "B" : "A";
  gameOver = true;
  selectedFirstId = null;
  selectedSecondId = null;
  setMessage(`${currentPlayer} 已无合法连线，${winner} 获胜！`, "success");
  updateUi();
  draw();
}

function handleCanvasClick(event) {
  if (gameOver) return;
  const point = getPointerPosition(event);
  const node = findNodeAt(point);

  if (selectedFirstId !== null && selectedSecondId !== null) {
    if (node) {
      if (node.id === selectedFirstId) {
        setMessage("如需更换起点，请先点击“撤回”。", "error");
        return;
      }
      if (node.degree >= MAX_DEGREE) {
        setMessage("这个点已经达到 3 条连接，请换一个终点。", "error");
        return;
      }
      selectedSecondId = node.id;
      setMessage("已更换终点，请点击空白处放置新点。");
      updateUi();
      draw();
      return;
    }

    const first = nodes.find((item) => item.id === selectedFirstId);
    const second = nodes.find((item) => item.id === selectedSecondId);
    makeMove(first, second, { id: nodes.length, x: point.x, y: point.y, degree: 2 });
    return;
  }

  if (!node) {
    setMessage("请先点击已有的蓝色圆点。", "error");
    return;
  }

  if (selectedFirstId === null) {
    if (node.degree >= MAX_DEGREE) {
      setMessage("这个点已经达到 3 条连接，请换一个点。", "error");
      return;
    }
    selectedFirstId = node.id;
    setMessage("已选中起点，请选择另一个点作为终点。");
  } else if (selectedSecondId === null) {
    if (node.id === selectedFirstId) {
      setMessage("起点和终点必须不同。", "error");
      return;
    }
    if (node.degree >= MAX_DEGREE) {
      setMessage("这个点已经达到 3 条连接，请换一个终点。", "error");
      return;
    }
    selectedSecondId = node.id;
    setMessage("端点已选好，请点击空白处放置新点；它会形成一条折线。");
  }
  updateUi();
  draw();
}

function selectLevel(event) {
  const nextLevel = Number(event.currentTarget.dataset.level);
  if (!Number.isInteger(nextLevel) || !LEVELS[nextLevel]) return;
  levelIndex = nextLevel;
  resetGame();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.strokeStyle = "#e7ebf1";
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 45) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 45) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
  ctx.restore();

  for (const edge of edges) {
    const a = nodes.find((node) => node.id === edge.a);
    const b = nodes.find((node) => node.id === edge.b);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  for (const node of nodes) {
    const selectedFirst = node.id === selectedFirstId;
    const selectedSecond = node.id === selectedSecondId;
    const selected = selectedFirst || selectedSecond;
    ctx.beginPath();
    ctx.arc(node.x, node.y, NODE_RADIUS + (selected ? 4 : 0), 0, Math.PI * 2);
    ctx.fillStyle = selectedFirst ? "#f59e0b" : selectedSecond ? "#8b5cf6" :
      node.degree >= MAX_DEGREE ? "#94a3b8" : "#2563eb";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(node.degree + " / 3", node.x, node.y + 30);
  }

  if (gameOver) {
    ctx.fillStyle = "rgba(255,255,255,.78)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#067647";
    ctx.font = "700 28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${winner} 获胜`, canvas.width / 2, canvas.height / 2 - 8);
    ctx.font = "16px sans-serif";
    ctx.fillText(`轮到 ${currentPlayer} 时已无合法连线`, canvas.width / 2, canvas.height / 2 + 26);
  }
}

canvas.addEventListener("click", handleCanvasClick);
resetButton.addEventListener("click", resetGame);
undoButton.addEventListener("click", handleUndo);
noMoveButton.addEventListener("click", handleNoMoveClaim);
levelButtons.forEach((button) => button.addEventListener("click", selectLevel));
resetGame();


