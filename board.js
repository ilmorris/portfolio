const viewport = document.querySelector('.viewport');
const scene = document.querySelector('#scene');
const board = document.querySelector('#board');
const boardTitle = board.querySelector('.board-title');
const spotlight = document.querySelector('#spotlight');
const viewButton = document.querySelector('#view-button');
const previousButton = document.querySelector('#view-previous');
const nextButton = document.querySelector('#view-next');
const viewProgress = document.querySelector('.view-progress');
const sections = [...board.querySelectorAll(':scope > section')];
const sectionButtons = sections.map(section => section.querySelector('.section-link'));
const startingColumn = Math.floor(sections.length / 2);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const mobileLayout = window.matchMedia('(max-width: 900px), (pointer: coarse)');
const mobileList = new URLSearchParams(location.search).get('mobile') === 'list';
if (mobileList) document.documentElement.dataset.mobileLayout = 'list';
const wheelThreshold = 85;
const wheelPause = 160;
const firstNoteStep = 1;

let route = [];
let stops = [];
let camera;
let currentStep = 0;
let currentColumn = startingColumn;
let touchStart;
let cameraAnimation;
let wheelDistance = 0;
let lastWheelTime = -Infinity;
let wheelDirection = 0;
let wheelConsumedAt = null;
let wheelTailMinimum = Infinity;
let canQueueWheel = false;
let queuedWheelDirection = 0;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function measureCamera() {
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  const roomWidth = scene.offsetWidth;
  const roomHeight = scene.offsetHeight;
  const boardWidth = board.offsetWidth;
  const boardHeight = board.offsetHeight;
  const boardLeft = board.offsetLeft;
  const boardTop = board.offsetTop;
  const aspect = width / height;
  const fit = aspect >= 1.35 && aspect <= 2.1 ? Math.max : Math.min;
  const boardScale = Math.min(width / boardWidth, height / boardHeight);
  const roomCover = Math.max(width / roomWidth, height / roomHeight);
  const roomFrame = .95 * fit(width / 1672, height / 941);

  camera = {
    width, height, roomWidth, roomHeight, boardWidth, boardHeight, boardLeft, boardTop,
    boardX: boardLeft + boardWidth / 2,
    boardY: boardTop + boardHeight / 2,
    roomScale: Math.min(
      width / (boardWidth + 48),
      height / (boardHeight + 48),
      Math.max(roomCover, roomFrame),
    ),
    readingScale: Math.max(2, width / 390, boardScale * 1.25),
  };

  if (mobileLayout.matches) {
    const bounds = sections.map(section => {
      const style = getComputedStyle(section);
      return {
        left: parseFloat(style.getPropertyValue('--zone-left')),
        right: parseFloat(style.getPropertyValue('--zone-right')),
      };
    });
    const widestColumn = Math.max(...bounds.map(({ left, right }) => right - left));
    const frameTop = boardTop - 22;
    const topInset = parseFloat(getComputedStyle(viewport).getPropertyValue('--mobile-board-top'));
    const zoom = Math.max(
      width / roomWidth,
      topInset / frameTop,
      (height - topInset) / (roomHeight - frameTop),
      Math.min(width / (widestColumn * 1.19), height * .83 / (boardHeight + 52)),
    );
    camera.columns = bounds.map(({ left, right }) => ({
      zoom,
      x: boardLeft + (left + right) / 2,
      y: frameTop + (height / 2 - topInset) / zoom,
    }));
  }
}

function setRoute(items) {
  route = items;
  const sceneBounds = scene.getBoundingClientRect();
  stops = route.map(item => itemCenter(item, sceneBounds));

  for (const button of sectionButtons) {
    button.inert = route.length > 0;
  }
}

function itemCenter(item, sceneBounds) {
  // Include the rotated paper and photos that extend past their group's layout box.
  const pieces = [item, ...item.querySelectorAll(':scope > .paper')];
  const bounds = pieces.map(piece => piece.getBoundingClientRect());
  const left = Math.min(...bounds.map(rect => rect.left));
  const right = Math.max(...bounds.map(rect => rect.right));
  const top = Math.min(...bounds.map(rect => rect.top));
  const bottom = Math.max(...bounds.map(rect => rect.bottom));
  const scale = sceneBounds.width / camera.roomWidth;
  return {
    x: ((left + right) / 2 - sceneBounds.left) / scale,
    y: ((top + bottom) / 2 - sceneBounds.top) / scale,
    width: (right - left) / scale,
    height: (bottom - top) / scale,
  };
}

