"use strict";

const tracks = [
  { id: "catcher", title: "Ловитель приятностей", caption: "Лови подарки и пропускай заботы", mount: mountCatcher },
  { id: "packing", title: "Собери корзину мечты", caption: "Уложи подарки в коробку", mount: mountPacking }
];
const $ = id => document.getElementById(id);
const storageKey = "cassette-for-mom-v1";
const avatarDialog = $("avatar-dialog");
const avatarForm = $("avatar-form");
const avatarFields = [...avatarForm.querySelectorAll("select")];
const avatarDefaults = Object.fromEntries(avatarFields.map(field => [field.name, field.options[0].value]));
const saved = load();
const state = {
  avatar: { ...avatarDefaults, glasses: saved.avatar?.glasses === true },
  completed: new Set(Array.isArray(saved.completed) ? saved.completed : []),
  prizeRevealed: saved.prizeRevealed === true
};
for (const field of avatarFields) {
  const value = saved.avatar?.[field.name];
  if ([...field.options].some(option => option.value === value)) state.avatar[field.name] = value;
}
let activeGame;

function load() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) ?? {};
  } catch {
    return {};
  }
}

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ ...state, completed: [...state.completed] }));
  } catch {
    // Keep the current play session usable when browser storage is unavailable.
  }
}

function avatarArt({ hair, hairColor, skin, shirt, glasses }) {
  const hairBack = {
    bob: '<path d="M12 43V26c0-13 8-20 20-20s20 7 20 20v17c-8 5-32 5-40 0Z"/>',
    waves: '<path d="M10 43q7-7 2-15C9 15 20 5 32 5s23 10 20 23q-5 8 2 15-5 8-12 1-10 7-20 0-7 7-12-1Z"/>',
    bun: '<circle cx="38" cy="10" r="9"/><path d="M14 29C11 8 53 6 50 29l-6 11H20Z"/>'
  };
  const fringe = {
    bob: '<path d="M15 29C9 7 53 5 49 29c-8-1-15-8-17-11-2 5-10 10-17 11Z"/>',
    waves: '<path d="M15 30C9 5 54 5 49 28c-8 2-14-4-18-11-2 7-10 5-16 13Z"/>',
    bun: '<path d="M15 29C11 10 53 8 49 29c-5 0-10-4-14-11-5 6-12 10-20 11Z"/>'
  };
  const template = document.createElement("template");
  template.innerHTML = `<svg class="avatar-art" viewBox="0 0 64 64" aria-hidden="true">
    <g fill="${hairColor}">${hairBack[hair]}</g>
    <path fill="${shirt}" d="M7 64c1-11 10-17 25-17s24 6 25 17Z"/>
    <path fill="${skin}" d="M27 41h10v10q-5 5-10 0Z"/>
    <ellipse cx="32" cy="32" rx="16" ry="17" fill="${skin}"/>
    <g fill="${hairColor}">${fringe[hair]}</g>
    <g fill="#352320"><circle cx="25" cy="32" r="1.7"/><circle cx="39" cy="32" r="1.7"/></g>
    <path d="M28 39q4 4 8 0" fill="none" stroke="#803f34" stroke-width="1.7" stroke-linecap="round"/>
    ${glasses ? '<path d="M18 30h13v3a6 6 0 0 1-12 0Zm15 0h13l-1 3a6 6 0 0 1-12 0Zm-2 2h2" fill="none" stroke="#372826" stroke-width="1.4"/>' : ""}
  </svg>`;
  return template.content.firstElementChild;
}

function draftAvatar() {
  return { ...Object.fromEntries(new FormData(avatarForm)), glasses: avatarForm.elements.glasses.checked };
}

function previewAvatar() {
  $("avatar-preview").replaceChildren(avatarArt(draftAvatar()));
}

$("avatar-open").addEventListener("click", () => {
  for (const field of avatarFields) field.value = state.avatar[field.name];
  avatarForm.elements.glasses.checked = state.avatar.glasses;
  previewAvatar();
  avatarDialog.showModal();
});
avatarForm.addEventListener("input", previewAvatar);
avatarForm.addEventListener("submit", event => {
  event.preventDefault();
  state.avatar = draftAvatar();
  save();
  activeGame?.refreshAvatar?.();
  avatarDialog.close();
});
$("avatar-cancel").addEventListener("click", () => avatarDialog.close());

function allCompleted() {
  return tracks.every(track => state.completed.has(track.id));
}

function renderHome() {
  const buttons = tracks.map((track, index) => {
    const button = document.createElement("button");
    const completed = state.completed.has(track.id);
    button.type = "button";
    button.className = "track";
    button.dataset.complete = String(completed);
    button.innerHTML = `<span class="track-number">${String(index + 1).padStart(2, "0")}</span>
      <span><strong>${track.title}</strong><small>${completed ? "Трек пройден" : track.caption}</small></span>
      <span class="track-action" aria-hidden="true">${completed ? "✓" : "▶"}</span>`;
    button.addEventListener("click", () => openTrack(track));
    return button;
  });
  $("tracks").replaceChildren(...buttons);
  $("progress").textContent = `Пройдено ${tracks.filter(track => state.completed.has(track.id)).length} / ${tracks.length}`;
  const unlocked = allCompleted();
  $("prize-open").disabled = !unlocked;
  $("prize-caption").textContent = unlocked ? "Подарочный сертификат" : "Откроется после прохождения всех треков";
  $("prize-icon").textContent = unlocked ? "→" : "🔒";
  $("play").textContent = unlocked ? "Открыть сторону Б →" : state.completed.size ? "▶  Продолжить" : "▶  Воспроизвести";
}

