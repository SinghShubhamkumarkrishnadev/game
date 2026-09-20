/* Jodi Race - 3D Hyper-Realistic Multiplayer Racing Engine (Core Controller)
 * Three.js r128, ES5 syntax.
 *
 * CONVENTIONS (read once, everything below follows from them)
 *  - lateralOffset / tiltAngle / steerAngle are all "LEFT = POSITIVE".
 *  - The bike model is assumed to point its nose along local +Z, Y up, so
 *    local +X is the rider's LEFT (three.js is right-handed). If your model
 *    faces -Z instead, set MODEL_FORWARD_SIGN = -1 and nothing else changes.
 *  - Road frame is a right-handed orthonormal basis (left, up, forward) with
 *    left x up = forward, so makeBasis() always yields a pure rotation.
 */
(function (global) {
  'use strict';

  /* ================= TUNING ================= */
  var MODEL_FORWARD_SIGN = 1;      // +1: bike nose = model +Z (default) | -1: nose = model -Z
  var LANE_WIDTH = 6;              // metres per 1.0 of lateralOffset
  var LATERAL_LIMIT = 0.85;
  var MAX_BANK = 0.45;             // rad, max lean into a turn
  var MAX_FORK = 0.45;             // rad, max handlebar angle
  var TILT_DEADZONE_DEG = 3.2;     // gyroscope deadzone
  var TILT_RANGE_DEG = 20;         // degrees past the deadzone for full lock
  var NITRO_SPEED_MULT = 1.4;
  var OVERSPEED_DECAY = 20;        // m/s^2, bleeds nitro overspeed back to maxSpeed
  var CRASH_DURATION = 2.0;
  var COLLISION_DIST = 2.2;
  var STALE_SYNC_SEC = 1.5;        // stop dead-reckoning the partner after this long without packets
  var FRAME_TURN_RATE = 3.0;       // rad/s, max roll-frame catch-up near vertical tangents
  var BASE_FOV = 65;
  var ENABLE_SHADOWS = true;
  var SHADOW_EXTENT = 45;          // half-size (m) of the shadow box that follows the player
  var SUN_OFFSET = new THREE.Vector3(80, 120, 60);
  var WORLD_UP = new THREE.Vector3(0, 1, 0);

  /* ================= HELPERS ================= */
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function wrap01(v) {
    v = v % 1;
    if (v < 0) v += 1;
    return v >= 1 ? 0 : v;
  }
  function damp(rate, dt) { return 1 - Math.exp(-rate * dt); }   // frame-rate independent smoothing

  /* ================= STATE ================= */
  var scene, camera, renderer, sun;
  var trackCurve = null;
  var curveLength = 1600;
  var minimapPoints = [];
  var minimapBounds = { minX: -400, maxX: 400, minZ: -400, maxZ: 400 };
  var minimapCache = { canvas: null, w: 0, h: 0, pts: null };
  var minimapTimer = 0;

  var playerBike, partnerBike, partnerNameSprite;
  var isRunning = false;
  var animFrameId = null;
  var containerEl = null;
  var sparkParticles = null;
  var cameraSnap = true;
  var loopErrors = 0;
  var bannerTimer = null;

  var raceTimer = 0;

  // Gyroscope steering
  var currentTiltSteer = 0;
  var targetTiltSteer = 0;
  var hasTiltSensor = false;
  var tiltState = 'idle';          // idle | pending | granted | denied
  var tiltNeutralBeta = null;      // landscape auto-calibration

  // Listener bookkeeping (so restarts never stack handlers)
  var onKeyDownRef = null;
  var onKeyUpRef = null;
  var onBlurRef = null;
  var onVisRef = null;
  var onOrientRef = null;
  var touchCleanups = [];
  var input = { kb: {}, touch: {} };

  // Partner
  var partnerPhysics = {
    pos: new THREE.Vector3(0, 0, 0),
    raceProgress: 0.005,           // unwrapped: (lap - 1) + progress. Never needs wrap-around logic.
    targetRaceProgress: 0.005,
    trackProgress: 0.005,
    lateralOffset: 0.38,
    targetLateralOffset: 0.38,
    speed: 0,
    tiltAngle: 0,
    targetTiltAngle: 0,
    isNitro: false,
    lap: 1,
    isCrashed: false,
    crashTimer: 0,
    crashSide: 1,
    syncAge: 0,
    hasSynced: false,
    name: 'Partner',
    avatar: '💖',
    theme: 'bullet'
  };

  var raceState = {
    totalLaps: 3,
    playerLap: 1,
    partnerLap: 1,
    playerScore: 0,
    partnerScore: 0,
    isFinished: false,
    winner: null,
    elapsed: 0,
    syncTimer: 0,
    onSyncCallback: null,
    onTakedownCallback: null,
    onFinishCallback: null,
    isSoloAI: true,
    isHost: true
  };

  // Player
  var bikePhysics = {
    pos: new THREE.Vector3(0, 0, 0),
    raceProgress: 0.012,           // unwrapped; lap = floor(raceProgress) + 1
    trackProgress: 0.012,          // wrapped 0..1
    speed: 0,
    maxSpeed: 42,
    accel: 24,
    decel: 16,
    brake: 38,
    lateralOffset: -0.38,
    tiltAngle: 0,                  // lean, LEFT = +
    steerAngle: 0,                 // handlebar, LEFT = +
    nitroFuel: 100,
    isNitro: false,
    isCrashed: false,
    crashTimer: 0,
    crashSide: 1,
    collisionCooldown: 4.0,
    controls: { left: false, right: false, gas: false, brake: false, nitro: false }
  };

  /* ================= ROAD FRAME (orthonormal, flip-proof) ================= */
  var _tan = new THREE.Vector3();
  var _lvl = new THREE.Vector3();
  var _prev = new THREE.Vector3();
  var _m4 = new THREE.Matrix4();
  var _negA = new THREE.Vector3();
  var _negB = new THREE.Vector3();
  var _behind = new THREE.Vector3();
  var _camPos = new THREE.Vector3();
  var _camLook = new THREE.Vector3();
  var _lookSmooth = new THREE.Vector3();
  var _tmpV = new THREE.Vector3();
  var _tmpX = new THREE.Vector3();

  function makeFrame() {
    return {
      ready: false,
      center: new THREE.Vector3(),
      pos: new THREE.Vector3(),
      fwd: new THREE.Vector3(0, 0, 1),
      left: new THREE.Vector3(1, 0, 0),
      up: new THREE.Vector3(0, 1, 0)
    };
  }
  var playerFrame = makeFrame();
  var partnerFrame = makeFrame();

  function perpendicularTo(t, out) {
    if (Math.abs(t.x) < 0.9) out.set(1, 0, 0); else out.set(0, 0, 1);
    out.addScaledVector(t, -out.dot(t));
    var l = out.length();
    if (l > 1e-8) out.multiplyScalar(1 / l);
    return out;
  }

  /* Builds (left, up, forward) at `progress`:
   *   left    = worldUp x tangent           (horizontal, so `up` can never point below the sky)
   *   up      = tangent x left              (perpendicular to the road, up.y >= 0)
   *   forward = tangent
   * left x up = forward, so det = +1 and makeBasis() is a true rotation.
   * Near-vertical tangents (worldUp x tangent -> 0) fall back to the previous
   * frame, projected onto the new tangent, so steep inclines cannot flip the bike. */
  function sampleRoad(frame, progress, lateral, dt) {
    var u = wrap01(progress);
    trackCurve.getPointAt(u, frame.center);
    trackCurve.getTangentAt(u, _tan);
    var tl = _tan.length();
    if (tl < 1e-8) _tan.copy(frame.fwd); else _tan.multiplyScalar(1 / tl);

    _lvl.crossVectors(WORLD_UP, _tan);
    var lenH = _lvl.length();
    if (lenH > 1e-8) _lvl.multiplyScalar(1 / lenH); else perpendicularTo(_tan, _lvl);

    if (!frame.ready) {
      frame.left.copy(_lvl);
      frame.ready = true;
    } else {
      _prev.copy(frame.left);
      _prev.addScaledVector(_tan, -_prev.dot(_tan));
      var pl = _prev.length();
      if (pl > 1e-8) _prev.multiplyScalar(1 / pl); else _prev.copy(_lvl);

      var w = clamp((lenH - 0.03) / 0.12, 0, 1);   // 0 = degenerate (vertical), 1 = well conditioned
      if (w >= 1) {
        frame.left.copy(_lvl);
      } else if (w <= 0) {
        frame.left.copy(_prev);
      } else {
        // Near-vertical: chase the level frame at a limited angular rate about the tangent
        // instead of snapping, so the exit from a wall/steep ramp can't pop the bike around.
        var ang = Math.atan2(_tmpX.crossVectors(_prev, _lvl).dot(_tan), _prev.dot(_lvl));
        var lim = FRAME_TURN_RATE * dt * w / Math.max(0.2, 1 - w);
        frame.left.copy(_prev).applyAxisAngle(_tan, clamp(ang, -lim, lim));
      }
    }

    // Gram-Schmidt so the basis is exactly orthonormal
    frame.left.addScaledVector(_tan, -frame.left.dot(_tan));
    var ll = frame.left.length();
    if (ll > 1e-8) frame.left.multiplyScalar(1 / ll); else frame.left.copy(_lvl);

    frame.fwd.copy(_tan);
    frame.up.crossVectors(_tan, frame.left).normalize();
    frame.pos.copy(frame.center).addScaledVector(frame.left, lateral * LANE_WIDTH);
  }

  /* lean > 0 = lean LEFT. Applied as a local roll about the model's forward axis. */
  function orientBike(bike, frame, lean) {
    if (MODEL_FORWARD_SIGN >= 0) {
      _m4.makeBasis(frame.left, frame.up, frame.fwd);            // model +X = left, +Z = forward
    } else {
      _negA.copy(frame.left).negate();
      _negB.copy(frame.fwd).negate();
      _m4.makeBasis(_negA, frame.up, _negB);                     // model +X = right, +Z = backward
    }
    bike.quaternion.setFromRotationMatrix(_m4);
    bike.rotateZ(-MODEL_FORWARD_SIGN * lean);
  }

  /* Wipe-out: fall onto one side, hop, slide, then stand back up for the respawn. */
  var _crash = { roll: 0, lift: 0 };
  function applyCrashPose(bike, frame, age, side) {
    var fall = clamp(age / 0.45, 0, 1);
    fall = 1 - Math.pow(1 - fall, 3);
    var recover = clamp((CRASH_DURATION - age) / 0.5, 0, 1);
    _crash.roll = side * 1.45 * fall * recover;
    _crash.lift = (Math.sin(clamp(age / 0.7, 0, 1) * Math.PI) * 0.9 + 0.35 * fall) * recover;
    bike.rotateZ(_crash.roll);
    bike.position.addScaledVector(frame.up, _crash.lift);
  }

  /* ================= ENVIRONMENT & LIGHTING ================= */
  function setupLighting() {
    scene.add(new THREE.AmbientLight(0xF4D6BC, 0.7));

    sun = new THREE.DirectionalLight(0xFFB060, 1.4);
    sun.position.copy(SUN_OFFSET);
    if (ENABLE_SHADOWS) {
      sun.castShadow = true;
      sun.shadow.mapSize.width = 1024;
      sun.shadow.mapSize.height = 1024;
      var sc = sun.shadow.camera;   // default is only +-5 units, which never covers the road
      sc.left = -SHADOW_EXTENT; sc.right = SHADOW_EXTENT;
      sc.top = SHADOW_EXTENT; sc.bottom = -SHADOW_EXTENT;
      sc.near = 10; sc.far = 400;
      sc.updateProjectionMatrix();
      sun.shadow.bias = -0.0004;
    }
    scene.add(sun);
    scene.add(sun.target);

    scene.fog = new THREE.FogExp2(0x3B1F4A, 0.0028);
  }

  function updateSun() {
    if (!sun) return;
    sun.position.copy(bikePhysics.pos).add(SUN_OFFSET);
    sun.target.position.copy(bikePhysics.pos);
  }

  /* ================= 3D NAMEPLATE SPRITE ================= */
  function createNameplateSprite(name, avatar) {
    var c = document.createElement('canvas');
    c.width = 256;
    c.height = 72;
    var ctx = c.getContext('2d');

    ctx.fillStyle = 'rgba(30, 10, 48, 0.88)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(8, 8, 240, 56, 28);
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#38E1E4';
      ctx.stroke();
    } else {
      ctx.fillRect(8, 8, 240, 56);
    }

    ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((avatar || '✨') + ' ' + (name || 'Partner'), 128, 36);

    var tex = new THREE.CanvasTexture(c);
    var spriteMat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
    var sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(4.2, 1.2, 1);
    sprite.renderOrder = 999;
    return sprite;
  }

  /* ================= MINIMAP (static track cached, markers redrawn @30Hz) ================= */
  var _mc = { cx: 0, cy: 0 };
  function minimapCoord(x, z, w, h, out) {
    var b = minimapBounds;
    var nx = (x - b.minX) / Math.max(1e-6, b.maxX - b.minX);
    var nz = (z - b.minZ) / Math.max(1e-6, b.maxZ - b.minZ);
    out.cx = 8 + nx * (w - 16);
    out.cy = 8 + nz * (h - 16);
    return out;
  }

  function buildMinimapCache(w, h) {
    var off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    var ctx = off.getContext('2d');
    var i, c;

    ctx.beginPath();
    for (i = 0; i < minimapPoints.length; i++) {
      c = minimapCoord(minimapPoints[i].x, minimapPoints[i].z, w, h, _mc);
      if (i === 0) ctx.moveTo(c.cx, c.cy); else ctx.lineTo(c.cx, c.cy);
    }
    ctx.closePath();
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255, 176, 0, 0.4)';
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    c = minimapCoord(minimapPoints[0].x, minimapPoints[0].z, w, h, _mc);
    ctx.fillStyle = '#FFB000';
    ctx.beginPath();
    ctx.arc(c.cx, c.cy, 3.5, 0, Math.PI * 2);
    ctx.fill();

    minimapCache.canvas = off;
    minimapCache.w = w;
    minimapCache.h = h;
    minimapCache.pts = minimapPoints;
  }

  function updateMinimap(delta) {
    minimapTimer += delta;
    if (minimapTimer < 1 / 30) return;
    minimapTimer = 0;

    var cvs = hudEl('raceMinimap');
    if (!cvs || !minimapPoints.length) return;
    var ctx = cvs.getContext('2d');
    var w = cvs.width;
    var h = cvs.height;

    if (!minimapCache.canvas || minimapCache.w !== w || minimapCache.h !== h || minimapCache.pts !== minimapPoints) {
      buildMinimapCache(w, h);
    }
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(minimapCache.canvas, 0, 0);

    var c = minimapCoord(partnerPhysics.pos.x, partnerPhysics.pos.z, w, h, _mc);
    ctx.fillStyle = '#38E1E4';
    ctx.beginPath();
    ctx.arc(c.cx, c.cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    c = minimapCoord(bikePhysics.pos.x, bikePhysics.pos.z, w, h, _mc);
    ctx.fillStyle = '#D6246E';
    ctx.beginPath();
    ctx.arc(c.cx, c.cy, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /* ================= HUD (cached lookups, DOM touched only on change) ================= */
  var hudEls = {};
  function hudEl(id) {
    var el = hudEls[id];
    if (!el || el.isConnected === false) {
      el = document.getElementById(id);
      hudEls[id] = el;
    }
    return el;
  }

  function updateHUD() {
    var p = bikePhysics;
    var el;

    el = hudEl('raceSpeedNum');
    if (el) {
      var kmh = Math.round(Math.abs(p.speed) * 3.6);
      if (el._jrV !== kmh) { el._jrV = kmh; el.textContent = kmh; }
    }

    el = hudEl('raceNitroBar');
    if (el) {
      var nw = Math.round(p.nitroFuel) + '%';
      if (el._jrV !== nw) { el._jrV = nw; el.style.width = nw; }
    }

    el = hudEl('raceScoreBadge');
    if (el && el._jrV !== raceState.playerScore) { el._jrV = raceState.playerScore; el.textContent = raceState.playerScore; }

    el = hudEl('raceLapBadge');
    if (el) {
      var lapTxt = 'Lap ' + Math.min(raceState.totalLaps, raceState.playerLap) + '/' + raceState.totalLaps;
      if (el._jrV !== lapTxt) { el._jrV = lapTxt; el.textContent = lapTxt; }
    }

    el = hudEl('raceLeadPill');
    if (el) {
      var meters = Math.round((p.raceProgress - partnerPhysics.raceProgress) * curveLength);
      var txt, col;
      if (Math.abs(meters) < 4) { txt = '🔥 Barabar! (Neck-to-Neck)'; col = '#FFB000'; }
      else if (meters > 0) { txt = '🚀 Aap +' + meters + 'm Aage!'; col = '#38E1E4'; }
      else { txt = '💨 Partner +' + Math.abs(meters) + 'm Aage!'; col = '#FF88AA'; }
      if (el._jrV !== txt) { el._jrV = txt; el.textContent = txt; }
      if (el._jrC !== col) { el._jrC = col; el.style.color = col; }
    }
  }

  /* ================= 3D COLLISION SPARKS ================= */
  function createSparkSystem() {
    var count = 50;
    var geom = new THREE.BufferGeometry();
    var positions = new Float32Array(count * 3);
    var vels = [];
    for (var i = 0; i < count; i++) vels.push(new THREE.Vector3());
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    var mat = new THREE.PointsMaterial({
      color: 0xFFA500,
      size: 0.45,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    sparkParticles = new THREE.Points(geom, mat);
    sparkParticles.frustumCulled = false;     // bounding sphere is computed while all points are at the origin
    sparkParticles.velocities = vels;
    sparkParticles.life = 0;
    scene.add(sparkParticles);
  }

  function burstSparks(atPos) {
    if (!sparkParticles) return;
    sparkParticles.position.copy(atPos);
    sparkParticles.material.opacity = 1;
    sparkParticles.life = 0.65;
    var arr = sparkParticles.geometry.attributes.position.array;
    for (var i = 0; i < sparkParticles.velocities.length; i++) {
      arr[i * 3] = 0;
      arr[i * 3 + 1] = 0;
      arr[i * 3 + 2] = 0;
      sparkParticles.velocities[i].set(
        (Math.random() - 0.5) * 18,
        Math.random() * 12 + 4,
        (Math.random() - 0.5) * 18
      );
    }
    sparkParticles.geometry.attributes.position.needsUpdate = true;
  }

  function updateSparks(delta) {
    if (!sparkParticles || sparkParticles.life <= 0) return;
    sparkParticles.life -= delta;
    sparkParticles.material.opacity = Math.max(0, sparkParticles.life / 0.65);
    var attr = sparkParticles.geometry.attributes.position;
    var arr = attr.array;
    for (var i = 0; i < sparkParticles.velocities.length; i++) {
      var v = sparkParticles.velocities[i];
      arr[i * 3] += v.x * delta;
      arr[i * 3 + 1] += v.y * delta;
      arr[i * 3 + 2] += v.z * delta;
      v.y -= 22 * delta;
    }
    attr.needsUpdate = true;
  }

  /* ================= PLAYER ================= */
  function updatePlayer(delta) {
    var p = bikePhysics;
    var c = p.controls;
    var down = p.isCrashed;
    var gas = c.gas && !down;
    var braking = c.brake && !down;
    var wantNitro = c.nitro && !down;

    // ---- Longitudinal ----
    if (wantNitro && gas && p.nitroFuel > 0) {
      p.isNitro = true;
      p.nitroFuel = Math.max(0, p.nitroFuel - delta * 25);
      p.speed = Math.min(p.maxSpeed * NITRO_SPEED_MULT, p.speed + p.accel * 1.8 * delta);
    } else {
      p.isNitro = false;
      if (gas) {
        if (p.speed > p.maxSpeed) p.speed = Math.max(p.maxSpeed, p.speed - OVERSPEED_DECAY * delta); // no snap after nitro
        else p.speed = Math.min(p.maxSpeed, p.speed + p.accel * delta);
      } else if (braking) {
        p.speed = Math.max(-10, p.speed - p.brake * delta);
      } else if (p.speed > 0) {
        p.speed = Math.max(0, p.speed - p.decel * delta);
      } else if (p.speed < 0) {
        p.speed = Math.min(0, p.speed + p.decel * delta);
      }
    }

    // ---- Wipe-out ----
    if (down) {
      p.speed *= Math.max(0, 1 - 8 * delta);
      p.crashTimer -= delta;
      if (p.crashTimer <= 0) {
        p.isCrashed = false;
        p.crashTimer = 0;
        p.speed = 0;
        p.collisionCooldown = 2.5;     // post-respawn immunity
      }
    }

    var speedRatio = Math.abs(p.speed) / p.maxSpeed;
    if (window.JodiRaceAudio && window.JodiRaceAudio.setRPM) window.JodiRaceAudio.setRPM(speedRatio, gas);

    // ---- Steering: buttons/keys + analog gyroscope, LEFT = +1 ----
    currentTiltSteer += (targetTiltSteer - currentTiltSteer) * damp(12, delta);
    if (targetTiltSteer === 0 && Math.abs(currentTiltSteer) < 0.01) currentTiltSteer = 0;

    var turnRate = 0;
    if (!down) {
      if (c.left) turnRate += 1;
      if (c.right) turnRate -= 1;
      turnRate = clamp(turnRate + currentTiltSteer, -1, 1);
    }

    var steerStrength = Math.min(1.25, Math.abs(p.speed) / p.maxSpeed) * 1.8;
    p.lateralOffset = clamp(p.lateralOffset + turnRate * steerStrength * delta, -LATERAL_LIMIT, LATERAL_LIMIT);

    // Lean into the corner and turn the handlebar the same way (both LEFT = +)
    var targetLean = turnRate * MAX_BANK * Math.min(1, Math.abs(p.speed) / 15);
    p.tiltAngle += (targetLean - p.tiltAngle) * damp(8, delta);
    p.steerAngle += (turnRate * MAX_FORK - p.steerAngle) * damp(14, delta);

    // ---- Progress & laps (unwrapped distance: lap is a pure function of it) ----
    p.raceProgress += (p.speed * delta) / curveLength;
    p.trackProgress = wrap01(p.raceProgress);
    var newLap = Math.max(1, Math.floor(p.raceProgress) + 1);
    if (newLap > raceState.playerLap && window.JodiAudio && window.JodiAudio.playUnlock) window.JodiAudio.playUnlock();
    raceState.playerLap = newLap;

    // ---- Pose ----
    sampleRoad(playerFrame, p.trackProgress, p.lateralOffset, delta);
    p.pos.copy(playerFrame.pos);

    if (playerBike) {
      playerBike.position.copy(playerFrame.pos);
      orientBike(playerBike, playerFrame, p.tiltAngle);
      if (p.isCrashed) applyCrashPose(playerBike, playerFrame, CRASH_DURATION - p.crashTimer, p.crashSide);

      if (playerBike.frontFork) playerBike.frontFork.rotation.y = p.steerAngle;   // left = +Y rotation = nose swings left

      if (playerBike.exhaustFlame) {
        if (p.isNitro) {
          playerBike.exhaustFlame.material.opacity = 0.85 + Math.random() * 0.15;
          playerBike.exhaustFlame.scale.set(1 + Math.random() * 0.3, 1 + Math.random() * 0.3, 1.2 + Math.random() * 0.5);
        } else {
          playerBike.exhaustFlame.material.opacity = 0;
        }
      }

      if (playerBike.frontWheel && playerBike.rearWheel) {
        var spin = p.speed * delta * 4;
        playerBike.frontWheel.rotation.x += spin;
        playerBike.rearWheel.rotation.x += spin;
      }
    }
  }

  /* ================= CHASE CAMERA ================= */
  function updateCamera(delta) {
    var p = bikePhysics;
    var camDist = 9.2 + (p.isNitro ? 2.2 : 0);

    // Ride the spline behind the player so the camera follows hairpins instead of cutting through them
    trackCurve.getPointAt(wrap01(p.trackProgress - camDist / curveLength), _behind);
    _camPos.copy(_behind).addScaledVector(playerFrame.left, p.lateralOffset * LANE_WIDTH * 0.6);
    _camPos.y = Math.max(_behind.y + 3.6, playerFrame.pos.y + 1.6);   // never below the road / the bike's eye line

    _camLook.copy(playerFrame.pos);
    _camLook.y += 1.6;
    _camLook.addScaledVector(playerFrame.fwd, 6);

    if (cameraSnap) {
      camera.position.copy(_camPos);
      _lookSmooth.copy(_camLook);
      cameraSnap = false;
    } else {
      camera.position.lerp(_camPos, damp(8, delta));
      _lookSmooth.lerp(_camLook, damp(14, delta));
    }
    camera.lookAt(_lookSmooth);

    var targetFov = BASE_FOV + (p.isNitro ? 9 : 0);
    if (Math.abs(camera.fov - targetFov) > 0.02) {
      camera.fov += (targetFov - camera.fov) * damp(5, delta);
      camera.updateProjectionMatrix();
    }
  }

  /* ================= PARTNER ================= */
  function updatePartner(delta) {
    var q = partnerPhysics;

    if (q.isCrashed) {
      q.crashTimer -= delta;
      q.speed = 0;
      q.isNitro = false;
      if (q.crashTimer <= 0) { q.isCrashed = false; q.crashTimer = 0; }
    }

    if (raceState.isSoloAI) {
      // Autopilot partner for solo practice
      if (!q.isCrashed) {
        q.speed = 31 + Math.sin(raceTimer) * 6;
        var prevLat = q.lateralOffset;
        q.raceProgress += (q.speed * delta) / curveLength;
        q.targetRaceProgress = q.raceProgress;
        q.lateralOffset = Math.sin(raceTimer * 1.5) * 0.5;
        var latVel = (q.lateralOffset - prevLat) / Math.max(delta, 1e-4);
        q.tiltAngle = clamp(latVel * 0.3, -0.25, 0.25);      // lean toward the direction of travel
      }
      q.lap = Math.max(1, Math.floor(q.raceProgress) + 1);
    } else {
      // Networked partner: smooth toward the last packet with dead-reckoning between packets
      q.syncAge += delta;
      if (q.syncAge < STALE_SYNC_SEC) {
        if (!q.isCrashed) q.targetRaceProgress += (q.speed * delta) / curveLength;
      } else {
        q.speed *= 1 - damp(3, delta);                        // link went quiet: coast to a stop, don't ghost-ride forever
      }
      var k = damp(14, delta);
      q.raceProgress += (q.targetRaceProgress - q.raceProgress) * k;
      q.lateralOffset += (q.targetLateralOffset - q.lateralOffset) * k;
      q.tiltAngle += (q.targetTiltAngle - q.tiltAngle) * k;
      q.lap = Math.max(1, Math.floor(q.targetRaceProgress) + 1);
    }
    raceState.partnerLap = q.lap;
    q.trackProgress = wrap01(q.raceProgress);

    sampleRoad(partnerFrame, q.trackProgress, q.lateralOffset, delta);
    q.pos.copy(partnerFrame.pos);

    if (partnerBike) {
      partnerBike.position.copy(partnerFrame.pos);
      orientBike(partnerBike, partnerFrame, q.tiltAngle);
      if (q.isCrashed) applyCrashPose(partnerBike, partnerFrame, CRASH_DURATION - q.crashTimer, q.crashSide);

      if (partnerBike.frontFork) partnerBike.frontFork.rotation.y = clamp(q.tiltAngle * (MAX_FORK / MAX_BANK), -MAX_FORK, MAX_FORK);
      if (partnerBike.exhaustFlame) partnerBike.exhaustFlame.material.opacity = q.isNitro ? 0.85 : 0;
      if (partnerBike.frontWheel && partnerBike.rearWheel) {
        var spinP = q.speed * delta * 4;
        partnerBike.frontWheel.rotation.x += spinP;
        partnerBike.rearWheel.rotation.x += spinP;
      }
    }

    if (partnerNameSprite) {
      partnerNameSprite.position.copy(partnerFrame.pos);
      partnerNameSprite.position.y += 4.0;
    }
  }

  /* ================= COLLISION, TAKEDOWN & FINISH ================= */
  function resolveCollisions(delta) {
    var p = bikePhysics;
    var q = partnerPhysics;
    if (p.collisionCooldown > 0) p.collisionCooldown -= delta;
    if (!playerBike || !partnerBike || p.isCrashed || q.isCrashed || p.collisionCooldown > 0) return;
    if (p.pos.distanceTo(q.pos) >= COLLISION_DIST) return;

    var partnerSpd = (typeof q.speed === 'number') ? q.speed : 0;
    var speedDiff = p.speed - partnerSpd;
    var pRamming = (p.speed > 16) && (p.isNitro || speedDiff > 7);
    var partnerRamming = (partnerSpd > 16) && (q.isNitro || speedDiff < -7);

    // Only one peer judges a ram; the other applies the resulting event. Prevents both sides
    // deciding "I rammed you" at the same time from slightly different snapshots.
    var judge = raceState.isSoloAI || raceState.isHost;

    if (judge && pRamming && !partnerRamming) {
      triggerTakedown('player', 'partner', false);
    } else if (judge && partnerRamming && !pRamming) {
      triggerTakedown('partner', 'player', false);
    } else {
      // Side brush: gentle lateral bounce, no wipe-out
      var push = 0.15;
      if (p.lateralOffset < q.lateralOffset) { p.lateralOffset -= push; q.lateralOffset += push; }
      else { p.lateralOffset += push; q.lateralOffset -= push; }
      p.lateralOffset = clamp(p.lateralOffset, -LATERAL_LIMIT, LATERAL_LIMIT);
      q.lateralOffset = clamp(q.lateralOffset, -LATERAL_LIMIT, LATERAL_LIMIT);
      p.collisionCooldown = 0.8;
    }
  }

  function showBanner(kind, title, sub) {
    var banner = document.getElementById('raceTakedownBanner');
    if (!banner) return;
    banner.innerHTML = '<div class="takedown-title">' + title + '</div><div class="takedown-sub">' + sub + '</div>';
    banner.className = 'race-takedown-banner show ' + kind;
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { banner.className = 'race-takedown-banner'; bannerTimer = null; }, 2200);
  }

  function triggerTakedown(rammer, victim, isFromNetwork) {
    bikePhysics.collisionCooldown = 3.5;
    if (window.JodiAudio && typeof window.JodiAudio.playCrash === 'function') window.JodiAudio.playCrash();
    if (playerBike && partnerBike) {
      burstSparks(_tmpV.copy(playerBike.position).lerp(partnerBike.position, 0.5));
    }
    var side = Math.random() < 0.5 ? -1 : 1;

    if (rammer === 'player') {
      raceState.playerScore += 50;
      bikePhysics.nitroFuel = Math.min(100, bikePhysics.nitroFuel + 35);
      partnerPhysics.isCrashed = true;
      partnerPhysics.crashTimer = CRASH_DURATION;
      partnerPhysics.crashSide = side;

      showBanner('rammer', '💥 TAKEDOWN!', 'Partner ko thok diya! +50 PTS 🔥');
      if (typeof window.burstCenter === 'function') window.burstCenter(30);

      if (!isFromNetwork && typeof raceState.onTakedownCallback === 'function') {
        raceState.onTakedownCallback({ rammer: 'player', victim: 'partner', points: 50 });
      }
    } else {
      raceState.partnerScore += 50;
      bikePhysics.isCrashed = true;
      bikePhysics.crashTimer = CRASH_DURATION;
      bikePhysics.crashSide = side;
      bikePhysics.isNitro = false;

      showBanner('victim', '💥 WIPED OUT!', 'Partner ne thok diya! Respawning... ⏳');

      if (!isFromNetwork && typeof raceState.onTakedownCallback === 'function') {
        raceState.onTakedownCallback({ rammer: 'partner', victim: 'player', points: 50 });
      }
    }
  }

  function onExternalTakedown(data) {
    if (!data) return;
    // Event arrives in the SENDER's perspective; flip it into ours.
    var localRammer = (data.rammer === 'player') ? 'partner' : 'player';
    var localVictim = (data.victim === 'player') ? 'partner' : 'player';
    // Ignore duplicates for a victim who is already down (checks the correct bike)
    if (localVictim === 'player' && bikePhysics.isCrashed) return;
    if (localVictim === 'partner' && partnerPhysics.isCrashed) return;
    triggerTakedown(localRammer, localVictim, true);
  }

  function checkFinish() {
    if (raceState.isFinished) return;
    var total = raceState.totalLaps;
    var partnerDist = raceState.isSoloAI ? partnerPhysics.raceProgress : partnerPhysics.targetRaceProgress;
    var winner = null;

    if (bikePhysics.raceProgress >= total) winner = 'player';
    else if (partnerDist >= total) winner = 'partner';
    if (!winner) return;

    raceState.isFinished = true;
    raceState.winner = winner;
    if (winner === 'player') raceState.playerScore += 100;   // finish-line bonus
    else raceState.partnerScore += 100;

    if (typeof raceState.onFinishCallback === 'function') {
      raceState.onFinishCallback({
        winner: winner,
        playerScore: raceState.playerScore,
        partnerScore: raceState.partnerScore
      });
    }
  }

  function broadcast(delta) {
    raceState.syncTimer += delta;
    if (raceState.syncTimer < 0.05) return;                  // ~20 Hz
    raceState.syncTimer = 0;
    if (typeof raceState.onSyncCallback !== 'function') return;
    var p = bikePhysics;
    raceState.onSyncCallback({
      progress: p.trackProgress,
      lateral: p.lateralOffset,
      speed: p.speed,
      tilt: p.tiltAngle,                                     // LEFT = +
      nitro: p.isNitro,
      lap: Math.floor(p.raceProgress) + 1                    // unclamped so (lap - 1) + progress == raceProgress
    });
  }

  /* ================= MAIN TICK ================= */
  function updatePhysics(delta) {
    if (!trackCurve) return;
    raceTimer += delta;
    raceState.elapsed = raceTimer;

    updatePlayer(delta);
    updatePartner(delta);
    updateSparks(delta);
    resolveCollisions(delta);
    updateCamera(delta);
    updateSun();
    checkFinish();
    broadcast(delta);
    updateHUD();
    updateMinimap(delta);
  }

  /* ================= INPUT: KEYBOARD + MULTI-TOUCH POINTER EVENTS ================= */
  function setInput(src, key, val) {
    input[src][key] = !!val;
    bikePhysics.controls[key] = !!(input.kb[key] || input.touch[key]);
  }

  function resetInput() {
    input.kb = {};
    input.touch = {};
    var c = bikePhysics.controls;
    c.left = c.right = c.gas = c.brake = c.nitro = false;
  }

  function keyToControl(key) {
    switch (key) {
      case 'ArrowUp': case 'w': case 'W': return 'gas';
      case 'ArrowDown': case 's': case 'S': return 'brake';
      case 'ArrowLeft': case 'a': case 'A': return 'left';
      case 'ArrowRight': case 'd': case 'D': return 'right';
      case 'Shift': return 'nitro';
    }
    return null;
  }

  /* Each button tracks its own pointerIds and captures them, so Gas held by one thumb is never
   * touched by events on the steer / nitro buttons under the other thumb. */
  function bindTouchButton(id, key) {
    var el = document.getElementById(id);
    if (!el) return;
    var active = {};
    var count = 0;

    el.style.touchAction = 'none';
    el.style.userSelect = 'none';
    el.style.webkitUserSelect = 'none';
    el.style.webkitTouchCallout = 'none';

    function onDown(e) {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      if (!active[e.pointerId]) { active[e.pointerId] = true; count++; }
      setInput('touch', key, true);
      requestTiltPermission();
      if (key === 'gas' && window.JodiRaceAudio && window.JodiRaceAudio.ensureContext) window.JodiRaceAudio.ensureContext();
    }

    function onEnd(e) {
      if (e.cancelable) e.preventDefault();
      try { el.releasePointerCapture(e.pointerId); } catch (_) {}
      if (active[e.pointerId]) { delete active[e.pointerId]; count--; }
      if (count <= 0) { count = 0; setInput('touch', key, false); }
      if (e.type === 'pointerup') requestTiltPermission();    // iOS wants the request inside a completed tap
    }

    function noMenu(e) { e.preventDefault(); }                // long-press context menu would cancel the pointer

    el.addEventListener('pointerdown', onDown, { passive: false });
    el.addEventListener('pointerup', onEnd, { passive: false });
    el.addEventListener('pointercancel', onEnd, { passive: false });
    el.addEventListener('lostpointercapture', onEnd, { passive: false });
    el.addEventListener('contextmenu', noMenu);

    touchCleanups.push(function () {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onEnd);
      el.removeEventListener('pointercancel', onEnd);
      el.removeEventListener('lostpointercapture', onEnd);
      el.removeEventListener('contextmenu', noMenu);
    });
  }

  function bindControls() {
    unbindControls();

    onKeyDownRef = function (e) {
      var k = keyToControl(e.key);
      if (!k) return;
      if (e.key.indexOf('Arrow') === 0) e.preventDefault();
      setInput('kb', k, true);
    };
    onKeyUpRef = function (e) {
      var k = keyToControl(e.key);
      if (k) setInput('kb', k, false);
    };
    onBlurRef = function () { resetInput(); };               // no stuck throttle after alt-tab
    onVisRef = function () { if (document.hidden) resetInput(); };

    window.addEventListener('keydown', onKeyDownRef);
    window.addEventListener('keyup', onKeyUpRef);
    window.addEventListener('blur', onBlurRef);
    document.addEventListener('visibilitychange', onVisRef);

    bindTouchButton('btnSteerL', 'left');
    bindTouchButton('btnSteerR', 'right');
    bindTouchButton('btnGas', 'gas');
    bindTouchButton('btnBrake', 'brake');
    bindTouchButton('btnNitro', 'nitro');
  }

  function unbindControls() {
    if (onKeyDownRef) window.removeEventListener('keydown', onKeyDownRef);
    if (onKeyUpRef) window.removeEventListener('keyup', onKeyUpRef);
    if (onBlurRef) window.removeEventListener('blur', onBlurRef);
    if (onVisRef) document.removeEventListener('visibilitychange', onVisRef);
    onKeyDownRef = onKeyUpRef = onBlurRef = onVisRef = null;
    for (var i = 0; i < touchCleanups.length; i++) touchCleanups[i]();
    touchCleanups = [];
    resetInput();
  }

  /* ================= INPUT: GYROSCOPE TILT ================= */
  // Signed degrees, + = phone tilted RIGHT. Portrait uses gamma; landscape uses beta (auto-centred).
  function readTiltDegrees(e) {
    var angle = 0;
    if (window.screen && window.screen.orientation && typeof window.screen.orientation.angle === 'number') {
      angle = window.screen.orientation.angle;
    } else if (typeof window.orientation === 'number') {
      angle = -window.orientation;                           // legacy value has the opposite sign
    }
    angle = ((angle % 360) + 360) % 360;

    if (angle === 90 || angle === 270) {
      if (e.beta === null || e.beta === undefined) return null;
      if (tiltNeutralBeta === null) tiltNeutralBeta = e.beta;
      var d = e.beta - tiltNeutralBeta;
      return angle === 90 ? d : -d;
    }
    if (e.gamma === null || e.gamma === undefined) return null;
    return angle === 180 ? -e.gamma : e.gamma;
  }

  function onDeviceOrientation(e) {
    var deg = readTiltDegrees(e);
    if (deg === null) return;
    hasTiltSensor = true;

    var mag = Math.abs(deg);
    if (mag < TILT_DEADZONE_DEG) {
      targetTiltSteer = 0;
    } else {
      var raw = clamp((mag - TILT_DEADZONE_DEG) / TILT_RANGE_DEG, 0, 1);
      // Tilt right (deg > 0) => turn RIGHT => turnRate negative. Tilt left => turnRate positive.
      targetTiltSteer = deg > 0 ? -raw : raw;
    }

    var badge = document.getElementById('raceTiltBadge');
    if (badge && !badge.classList.contains('active')) badge.classList.add('active');
  }

  function attachTilt() {
    if (tiltState === 'granted') return;
    window.addEventListener('deviceorientation', onDeviceOrientation, true);
    tiltState = 'granted';
  }

  function requestTiltPermission() {
    if (tiltState !== 'idle') return;
    if (typeof window.DeviceOrientationEvent === 'undefined') return;
    if (typeof window.DeviceOrientationEvent.requestPermission === 'function') {
      tiltState = 'pending';
      window.DeviceOrientationEvent.requestPermission().then(function (state) {
        if (state === 'granted') attachTilt(); else tiltState = 'denied';
      }).catch(function () {
        tiltState = 'idle';      // not inside a user gesture: retry on the next tap
      });
    } else {
      attachTilt();
    }
  }

  function calibrateTilt() { tiltNeutralBeta = null; }

  /* ================= LIFECYCLE ================= */
  function disposeScene(root) {
    if (!root) return;
    root.traverse(function (o) {
      if (o.geometry && o.geometry.dispose) o.geometry.dispose();
      var m = o.material;
      if (!m) return;
      var list = Array.isArray(m) ? m : [m];
      for (var i = 0; i < list.length; i++) {
        var mm = list[i];
        for (var k in mm) {
          var v = mm[k];
          if (v && v.isTexture) v.dispose();
        }
        if (mm.dispose) mm.dispose();
      }
    });
  }

  function onWindowResize() {
    if (!renderer || !containerEl) return;
    var w = containerEl.clientWidth || window.innerWidth;
    var h = containerEl.clientHeight || window.innerHeight;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function initRace(container, bikeThemeKey, trackSeed, partnerOptions) {
    cleanupRace();
    if (!window.JodiRaceTrack) {
      console.error('JodiRace: window.JodiRaceTrack is missing; cannot start race.');
      return;
    }
    containerEl = container;

    // Partner options (defaults first so a previous race's name never leaks through)
    var opts = partnerOptions || {};
    partnerPhysics.name = opts.name || 'Partner';
    partnerPhysics.avatar = opts.avatar || '💖';
    partnerPhysics.theme = opts.theme || 'bullet';
    raceState.isSoloAI = opts.isSoloAI !== undefined ? !!opts.isSoloAI : true;
    var isHost = opts.isHost !== undefined ? !!opts.isHost : true;
    raceState.isHost = isHost;

    // Staggered grid. lateralOffset is LEFT-positive: host starts in the right lane (-), guest in the left lane (+).
    var pStart = isHost ? 0.012 : 0.005;
    var qStart = isHost ? 0.005 : 0.012;
    var pLane = isHost ? -0.38 : 0.38;

    var p = bikePhysics;
    p.raceProgress = pStart;
    p.trackProgress = pStart;
    p.lateralOffset = pLane;
    p.speed = 0;
    p.tiltAngle = 0;
    p.steerAngle = 0;
    p.nitroFuel = 100;
    p.isNitro = false;
    p.isCrashed = false;
    p.crashTimer = 0;
    p.collisionCooldown = 4.0;                               // start-line immunity

    var q = partnerPhysics;
    q.raceProgress = qStart;
    q.targetRaceProgress = qStart;
    q.trackProgress = qStart;
    q.lateralOffset = -pLane;
    q.targetLateralOffset = -pLane;
    q.speed = 0;
    q.tiltAngle = 0;
    q.targetTiltAngle = 0;
    q.isNitro = false;
    q.isCrashed = false;
    q.crashTimer = 0;
    q.syncAge = 0;
    q.hasSynced = false;
    q.lap = 1;

    raceState.playerLap = 1;
    raceState.partnerLap = 1;
    raceState.playerScore = 0;
    raceState.partnerScore = 0;
    raceState.isFinished = false;
    raceState.winner = null;
    raceState.elapsed = 0;
    raceState.syncTimer = 0;

    raceTimer = 0;
    minimapTimer = 0;
    currentTiltSteer = 0;
    targetTiltSteer = 0;
    tiltNeutralBeta = null;
    cameraSnap = true;
    loopErrors = 0;
    hudEls = {};
    playerFrame.ready = false;
    partnerFrame.ready = false;

    var w = container.clientWidth || window.innerWidth;
    var h = container.clientHeight || window.innerHeight;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x3B1F4A);

    camera = new THREE.PerspectiveCamera(BASE_FOV, w / Math.max(1, h), 0.5, 1200);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = ENABLE_SHADOWS;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    setupLighting();

    // Procedural track
    trackCurve = window.JodiRaceTrack.generate(trackSeed);
    curveLength = trackCurve.getLength();
    if (!(curveLength > 1) && window.JodiRaceTrack.getLength) curveLength = window.JodiRaceTrack.getLength();
    minimapPoints = window.JodiRaceTrack.getMinimapPoints();
    minimapBounds = window.JodiRaceTrack.getMinimapBounds();
    minimapCache.canvas = null;
    window.JodiRaceTrack.buildMesh(scene);

    if (ENABLE_SHADOWS) {
      scene.traverse(function (o) { if (o.isMesh) o.receiveShadow = true; });   // the road etc. catch the bikes' shadows
    }

    // Bikes
    var buildBike = window.JodiRaceModels && window.JodiRaceModels.buildRealisticBike;
    playerBike = buildBike ? buildBike(bikeThemeKey || 'sport') : new THREE.Group();
    scene.add(playerBike);
    partnerBike = buildBike ? buildBike(partnerPhysics.theme) : new THREE.Group();
    scene.add(partnerBike);
    if (ENABLE_SHADOWS) {
      var cast = function (o) { if (o.isMesh) o.castShadow = true; };
      playerBike.traverse(cast);
      partnerBike.traverse(cast);
    }

    // Nameplate lives in the scene (not on the bike) so it doesn't swing with lean / crash roll
    partnerNameSprite = createNameplateSprite(partnerPhysics.name, partnerPhysics.avatar);
    scene.add(partnerNameSprite);

    createSparkSystem();

    if (window.JodiRaceAudio) window.JodiRaceAudio.init();

    bindControls();
    window.addEventListener('resize', onWindowResize);
    onOrientRef = function () { tiltNeutralBeta = null; onWindowResize(); };
    window.addEventListener('orientationchange', onOrientRef);
    requestTiltPermission();                                  // works immediately on Android; iOS retries on first tap

    // Place everything before the first rendered frame
    try { updatePhysics(0); } catch (e0) { console.warn('Race init pose warning:', e0); }

    isRunning = true;
    var clock = new THREE.Clock();

    function animate() {
      if (!isRunning) return;
      animFrameId = requestAnimationFrame(animate);
      try {
        var delta = Math.min(clock.getDelta(), 0.05);
        updatePhysics(delta);
        if (!isRunning || !renderer) return;                  // a callback may have cleaned up mid-tick
        renderer.render(scene, camera);
      } catch (loopErr) {
        if (loopErrors++ < 5) console.warn('Race tick warning:', loopErr);
      }
    }
    animate();
  }

  function cleanupRace() {
    isRunning = false;
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    if (window.JodiRaceAudio && window.JodiRaceAudio.stop) window.JodiRaceAudio.stop();

    unbindControls();
    window.removeEventListener('resize', onWindowResize);
    if (onOrientRef) { window.removeEventListener('orientationchange', onOrientRef); onOrientRef = null; }
    window.removeEventListener('deviceorientation', onDeviceOrientation, true);
    if (tiltState === 'granted') tiltState = 'idle';
    hasTiltSensor = false;
    targetTiltSteer = 0;
    currentTiltSteer = 0;

    if (bannerTimer) { clearTimeout(bannerTimer); bannerTimer = null; }

    disposeScene(scene);
    if (renderer) {
      if (renderer.domElement && renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      renderer.dispose();
      if (renderer.forceContextLoss) renderer.forceContextLoss();   // mobile browsers cap live WebGL contexts
      renderer = null;
    }
    scene = null;
    camera = null;
    sun = null;
    trackCurve = null;
    playerBike = partnerBike = partnerNameSprite = sparkParticles = null;
  }

  /* ================= NETWORK ================= */
  function onPartnerSync(data) {
    if (!data) return;
    var q = partnerPhysics;
    raceState.isSoloAI = false;
    q.syncAge = 0;

    if (typeof data.progress === 'number') {
      var lap = (typeof data.lap === 'number') ? data.lap : q.lap;
      var target = (lap - 1) + wrap01(data.progress);         // rebuild unwrapped distance: no wrap-around maths needed
      q.targetRaceProgress = target;
      if (!q.hasSynced || Math.abs(target - q.raceProgress) > 0.25) q.raceProgress = target;   // first packet / desync: snap
      q.hasSynced = true;
    }
    if (typeof data.lateral === 'number') q.targetLateralOffset = data.lateral;
    if (typeof data.speed === 'number') q.speed = data.speed;
    if (typeof data.tilt === 'number') q.targetTiltAngle = data.tilt;
    q.isNitro = !!data.nitro;
  }

  global.JodiRace = {
    init: initRace,
    cleanup: cleanupRace,
    setSoloAI: function (val) { raceState.isSoloAI = !!val; },
    setupTiltSensor: requestTiltPermission,   // call from a click/tap handler (e.g. "Start Race") for iOS
    calibrateTilt: calibrateTilt,
    hasTilt: function () { return hasTiltSensor; },
    get BIKE_THEMES() {
      return (window.JodiRaceModels && window.JodiRaceModels.BIKE_THEMES) || {};
    },
    getPhysics: function () { return bikePhysics; },
    getPartnerPhysics: function () { return partnerPhysics; },
    getRaceState: function () { return raceState; },
    onPartnerSync: onPartnerSync,
    onExternalTakedown: onExternalTakedown,
    setOnLocalSync: function (cb) { raceState.onSyncCallback = cb; },
    setOnTakedown: function (cb) { raceState.onTakedownCallback = cb; },
    setOnFinish: function (cb) { raceState.onFinishCallback = cb; }
  };
})(window);