"use strict";

function mountCatcher(container, { avatar, complete, isPaused }) {
  container.innerHTML = `
    <p class="instructions">Собери 12 приятностей. За каждую пойманную заботу теряется жизнь.</p>
    <div class="legend"><span>Лови 💐 ☕ 🎫 💗</span><span>Пропускай ⏰ 🏥 🧹</span></div>
    <div class="hud"><span data-score></span><span data-lives></span></div>
    <div class="field" tabindex="0" aria-label="Игровое поле. Для движения используй стрелки влево и вправо.">
      <div class="catcher" aria-hidden="true"><div data-player></div><div class="basket"></div></div>
    </div>
    <div class="game-controls"><button type="button" data-start>Начать</button><p role="status">Двигайся стрелками, мышью или пальцем.</p></div>`;
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
    else start.focus();
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
      untilSpawn = 0.74;
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
    field.focus();
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
    refreshAvatar: () => player.replaceChildren(avatar()),
    dispose: () => cancelAnimationFrame(frame)
  };
}

function mountPacking(container, { complete }) {
  const columns = 5;
  const rows = 4;
  const pieces = [
    { name: "Коробка конфет", icon: "🍫", color: "#d59a85", shape: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { name: "Букет", icon: "💐", color: "#b2bc91", shape: [[0, 0], [1, 0], [2, 0], [1, 1], [2, 1]] },
    { name: "Кружка", icon: "☕", color: "#e6b178", shape: [[0, 0], [0, 1], [1, 1], [2, 1]] },
    { name: "Фоторамка", icon: "🖼️", color: "#baa2ba", shape: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { name: "Книга", icon: "📕", color: "#a7bbc6", shape: [[0, 0], [0, 1], [0, 2]] }
  ];
  container.innerHTML = `
    <p class="instructions">Выбери предмет и клетку для его верхнего левого угла. Предметы можно поворачивать и перекладывать.</p>
    <div class="pack-layout">
      <div class="packing-grid" role="group" aria-label="Коробка"></div>
      <div class="pieces" role="group" aria-label="Подарки"></div>
    </div>
    <div class="game-controls"><button class="outline" type="button" data-rotate>↻ Повернуть</button><button class="outline" type="button" data-reset>Заново</button><button type="button" data-close disabled>Закрыть крышку</button></div>
    <p class="pack-status" role="status"></p>`;
  const grid = container.querySelector(".packing-grid");
  const tray = container.querySelector(".pieces");
  const rotate = container.querySelector("[data-rotate]");
  const reset = container.querySelector("[data-reset]");
  const close = container.querySelector("[data-close]");
  const status = container.querySelector("[role=status]");
  const cellButtons = [];
  const pieceButtons = [];
  let selected = 0;
  let placements = new Map();
  let shapes = pieces.map(piece => piece.shape);
  let closed = false;

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
    reset.disabled = closed;
    close.disabled = placements.size !== pieces.length || closed;
  }

  function select(index) {
    selected = index;
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
    const height = Math.max(...shapes[selected].map(([, y]) => y));
    shapes[selected] = shapes[selected].map(([x, y]) => [height - y, x]);
    status.textContent = `Предмет «${pieces[selected].name}» повёрнут.`;
    render();
  });
  reset.addEventListener("click", () => {
    placements = new Map();
    shapes = pieces.map(piece => piece.shape);
    selected = 0;
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