function cameraPose() {
  const { width, height, roomWidth, roomHeight, boardHeight, boardX, boardY, roomScale, readingScale } = camera;
  const roomTilt = clamp(height / (2 * roomScale) - boardHeight / 2 - 24, 0, 52);
  let view = { x: boardX, y: boardY + roomTilt, zoom: roomScale };
  if (currentStep >= firstNoteStep) {
    const stop = stops[currentStep - firstNoteStep];
    const zoom = Math.min(
      mobileLayout.matches ? 2.5 : readingScale,
      width / (stop.width + 20),
      Math.max(height - 100, height * .68) / (stop.height + 20),
    );
    view = { ...stop, zoom };
  } else if (mobileLayout.matches) {
    view = camera.columns[currentColumn];
  }
  const { x, y, zoom } = view;
  const halfWidth = Math.min(roomWidth / 2, width / (2 * zoom));
  const halfHeight = Math.min(roomHeight / 2, height / (2 * zoom));
  return {
    x: clamp(x, halfWidth, roomWidth - halfWidth),
    y: clamp(y, halfHeight, roomHeight - halfHeight),
    zoom,
  };
}

function showSpotlight(pose) {
  const stop = stops[currentStep - firstNoteStep];
  if (!stop) return;

  spotlight.style.setProperty('--spot-x', `${camera.width / 2 + (stop.x - pose.x) * pose.zoom}px`);
  spotlight.style.setProperty('--spot-y', `${camera.height / 2 + (stop.y - pose.y) * pose.zoom}px`);
  spotlight.style.setProperty('--spot-width', `${(stop.width * 0.67 + 16) * pose.zoom}px`);
  spotlight.style.setProperty('--spot-height', `${(stop.height * 0.64 + 14) * pose.zoom}px`);
  spotlight.classList.add('is-visible');
}

function settleStep(pose) {
  if (currentStep >= firstNoteStep) {
    showSpotlight(pose);
    return;
  }
  if (mobileLayout.matches) return;

  viewport.style.setProperty('--board-screen-x', `${camera.width / 2 + (camera.boardLeft - pose.x) * pose.zoom}px`);
  viewport.style.setProperty('--board-screen-y', `${camera.height / 2 + (camera.boardTop - pose.y) * pose.zoom}px`);
  viewport.style.setProperty('--board-screen-scale', pose.zoom);
  const titleRect = boardTitle.getBoundingClientRect();
  const viewportRect = viewport.getBoundingClientRect();
  viewport.style.setProperty('--title-spot-x', `${titleRect.left + titleRect.width / 2 - viewportRect.left}px`);
  viewport.style.setProperty('--title-spot-y', `${titleRect.top + titleRect.height / 2 - viewportRect.top}px`);
  viewport.style.setProperty('--title-spot-width', `${boardTitle.offsetWidth * .51 * pose.zoom}px`);
  viewport.style.setProperty('--title-spot-height', `${(boardTitle.offsetHeight * .88 + 12) * pose.zoom}px`);

  viewport.classList.add('is-overview');
}

function updateViewControls() {
  viewButton.hidden = !mobileLayout.matches && currentStep === 0;
  if (!mobileLayout.matches) {
    if (viewButton.textContent !== 'Back to the Room') viewButton.textContent = 'Back to the Room';
    return;
  }

  const exploring = currentStep >= firstNoteStep;
  const index = exploring ? currentStep - firstNoteStep : currentColumn;
  const total = exploring ? route.length : sections.length;
  const unit = exploring ? 'note' : 'section';
  const name = exploring ? '' : `${sectionButtons[currentColumn].textContent.trim()} · `;
  viewProgress.textContent = `${name}${index + 1} / ${total}`;
  viewButton.textContent = exploring ? 'Back to Sections' : 'Explore';
  previousButton.setAttribute('aria-label', `Previous ${unit}`);
  nextButton.setAttribute('aria-label', `Next ${unit}`);
  previousButton.setAttribute('aria-disabled', index === 0);
  nextButton.setAttribute('aria-disabled', index === total - 1);
  sectionButtons.forEach((button, column) => {
    button.inert = exploring || column !== currentColumn;
  });
}