function show(screen, heading) {
  activeGame?.dispose?.();
  activeGame = undefined;
  for (const id of ["home", "game-screen", "prize-screen"]) $(id).hidden = id !== screen;
  $(heading).focus();
  window.scrollTo(0, 0);
}

function goHome() {
  renderHome();
  show("home", "home-title");
  $("game-content").replaceChildren();
}

function advance() {
  const next = tracks.find(track => !state.completed.has(track.id));
  if (next) openTrack(next);
  else openPrize();
}

function openTrack(track) {
  $("game-track").textContent = `Сторона А · Трек ${tracks.indexOf(track) + 1} из ${tracks.length}`;
  $("game-title").textContent = track.title;
  $("game-result").hidden = true;
  show("game-screen", "game-title");
  activeGame = track.mount($("game-content"), {
    avatar: () => avatarArt(state.avatar),
    isPaused: () => avatarDialog.open || document.hidden,
    complete: () => {
      state.completed.add(track.id);
      save();
      $("next").textContent = allCompleted() ? "К сюрпризу →" : "Следующий трек →";
      $("game-result").hidden = false;
      $("next").focus();
    }
  });
}

$("play").addEventListener("click", advance);
$("next").addEventListener("click", advance);
$("home-link").addEventListener("click", event => {
  event.preventDefault();
  goHome();
});
for (const button of document.querySelectorAll(".back")) button.addEventListener("click", goHome);
$("prize-open").addEventListener("click", openPrize);

const foil = $("foil");
const brush = foil.getContext("2d", { willReadFrequently: true });
let pointer = null;
let previous = null;
let coatReady = false;

function prepareFoil() {
  const gradient = brush.createLinearGradient(0, 0, foil.width, foil.height);
  gradient.addColorStop(0, "#aaa5a4");
  gradient.addColorStop(0.53, "#ede9e1");
  gradient.addColorStop(1, "#a5a0a3");
  brush.fillStyle = gradient;
  brush.fillRect(0, 0, foil.width, foil.height);
  brush.fillStyle = "#443a36";
  brush.textAlign = "center";
  brush.textBaseline = "middle";
  brush.font = "bold 38px system-ui";
  brush.fillText("Сотри здесь", foil.width / 2, foil.height / 2);
  brush.globalCompositeOperation = "destination-out";
  brush.lineWidth = 79;
  brush.lineCap = "round";
  brush.strokeStyle = "#000";
  coatReady = true;
}

function openPrize() {
  if (!allCompleted()) return;
  show("prize-screen", "prize-title");
  $("game-content").replaceChildren();
  if (state.prizeRevealed) {
    revealPrize();
    return;
  }
  if (!coatReady) prepareFoil();
}

function revealPrize() {
  if (!allCompleted()) return;
  state.prizeRevealed = true;
  save();
  const buttonHadFocus = document.activeElement === $("prize-reveal");
  foil.hidden = true;
  $("scratch-tip").hidden = true;
  $("certificate").removeAttribute("aria-hidden");
  $("prize-reveal").hidden = true;
  $("prize-status").textContent = "Сертификат открыт. С днём рождения, мама!";
  if (buttonHadFocus) $("prize-title").focus();
}

function scratch(event) {
  const rect = foil.getBoundingClientRect();
  const x = (event.clientX - rect.left) * foil.width / rect.width;
  const y = (event.clientY - rect.top) * foil.height / rect.height;
  brush.beginPath();
  brush.moveTo(previous?.x ?? x + 0.01, previous?.y ?? y);
  brush.lineTo(x, y);
  brush.stroke();
  previous = { x, y };
}

foil.addEventListener("pointerdown", event => {
  if (pointer !== null || event.button !== 0) return;
  pointer = event.pointerId;
  foil.setPointerCapture(pointer);
  scratch(event);
});
foil.addEventListener("pointermove", event => {
  if (pointer === event.pointerId) scratch(event);
});
foil.addEventListener("lostpointercapture", () => {
  pointer = null;
  previous = null;
  const pixels = brush.getImageData(0, 0, foil.width, foil.height).data;
  let erased = 0;
  let total = 0;
  for (let y = 4; y < foil.height; y += 8) {
    for (let x = 4; x < foil.width; x += 8) {
      total++;
      if (pixels[(y * foil.width + x) * 4 + 3] < 32) erased++;
    }
  }
  if (erased / total >= 0.55) revealPrize();
});
$("prize-reveal").addEventListener("click", revealPrize);
renderHome();
