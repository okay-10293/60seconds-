// ============================================================
// joystick.js — 화면 위 가상 조이스틱 (터치/마우스 공용)
// ============================================================
// 사용법:
//   const joy = window.Joystick.create({ mode, zoneEl, baseEl, knobEl });
//   joy.vector.x, joy.vector.y  // -1 ~ 1 사이 값, 매 프레임 읽어서 쓰면 됨
//   joy.destroy();              // 화면 나갈 때 이벤트 리스너 정리
//
// mode: 'fixed'(고정형, 기본값) — 조이스틱이 항상 zone 한가운데 고정.
//       'dynamic'(유동형) — zone 안 아무 데나 손가락을 짚으면 그 자리에
//       조이스틱이 나타나 따라다닌다. 단, zone 밖(맵 쪽)으로는 절대 못
//       나가도록 zoneEl 안에서만 중심 좌표를 clamp 한다.

function createJoystick({ mode = 'fixed', zoneEl, baseEl, knobEl }) {
  const vector = { x: 0, y: 0 };
  let dragging = false;
  let activePointerId = null;
  const isDynamic = mode === 'dynamic';
  // 유동형에서 pointerdown을 받을 영역은 조이스틱 원판(baseEl)이 아니라 그보다
  // 넓은 zoneEl 전체다 — 그래야 "일정 범위 안 아무 데나" 짚었을 때 반응한다.
  const listenEl = isDynamic ? zoneEl : baseEl;

  if (isDynamic) {
    baseEl.classList.add('joystick-dynamic');
  }

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

  // 유동형 전용: zoneEl 기준 좌표로 baseEl을 옮겨 그 자리에 띄운다.
  // baseEl 반지름만큼은 항상 zoneEl 안쪽에 있도록 clamp해서, 조이스틱
  // 원판 자체가 zone 밖(=맵 쪽)으로 삐져나가는 일이 없게 한다.
  function placeBaseAt(clientX, clientY) {
    const zoneRect = zoneEl.getBoundingClientRect();
    const half = baseEl.offsetWidth / 2;
    let x = clientX - zoneRect.left;
    let y = clientY - zoneRect.top;
    x = Math.max(half, Math.min(zoneRect.width - half, x));
    y = Math.max(half, Math.min(zoneRect.height - half, y));
    baseEl.style.left = `${x}px`;
    baseEl.style.top = `${y}px`;
  }

  function onPointerDown(e) {
    dragging = true;
    activePointerId = e.pointerId;
    baseEl.classList.add('joystick-active');
    if (isDynamic) {
      placeBaseAt(e.clientX, e.clientY);
      baseEl.classList.add('joystick-visible');
    }
    listenEl.setPointerCapture(e.pointerId);
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
    if (isDynamic) baseEl.classList.remove('joystick-visible');
    reset();
  }

  listenEl.addEventListener('pointerdown', onPointerDown);
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
    listenEl.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  }

  return { vector, destroy };
}

window.Joystick = { create: createJoystick };
