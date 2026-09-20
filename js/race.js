/* Jodi Race - 3D Hyper-Realistic Multiplayer Racing Engine (Core Controller) */
(function (global) {
  'use strict';

  var scene, camera, renderer;
  var trackCurve = null;
  var trackLength = 1600;
  var minimapPoints = [];
  var minimapBounds = { minX: -400, maxX: 400, minZ: -400, maxZ: 400 };

  var playerBike, partnerBike, partnerNameSprite;
  var isRunning = false;
  var animFrameId = null;
  var containerEl = null;
  var sparkParticles = null;

  // Race & Lap Timing Safeties
  var raceTimer = 0;
  var playerLapTimer = 0;
  var partnerLapTimer = 0;

  // Mobile Device Orientation Gyroscope Tilt Steering
  var currentTiltSteer = 0;
  var targetTiltSteer = 0;
  var hasTiltSensor = false;
  var onKeyDownRef = null;
  var onKeyUpRef = null;

  // Partner State & Interpolation
  var partnerPhysics = {
    pos: new THREE.Vector3(0, 0, 0),
    trackProgress: 0.005,
    targetProgress: 0.005,
    lateralOffset: 0.38,
    targetLateralOffset: 0.38,
    speed: 0,
    tiltAngle: 0,
    targetTiltAngle: 0,
    isNitro: false,
    lap: 1,
    lastTrackProgress: 0.005,
    isCrashed: false,
    crashTimer: 0,
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
    syncTimer: 0,
    onSyncCallback: null,
    onTakedownCallback: null,
    onFinishCallback: null,
    isSoloAI: true
  };

  // Bike Physical & Driving State
  var bikePhysics = {
    pos: new THREE.Vector3(0, 0, 0),
    trackProgress: 0.012,
    lastTrackProgress: 0.012,
    speed: 0,
    maxSpeed: 42,
    accel: 24,
    decel: 16,
    brake: 38,
    lateralOffset: -0.38,
    lateralSpeed: 0,
    heading: 0,
    tiltAngle: 0,
    nitroFuel: 100,
    isNitro: false,
    isCrashed: false,
    crashTimer: 0,
    collisionCooldown: 4.0,
    controls: {
      left: false,
      right: false,
      gas: false,
      brake: false,
      nitro: false
    }
  };

  /* ================= ENVIRONMENT & LIGHTING ================= */
  function setupLighting() {
    // Dusk Sunset Ambient Light
    var ambient = new THREE.AmbientLight(0xF4D6BC, 0.7);
    scene.add(ambient);

    // Golden Sunlight
    var sun = new THREE.DirectionalLight(0xFFB060, 1.4);
    sun.position.set(80, 120, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    scene.add(sun);

    // Warm Atmosphere Fog
    scene.fog = new THREE.FogExp2(0x3B1F4A, 0.0028);
  }

  /* ================= 2D MINIMAP & 3D NAMEPLATE SPRITE ================= */
  function createNameplateSprite(name, avatar) {
    var c = document.createElement('canvas');
    c.width = 256;
    c.height = 72;
    var ctx = c.getContext('2d');

    ctx.fillStyle = 'rgba(30, 10, 48, 0.88)';
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
    sprite.position.set(0, 4.0, 0);
    return sprite;
  }

  function updateMinimap() {
    var cvs = document.getElementById('raceMinimap');
    if (!cvs || !minimapPoints.length) return;
    var ctx = cvs.getContext('2d');
    var w = cvs.width;
    var h = cvs.height;

    ctx.clearRect(0, 0, w, h);

    function mapCoord(x, z) {
      var b = minimapBounds;
      var nx = (x - b.minX) / (b.maxX - b.minX);
      var nz = (z - b.minZ) / (b.maxZ - b.minZ);
      return {
        cx: 8 + nx * (w - 16),
        cy: 8 + nz * (h - 16)
      };
    }

    // Outer track glow line
    ctx.beginPath();
    for (var i = 0; i < minimapPoints.length; i++) {
      var c = mapCoord(minimapPoints[i].x, minimapPoints[i].z);
      if (i === 0) ctx.moveTo(c.cx, c.cy);
      else ctx.lineTo(c.cx, c.cy);
    }
    ctx.closePath();
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255, 176, 0, 0.4)';
    ctx.stroke();

    // Sharp track line
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    // Start / Finish Line marker
    var finishCoord = mapCoord(minimapPoints[0].x, minimapPoints[0].z);
    ctx.fillStyle = '#FFB000';
    ctx.beginPath();
    ctx.arc(finishCoord.cx, finishCoord.cy, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Partner Marker (Teal / Cyan)
    if (partnerPhysics.pos) {
      var pCoord = mapCoord(partnerPhysics.pos.x, partnerPhysics.pos.z);
      ctx.fillStyle = '#38E1E4';
      ctx.beginPath();
      ctx.arc(pCoord.cx, pCoord.cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Player Marker (Rani Pink)
    if (bikePhysics.pos) {
      var myCoord = mapCoord(bikePhysics.pos.x, bikePhysics.pos.z);
      ctx.fillStyle = '#D6246E';
      ctx.beginPath();
      ctx.arc(myCoord.cx, myCoord.cy, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  /* ================= 3D COLLISION SPARKS SYSTEM ================= */
  function createSparkSystem() {
    if (sparkParticles && sparkParticles.parent) {
      sparkParticles.parent.remove(sparkParticles);
    }
    var count = 50;
    var geom = new THREE.BufferGeometry();
    var positions = new Float32Array(count * 3);
    var vels = [];
    for (var i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      vels.push(new THREE.Vector3(
        (Math.random() - 0.5) * 16,
        Math.random() * 12 + 3,
        (Math.random() - 0.5) * 16
      ));
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    var mat = new THREE.PointsMaterial({
      color: 0xFFA500,
      size: 0.45,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    });
    sparkParticles = new THREE.Points(geom, mat);
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

  /* ================= GAME LOOP & DRIVING PHYSICS ================= */
  function updatePhysics(delta) {
    var p = bikePhysics;
    var ctrl = p.controls;

    // Acceleration & Braking
    var isAccelerating = ctrl.gas;
    if (ctrl.nitro && p.nitroFuel > 0 && ctrl.gas) {
      p.isNitro = true;
      p.nitroFuel = Math.max(0, p.nitroFuel - delta * 25);
      p.speed = Math.min(p.maxSpeed * 1.4, p.speed + p.accel * 1.8 * delta);
    } else {
      p.isNitro = false;
      if (ctrl.gas) {
        p.speed = Math.min(p.maxSpeed, p.speed + p.accel * delta);
      } else if (ctrl.brake) {
        p.speed = Math.max(-10, p.speed - p.brake * delta);
      } else {
        // Coasting friction
        if (p.speed > 0) p.speed = Math.max(0, p.speed - p.decel * delta);
        else if (p.speed < 0) p.speed = Math.min(0, p.speed + p.decel * delta);
      }
    }

    // Sound revving update
    var speedRatio = Math.abs(p.speed) / p.maxSpeed;
    if (window.JodiRaceAudio) {
      window.JodiRaceAudio.setRPM(speedRatio, isAccelerating);
    }

    // Race Timers Update
    raceTimer += delta;
    playerLapTimer += delta;
    partnerLapTimer += delta;

    // Smooth Gyroscope Tilt Steering Interpolation
    currentTiltSteer += (targetTiltSteer - currentTiltSteer) * Math.min(1, delta * 12);

    // Lateral Steering: Left moves Left (+1), Right moves Right (-1)
    var turnRate = 0;
    if (ctrl.left) turnRate += 1;
    if (ctrl.right) turnRate -= 1;

    // Blend in Gyroscope Phone Tilt (seamless analog steering)
    if (Math.abs(currentTiltSteer) > 0.035) {
      turnRate += currentTiltSteer;
      turnRate = Math.max(-1, Math.min(1, turnRate));
    }

    var steerStrength = (p.speed / p.maxSpeed) * 1.8;
    p.lateralOffset = Math.max(-0.85, Math.min(0.85, p.lateralOffset + turnRate * steerStrength * delta));

    // Natural banking lean into corners: turning left leans left (+Z roll)
    var targetTilt = turnRate * 0.45 * Math.min(1, Math.abs(p.speed) / 15);
    p.tiltAngle += (targetTilt - p.tiltAngle) * delta * 8;

    // Progress along spline track
    var totalCurveLen = trackCurve.getLength();
    var deltaProgress = (p.speed * delta) / totalCurveLen;
    p.trackProgress = (p.trackProgress + deltaProgress) % 1.0;
    if (p.trackProgress < 0) p.trackProgress += 1.0;

    // Lap progress tracking for Player with minimum 10.0s lap gate
    if (p.lastTrackProgress > 0.85 && p.trackProgress < 0.15 && p.speed > 0) {
      if (playerLapTimer >= 10.0) {
        raceState.playerLap++;
        playerLapTimer = 0;
        if (window.JodiAudio) window.JodiAudio.playUnlock();
      }
    } else if (p.lastTrackProgress < 0.15 && p.trackProgress > 0.85 && p.speed < 0) {
      raceState.playerLap = Math.max(1, raceState.playerLap - 1);
    }
    p.lastTrackProgress = p.trackProgress;

    // Calculate 3D Position & Heading from Spline for Player
    var safePlayerProgress = Math.max(0.0001, Math.min(0.9999, p.trackProgress));
    var trackPt = trackCurve.getPointAt(safePlayerProgress);
    var tangent = trackCurve.getTangentAt(safePlayerProgress).normalize();
    var worldUp = new THREE.Vector3(0, 1, 0);

    // Road lateral lane vector
    var binormal = worldUp.clone().cross(tangent).normalize();

    // Add lateral lane offset
    var finalPos = trackPt.clone().add(binormal.clone().multiplyScalar(p.lateralOffset * 6));
    p.pos.copy(finalPos);

    if (playerBike) {
      playerBike.position.copy(finalPos);
      playerBike.lookAt(finalPos.clone().add(tangent));

      // Apply banking lean roll
      playerBike.rotateZ(p.tiltAngle);

      // Steer front fork: turning left rotates handlebar left, turning right rotates right
      if (playerBike.frontFork) {
        playerBike.frontFork.rotation.y = turnRate * 0.45;
      }

      // Nitro exhaust flame animation
      if (playerBike.exhaustFlame) {
        if (p.isNitro) {
          playerBike.exhaustFlame.material.opacity = 0.85 + Math.random() * 0.15;
          playerBike.exhaustFlame.scale.set(1 + Math.random() * 0.3, 1 + Math.random() * 0.3, 1.2 + Math.random() * 0.5);
        } else {
          playerBike.exhaustFlame.material.opacity = 0;
        }
      }

      // Rotate wheels with velocity
      if (playerBike.frontWheel && playerBike.rearWheel) {
        var spin = p.speed * delta * 4;
        playerBike.frontWheel.rotation.x += spin;
        playerBike.rearWheel.rotation.x += spin;
      }
    }

    // Dynamic 3rd-Person Chase Camera
    var camDistance = 9.2 + (p.isNitro ? 2.2 : 0);
    var camHeight = 3.6;
    var camPos = finalPos.clone()
      .sub(tangent.clone().multiplyScalar(camDistance))
      .add(new THREE.Vector3(0, camHeight, 0));

    // Prevent chase camera from dipping below the road surface on steep slopes
    if (camPos.y < finalPos.y + 1.6) {
      camPos.y = finalPos.y + 1.6;
    }

    camera.position.lerp(camPos, delta * 8);
    camera.lookAt(finalPos.clone().add(new THREE.Vector3(0, 1.6, 0)).add(tangent.clone().multiplyScalar(6)));

    // ================= PARTNER BIKE UPDATE =================
    if (partnerBike && trackCurve) {
      if (raceState.isSoloAI) {
        // Autopilot AI partner for solo practice
        partnerPhysics.speed = 31 + Math.sin(Date.now() * 0.001) * 6;
        var aiDelta = (partnerPhysics.speed * delta) / totalCurveLen;
        partnerPhysics.trackProgress = (partnerPhysics.trackProgress + aiDelta) % 1.0;
        partnerPhysics.lateralOffset = Math.sin(Date.now() * 0.0015) * 0.5;
        partnerPhysics.tiltAngle = -Math.cos(Date.now() * 0.0015) * 0.25;

        if (partnerPhysics.lastTrackProgress > 0.85 && partnerPhysics.trackProgress < 0.15) {
          if (partnerLapTimer >= 10.0) {
            raceState.partnerLap++;
            partnerLapTimer = 0;
          }
        }
        partnerPhysics.lastTrackProgress = partnerPhysics.trackProgress;
      } else {
        // High-precision smooth multiplayer lerping with forward extrapolation
        if (partnerPhysics.speed > 0 && !partnerPhysics.isCrashed) {
          var forwardEst = (partnerPhysics.speed * delta) / totalCurveLen;
          partnerPhysics.targetProgress = (partnerPhysics.targetProgress + forwardEst) % 1.0;
        }

        var pT = Math.min(1, delta * 14);
        var diffProgress = partnerPhysics.targetProgress - partnerPhysics.trackProgress;
        // Handle wrap-around across 0.0 <-> 1.0 boundary
        if (diffProgress > 0.5) {
          diffProgress -= 1.0;
        } else if (diffProgress < -0.5) {
          diffProgress += 1.0;
        }

        partnerPhysics.trackProgress = (partnerPhysics.trackProgress + diffProgress * pT + 1.0) % 1.0;
        partnerPhysics.lateralOffset += (partnerPhysics.targetLateralOffset - partnerPhysics.lateralOffset) * pT;
        partnerPhysics.tiltAngle += (partnerPhysics.targetTiltAngle - partnerPhysics.tiltAngle) * pT;

        if (partnerPhysics.lastTrackProgress > 0.85 && partnerPhysics.trackProgress < 0.15) {
          // Cross lap line
        }
        partnerPhysics.lastTrackProgress = partnerPhysics.trackProgress;
      }

      var safePartProgress = Math.max(0.0001, Math.min(0.9999, partnerPhysics.trackProgress));
      var partPt = trackCurve.getPointAt(safePartProgress);
      var partTan = trackCurve.getTangentAt(safePartProgress).normalize();
      var partWorldUp = new THREE.Vector3(0, 1, 0);
      var partBinorm = partWorldUp.clone().cross(partTan).normalize();

      var partFinalPos = partPt.clone().add(partBinorm.clone().multiplyScalar(partnerPhysics.lateralOffset * 6));
      partnerPhysics.pos.copy(partFinalPos);

      partnerBike.position.copy(partFinalPos);
      partnerBike.lookAt(partFinalPos.clone().add(partTan));
      partnerBike.rotateZ(partnerPhysics.tiltAngle);

      if (partnerBike.exhaustFlame) {
        partnerBike.exhaustFlame.material.opacity = partnerPhysics.isNitro ? 0.85 : 0;
      }

      if (partnerBike.frontWheel && partnerBike.rearWheel) {
        var spinP = (partnerPhysics.speed || 30) * delta * 4;
        partnerBike.frontWheel.rotation.x += spinP;
        partnerBike.rearWheel.rotation.x += spinP;
      }
    }

    // Update 3D Spark Particles
    if (sparkParticles && sparkParticles.life > 0) {
      sparkParticles.life -= delta;
      sparkParticles.material.opacity = Math.max(0, sparkParticles.life / 0.65);
      var pAttr = sparkParticles.geometry.attributes.position;
      var pArray = pAttr.array;
      for (var sp = 0; sp < sparkParticles.velocities.length; sp++) {
        var vSp = sparkParticles.velocities[sp];
        pArray[sp * 3] += vSp.x * delta;
        pArray[sp * 3 + 1] += vSp.y * delta;
        pArray[sp * 3 + 2] += vSp.z * delta;
        vSp.y -= 22 * delta;
      }
      pAttr.needsUpdate = true;
    }

    // ================= COLLISION, TAKEDOWN & CRASH SYSTEM =================
    if (bikePhysics.collisionCooldown > 0) {
      bikePhysics.collisionCooldown -= delta;
    }

    // Check collision between Player & Partner
    if (playerBike && partnerBike && !bikePhysics.isCrashed && !partnerPhysics.isCrashed && bikePhysics.collisionCooldown <= 0) {
      var collisionDist = p.pos.distanceTo(partnerPhysics.pos);
      if (collisionDist < 2.2) {
        var partnerSpd = (typeof partnerPhysics.speed === 'number') ? partnerPhysics.speed : 0;
        var speedDiff = p.speed - partnerSpd;

        // A takedown strictly requires high-speed Nitro boost (> 25)
        var pRamming = p.isNitro && (p.speed > 25);
        var partnerRamming = partnerPhysics.isNitro && (partnerSpd > 25);

        if (pRamming && !partnerRamming) {
          // PLAYER RAMS PARTNER! (Thokne wale ko +50 pts, partner wipes out)
          triggerTakedown('player', 'partner', false);
        } else if (partnerRamming && !pRamming) {
          // PARTNER RAMS PLAYER! (Partner gets pts, player wipes out)
          triggerTakedown('partner', 'player', false);
        } else {
          // Gentle lateral bounce off (side brush) - NO wipeout!
          var push = 0.15;
          if (p.lateralOffset < partnerPhysics.lateralOffset) {
            p.lateralOffset -= push;
            partnerPhysics.lateralOffset += push;
          } else {
            p.lateralOffset += push;
            partnerPhysics.lateralOffset -= push;
          }
          p.lateralOffset = Math.max(-0.85, Math.min(0.85, p.lateralOffset));
          partnerPhysics.lateralOffset = Math.max(-0.85, Math.min(0.85, partnerPhysics.lateralOffset));
          bikePhysics.collisionCooldown = 0.8;
        }
      }
    }

    // Player Crash / Wipeout tumble & auto-respawn
    if (bikePhysics.isCrashed) {
      bikePhysics.crashTimer -= delta;
      p.speed = 0;
      if (playerBike) {
        playerBike.rotateZ(Math.sin((2.0 - bikePhysics.crashTimer) * Math.PI) * 0.45);
      }
      if (bikePhysics.crashTimer <= 0) {
        bikePhysics.isCrashed = false;
        bikePhysics.collisionCooldown = 2.5; // Post-respawn immunity
        if (playerBike) playerBike.rotation.z = 0;
      }
    }

    // Partner Crash / Wipeout tumble & auto-respawn
    if (partnerPhysics.isCrashed) {
      partnerPhysics.crashTimer -= delta;
      partnerPhysics.speed = 0;
      if (partnerBike) {
        partnerBike.rotateZ(delta * 9);
        partnerBike.position.y = (partFinalPos ? partFinalPos.y : 0) + Math.sin((2.0 - partnerPhysics.crashTimer) * Math.PI) * 0.8;
      }
      if (partnerPhysics.crashTimer <= 0) {
        partnerPhysics.isCrashed = false;
        if (partnerBike) partnerBike.rotation.z = 0;
      }
    }

    // Race Finish Check (Lap 3 Completion)
    if (!raceState.isFinished) {
      if (raceState.playerLap > raceState.totalLaps) {
        raceState.isFinished = true;
        raceState.winner = 'player';
        raceState.playerScore += 100; // Finish line win bonus
        if (typeof raceState.onFinishCallback === 'function') {
          raceState.onFinishCallback({
            winner: 'player',
            playerScore: raceState.playerScore,
            partnerScore: raceState.partnerScore
          });
        }
      } else if (raceState.partnerLap > raceState.totalLaps) {
        raceState.isFinished = true;
        raceState.winner = 'partner';
        raceState.partnerScore += 100;
        if (typeof raceState.onFinishCallback === 'function') {
          raceState.onFinishCallback({
            winner: 'partner',
            playerScore: raceState.playerScore,
            partnerScore: raceState.partnerScore
          });
        }
      }
    }

    // High-frequency WebRTC State Broadcast Trigger (~20Hz)
    raceState.syncTimer += delta;
    if (raceState.syncTimer >= 0.05) {
      raceState.syncTimer = 0;
      if (typeof raceState.onSyncCallback === 'function') {
        raceState.onSyncCallback({
          progress: p.trackProgress,
          lateral: p.lateralOffset,
          speed: p.speed,
          tilt: p.tiltAngle,
          nitro: p.isNitro,
          lap: raceState.playerLap
        });
      }
    }

    // Update Speedometer & HUD
    updateHUD(speedRatio);

    // Update Minimap
    updateMinimap();
  }

  function updateHUD(speedRatio) {
    var speedKmH = Math.round(Math.abs(bikePhysics.speed) * 3.6);
    var spdEl = document.getElementById('raceSpeedNum');
    if (spdEl) spdEl.textContent = speedKmH;

    var nitroBar = document.getElementById('raceNitroBar');
    if (nitroBar) nitroBar.style.width = Math.round(bikePhysics.nitroFuel) + '%';

    var scoreEl = document.getElementById('raceScoreBadge');
    if (scoreEl) scoreEl.textContent = raceState.playerScore;

    // Lap Display
    var lapEl = document.getElementById('raceLapBadge');
    if (lapEl) {
      lapEl.textContent = 'Lap ' + Math.min(raceState.totalLaps, raceState.playerLap) + '/' + raceState.totalLaps;
    }

    // Distance Lead Indicator
    var leadEl = document.getElementById('raceLeadPill');
    if (leadEl) {
      var leadDiff = (raceState.playerLap + bikePhysics.trackProgress) - (raceState.partnerLap + partnerPhysics.trackProgress);
      var meters = Math.round(leadDiff * trackLength);
      if (Math.abs(meters) < 4) {
        leadEl.textContent = '🔥 Barabar! (Neck-to-Neck)';
        leadEl.style.color = '#FFB000';
      } else if (meters > 0) {
        leadEl.textContent = '🚀 Aap +' + meters + 'm Aage!';
        leadEl.style.color = '#38E1E4';
      } else {
        leadEl.textContent = '💨 Partner +' + Math.abs(meters) + 'm Aage!';
        leadEl.style.color = '#FF88AA';
      }
    }
  }

  /* ================= LIFECYCLE & TOUCH CONTROLS ================= */
  function initRace(container, bikeThemeKey, trackSeed, partnerOptions) {
    cleanupRace();
    containerEl = container;

    // Configure Partner Options
    if (partnerOptions) {
      if (partnerOptions.name) partnerPhysics.name = partnerOptions.name;
      if (partnerOptions.avatar) partnerPhysics.avatar = partnerOptions.avatar;
      if (partnerOptions.theme) partnerPhysics.theme = partnerOptions.theme;
      raceState.isSoloAI = partnerOptions.isSoloAI !== undefined ? !!partnerOptions.isSoloAI : true;
    }

    var isHost = (partnerOptions && partnerOptions.isHost !== undefined) ? !!partnerOptions.isHost : true;

    // Reset Physics with Staggered Multi-Lane Grid (Host Left, Guest Right)
    if (isHost) {
      bikePhysics.trackProgress = 0.012;
      bikePhysics.lastTrackProgress = 0.012;
      bikePhysics.lateralOffset = -0.38;

      partnerPhysics.trackProgress = 0.005;
      partnerPhysics.targetProgress = 0.005;
      partnerPhysics.lastTrackProgress = 0.005;
      partnerPhysics.lateralOffset = 0.38;
      partnerPhysics.targetLateralOffset = 0.38;
    } else {
      bikePhysics.trackProgress = 0.005;
      bikePhysics.lastTrackProgress = 0.005;
      bikePhysics.lateralOffset = 0.38;

      partnerPhysics.trackProgress = 0.012;
      partnerPhysics.targetProgress = 0.012;
      partnerPhysics.lastTrackProgress = 0.012;
      partnerPhysics.lateralOffset = -0.38;
      partnerPhysics.targetLateralOffset = -0.38;
    }

    bikePhysics.speed = 0;
    bikePhysics.tiltAngle = 0;
    bikePhysics.nitroFuel = 100;
    bikePhysics.isCrashed = false;
    bikePhysics.crashTimer = 0;
    bikePhysics.collisionCooldown = 4.0; // 4 seconds start-line immunity!
    bikePhysics.controls.gas = false;
    bikePhysics.controls.brake = false;
    bikePhysics.controls.left = false;
    bikePhysics.controls.right = false;
    bikePhysics.controls.nitro = false;

    partnerPhysics.speed = 0;
    partnerPhysics.tiltAngle = 0;
    partnerPhysics.targetTiltAngle = 0;
    partnerPhysics.isCrashed = false;
    partnerPhysics.crashTimer = 0;
    partnerPhysics.isNitro = false;

    raceState.playerLap = 1;
    raceState.partnerLap = 1;
    raceState.isFinished = false;
    raceState.syncTimer = 0;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x3B1F4A);

    // Camera
    camera = new THREE.PerspectiveCamera(65, container.clientWidth / container.clientHeight, 0.5, 1200);

    // WebGL Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Lighting & Procedural Track
    setupLighting();
    if (window.JodiRaceTrack) {
      trackCurve = window.JodiRaceTrack.generate(trackSeed);
      trackLength = window.JodiRaceTrack.getLength();
      minimapPoints = window.JodiRaceTrack.getMinimapPoints();
      minimapBounds = window.JodiRaceTrack.getMinimapBounds();
      window.JodiRaceTrack.buildMesh(scene);
    }

    // 3D Player Bike
    var buildBike = (window.JodiRaceModels && window.JodiRaceModels.buildRealisticBike);
    playerBike = buildBike ? buildBike(bikeThemeKey || 'sport') : new THREE.Group();
    scene.add(playerBike);

    // 3D Partner Bike with floating Nametag Sprite
    partnerBike = buildBike ? buildBike(partnerPhysics.theme || 'bullet') : new THREE.Group();
    partnerNameSprite = createNameplateSprite(partnerPhysics.name, partnerPhysics.avatar);
    partnerBike.add(partnerNameSprite);
    scene.add(partnerBike);

    // Spark Particles System
    createSparkSystem();

    // Audio Engine
    if (window.JodiRaceAudio) {
      window.JodiRaceAudio.init();
    }

    // Bind Controls
    bindControls();

    raceTimer = 0;
    playerLapTimer = 0;
    partnerLapTimer = 0;
    currentTiltSteer = 0;
    targetTiltSteer = 0;

    // Animation Loop with Defensive Exception Protection
    isRunning = true;
    var clock = new THREE.Clock();

    function animate() {
      if (!isRunning) return;
      animFrameId = requestAnimationFrame(animate);
      try {
        var delta = Math.min(clock.getDelta(), 0.05);
        updatePhysics(delta);
        renderer.render(scene, camera);
      } catch (loopErr) {
        console.warn('Race tick warning:', loopErr);
      }
    }
    animate();

    window.addEventListener('resize', onWindowResize);
    setupTiltSensor();
  }

  function onWindowResize() {
    if (!renderer || !containerEl) return;
    camera.aspect = containerEl.clientWidth / containerEl.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(containerEl.clientWidth, containerEl.clientHeight);
  }

  // Device Orientation Gyroscope Tilt Handler
  function onDeviceOrientation(e) {
    if (e.gamma === null || e.gamma === undefined) return;
    hasTiltSensor = true;
    var gamma = e.gamma; // -90 to +90 degrees roll in portrait

    // Deadzone of 3.2 degrees to prevent resting tremor
    if (Math.abs(gamma) < 3.2) {
      targetTiltSteer = 0;
    } else {
      // Tilting left: gamma is negative (e.g. -15°).
      // Left turn needs positive turnRate, so targetTiltSteer is POSITIVE (+).
      // Tilting right: gamma is positive (e.g. +15°).
      // Right turn needs negative turnRate, so targetTiltSteer is NEGATIVE (-).
      var raw = (gamma - Math.sign(gamma) * 3.2) / 20;
      targetTiltSteer = -Math.max(-1, Math.min(1, raw));
    }

    var badge = document.getElementById('raceTiltBadge');
    if (badge && !badge.classList.contains('active')) {
      badge.classList.add('active');
    }
  }

  function setupTiltSensor() {
    if (typeof window.DeviceOrientationEvent !== 'undefined' && typeof window.DeviceOrientationEvent.requestPermission === 'function') {
      // iOS 13+ requires user gesture request
      window.DeviceOrientationEvent.requestPermission().then(function (state) {
        if (state === 'granted') {
          window.addEventListener('deviceorientation', onDeviceOrientation, true);
        }
      }).catch(function () {});
    } else if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', onDeviceOrientation, true);
    }
  }

  function bindControls() {
    onKeyDownRef = function (e) {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') bikePhysics.controls.gas = true;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') bikePhysics.controls.brake = true;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') bikePhysics.controls.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') bikePhysics.controls.right = true;
      if (e.key === 'Shift') bikePhysics.controls.nitro = true;
    };

    onKeyUpRef = function (e) {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') bikePhysics.controls.gas = false;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') bikePhysics.controls.brake = false;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') bikePhysics.controls.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') bikePhysics.controls.right = false;
      if (e.key === 'Shift') bikePhysics.controls.nitro = false;
    };

    window.addEventListener('keydown', onKeyDownRef);
    window.addEventListener('keyup', onKeyUpRef);

    // Modern Multi-Touch Driving Controls (Pointer Events + Pointer Capture)
    // Ensures holding Gas with one thumb and pressing Steer/Nitro with the other NEVER cancels Gas!
    function setupTouchBtn(btnId, controlKey) {
      var el = document.getElementById(btnId);
      if (!el) return;

      var activePointers = new Set();

      function onPointerDown(e) {
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
        activePointers.add(e.pointerId);
        bikePhysics.controls[controlKey] = true;

        setupTiltSensor();
        if (controlKey === 'gas' && window.JodiRaceAudio) {
          window.JodiRaceAudio.ensureContext();
        }
      }

      function onPointerEnd(e) {
        e.preventDefault();
        try { el.releasePointerCapture(e.pointerId); } catch (_) {}
        activePointers.delete(e.pointerId);
        if (activePointers.size === 0) {
          bikePhysics.controls[controlKey] = false;
        }
      }

      el.addEventListener('pointerdown', onPointerDown, { passive: false });
      el.addEventListener('pointerup', onPointerEnd, { passive: false });
      el.addEventListener('pointercancel', onPointerEnd, { passive: false });
      el.addEventListener('lostpointercapture', onPointerEnd, { passive: false });
    }

    setupTouchBtn('btnSteerL', 'left');
    setupTouchBtn('btnSteerR', 'right');
    setupTouchBtn('btnGas', 'gas');
    setupTouchBtn('btnBrake', 'brake');
    setupTouchBtn('btnNitro', 'nitro');
  }

  function cleanupRace() {
    isRunning = false;
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    if (window.JodiRaceAudio) {
      window.JodiRaceAudio.stop();
    }
    window.removeEventListener('resize', onWindowResize);
    if (onKeyDownRef) window.removeEventListener('keydown', onKeyDownRef);
    if (onKeyUpRef) window.removeEventListener('keyup', onKeyUpRef);
    window.removeEventListener('deviceorientation', onDeviceOrientation, true);

    if (renderer && renderer.domElement && renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
      renderer.dispose();
      renderer = null;
    }
  }

  function onPartnerSync(data) {
    if (!data) return;
    raceState.isSoloAI = false;
    if (typeof data.progress === 'number') partnerPhysics.targetProgress = data.progress;
    if (typeof data.lateral === 'number') partnerPhysics.targetLateralOffset = data.lateral;
    if (typeof data.speed === 'number') partnerPhysics.speed = data.speed;
    if (typeof data.tilt === 'number') partnerPhysics.targetTiltAngle = data.tilt;
    partnerPhysics.isNitro = !!data.nitro;
    if (typeof data.lap === 'number') {
      partnerPhysics.lap = data.lap;
      raceState.partnerLap = data.lap;
    }
  }

  function triggerTakedown(rammer, victim, isFromNetwork) {
    bikePhysics.collisionCooldown = 3.5;
    if (window.JodiAudio && typeof window.JodiAudio.playCrash === 'function') {
      window.JodiAudio.playCrash();
    }
    if (playerBike && partnerBike) {
      var sparkPoint = playerBike.position.clone().lerp(partnerBike.position, 0.5);
      burstSparks(sparkPoint);
    }

    var banner = document.getElementById('raceTakedownBanner');
    if (rammer === 'player') {
      raceState.playerScore += 50;
      bikePhysics.nitroFuel = Math.min(100, bikePhysics.nitroFuel + 35);
      partnerPhysics.isCrashed = true;
      partnerPhysics.crashTimer = 2.0;

      if (banner) {
        banner.innerHTML = '<div class="takedown-title">💥 TAKEDOWN!</div>' +
          '<div class="takedown-sub">Partner ko thok diya! +50 PTS 🔥</div>';
        banner.className = 'race-takedown-banner show rammer';
        setTimeout(function () { banner.className = 'race-takedown-banner'; }, 2200);
      }
      if (window.burstCenter) window.burstCenter(30);

      // Only send over network if this event originated locally!
      if (!isFromNetwork && typeof raceState.onTakedownCallback === 'function') {
        raceState.onTakedownCallback({ rammer: 'player', victim: 'partner', points: 50 });
      }
    } else {
      // Partner rammed player (local player is victim)
      raceState.partnerScore += 50;
      bikePhysics.isCrashed = true;
      bikePhysics.crashTimer = 2.0;
      bikePhysics.speed = 0;

      if (banner) {
        banner.innerHTML = '<div class="takedown-title">💥 WIPED OUT!</div>' +
          '<div class="takedown-sub">Partner ne thok diya! Respawning... ⏳</div>';
        banner.className = 'race-takedown-banner show victim';
        setTimeout(function () { banner.className = 'race-takedown-banner'; }, 2200);
      }

      // Only send over network if this event originated locally!
      if (!isFromNetwork && typeof raceState.onTakedownCallback === 'function') {
        raceState.onTakedownCallback({ rammer: 'partner', victim: 'player', points: 50 });
      }
    }
  }

  function onExternalTakedown(data) {
    if (!data) return;
    // Don't re-trigger crash if already in crashed state
    if (bikePhysics.isCrashed && data.victim === 'player') return;
    var localRammer = (data.rammer === 'player') ? 'partner' : 'player';
    var localVictim = (data.victim === 'player') ? 'partner' : 'player';
    triggerTakedown(localRammer, localVictim, true /* isFromNetwork */);
  }

  global.JodiRace = {
    init: initRace,
    cleanup: cleanupRace,
    setSoloAI: function (val) { raceState.isSoloAI = !!val; },
    setupTiltSensor: setupTiltSensor,
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