function renderStep(animate) {
  const pose = cameraPose();
  const transform = `scale(${pose.zoom}) translate(${-pose.x}px, ${-pose.y}px)`;
  const start = animate && !reducedMotion.matches ? getComputedStyle(scene).transform : null;
  cameraAnimation?.cancel();
  if (animate) viewport.classList.remove('is-overview');
  spotlight.classList.remove('is-visible');
  scene.style.setProperty('--camera-transform', transform);
  updateViewControls();

  if (start) {
    cameraAnimation = scene.animate([{ transform: start }, { transform }], {
      duration: 550,
      easing: 'cubic-bezier(.22,.75,.25,1)',
    });
    cameraAnimation.onfinish = () => {
      settleStep(pose);
      const direction = queuedWheelDirection;
      queuedWheelDirection = 0;
      if (direction) navigate(direction);
    };
  } else {
    settleStep(pose);
  }
}

function goToStep(step) {
  const next = clamp(step, 0, route.length + firstNoteStep - 1);
  if (next === currentStep) return;

  currentStep = next;
  wheelDistance = 0;
  canQueueWheel = false;
  queuedWheelDirection = 0;
  if (currentStep < firstNoteStep && route.length) setRoute([]);
  renderStep(true);
}

function refreshLayout() {
  if (mobileLayout.matches && mobileList) return;
  measureCamera();
  setRoute(route);
  renderStep(false);
}

function navigate(direction) {
  if (currentStep >= firstNoteStep) {
    goToStep(Math.max(firstNoteStep, currentStep + direction));
  } else if (mobileLayout.matches) {
    const nextColumn = clamp(currentColumn + direction, 0, sections.length - 1);
    if (nextColumn === currentColumn) return;
    currentColumn = nextColumn;
    renderStep(true);
  }
}

function cameraIsMoving() {
  return cameraAnimation?.playState === 'running';
}

function enterSection(section) {
  const items = [...section.querySelectorAll('[data-stop]')];
  if (!items.length) return;

  if (mobileLayout.matches && mobileList) {
    items[0].scrollIntoView({ block: 'start' });
  } else {
    setRoute(items);
    goToStep(firstNoteStep);
  }
  items[0].focus({ preventScroll: true, focusVisible: false });
}

for (const [index, button] of sectionButtons.entries()) {
  button.addEventListener('click', () => enterSection(sections[index]));
}

viewButton.addEventListener('click', () => {
  if (!mobileLayout.matches || currentStep >= firstNoteStep) goToStep(0);
  else enterSection(sections[currentColumn]);
});

previousButton.addEventListener('click', () => navigate(-1));
nextButton.addEventListener('click', () => navigate(1));

viewport.addEventListener('touchstart', (event) => {
  touchStart = mobileLayout.matches && !mobileList && event.touches.length === 1
    && !event.target.closest('.view-controls, a') ? event.touches[0] : null;
}, { passive: true });

viewport.addEventListener('touchcancel', () => { touchStart = null; });

viewport.addEventListener('touchend', (event) => {
  if (!touchStart) return;
  const end = [...event.changedTouches].find(touch => touch.identifier === touchStart.identifier);
  if (!end) return;
  const dx = touchStart.clientX - end.clientX;
  const dy = touchStart.clientY - end.clientY;
  touchStart = null;
  const distance = Math.abs(dx) > Math.abs(dy) ? dx : dy;
  if (Math.abs(distance) < 42) return;
  if (event.cancelable) event.preventDefault();
  if (!cameraIsMoving()) navigate(Math.sign(distance));
});

