(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  const startScreen = document.getElementById('startScreen');
  const startBtn = document.getElementById('startBtn');
  const pauseOverlay = document.getElementById('pauseOverlay');
  const finishScreen = document.getElementById('finishScreen');
  const restartBtn = document.getElementById('restartBtn');
  const creditsBtn = document.getElementById('creditsBtn');
  const creditsBackBtn = document.getElementById('creditsBackBtn');
  const creditsScreen = document.getElementById('creditsScreen');
  const creditsList = document.getElementById('creditsList');
  const hud = document.getElementById('hud');

  const hudPosition = document.getElementById('hudPosition');
  const hudLap = document.getElementById('hudLap');
  const hudSpeed = document.getElementById('hudSpeed');
  const hudScore = document.getElementById('hudScore');
  const hudDriftDistance = document.getElementById('hudDriftDistance');
  const hudDriftCharge = document.getElementById('hudDriftCharge');
  const driftBar = document.getElementById('driftBar');
  const turboMsg = document.getElementById('turboMsg');

  const finishTitle = document.getElementById('finishTitle');
  const finishPosition = document.getElementById('finishPosition');
  const finishScore = document.getElementById('finishScore');
  const finishDrift = document.getElementById('finishDrift');

  const btnLeft = document.getElementById('btnLeft');
  const btnRight = document.getElementById('btnRight');
  const btnGas = document.getElementById('btnGas');
  const btnBrake = document.getElementById('btnBrake');
  const btnDrift = document.getElementById('btnDrift');

  const TWO_PI = Math.PI * 2;
  function normalizeAngle(a) {
    while (a > Math.PI) a -= TWO_PI;
    while (a < -Math.PI) a += TWO_PI;
    return a;
  }
  function angleDiff(a, b) { return normalizeAngle(a - b); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
  function rand(min, max) { return min + Math.random() * (max - min); }

  const TRACK_WIDTH = 260;

  const controlPoints = [
    { x: 500,  y: 1300 },
    { x: 1300, y: 1420 },
    { x: 2100, y: 1380 },
    { x: 2700, y: 1500 },
    { x: 3050, y: 1250 },
    { x: 2750, y: 1000 },
    { x: 2150, y: 1050 },
    { x: 1700, y: 900 },
    { x: 1900, y: 620 },
    { x: 1450, y: 380 },
    { x: 850,  y: 340 },
    { x: 420,  y: 560 },
    { x: 260,  y: 950 },
  ];

  function catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t +
      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
    const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
    return { x, y };
  }

  function buildTrack() {
    const n = controlPoints.length;
    const samplesPerSeg = 14;
    const raw = [];
    for (let i = 0; i < n; i++) {
      const p0 = controlPoints[(i - 1 + n) % n];
      const p1 = controlPoints[i];
      const p2 = controlPoints[(i + 1) % n];
      const p3 = controlPoints[(i + 2) % n];
      for (let s = 0; s < samplesPerSeg; s++) {
        const t = s / samplesPerSeg;
        raw.push(catmullRom(p0, p1, p2, p3, t));
      }
    }
    const pts = [];
    let cum = 0;
    for (let i = 0; i < raw.length; i++) {
      const cur = raw[i];
      const next = raw[(i + 1) % raw.length];
      const tangentAngle = Math.atan2(next.y - cur.y, next.x - cur.x);
      if (i > 0) cum += dist(raw[i - 1].x, raw[i - 1].y, cur.x, cur.y);
      pts.push({
        x: cur.x, y: cur.y,
        angle: tangentAngle,
        nx: Math.cos(tangentAngle + Math.PI / 2),
        ny: Math.sin(tangentAngle + Math.PI / 2),
        arc: cum,
      });
    }
    const totalLength = cum + dist(raw[raw.length - 1].x, raw[raw.length - 1].y, raw[0].x, raw[0].y);
    return { points: pts, length: totalLength };
  }

  const track = buildTrack();
  const TRACK_N = track.points.length;

  const trackBounds = (() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of track.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY };
  })();

  function nearestTrackIndex(x, y, hint) {
    const h = hint === undefined ? 0 : hint;
    const WINDOW = 50;
    let bestI = h, bestD = Infinity;
    for (let k = -WINDOW; k <= WINDOW; k++) {
      const i = ((h + k) % TRACK_N + TRACK_N) % TRACK_N;
      const p = track.points[i];
      const dx = p.x - x, dy = p.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; bestI = i; }
    }
    return bestI;
  }

  const scenery = [];
  (function buildScenery() {
    for (let i = 0; i < TRACK_N; i += 4) {
      const p = track.points[i];
      if (Math.random() < 0.55) {
        const side = Math.random() < 0.5 ? 1 : -1;
        const offset = TRACK_WIDTH / 2 + rand(60, 170);
        scenery.push({
          x: p.x + p.nx * offset * side,
          y: p.y + p.ny * offset * side,
          type: Math.random() < 0.82 ? 'tree' : 'sign',
          r: rand(14, 24),
        });
      }
    }
  })();

  const keys = {};
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'KeyP') togglePause();
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  const touchInput = { left: false, right: false, gas: false, brake: false, drift: false };
  function bindTouch(el, key) {
    if (!el) return;
    const on = (e) => { e.preventDefault(); touchInput[key] = true; };
    const off = (e) => { e.preventDefault(); touchInput[key] = false; };
    el.addEventListener('touchstart', on, { passive: false });
    el.addEventListener('touchend', off, { passive: false });
    el.addEventListener('touchcancel', off, { passive: false });
    el.addEventListener('mousedown', on);
    el.addEventListener('mouseup', off);
    el.addEventListener('mouseleave', off);
  }
  bindTouch(btnLeft, 'left');
  bindTouch(btnRight, 'right');
  bindTouch(btnGas, 'gas');
  bindTouch(btnBrake, 'brake');
  bindTouch(btnDrift, 'drift');

  function getPlayerControls() {
    const steer = ((keys['ArrowLeft'] || touchInput.left) ? -1 : 0) +
                  ((keys['ArrowRight'] || touchInput.right) ? 1 : 0);
    const throttle = ((keys['ArrowUp'] || touchInput.gas) ? 1 : 0) -
                      ((keys['ArrowDown'] || touchInput.brake) ? 1 : 0);
    const driftHeld = !!(keys['Space'] || touchInput.drift);
    return { steer: clamp(steer, -1, 1), throttle, driftHeld };
  }

  const CAR_LENGTH = 34, CAR_WIDTH = 18;
  const MAX_SPEED = 620;
  const MAX_REVERSE = -200;
  const ACCEL = 420;
  const BRAKE_POWER = 640;
  const FRICTION = 260;
  const GRASS_DRAG = 3.2;
  const TURN_RATE = 2.6;
  const DRIFT_TURN_RATE = 3.4;
  const GRIP_NORMAL = 10;
  const GRIP_DRIFT = 2.0;
  const DRIFT_MIN_SPEED = 140;
  const DRIFT_SPEED_LOSS = 40;
  const TURBO_BLUE = 90, TURBO_YELLOW = 170, TURBO_PURPLE = 280;
  const TURBO_DECAY = 220;       // px/s^2 - how fast the turbo overspeed bleeds off
  const TURBO_BOOST_CAP = 420;   // max stacked overspeed from chained drifts

  const AI_COLORS = ['#ff5c5c', '#5cff8a', '#ffd35c', '#5c9dff', '#ff5cf0'];

  function makeCar(color, isPlayer) {
    const p = track.points[0];
    return {
      x: p.x, y: p.y,
      heading: p.angle,
      velAngle: p.angle,
      speed: 0,
      color,
      isPlayer: !!isPlayer,
      isDrifting: false,
      driftTimer: 0,
      driftDir: 0,
      totalDriftDistance: 0,
      trackIndex: 0,
      turboBoost: 0,
      lap: 0,
      progress: 0,
      position: 1,
      finished: false,
      _prevArcFrac: undefined,
      aiPhase: Math.random() * TWO_PI,
      aiFreq: rand(0.15, 0.35),
      aiLaneAmp: rand(40, 110),
      aiSpeedMul: rand(0.74, 0.88),
      topSpeed: MAX_SPEED,
      aiLookahead: Math.floor(rand(10, 18)),
      score: 0,
    };
  }

  let turboMsgTimer = 0;
  function triggerTurboMessage(tier) {
    turboMsg.textContent = 'MINI TURBO!';
    turboMsg.className = 'turbo-msg show tier-' + tier;
    turboMsgTimer = 1.0;
  }

  const camera = { x: 0, y: 0, shake: 0 };
  function triggerShake(amount) { camera.shake = Math.min(20, camera.shake + amount); }

  function updateCarPhysics(car, controls, dt) {
    const { steer, throttle, driftHeld } = controls;
    const speedFactor = clamp(Math.abs(car.speed) / MAX_SPEED, 0.25, 1);

    const canDrift = Math.abs(car.speed) > DRIFT_MIN_SPEED;
    if (driftHeld && canDrift && steer !== 0 && !car.isDrifting) {
      car.isDrifting = true;
      car.driftTimer = 0;
      car.driftDir = steer;
    }

    if (car.isDrifting) {
      car.driftTimer += dt;
      car.heading += steer * DRIFT_TURN_RATE * dt * speedFactor;
      const diff = angleDiff(car.heading, car.velAngle);
      car.velAngle += diff * clamp(GRIP_DRIFT * dt, 0, 1);
      car.speed = Math.max(DRIFT_MIN_SPEED * 0.5, car.speed - DRIFT_SPEED_LOSS * dt);
      const step = Math.abs(car.speed + car.turboBoost) * dt;
      car.totalDriftDistance += step;
      if (car.isPlayer) spawnDriftEffects(car);
    } else {
      car.heading += steer * TURN_RATE * dt * speedFactor;
      const diff = angleDiff(car.heading, car.velAngle);
      car.velAngle += diff * clamp(GRIP_NORMAL * dt, 0, 1);
    }

    if (!driftHeld && car.isDrifting) {
      let boost = TURBO_BLUE, tier = 'blue';
      if (car.driftTimer >= 2) { boost = TURBO_PURPLE; tier = 'purple'; }
      else if (car.driftTimer >= 1) { boost = TURBO_YELLOW; tier = 'yellow'; }
      car.turboBoost = Math.min(TURBO_BOOST_CAP, car.turboBoost + boost);
      car.velAngle = car.heading;
      car.isDrifting = false;
      car.driftTimer = 0;
      if (car.isPlayer) {
        triggerTurboMessage(tier);
        triggerShake(tier === 'purple' ? 10 : tier === 'yellow' ? 6 : 3);
      }
    }

    // turbo overspeed decays independently of the throttle-driven base speed,
    // so holding the gas pedal alone can never reach mini-turbo speeds.
    if (car.turboBoost > 0) {
      car.turboBoost = Math.max(0, car.turboBoost - TURBO_DECAY * dt);
    }

    if (throttle > 0) {
      car.speed += ACCEL * throttle * dt;
    } else if (throttle < 0) {
      const mag = -throttle;
      if (car.speed > 20) car.speed -= BRAKE_POWER * mag * dt;
      else car.speed -= ACCEL * 0.6 * mag * dt;
    } else {
      if (car.speed > 0) car.speed = Math.max(0, car.speed - FRICTION * dt);
      else if (car.speed < 0) car.speed = Math.min(0, car.speed + FRICTION * dt);
    }
    car.speed = clamp(car.speed, MAX_REVERSE, car.topSpeed);

    const ti = nearestTrackIndex(car.x, car.y, car.trackIndex);
    car.trackIndex = ti;
    const tp = track.points[ti];
    const lateral = (car.x - tp.x) * tp.nx + (car.y - tp.y) * tp.ny;
    if (Math.abs(lateral) > TRACK_WIDTH / 2) {
      const drag = Math.max(0, 1 - GRASS_DRAG * dt);
      car.speed *= drag;
      car.turboBoost *= drag;
      const overshoot = Math.abs(lateral) - TRACK_WIDTH / 2;
      const pull = clamp(overshoot * 0.03, 0, 4);
      const s = Math.sign(lateral);
      car.x -= s * tp.nx * pull;
      car.y -= s * tp.ny * pull;
    }

    const finalMoveSpeed = car.speed + car.turboBoost;
    car.x += Math.cos(car.velAngle) * finalMoveSpeed * dt;
    car.y += Math.sin(car.velAngle) * finalMoveSpeed * dt;

    const arcFrac = tp.arc / track.length;
    if (car._prevArcFrac !== undefined) {
      if (car._prevArcFrac > 0.85 && arcFrac < 0.15) car.lap += 1;
      else if (car._prevArcFrac < 0.15 && arcFrac > 0.85) car.lap -= 1;
    }
    car._prevArcFrac = arcFrac;
    const along = (car.x - tp.x) * Math.cos(tp.angle) + (car.y - tp.y) * Math.sin(tp.angle);
    car.progress = car.lap * track.length + tp.arc + along;
  }

  function getAIControls(car, dt) {
    const lookIdx = (car.trackIndex + car.aiLookahead) % TRACK_N;
    const tp = track.points[lookIdx];
    car.aiPhase += car.aiFreq * dt;
    const laneOffset = Math.sin(car.aiPhase) * car.aiLaneAmp;
    const targetX = tp.x + tp.nx * laneOffset;
    const targetY = tp.y + tp.ny * laneOffset;
    const desiredHeading = Math.atan2(targetY - car.y, targetX - car.x);
    const diff = angleDiff(desiredHeading, car.heading);
    const steer = clamp(diff * 2.2, -1, 1);
    const cornerSharpness = clamp(Math.abs(diff) * 1.6, 0, 1);
    const throttle = clamp(1 - cornerSharpness * 0.6, 0.35, 1);
    const lapGap = (car.progress - player.progress) / track.length;
    const catchUp = clamp(1 - lapGap * 0.4, 0.92, 1.06);
    car.topSpeed = MAX_SPEED * car.aiSpeedMul * catchUp;
    return { steer, throttle, driftHeld: false };
  }

  function resolveCollisions(cars) {
    const R = 20;
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i], b = cars[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const minD = R * 2;
        if (d > 0 && d < minD) {
          const overlap = (minD - d) / 2;
          const nx = dx / d, ny = dy / d;
          a.x -= nx * overlap; a.y -= ny * overlap;
          b.x += nx * overlap; b.y += ny * overlap;
          a.speed *= 0.85; b.speed *= 0.85;
          a.turboBoost *= 0.85; b.turboBoost *= 0.85;
          spawnImpactParticles((a.x + b.x) / 2, (a.y + b.y) / 2);
          if (a.isPlayer || b.isPlayer) triggerShake(6);
        }
      }
    }
  }

  const particles = [];
  const tireMarks = [];
  const impactParticles = [];

  function spawnDriftEffects(car) {
    const rx = car.x - Math.cos(car.heading) * (CAR_LENGTH * 0.4);
    const ry = car.y - Math.sin(car.heading) * (CAR_LENGTH * 0.4);

    tireMarks.push({ x: rx, y: ry, life: 3 });
    if (tireMarks.length > 900) tireMarks.shift();

    if (Math.random() < 0.9) {
      particles.push({
        x: rx + rand(-4, 4), y: ry + rand(-4, 4),
        vx: rand(-15, 15), vy: rand(-15, 15),
        life: rand(0.5, 0.9), maxLife: 0.9,
        size: rand(6, 14), type: 'smoke',
      });
    }

    let color = '#4fc3ff';
    if (car.driftTimer >= 2) color = '#c77dff';
    else if (car.driftTimer >= 1) color = '#ffe14f';
    for (let k = 0; k < 2; k++) {
      particles.push({
        x: rx, y: ry,
        vx: rand(-60, 60), vy: rand(-60, 60),
        life: rand(0.2, 0.4), maxLife: 0.4,
        size: rand(2, 4), type: 'spark', color,
      });
    }
  }

  function spawnImpactParticles(x, y) {
    for (let k = 0; k < 10; k++) {
      impactParticles.push({
        x, y, vx: rand(-140, 140), vy: rand(-140, 140),
        life: rand(0.3, 0.5), maxLife: 0.5, size: rand(2, 4),
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.type === 'smoke') p.size += 10 * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = impactParticles.length - 1; i >= 0; i--) {
      const p = impactParticles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) impactParticles.splice(i, 1);
    }
    for (let i = tireMarks.length - 1; i >= 0; i--) {
      tireMarks[i].life -= dt;
      if (tireMarks[i].life <= 0) tireMarks.splice(i, 1);
    }
  }

  let cars = [];
  let player = null;
  let state = 'start'; // start | playing | paused | finished
  let lastTime = 0;

  function resetGame() {
    cars = [];
    player = makeCar('#ffffff', true);
    cars.push(player);
    const tp = track.points[0];
    for (let i = 0; i < 5; i++) {
      const c = makeCar(AI_COLORS[i], false);
      const lane = ((i % 2 === 0) ? 1 : -1) * (40 + Math.floor(i / 2) * 40);
      c.x += tp.nx * lane - Math.cos(tp.angle) * (i + 1) * 55;
      c.y += tp.ny * lane - Math.sin(tp.angle) * (i + 1) * 55;
      cars.push(c);
    }
    cars.forEach((c) => {
      c.trackIndex = nearestTrackIndex(c.x, c.y, 0);
      const startFrac = track.points[c.trackIndex].arc / track.length;
      if (startFrac > 0.5) c.lap = -1;
      c._prevArcFrac = startFrac;
    });
    particles.length = 0;
    tireMarks.length = 0;
    impactParticles.length = 0;
    camera.x = player.x; camera.y = player.y; camera.shake = 0;
    turboMsg.classList.remove('show');
  }

  function updateRanking() {
    const sorted = [...cars].sort((a, b) => b.progress - a.progress);
    sorted.forEach((c, idx) => { c.position = idx + 1; });
  }

  function update(dt) {
    if (state !== 'playing') return;

    updateCarPhysics(player, getPlayerControls(), dt);
    for (let i = 1; i < cars.length; i++) {
      updateCarPhysics(cars[i], getAIControls(cars[i], dt), dt);
    }

    resolveCollisions(cars);
    updateParticles(dt);
    updateRanking();

    camera.x = lerp(camera.x, player.x, Math.min(1, dt * 4));
    camera.y = lerp(camera.y, player.y, Math.min(1, dt * 4));
    if (camera.shake > 0) camera.shake = Math.max(0, camera.shake - dt * 40);

    if (turboMsgTimer > 0) {
      turboMsgTimer -= dt;
      if (turboMsgTimer <= 0) turboMsg.classList.remove('show');
    }

    player.score = Math.floor(player.progress / 4 + player.totalDriftDistance / 3);
    updateHUD();

    if (player.lap >= 3 && !player.finished) {
      player.finished = true;
      finishRace();
    }
  }

  function updateHUD() {
    hudPosition.textContent = `${player.position}/${cars.length}`;
    hudLap.textContent = `LAP ${clamp(player.lap + 1, 1, 3)}/3`;
    hudSpeed.textContent = `${Math.round(Math.abs(player.speed + player.turboBoost) * 0.9)} KM/H`;
    hudScore.textContent = `${player.score}`;
    hudDriftDistance.textContent = `${Math.round(player.totalDriftDistance)} m`;

    let tierLabel = 'READY';
    let pct = 0;
    let tierClass = 'blue';
    if (player.isDrifting) {
      tierLabel = 'DRIFTING';
      if (player.driftTimer >= 2) tierClass = 'max';
      else if (player.driftTimer >= 1) tierClass = 'yellow';
      pct = clamp(player.driftTimer / 2, 0, 1) * 100;
    }
    hudDriftCharge.textContent = tierLabel;
    driftBar.style.width = pct + '%';
    driftBar.className = 'drift-bar-fill ' + tierClass;
  }

  function worldToScreen(x, y) {
    const sh = camera.shake;
    return {
      x: x - camera.x + canvas.width / 2 + (sh ? rand(-sh, sh) : 0),
      y: y - camera.y + canvas.height / 2 + (sh ? rand(-sh, sh) : 0),
    };
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#2e7d32';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    const gridSize = 80;
    const offX = ((camera.x % gridSize) + gridSize) % gridSize;
    const offY = ((camera.y % gridSize) + gridSize) % gridSize;
    for (let x = -offX; x < canvas.width; x += gridSize) {
      for (let y = -offY; y < canvas.height; y += gridSize) {
        if (((Math.round((x + offX) / gridSize) + Math.round((y + offY) / gridSize)) % 2) === 0) {
          ctx.fillRect(x, y, gridSize, gridSize);
        }
      }
    }

    drawTrack();
    drawScenery();
    drawTireMarks();
    drawCars();
    drawParticles();
    if (state === 'playing' || state === 'paused') drawMinimap();
  }

  const MINIMAP_W = 190, MINIMAP_H = 140, MINIMAP_MARGIN_RIGHT = 16, MINIMAP_MARGIN_TOP = 100;

  function minimapPoint(x, y, boxX, boxY, scale) {
    return {
      x: boxX + MINIMAP_W / 2 + (x - trackBounds.cx) * scale,
      y: boxY + MINIMAP_H / 2 + (y - trackBounds.cy) * scale,
    };
  }

  function drawMinimap() {
    const boxX = canvas.width - MINIMAP_W - MINIMAP_MARGIN_RIGHT;
    const boxY = MINIMAP_MARGIN_TOP;
    const scale = Math.min(MINIMAP_W / trackBounds.w, MINIMAP_H / trackBounds.h) * 0.82;

    ctx.fillStyle = 'rgba(10,14,20,0.6)';
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    roundRect(ctx, boxX, boxY, MINIMAP_W, MINIMAP_H, 10);
    ctx.fill(); ctx.stroke();

    ctx.beginPath();
    for (let i = 0; i <= TRACK_N; i++) {
      const p = track.points[i % TRACK_N];
      const mp = minimapPoint(p.x, p.y, boxX, boxY, scale);
      if (i === 0) ctx.moveTo(mp.x, mp.y); else ctx.lineTo(mp.x, mp.y);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 3;
    ctx.stroke();

    for (const c of cars) {
      const mp = minimapPoint(c.x, c.y, boxX, boxY, scale);
      ctx.beginPath();
      ctx.arc(mp.x, mp.y, c.isPlayer ? 4.5 : 3, 0, TWO_PI);
      ctx.fillStyle = c.isPlayer ? '#ffffff' : c.color;
      ctx.fill();
      if (c.isPlayer) {
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '10px Arial';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('MAP', boxX + 9, boxY + 16);
  }

  function drawTrack() {
    ctx.beginPath();
    for (let i = 0; i <= TRACK_N; i++) {
      const p = track.points[i % TRACK_N];
      const s = worldToScreen(p.x + p.nx * TRACK_WIDTH / 2, p.y + p.ny * TRACK_WIDTH / 2);
      if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
    }
    for (let i = TRACK_N; i >= 0; i--) {
      const p = track.points[i % TRACK_N];
      const s = worldToScreen(p.x - p.nx * TRACK_WIDTH / 2, p.y - p.ny * TRACK_WIDTH / 2);
      ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
    ctx.fillStyle = '#4a4a4f';
    ctx.fill();

    ctx.lineWidth = 10;
    for (let i = 0; i < TRACK_N; i++) {
      const p = track.points[i];
      const nextP = track.points[(i + 1) % TRACK_N];
      const color = (Math.floor(i / 4) % 2 === 0) ? '#ff3b3b' : '#f5f5f5';
      ctx.strokeStyle = color;

      const a1 = worldToScreen(p.x + p.nx * (TRACK_WIDTH / 2 - 4), p.y + p.ny * (TRACK_WIDTH / 2 - 4));
      const a2 = worldToScreen(nextP.x + nextP.nx * (TRACK_WIDTH / 2 - 4), nextP.y + nextP.ny * (TRACK_WIDTH / 2 - 4));
      ctx.beginPath(); ctx.moveTo(a1.x, a1.y); ctx.lineTo(a2.x, a2.y); ctx.stroke();

      const b1 = worldToScreen(p.x - p.nx * (TRACK_WIDTH / 2 - 4), p.y - p.ny * (TRACK_WIDTH / 2 - 4));
      const b2 = worldToScreen(nextP.x - nextP.nx * (TRACK_WIDTH / 2 - 4), nextP.y - nextP.ny * (TRACK_WIDTH / 2 - 4));
      ctx.beginPath(); ctx.moveTo(b1.x, b1.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
    }

    ctx.setLineDash([20, 20]);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i <= TRACK_N; i++) {
      const p = track.points[i % TRACK_N];
      const s = worldToScreen(p.x, p.y);
      if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    const fp = track.points[0];
    const s1 = worldToScreen(fp.x + fp.nx * TRACK_WIDTH / 2, fp.y + fp.ny * TRACK_WIDTH / 2);
    const s2 = worldToScreen(fp.x - fp.nx * TRACK_WIDTH / 2, fp.y - fp.ny * TRACK_WIDTH / 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
  }

  function drawScenery() {
    for (const s of scenery) {
      const p = worldToScreen(s.x, s.y);
      if (p.x < -50 || p.x > canvas.width + 50 || p.y < -50 || p.y > canvas.height + 50) continue;
      if (s.type === 'tree') {
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(p.x - 3, p.y - 4, 6, 10);
        ctx.beginPath(); ctx.arc(p.x, p.y - 10, s.r, 0, TWO_PI);
        ctx.fillStyle = '#1b5e20'; ctx.fill();
      } else {
        ctx.fillStyle = '#eeeeee';
        ctx.fillRect(p.x - 2, p.y - 2, 4, 20);
        ctx.fillStyle = '#ffb300';
        ctx.fillRect(p.x - 10, p.y - 20, 20, 14);
      }
    }
  }

  function drawTireMarks() {
    ctx.fillStyle = 'rgba(20,20,20,0.35)';
    for (const t of tireMarks) {
      const p = worldToScreen(t.x, t.y);
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, TWO_PI); ctx.fill();
    }
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawCars() {
    const sorted = [...cars].sort((a, b) => a.y - b.y);
    for (const c of sorted) {
      const p = worldToScreen(c.x, c.y);
      ctx.save();
      ctx.translate(p.x, p.y);

      ctx.save();
      ctx.rotate(c.heading);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-CAR_LENGTH / 2 + 3, -CAR_WIDTH / 2 + 3, CAR_LENGTH, CAR_WIDTH);
      ctx.restore();

      ctx.rotate(c.heading);
      ctx.fillStyle = c.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2;
      roundRect(ctx, -CAR_LENGTH / 2, -CAR_WIDTH / 2, CAR_LENGTH, CAR_WIDTH, 5);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = 'rgba(150,220,255,0.85)';
      ctx.fillRect(0, -CAR_WIDTH / 2 + 3, CAR_LENGTH / 3, CAR_WIDTH - 6);

      ctx.fillStyle = '#ff1744';
      ctx.fillRect(-CAR_LENGTH / 2, -CAR_WIDTH / 2 + 2, 3, CAR_WIDTH - 4);

      ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const s = worldToScreen(p.x, p.y);
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      if (p.type === 'smoke') {
        ctx.fillStyle = `rgba(200,200,200,${alpha * 0.5})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, p.size, 0, TWO_PI); ctx.fill();
      } else {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(s.x, s.y, p.size, 0, TWO_PI); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    for (const p of impactParticles) {
      const s = worldToScreen(p.x, p.y);
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = `rgba(255,220,120,${alpha})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, p.size, 0, TWO_PI); ctx.fill();
    }
  }

  function finishRace() {
    state = 'finished';
    finishTitle.textContent = player.position === 1 ? 'YOU WIN!' : 'RACE FINISHED';
    finishPosition.textContent = `Position: ${player.position}/${cars.length}`;
    finishScore.textContent = `Score: ${player.score}`;
    finishDrift.textContent = `Drift Distance: ${Math.round(player.totalDriftDistance)} m`;
    finishScreen.classList.add('show');
    hud.classList.remove('show');
  }

  function togglePause() {
    if (state === 'playing') {
      state = 'paused';
      pauseOverlay.classList.add('show');
    } else if (state === 'paused') {
      state = 'playing';
      pauseOverlay.classList.remove('show');
      lastTime = performance.now();
    }
  }

  function startRace() {
    resetGame();
    state = 'playing';
    startScreen.classList.remove('show');
    finishScreen.classList.remove('show');
    pauseOverlay.classList.remove('show');
    hud.classList.add('show');
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  const TEAM_MEMBERS = [
    { name: 'ISHA SONI', role: '24BCG10022' },
    { name: 'HIMANSHU KUMAR', role: '24BCG10019' },
    { name: 'YASH BURAD', role: '24BCG10140' },
    { name: 'ADI MIDLA', role: '24BCG10117' },
    { name: 'SAMAY RAJPUT', role: '24BCG10018' },
    { name: 'FIONA DEY', role: '24BCG10020' },
    { name: 'SOHIKA SHARMA', role: '24BCG10029' },
    { name: 'THIGULLA SHASHANK BHARADWAJ', role: '24BCG10050' },
  ];

  TEAM_MEMBERS.forEach((m) => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    const role = document.createElement('span');
    name.textContent = m.name;
    role.textContent = m.role;
    role.className = 'role';
    li.appendChild(name);
    li.appendChild(role);
    creditsList.appendChild(li);
  });

  creditsBtn.addEventListener('click', () => {
    startScreen.classList.remove('show');
    creditsScreen.classList.add('show');
  });
  creditsBackBtn.addEventListener('click', () => {
    creditsScreen.classList.remove('show');
    startScreen.classList.add('show');
  });

  startBtn.addEventListener('click', startRace);
  restartBtn.addEventListener('click', startRace);

  function loop(now) {
    const dt = clamp((now - lastTime) / 1000, 0, 0.05);
    lastTime = now;
    update(dt);
    draw();
    if (state === 'playing' || state === 'paused') {
      requestAnimationFrame(loop);
    }
  }

  function idleRender() {
    draw();
    if (state === 'start') requestAnimationFrame(idleRender);
  }

  camera.x = track.points[0].x;
  camera.y = track.points[0].y;
  idleRender();

})();
