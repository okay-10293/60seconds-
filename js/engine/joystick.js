// ============================================================
// joystick.js — 화면 위 가상 조이스틱 (터치/마우스 공용)
// ============================================================
// 사용법:
//   const joy = window.Joystick.create(baseEl, knobEl);
//   joy.vector.x, joy.vector.y  // -1 ~ 1 사이 값, 매 프레임 읽어서 쓰면 됨
//   joy.destroy();              // 화면 나갈 때 이벤트 리스너 정리

function createJoystick(baseEl, knobEl) {
  const vector = { x: 0, y: 0 };
  let dragging = false;
  let activePointerId = null;

  function maxRadius() {
    return baseEl.offsetWidth / 2 - knobEl.offsetWidth / 2;
  }

  function setFromPointer(clientX, clientY) {
    const rect = baseEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const max = maxRadius();
    if (dist > max && dist > 0) {
      dx = (dx / dist) * max;
      dy = (dy / dist) * max;
    }
    knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
    vector.x = max > 0 ? dx / max : 0;
    vector.y = max > 0 ? dy / max : 0;
  }

  function reset() {
    vector.x = 0;
    vector.y = 0;
    knobEl.style.transform = 'translate(0px, 0px)';
  }

  function onPointerDown(e) {
    dragging = true;
    activePointerId = e.pointerId;
    baseEl.classList.add('joystick-active');
    baseEl.setPointerCapture(e.pointerId);
    setFromPointer(e.clientX, e.clientY);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!dragging || e.pointerId !== activePointerId) return;
    setFromPointer(e.clientX, e.clientY);
    e.preventDefault();
  }

  function onPointerUp(e) {
    if (e.pointerId !== activePointerId) return;
    dragging = false;
    activePointerId = null;
    baseEl.classList.remove('joystick-active');
    reset();
  }

  baseEl.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  // 키보드 방향키(데스크톱 테스트용) — 조이스틱 값에 함께 반영
  const keys = new Set();
  function onKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      keys.add(e.key);
      updateFromKeys();
    }
  }
  function onKeyUp(e) {
    keys.delete(e.key);
    if (!dragging) updateFromKeys();
  }
  function updateFromKeys() {
    if (dragging) return;
    let kx = 0;
    let ky = 0;
    if (keys.has('ArrowLeft')) kx -= 1;
    if (keys.has('ArrowRight')) kx += 1;
    if (keys.has('ArrowUp')) ky -= 1;
    if (keys.has('ArrowDown')) ky += 1;
    if (kx === 0 && ky === 0) {
      reset();
      return;
    }
    const len = Math.hypot(kx, ky) || 1;
    vector.x = kx / len;
    vector.y = ky / len;
    knobEl.style.transform = `translate(${vector.x * maxRadius()}px, ${vector.y * maxRadius()}px)`;
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  function destroy() {
    baseEl.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  }

  return { vector, destroy };
}

window.Joystick = { create: createJoystick };
