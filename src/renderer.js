const pet = document.getElementById("pet");

const cell = { width: 192, height: 208 };
const rows = {
  idle: { row: 0, frames: 6, durations: [280, 110, 110, 140, 140, 320] },
  "running-right": { row: 1, frames: 8, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
  "running-left": { row: 2, frames: 8, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
  waving: { row: 3, frames: 4, durations: [140, 140, 140, 280] },
  jumping: { row: 4, frames: 5, durations: [140, 140, 140, 140, 280] },
  failed: { row: 5, frames: 8, durations: [140, 140, 140, 140, 140, 140, 140, 240] },
  waiting: { row: 6, frames: 6, durations: [150, 150, 150, 150, 150, 260] },
  running: { row: 7, frames: 6, durations: [120, 120, 120, 120, 120, 220] },
  review: { row: 8, frames: 6, durations: [150, 150, 150, 150, 150, 280] },
};

const randomActionStates = Object.keys(rows).filter(
  (state) => state !== "idle" && state !== "running-right" && state !== "running-left",
);
const autoRandomDelay = { min: 20000, max: 45000 };
const randomActionDuration = { min: 1000, max: 3000 };

let currentState = null;
let frameIndex = 0;
let frameTimer = null;
let returnTimer = null;
let randomTimer = null;
let randomPaused = false;
let lastRandomState = null;
let isDragging = false;
let dragStartCursor = null;
let dragStartBounds = null;
let lastDragCursor = null;
let didDrag = false;

function setSpritePosition() {
  const state = rows[currentState];
  const x = frameIndex * cell.width;
  const y = state.row * cell.height;
  pet.style.backgroundPosition = `-${x}px -${y}px`;
}

function scheduleNextFrame() {
  clearTimeout(frameTimer);
  const state = rows[currentState];
  const duration = state.durations[frameIndex] ?? 140;
  frameTimer = setTimeout(() => {
    frameIndex = (frameIndex + 1) % state.frames;
    setSpritePosition();
    scheduleNextFrame();
  }, duration);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandomAction() {
  const candidates = randomActionStates.filter((state) => state !== lastRandomState);
  const pool = candidates.length > 0 ? candidates : randomActionStates;
  return pool[randomInt(0, pool.length - 1)];
}

function playRandomAction() {
  const state = pickRandomAction();
  lastRandomState = state;
  setState(state, {
    forceRestart: true,
    returnToIdleAfter: randomInt(randomActionDuration.min, randomActionDuration.max),
  });
}

function scheduleRandomAction() {
  clearTimeout(randomTimer);
  if (randomPaused) return;

  randomTimer = setTimeout(() => {
    if (randomPaused) return;
    if (isDragging || currentState !== "idle") {
      scheduleRandomAction();
      return;
    }

    playRandomAction();
  }, randomInt(autoRandomDelay.min, autoRandomDelay.max));
}

function setState(stateName, options = {}) {
  if (!rows[stateName]) return;
  if (currentState === stateName && !options.forceRestart) return;
  currentState = stateName;
  frameIndex = 0;
  setSpritePosition();
  scheduleNextFrame();

  clearTimeout(returnTimer);
  if (options.returnToIdleAfter) {
    returnTimer = setTimeout(() => setState("idle"), options.returnToIdleAfter);
  }

  if (stateName === "idle") {
    scheduleRandomAction();
  }
}

async function startDrag(event) {
  if (event.button !== 0) return;
  isDragging = true;
  dragStartCursor = await window.petAPI.getCursor();
  lastDragCursor = dragStartCursor;
  dragStartBounds = await window.petAPI.getBounds();
  didDrag = false;
  pet.setPointerCapture(event.pointerId);
}

async function continueDrag(event) {
  if (!isDragging || !dragStartCursor || !dragStartBounds) return;
  const cursor = await window.petAPI.getCursor();
  const dx = cursor.x - dragStartCursor.x;
  const dy = cursor.y - dragStartCursor.y;
  const stepX = cursor.x - lastDragCursor.x;
  const stepY = cursor.y - lastDragCursor.y;
  lastDragCursor = cursor;

  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
    didDrag = true;
  }

  window.petAPI.setPosition({
    x: dragStartBounds.x + dx,
    y: dragStartBounds.y + dy,
  });

  if (Math.abs(stepX) > 2) {
    setState(stepX > 0 ? "running-right" : "running-left");
  }
}

function stopDrag(event) {
  if (!isDragging) return;
  isDragging = false;
  dragStartCursor = null;
  dragStartBounds = null;
  lastDragCursor = null;
  if (pet.hasPointerCapture(event.pointerId)) {
    pet.releasePointerCapture(event.pointerId);
  }
  setState("idle");
}

pet.addEventListener("pointerdown", startDrag);
pet.addEventListener("pointermove", continueDrag);
pet.addEventListener("pointerup", stopDrag);
pet.addEventListener("pointercancel", stopDrag);

pet.addEventListener("click", () => {
  if (didDrag) {
    didDrag = false;
    return;
  }

  playRandomAction();
});

window.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  window.petAPI.showMenu();
});

window.petAPI.onSetState((state) => {
  setState(state, state === "idle" ? {} : { returnToIdleAfter: 3000 });
});

window.petAPI.onSetRandomPaused((paused) => {
  randomPaused = Boolean(paused);
  if (randomPaused) {
    clearTimeout(randomTimer);
  } else if (currentState === "idle") {
    scheduleRandomAction();
  }
});

setState("idle");
