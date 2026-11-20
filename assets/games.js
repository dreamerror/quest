"use strict";

function mountMarbles(container, { complete, isPaused }) {
  container.innerHTML = `
    <p class="instructions">Стреляй по бусинам и собирай три одного цвета. Очисти дорожку до того, как цепочка доберётся до катушки.</p>
    <div class="hud"><span data-count></span><span data-ammo></span></div>
    <canvas class="marble-board" width="640" height="440" tabindex="0" aria-label="Бусы для мамы. Мышь или касание — выстрел. Стрелки — прицел, пробел — выстрел, X — смена бусины."></canvas>
    <div class="game-controls marble-controls"><button type="button" data-start>Начать</button><button type="button" class="outline" data-swap>⇄ Сменить бусину</button></div>
    <p class="pack-status" role="status">Прицелься мышью или пальцем. Стрелки и пробел тоже работают.</p>`;
  const canvas = container.querySelector("canvas");
  const context = canvas.getContext("2d");
  const start = container.querySelector("[data-start]");
  const swap = container.querySelector("[data-swap]");
  const status = container.querySelector("[role=status]");
  const count = container.querySelector("[data-count]");
  const ammo = container.querySelector("[data-ammo]");
  const colors = ["#a44435", "#386e66", "#735786"];
  const symbols = ["♥", "✦", "●"];
  const names = ["Красная ♥", "Зелёная ✦", "Сиреневая ●"];
  const gap = 29;
  const radius = 14;
  const launcher = { x: 320, y: 360 };
  const path = [{ x: 60, y: 240, distance: 0 }];
  for (let step = 1; step <= 180; step++) {
    const angle = Math.PI - step * Math.PI / 180;
    const point = { x: 320 + 260 * Math.cos(angle), y: 240 - 175 * Math.sin(angle) };
    const previous = path[path.length - 1];
    point.distance = previous.distance + Math.hypot(point.x - previous.x, point.y - previous.y);
    path.push(point);
  }
  const length = path[path.length - 1].distance;
  let balls;
  let head;
  let current;
  let next;
  let angle = -Math.PI / 2;
  let shot = null;
  let running = false;
  let frame;
  let lastTime = null;
  let disposed = false;

  function pointAt(distance) {
    const clamped = Math.max(0, Math.min(length, distance));
    const index = path.findIndex(point => point.distance >= clamped);
    if (index === 0) return path[0];
    const a = path[index - 1];
    const b = path[index];
    const ratio = (clamped - a.distance) / (b.distance - a.distance);
    return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
  }

  function pickColor() {
    const available = [...new Set(balls)];
    return available[Math.floor(Math.random() * available.length)];
  }

  function hud() {
    count.textContent = `На дорожке ${balls.length}`;
    ammo.textContent = `Выстрел ${names[current]} · Далее ${names[next]}`;
  }

  function bead(x, y, color, size = radius) {
    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fillStyle = colors[color];
    context.fill();
    context.strokeStyle = "#fff1ce";
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = "#fff5dc";
    context.font = `bold ${size}px Arial`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(symbols[color], x, y + 1);
  }

  function draw() {
    context.clearRect(0, 0, 640, 440);
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(path[0].x, path[0].y);
    for (const point of path) context.lineTo(point.x, point.y);
    context.lineWidth = 38;
    context.strokeStyle = "#bc936b";
    context.stroke();
    context.lineWidth = 30;
    context.strokeStyle = "#e2bf91";
    context.stroke();
    context.beginPath();
    context.arc(580, 240, 24, 0, Math.PI * 2);
    context.fillStyle = "#584033";
    context.fill();
    context.beginPath();
    context.arc(580, 240, 11, 0, Math.PI * 2);
    context.fillStyle = "#e6bc87";
    context.fill();
    for (let index = balls.length - 1; index >= 0; index--) {
      const point = pointAt(head - index * gap);
      bead(point.x, point.y, balls[index]);
    }
    context.save();
    context.setLineDash([4, 8]);
    context.strokeStyle = "#654d3c80";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(launcher.x, launcher.y);
    context.lineTo(launcher.x + Math.cos(angle) * 110, launcher.y + Math.sin(angle) * 110);
    context.stroke();
    context.restore();
    context.beginPath();
    context.arc(launcher.x, launcher.y, 31, 0, Math.PI * 2);
    context.fillStyle = "#936847";
    context.fill();
    bead(launcher.x, launcher.y, current, 21);
    bead(launcher.x + 54, launcher.y + 12, next, 12);
    if (shot) bead(shot.x, shot.y, shot.color, 12);
  }

  function reset() {
    balls = Array.from({ length: 18 }, (_, index) => Math.floor(index / 2) % 3);
    head = 510;
    current = 2;
    next = 1;
    shot = null;
    hud();
    draw();
  }

  function finish(won) {
    running = false;
    shot = null;
    swap.disabled = true;
    start.disabled = false;
    start.hidden = won;
    start.textContent = "Попробовать снова";
    status.textContent = won ? "Все бусины собраны!" : "Цепочка добралась до катушки. Попробуем ещё раз?";
    draw();
    if (won) complete();
    else start.focus({ preventScroll: true });
  }

  function resolve(index) {
    let left = index;
    let right = index;
    while (left > 0 && balls[left - 1] === balls[index]) left--;
    while (right + 1 < balls.length && balls[right + 1] === balls[index]) right++;
    if (right - left + 1 < 3) return;
    const removed = right - left + 1;
    balls.splice(left, removed);
    head -= removed * gap;
    if (left > 0 && left < balls.length && balls[left - 1] === balls[left]) resolve(left);
  }

  function tick(time) {
    if (disposed || !running) return;
    const dt = lastTime === null ? 0 : Math.min((time - lastTime) / 1000, 0.04);
    lastTime = time;
    if (!isPaused()) {
      head += dt * 3.5;
      if (shot) {
        shot.x += Math.cos(shot.angle) * 650 * dt;
        shot.y += Math.sin(shot.angle) * 650 * dt;
        const hit = balls.findIndex((_, index) => {
          const point = pointAt(head - index * gap);
          return Math.hypot(shot.x - point.x, shot.y - point.y) <= 26;
        });
        if (hit >= 0) {
          const front = pointAt(head - hit * gap + gap / 2);
          const back = pointAt(head - hit * gap - gap / 2);
          const index = hit + Number(Math.hypot(shot.x - back.x, shot.y - back.y) < Math.hypot(shot.x - front.x, shot.y - front.y));
          balls.splice(index, 0, shot.color);
          head += gap;
          shot = null;
          resolve(index);
          if (balls.length === 0) {
            hud();
            finish(true);
            return;
          }
          if (!balls.includes(current)) current = pickColor();
          if (!balls.includes(next)) next = pickColor();
          hud();
        } else if (shot.x < -20 || shot.x > 660 || shot.y < -20 || shot.y > 460) shot = null;
      }
      if (head >= length - radius) {
        finish(false);
        return;
      }
      draw();
    }
    frame = requestAnimationFrame(tick);
  }

  function fire() {
    if (!running || isPaused() || shot) return;
    shot = { ...launcher, angle, color: current };
    current = next;
    next = pickColor();
    hud();
  }

  function aim(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * 640 / rect.width;
    const y = (event.clientY - rect.top) * 440 / rect.height;
    angle = Math.max(-Math.PI + 0.1, Math.min(-0.1, Math.atan2(Math.min(y - launcher.y, -10), x - launcher.x)));
    if (!running) draw();
  }

  canvas.addEventListener("pointermove", aim);
  canvas.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    aim(event);
    canvas.focus({ preventScroll: true });
    fire();
  });
  function swapColor() {
    if (!running || isPaused()) return;
    [current, next] = [next, current];
    hud();
    draw();
  }
  swap.addEventListener("click", swapColor);
  canvas.addEventListener("keydown", event => {
    if (["ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
    if (event.key === "ArrowLeft") angle = Math.max(-Math.PI + 0.1, angle - 0.07);
    if (event.key === "ArrowRight") angle = Math.min(-0.1, angle + 0.07);
    if (event.key === " " && !event.repeat) fire();
    if (event.code === "KeyX") swapColor();
    if (!running) draw();
  });
  start.addEventListener("click", () => {
    reset();
    running = true;
    lastTime = null;
    start.disabled = true;
    swap.disabled = false;
    status.textContent = "Три бусины одного цвета исчезают. Соседние группы могут запустить цепную реакцию.";
    canvas.focus({ preventScroll: true });
    canvas.scrollIntoView({ block: "nearest" });
    frame = requestAnimationFrame(tick);
  });
  swap.disabled = true;
  reset();
  return { dispose: () => { disposed = true; cancelAnimationFrame(frame); } };
}

function mountCatcher(container, { avatar, complete, isPaused }) {
  container.innerHTML = `
    <p class="instructions">Собери 12 приятностей. За каждую пойманную заботу теряется жизнь.</p>
    <div class="catcher-screen">
      <div class="legend"><span>Лови 💐 ☕ 🎫 💗</span><span>Пропускай ⏰ 🏥 🧹</span></div>
      <div class="hud"><span data-score></span><span data-lives></span></div>
      <div class="field" tabindex="0" aria-label="Игровое поле. Для движения используй стрелки влево и вправо.">
        <div class="catcher" aria-hidden="true"><div data-player></div><div class="basket"></div></div>
      </div>
      <div class="game-controls"><button type="button" data-start>Начать</button><p role="status">Двигайся стрелками, мышью или пальцем.</p></div>
    </div>`;
  const screen = container.querySelector(".catcher-screen");
  const field = container.querySelector(".field");
  const player = container.querySelector("[data-player]");
  const catcher = container.querySelector(".catcher");
  const scoreLabel = container.querySelector("[data-score]");
  const livesLabel = container.querySelector("[data-lives]");
  const start = container.querySelector("[data-start]");
  const status = container.querySelector("[role=status]");
  const treats = ["💐", "☕", "🎫", "💗"];
  const chores = ["⏰", "🏥", "🧹"];
  const keys = new Set();
  const drops = [];
  let position = 0.5;
  let score = 0;
  let lives = 3;
  let frame = null;
  let lastTime = null;
  let untilSpawn = 0;
  let spawnCount = 0;

  function scrollIntoView() {
    screen.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function updateHud() {
    scoreLabel.textContent = `Приятности ${score} / 12`;
    livesLabel.textContent = `Жизни ${lives} / 3`;
  }

  function moveTo(x, width) {
    const inset = 31 / width;
    position = Math.max(inset, Math.min(1 - inset, x));
    catcher.style.left = `${position * 100}%`;
    catcher.style.bottom = "-10px";
  }

  function spawn(width) {
    const hazard = spawnCount > 1 && spawnCount % 3 === 2;
    spawnCount++;
    const choices = hazard ? chores : treats;
    const node = document.createElement("span");
    node.className = "drop";
    node.setAttribute("aria-hidden", "true");
    node.textContent = choices[Math.floor(Math.random() * choices.length)];
    const x = (22 + Math.random() * (width - 44)) / width;
    const speed = 112 + Math.min(score * 4, 35);
    node.style.left = `${x * 100}%`;
    node.style.top = "-22px";
    field.append(node);
    drops.push({ node, hazard, x, y: -22, speed });
  }

  function finish(won) {
    for (const drop of drops) drop.node.remove();
    drops.length = 0;
    keys.clear();
    frame = null;
    start.hidden = won;
    start.disabled = won;
    start.textContent = "Сыграть снова";
    status.textContent = won ? "Корзинка полна приятностей!" : "Жизни закончились. Можно попробовать ещё раз.";
    if (won) complete();
    else {
      start.focus({ preventScroll: true });
      scrollIntoView();
    }
  }

  function tick(time) {
    const dt = lastTime === null ? 0 : Math.min((time - lastTime) / 1000, 0.045);
    lastTime = time;
    if (isPaused()) {
      frame = requestAnimationFrame(tick);
      return;
    }
    const width = field.clientWidth;
    const height = field.clientHeight;
    const direction = Number(keys.has("ArrowRight")) - Number(keys.has("ArrowLeft"));
    moveTo(position + direction * 390 * dt / width, width);
    untilSpawn -= dt;
    if (untilSpawn <= 0) {
      spawn(width);
      untilSpawn = 0.84;
    }
    for (let index = drops.length - 1; index >= 0; index--) {
      const drop = drops[index];
      drop.y += drop.speed * dt;
      drop.node.style.top = `${drop.y}px`;
      const caught = drop.y >= height - 72 && drop.y <= height - 25 && Math.abs(drop.x - position) * width <= 37;
      if (!caught && drop.y < height + 24) continue;
      drop.node.remove();
      drops.splice(index, 1);
      if (!caught) continue;
      if (drop.hazard) lives--;
      else score++;
      updateHud();
      if (score === 12 || lives === 0) {
        finish(score === 12);
        return;
      }
    }
    frame = requestAnimationFrame(tick);
  }

  start.addEventListener("click", () => {
    score = 0;
    lives = 3;
    lastTime = null;
    untilSpawn = 0.25;
    spawnCount = 0;
    moveTo(0.5, field.clientWidth);
    updateHud();
    start.disabled = true;
    status.textContent = "Двигайся стрелками, мышью или пальцем.";
    field.focus({ preventScroll: true });
    scrollIntoView();
    frame = requestAnimationFrame(tick);
  });

  function movePointer(event) {
    if (frame === null) return;
    const bounds = field.getBoundingClientRect();
    moveTo((event.clientX - bounds.left) / bounds.width, field.clientWidth);
  }

  field.addEventListener("pointerdown", event => {
    if (frame === null) return;
    field.setPointerCapture(event.pointerId);
    movePointer(event);
  });
  field.addEventListener("pointermove", event => {
    if (event.pointerType === "mouse" || field.hasPointerCapture(event.pointerId)) movePointer(event);
  });
  field.addEventListener("keydown", event => {
    if (frame === null || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    keys.add(event.key);
  });
  field.addEventListener("keyup", event => keys.delete(event.key));
  field.addEventListener("blur", () => keys.clear());
  player.replaceChildren(avatar());
  moveTo(0.5, field.clientWidth);
  updateHud();
  return {
    scrollIntoView,
    refreshAvatar: () => player.replaceChildren(avatar()),
    dispose: () => cancelAnimationFrame(frame)
  };
}

function mountPacking(container, { complete }) {
  const columns = 7;
  const rows = 5;
  const pieces = [
    { name: "Коробка конфет", icon: "🍫", color: "#d59a85", shape: [[0, 0], [1, 0], [0, 1], [1, 1]], solution: [0, 0, 0] },
    { name: "Букет", icon: "💐", color: "#b2bc91", shape: [[0, 0], [1, 0], [2, 0], [1, 1], [2, 1]], solution: [2, 0, 0] },
    { name: "Кружка", icon: "☕", color: "#e6b178", shape: [[0, 0], [0, 1], [1, 1], [2, 1]], solution: [2, 1, 0] },
    { name: "Фоторамка", icon: "🖼️", color: "#baa2ba", shape: [[0, 0], [1, 0], [0, 1], [1, 1]], solution: [5, 0, 0] },
    { name: "Книга", icon: "📕", color: "#a7bbc6", shape: [[0, 0], [0, 1], [0, 2]], solution: [6, 2, 0] },
    { name: "Мягкая игрушка", icon: "🧸", color: "#d7ad8a", shape: [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]], solution: [3, 2, 1] },
    { name: "Чай", icon: "🍵", color: "#a7c3a9", shape: [[0, 0], [1, 0], [1, 1], [2, 1]], solution: [0, 2, 0] },
    { name: "Шарф", icon: "🧣", color: "#d7a4aa", shape: [[0, 0], [0, 1], [0, 2], [0, 3]], solution: [0, 4, 1] }
  ];
  container.innerHTML = `
    <p class="instructions">Выбери предмет и клетку для его верхнего левого угла. Предметы можно поворачивать и перекладывать.</p>
    <div class="pack-layout">
      <div class="packing-grid" role="group" aria-label="Коробка"></div>
      <div class="pieces" role="group" aria-label="Подарки"></div>
    </div>
    <div class="game-controls"><button class="outline" type="button" data-rotate>↻ Повернуть</button><button class="outline" type="button" data-hint>Подсказка</button><button class="outline" type="button" data-reset>Заново</button><button type="button" data-close disabled>Закрыть крышку</button></div>
    <p class="pack-status" role="status"></p>`;
  const grid = container.querySelector(".packing-grid");
  const tray = container.querySelector(".pieces");
  const rotate = container.querySelector("[data-rotate]");
  const hint = container.querySelector("[data-hint]");
  const reset = container.querySelector("[data-reset]");
  const close = container.querySelector("[data-close]");
  const status = container.querySelector("[role=status]");
  const cellButtons = [];
  const pieceButtons = [];
  let selected = 0;
  let hinted = null;
  let placements = new Map();
  let shapes = pieces.map(piece => piece.shape);
  let closed = false;
  grid.style.setProperty("--columns", columns);

  function rotateShape(shape) {
    const height = Math.max(...shape.map(([, y]) => y));
    return shape.map(([x, y]) => [height - y, x]);
  }

  function positions(shape, anchor) {
    const column = anchor % columns;
    const row = Math.floor(anchor / columns);
    return shape.map(([x, y]) => [x + column, y + row]);
  }

  function occupied() {
    const cells = new Map();
    for (const [piece, anchor] of placements) {
      for (const [x, y] of positions(shapes[piece], anchor)) cells.set(y * columns + x, piece);
    }
    return cells;
  }

  function render() {
    const cells = occupied();
    const firstCells = new Map();
    for (const [piece, anchor] of placements) {
      firstCells.set(piece, Math.min(...positions(shapes[piece], anchor).map(([x, y]) => y * columns + x)));
    }
    for (const [index, button] of cellButtons.entries()) {
      const pieceIndex = cells.get(index);
      const piece = pieces[pieceIndex];
      button.textContent = firstCells.get(pieceIndex) === index ? piece.icon : "";
      button.dataset.filled = String(Boolean(piece));
      button.dataset.hinted = String(pieceIndex === hinted);
      button.style.setProperty("--piece-color", piece?.color ?? "");
      button.setAttribute("aria-label", `Ряд ${Math.floor(index / columns) + 1}, клетка ${index % columns + 1}${piece ? `, ${piece.name}` : ""}`);
      button.disabled = closed;
    }
    for (const [index, button] of pieceButtons.entries()) {
      const packed = placements.has(index);
      button.dataset.packed = String(packed);
      button.setAttribute("aria-pressed", String(index === selected));
      button.querySelector(".packed-mark").hidden = !packed;
      button.disabled = closed;
      const preview = button.querySelector(".piece-shape");
      const width = Math.max(...shapes[index].map(([x]) => x)) + 1;
      const height = Math.max(...shapes[index].map(([, y]) => y)) + 1;
      preview.style.gridTemplateColumns = `repeat(${width}, 7px)`;
      preview.style.gridTemplateRows = `repeat(${height}, 7px)`;
      preview.replaceChildren(...shapes[index].map(([x, y]) => {
        const cell = document.createElement("i");
        cell.style.gridColumn = String(x + 1);
        cell.style.gridRow = String(y + 1);
        return cell;
      }));
    }
    rotate.disabled = selected === null || closed;
    hint.disabled = placements.size === pieces.length || closed;
    reset.disabled = closed;
    close.disabled = placements.size !== pieces.length || closed;
  }

  function select(index) {
    selected = index;
    hinted = null;
    placements.delete(index);
    status.textContent = `Выбран предмет «${pieces[index].name}».`;
    render();
  }

  function place(anchor) {
    if (selected === null) {
      const piece = occupied().get(anchor);
      if (piece !== undefined) select(piece);
      return;
    }
    const cells = occupied();
    const target = positions(shapes[selected], anchor);
    if (target.some(([x, y]) => x >= columns || y >= rows || cells.has(y * columns + x))) {
      status.textContent = "Здесь предмет не помещается. Выбери другую клетку или поверни его.";
      return;
    }
    placements.set(selected, anchor);
    selected = null;
    hinted = null;
    status.textContent = placements.size === pieces.length ? "Всё поместилось. Закрой крышку!" : `Уложено ${placements.size} из ${pieces.length}.`;
    render();
  }

  for (let index = 0; index < columns * rows; index++) {
    const button = document.createElement("button");
    button.type = "button";
    button.addEventListener("click", () => place(index));
    cellButtons.push(button);
    grid.append(button);
  }
  for (const [index, piece] of pieces.entries()) {
    const button = document.createElement("button");
    button.type = "button";
    button.style.setProperty("--piece-color", piece.color);
    button.innerHTML = `<span>${piece.icon} ${piece.name} <span class="packed-mark" aria-label="Уложено">✓</span></span><span class="piece-shape" aria-hidden="true"></span>`;
    button.addEventListener("click", () => select(index));
    pieceButtons.push(button);
    tray.append(button);
  }
  rotate.addEventListener("click", () => {
    shapes[selected] = rotateShape(shapes[selected]);
    status.textContent = `Предмет «${pieces[selected].name}» повёрнут.`;
    render();
  });
  hint.addEventListener("click", () => {
    const index = selected ?? pieces.findIndex((_, pieceIndex) => !placements.has(pieceIndex));
    const piece = pieces[index];
    const [column, row, turns] = piece.solution;
    const anchor = row * columns + column;
    let shape = piece.shape;
    for (let turn = 0; turn < turns; turn++) shape = rotateShape(shape);

    const cells = occupied();
    const blockers = new Set(positions(shape, anchor).map(([x, y]) => cells.get(y * columns + x)));
    blockers.delete(undefined);
    for (const blocker of blockers) placements.delete(blocker);
    shapes[index] = shape;
    placements.set(index, anchor);
    selected = null;
    hinted = index;
    const details = blockers.size ? " Мешавшие предметы вернулись в список." : "";
    const finished = placements.size === pieces.length ? " Можно закрыть крышку!" : "";
    status.textContent = `Подсказка уложила предмет «${piece.name}».${details}${finished}`;
    render();
    if (hint.disabled) close.focus();
  });
  reset.addEventListener("click", () => {
    placements = new Map();
    shapes = pieces.map(piece => piece.shape);
    selected = 0;
    hinted = null;
    status.textContent = "Коробка снова пуста.";
    render();
  });
  close.addEventListener("click", () => {
    closed = true;
    render();
    status.textContent = "Коробка закрыта. Все подарки внутри!";
    complete();
  });
  render();
}
