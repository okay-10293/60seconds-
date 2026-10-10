// ============================================================
// joystick.js — 화면 위 가상 조이스틱 (터치/마우스 공용)
// ============================================================
// 사용법:
//   const joy = window.Joystick.create({ mode, zoneEl, baseEl, knobEl });
//   joy.vector.x, joy.vector.y  // -1 ~ 1 사이 값, 매 프레임 읽어서 쓰면 됨
//   joy.destroy();              // 화면 나갈 때 이벤트 리스너 정리
//
// mode: 'fixed'(고정형, 기본값) — 조이스틱이 항상 zone 한가운데 고정.
//       'dynamic'(유동형) — 브롤스타즈/로블록스 스타일. zone 안 손가락을
//       짚으면 그 자리에 조이스틱이 나타나고, 손가락을 최대 반경 밖으로
//       계속 끌고 가면 조이스틱 본체가 손가락을 슬금슬금 따라온다(트레일링).
//       단, 본체가 zone 밖(맵 쪽)으로 삐져나가지는 못하도록 clamp 한다.

function createJoystick({ mode = 'fixed', zoneEl, baseEl, knobEl }) {
  const vector = { x: 0, y: 0 };
  let dragging = false;
  let activePointerId = null;
  const isDynamic = mode === 'dynamic';
  // 유동형에서 pointerdown을 받을 영역은 조이스틱 원판(baseEl)이 아니라 그보다
  // 넓은 zoneEl 전체다 — 그래야 "일정 범위 안 아무 데나" 짚었을 때 반응한다.
  const listenEl = isDynamic ? zoneEl : baseEl;
  // 유동형에서 지금 베이스 중심이 zoneEl 기준 어디에 있는지 (px). pointerdown마다
  // 새로 잡고, 드래그 중엔 이 값을 기준으로 "손가락을 따라오는" 계산을 한다.
  let baseCenter = { x: 0, y: 0 };

  if (isDynamic) {
    baseEl.classList.add('joystick-dynamic');
  }

  function maxRadius() {
    return baseEl.offsetWidth / 2 - knobEl.offsetWidth / 2;
  }

  // zoneEl 안쪽(half만큼 여유)으로만 베이스 중심이 있을 수 있게 clamp
  function clampToZone(x, y) {
    const zoneRect = zoneEl.getBoundingClientRect();
    const half = baseEl.offsetWidth / 2;
    return {
      x: Math.max(half, Math.min(zoneRect.width - half, x)),
      y: Math.max(half, Math.min(zoneRect.height - half, y)),
    };
  }

  function setBaseCenter(x, y) {
    baseCenter = clampToZone(x, y);
    baseEl.style.left = `${baseCenter.x}px`;
    baseEl.style.top = `${baseCenter.y}px`;
  }

  function setFromPointer(clientX, clientY) {
    const max = maxRadius();
    let cx;
    let cy;

    if (isDynamic) {
      const zoneRect = zoneEl.getBoundingClientRect();
      cx = zoneRect.left + baseCenter.x;
      cy = zoneRect.top + baseCenter.y;
    } else {
      const rect = baseEl.getBoundingClientRect();
      cx = rect.left + rect.width / 2;
      cy = rect.top + rect.height / 2;
    }

    let dx = clientX - cx;
    let dy = clientY - cy;
    const d = Math.hypot(dx, dy);

    if (isDynamic && d > max && d > 0) {
      // 최대 반경을 넘어간 만큼 베이스 자체를 손가락 쪽으로 옮긴다
      // (브롤스타즈처럼 조이스틱 본체가 손가락을 따라 슬금슬금 이동)
      const ux = dx / d;
      const uy = dy / d;
      const zoneRect = zoneEl.getBoundingClientRect();
      setBaseCenter(clientX - zoneRect.left - ux * max, clientY - zoneRect.top - uy * max);
      dx = ux * max;
      dy = uy * max;
    } else if (d > max && d > 0) {
      dx = (dx / d) * max;
      dy = (dy / d) * max;
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
    if (isDynamic) {
      const zoneRect = zoneEl.getBoundingClientRect();
      setBaseCenter(e.clientX - zoneRect.left, e.clientY - zoneRect.top);
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

  // 키보드(PC): WASD 또는 방향키로 이동 — 조이스틱 값에 함께 반영한다.
  // e.key 대신 e.code(물리 키 위치)를 쓰는 이유: 한글 입력 상태에서는 W가 'ㅈ'으로
  // 들어와 e.key로는 못 알아보기 때문.
  const KEY_DIRS = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
  };
  const keys = new Set(); // 지금 눌려 있는 물리 키
  function onKeyDown(e) {
    if (!KEY_DIRS[e.code]) return;
    e.preventDefault(); // 방향키로 페이지가 스크롤되는 것 방지
    keys.add(e.code);
    updateFromKeys();
  }
  function onKeyUp(e) {
    if (!KEY_DIRS[e.code]) return;
    keys.delete(e.code);
    if (!dragging) updateFromKeys();
  }
  function onBlur() {
    // 창을 벗어난 사이 키를 뗐다면 keyup을 못 받아 계속 걸어가는 걸 방지
    keys.clear();
    if (!dragging) updateFromKeys();
  }
  function updateFromKeys() {
    if (dragging) return;
    let kx = 0;
    let ky = 0;
    keys.forEach((code) => {
      const dir = KEY_DIRS[code];
      if (dir === 'left') kx -= 1;
      else if (dir === 'right') kx += 1;
      else if (dir === 'up') ky -= 1;
      else if (dir === 'down') ky += 1;
    });
    kx = Math.max(-1, Math.min(1, kx));
    ky = Math.max(-1, Math.min(1, ky));
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
  window.addEventListener('blur', onBlur);

  function destroy() {
    listenEl.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
  }

  return { vector, destroy };
}

window.Joystick = { create: createJoystick };