viewport.addEventListener('wheel', (event) => {
  if (mobileLayout.matches ? mobileList : currentStep === 0) return;
  const sideways = Math.abs(event.deltaY) <= Math.abs(event.deltaX);
  if (event.ctrlKey || (sideways && !mobileLayout.matches)) return;
  if (event.cancelable) event.preventDefault();

  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? camera.height : 1;
  const distance = (sideways ? event.deltaX : event.deltaY) * unit;
  const direction = Math.sign(distance);
  const magnitude = Math.abs(distance);
  const reversed = wheelDirection !== 0 && direction !== wheelDirection && magnitude >= 14;
  const pastImpulse = wheelConsumedAt !== null && event.timeStamp - wheelConsumedAt >= 200;
  const renewedImpulse = pastImpulse && magnitude >= 24 && magnitude >= wheelTailMinimum * 1.65 + 8;
  const moving = cameraIsMoving();

  if (event.timeStamp - lastWheelTime > wheelPause || reversed || renewedImpulse) {
    wheelDistance = 0;
    wheelConsumedAt = null;
    wheelTailMinimum = Infinity;
    canQueueWheel = moving;
  }
  lastWheelTime = event.timeStamp;
  if (magnitude >= 14) wheelDirection = direction;

  // After a step, a decaying stream of wheel events belongs to the same gesture.
  if (wheelConsumedAt !== null) {
    if (pastImpulse) wheelTailMinimum = Math.min(wheelTailMinimum, magnitude);
    return;
  }
  if (moving && !canQueueWheel) return;

  wheelDistance = direction === Math.sign(wheelDistance) ? wheelDistance + distance : distance;
  if (Math.abs(wheelDistance) < wheelThreshold) return;

  wheelConsumedAt = event.timeStamp;
  wheelTailMinimum = Infinity;
  wheelDistance = 0;
  if (moving) {
    canQueueWheel = false;
    queuedWheelDirection = direction;
  } else {
    navigate(direction);
  }
}, { passive: false });

window.addEventListener('resize', refreshLayout);
mobileLayout.addEventListener('change', () => {
  cameraAnimation?.cancel();
  viewport.classList.remove('is-overview');
  spotlight.classList.remove('is-visible');
  for (const button of sectionButtons) button.inert = false;
  currentStep = 0;
  currentColumn = startingColumn;
  route = [];
  wheelDistance = 0;
  lastWheelTime = -Infinity;
  queuedWheelDirection = 0;
  if (mobileLayout.matches) window.scrollTo({ top: 0, behavior: 'instant' });
  refreshLayout();
});
reducedMotion.addEventListener('change', () => {
  if (!(mobileLayout.matches && mobileList) && reducedMotion.matches) renderStep(false);
});

window.addEventListener('keydown', (event) => {
  if (mobileLayout.matches && mobileList) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;

  if (event.key === 'Escape' && route.length) {
    const returnTarget = mobileLayout.matches
      ? viewButton
      : route[0].closest('.board > section').querySelector('.section-link');
    goToStep(0);
    returnTarget.focus({ preventScroll: true });
    return;
  }

  const keyDirections = { ArrowUp: -1, PageUp: -1, ArrowDown: 1, PageDown: 1 };
  if (mobileLayout.matches) Object.assign(keyDirections, { ArrowLeft: -1, ArrowRight: 1 });
  const space = event.key === ' ' && !event.target.closest?.('button, a');
  const direction = space ? (event.shiftKey ? -1 : 1) : keyDirections[event.key];
  if (!direction && (mobileLayout.matches || !['Home', 'End'].includes(event.key))) return;
  event.preventDefault();
  if (event.repeat || cameraIsMoving()) return;

  if (event.key === 'Home') goToStep(0);
  else if (event.key === 'End') goToStep(route.length + firstNoteStep - 1);
  else navigate(direction);
});

refreshLayout();
document.fonts.ready.then(refreshLayout);

if (new URLSearchParams(location.search).has('grid')) {
  const coordinates = document.querySelector('#board-coordinates');
  board.classList.add('show-grid');
  coordinates.hidden = false;
  if (camera) coordinates.value = `${camera.boardWidth} × ${camera.boardHeight}`;

  viewport.addEventListener('pointermove', (event) => {
    if (mobileLayout.matches) return;
    const { boardWidth, boardHeight } = camera;
    const rect = board.getBoundingClientRect();
    const x = Math.round((event.clientX - rect.left) * boardWidth / rect.width);
    const y = Math.round((event.clientY - rect.top) * boardHeight / rect.height);
    coordinates.value = x >= 0 && x <= boardWidth && y >= 0 && y <= boardHeight
      ? `x: ${x} · y: ${y}`
      : `${boardWidth} × ${boardHeight}`;
  }, { passive: true });
}
