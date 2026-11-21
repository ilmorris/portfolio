const approach = document.querySelector('#approach');
const scene = document.querySelector('#scene');
const viewButton = document.querySelector('#view-button');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const room = { width: 1672, height: 941, x: 836, y: 470.5 };
const board = { width: 1230, height: 676, x: 834, y: 432 };
let activeNote = null;
let frame = 0;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function mix(start, end, progress) {
  return start + (end - start) * progress;
}

function scrollRange() {
  return approach.offsetHeight - window.innerHeight;
}

function drawCamera() {
  frame = 0;
  const width = document.documentElement.clientWidth;
  const height = window.innerHeight;
  const scroll = clamp(window.scrollY / Math.max(1, scrollRange()), 0, 1);
  const progress = reducedMotion.matches ? Number(scroll >= 0.5) : scroll;
  const aspect = width / height;
  const fit = aspect >= 1.35 && aspect <= 2.1 ? Math.max : Math.min;
  const roomScale = fit(width / room.width, height / room.height);
  const boardScale = fit(width / board.width, height / board.height);
  const zoom = activeNote ? Math.max(boardScale * 1.25, width / 610) : mix(roomScale, boardScale, progress);
  const x = activeNote
    ? activeNote.offsetParent.offsetLeft + activeNote.offsetLeft + activeNote.offsetWidth / 2
    : mix(room.x, board.x, progress);
  const y = activeNote
    ? activeNote.offsetParent.offsetTop + activeNote.offsetTop + activeNote.offsetHeight / 2
    : mix(room.y, board.y, progress);

  const halfWidth = Math.min(room.width / 2, width / (2 * zoom));
  const halfHeight = Math.min(room.height / 2, height / (2 * zoom));
  scene.style.setProperty('--zoom', zoom);
  scene.style.setProperty('--pan-x', `${-clamp(x, halfWidth, room.width - halfWidth)}px`);
  scene.style.setProperty('--pan-y', `${-clamp(y, halfHeight, room.height - halfHeight)}px`);
  viewButton.textContent = activeNote || scroll > 0.5 ? 'Torna alla vista d’insieme' : 'Avvicinati alla lavagna';
}

function scheduleCamera() {
  if (!frame) frame = requestAnimationFrame(drawCamera);
}

function showOverview() {
  scene.classList.toggle('reframe', Boolean(activeNote));
  activeNote = null;
  window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  scheduleCamera();
}

for (const button of document.querySelectorAll('[data-note]')) {
  button.addEventListener('click', () => {
    activeNote = document.getElementById(button.dataset.note);
    scene.classList.add('reframe');
    window.scrollTo({ top: scrollRange(), behavior: 'instant' });
    activeNote.focus({ preventScroll: true, focusVisible: false });
    scheduleCamera();
  });
}

viewButton.addEventListener('click', () => {
  if (activeNote || window.scrollY > scrollRange() / 2) {
    showOverview();
  } else {
    scene.classList.remove('reframe');
    window.scrollTo({ top: scrollRange(), behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  }
});

window.addEventListener('scroll', () => {
  if (window.scrollY < scrollRange() - 4) {
    activeNote = null;
    scene.classList.remove('reframe');
  }
  scheduleCamera();
}, { passive: true });

window.addEventListener('resize', scheduleCamera);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && activeNote) {
    showOverview();
    viewButton.focus({ preventScroll: true });
  }
});

drawCamera();
