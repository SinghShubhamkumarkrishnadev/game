/* Jodi Race - 3D Hyper-Realistic Multiplayer Bike Racing Engine (Phases 1, 2 & 3 Complete) */
(function (global) {
  'use strict';

  var scene, camera, renderer;
  var trackCurve, trackMesh, trackLength = 1600;
  var playerBike, partnerBike, partnerNameSprite;
  var isRunning = false;
  var animFrameId = null;
  var containerEl = null;
  var sparkParticles = null;

  var minimapPoints = [];
  var minimapBounds = { minX: -400, maxX: 400, minZ: -400, maxZ: 400 };

  // Partner State & Interpolation (Phase 2 & 3)
  var partnerPhysics = {
    pos: new THREE.Vector3(0, 0, 0),
    trackProgress: 0.02,
    targetProgress: 0.02,
    lateralOffset: 0.35,
    targetLateralOffset: 0.35,
    speed: 0,
    tiltAngle: 0,
    targetTiltAngle: 0,
    isNitro: false,
    lap: 1,
    lastTrackProgress: 0.02,
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

  // Audio Engine for Motorcycle Sound
  var engineAudio = {
    ctx: null,
    osc1: null,
    osc2: null,
    gain: null,
    init: function () {
      try {
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
        this.osc1 = this.ctx.createOscillator();
        this.osc2 = this.ctx.createOscillator();
        this.gain = this.ctx.createGain();

        this.osc1.type = 'sawtooth';
        this.osc2.type = 'triangle';

        this.osc1.frequency.setValueAtTime(45, this.ctx.currentTime);
        this.osc2.frequency.setValueAtTime(90, this.ctx.currentTime);

        this.gain.gain.setValueAtTime(0.001, this.ctx.currentTime);

        this.osc1.connect(this.gain);
        this.osc2.connect(this.gain);
        this.gain.connect(this.ctx.destination);

        this.osc1.start();
        this.osc2.start();
      } catch (e) {}
    },
    setRPM: function (speedRatio, isAccelerating) {
      if (!this.ctx || !this.gain) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(function () {});
      }
      var now = this.ctx.currentTime;
      var baseFreq = 40 + speedRatio * 180;
      this.osc1.frequency.setTargetAtTime(baseFreq, now, 0.05);
      this.osc2.frequency.setTargetAtTime(baseFreq * 2, now, 0.05);

      var volume = isAccelerating ? (0.04 + speedRatio * 0.06) : (0.02 + speedRatio * 0.03);
      if (window.JodiAudio && window.JodiAudio.isMuted()) {
        volume = 0;
      }
      this.gain.gain.setTargetAtTime(volume, now, 0.05);
    },
    stop: function () {
      if (this.gain && this.ctx) {
        this.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
      }
    }
  };

  // Bike Physical & Driving State
  var bikePhysics = {
    pos: new THREE.Vector3(0, 0, 0),
    trackProgress: 0.01, // 0.0 to 1.0 along spline
    lastTrackProgress: 0.01,
    speed: 0,            // current velocity (units/sec)
    maxSpeed: 42,        // top speed
    accel: 24,           // acceleration rate
    decel: 16,           // coasting drag
    brake: 38,           // braking force
    lateralOffset: -0.25,// -1 (left edge) to +1 (right edge)
    lateralSpeed: 0,
    heading: 0,          // yaw angle
    tiltAngle: 0,        // banking roll angle into turns
    nitroFuel: 100,      // nitro energy
    isNitro: false,
    isCrashed: false,
    crashTimer: 0,
    collisionCooldown: 0,
    controls: {
      left: false,
      right: false,
      gas: false,
      brake: false,
      nitro: false
    }
  };

  // 4 Hyper-Realistic Color Themes
  var BIKE_THEMES = {
    bullet: {
      name: 'Royal Bullet 350',
      bodyColor: 0x1A1A1A,
      accentColor: 0xE6C280,
      metalColor: 0xE8E8E8,
      specular: 0x999999,
      roughness: 0.25,
      metalness: 0.85
    },
    sport: {
      name: 'Rani Neon Sport',
      bodyColor: 0xD6246E,
      accentColor: 0xFFB000,
      metalColor: 0x222222,
      specular: 0xFF88AA,
      roughness: 0.15,
      metalness: 0.65
    },
    turbo: {
      name: 'Mor Teal Turbo',
      bodyColor: 0x0B7A7C,
      accentColor: 0x38E1E4,
      metalColor: 0x333333,
      specular: 0x88EEEE,
      roughness: 0.2,
      metalness: 0.75
    },
    cafe: {
      name: 'Kesar Cafe Racer',
      bodyColor: 0xE65100,
      accentColor: 0xFFD54F,
      metalColor: 0xD0D0D0,
      specular: 0xFFA726,
      roughness: 0.22,
      metalness: 0.8
    }
  };

  /* ================= 1. PROCEDURAL 3D CURVY TRACK ================= */
  function generateProceduralTrack(seed) {
    var points = [];
    var numPoints = 16;
    var radius = 320;
    var s = seed || Math.random() * 1000;

    for (var i = 0; i < numPoints; i++) {
      var angle = (i / numPoints) * Math.PI * 2;
      // Winding curve perturbation
      var rOffset = Math.sin(angle * 3 + s) * 70 + Math.cos(angle * 2 - s) * 45;
      var r = radius + rOffset;
      var x = Math.cos(angle) * r;
      var z = Math.sin(angle) * r;
      // Gentle elevation changes / hills
      var y = Math.sin(angle * 4 + s) * 16 + Math.cos(angle * 3) * 10;
      points.push(new THREE.Vector3(x, y, z));
    }

    trackCurve = new THREE.CatmullRomCurve3(points, true, 'centripetal');
    trackLength = Math.round(trackCurve.getLength());

    // Precompute 2D minimap spline samples
    minimapPoints = [];
    var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (var m = 0; m <= 80; m++) {
      var mp = trackCurve.getPointAt(m / 80);
      minimapPoints.push({ x: mp.x, z: mp.z });
      if (mp.x < minX) minX = mp.x;
      if (mp.x > maxX) maxX = mp.x;
      if (mp.z < minZ) minZ = mp.z;
      if (mp.z > maxZ) maxZ = mp.z;
    }
    var pad = 45;
    minimapBounds = {
      minX: minX - pad,
      maxX: maxX + pad,
      minZ: minZ - pad,
      maxZ: maxZ + pad
    };

    return trackCurve;
  }

  function buildTrackMesh() {
    var segments = 400;
    var roadWidth = 14;
    var geom = new THREE.BufferGeometry();
    var vertices = [];
    var uvs = [];
    var indices = [];

    var frames = trackCurve.computeFrenetFrames(segments, true);

    for (var i = 0; i <= segments; i++) {
      var u = i / segments;
      var p = trackCurve.getPointAt(u);
      var N = frames.normals[i % segments];
      var B = frames.binormals[i % segments];

      // Road Left & Right edges
      var leftPt = p.clone().add(B.clone().multiplyScalar(-roadWidth / 2));
      var rightPt = p.clone().add(B.clone().multiplyScalar(roadWidth / 2));

      vertices.push(leftPt.x, leftPt.y + 0.1, leftPt.z);
      vertices.push(rightPt.x, rightPt.y + 0.1, rightPt.z);

      uvs.push(0, u * 80);
      uvs.push(1, u * 80);

      if (i < segments) {
        var row1 = i * 2;
        var row2 = (i + 1) * 2;
        indices.push(row1, row1 + 1, row2);
        indices.push(row1 + 1, row2 + 1, row2);
      }
    }

    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    // Road Texture Canvas (Asphalt + Dashed Center Line + Red/White Rumble Strips)
    var cvs = document.createElement('canvas');
    cvs.width = 512;
    cvs.height = 512;
    var ctx = cvs.getContext('2d');

    // Dark Asphalt
    ctx.fillStyle = '#222228';
    ctx.fillRect(0, 0, 512, 512);

    // Rumble Strips (Kerbs) on sides
    for (var k = 0; k < 512; k += 32) {
      ctx.fillStyle = (Math.floor(k / 32) % 2 === 0) ? '#D6246E' : '#FFFFFF';
      ctx.fillRect(0, k, 24, 32);
      ctx.fillRect(488, k, 24, 32);
    }

    // Road Edge Lines
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(34, 0); ctx.lineTo(34, 512);
    ctx.moveTo(478, 0); ctx.lineTo(478, 512);
    ctx.stroke();

    // Dashed Center Lane
    ctx.strokeStyle = '#FFB000';
    ctx.lineWidth = 8;
    ctx.setLineDash([36, 28]);
    ctx.beginPath();
    ctx.moveTo(256, 0); ctx.lineTo(256, 512);
    ctx.stroke();

    var roadTex = new THREE.CanvasTexture(cvs);
    roadTex.wrapS = THREE.RepeatWrapping;
    roadTex.wrapT = THREE.RepeatWrapping;

    var roadMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      roughness: 0.8,
      metalness: 0.1
    });

    trackMesh = new THREE.Mesh(geom, roadMat);
    trackMesh.receiveShadow = true;
    scene.add(trackMesh);

    // Guard Rails (Safety barrier tubes on outer edges)
    buildGuardRails(segments, roadWidth);

    // Start & Finish Banner
    buildFinishBanner();
  }

  function buildGuardRails(segments, roadWidth) {
    var leftPoints = [];
    var rightPoints = [];
    for (var i = 0; i <= segments; i += 2) {
      var u = i / segments;
      var p = trackCurve.getPointAt(u);
      var B = trackCurve.computeFrenetFrames(segments, true).binormals[i % segments];
      leftPoints.push(p.clone().add(B.clone().multiplyScalar(-roadWidth / 2 - 0.8)).add(new THREE.Vector3(0, 0.8, 0)));
      rightPoints.push(p.clone().add(B.clone().multiplyScalar(roadWidth / 2 + 0.8)).add(new THREE.Vector3(0, 0.8, 0)));
    }

    var railMat = new THREE.MeshStandardMaterial({ color: 0xAAAAAA, metalness: 0.9, roughness: 0.3 });
    var leftCurve = new THREE.CatmullRomCurve3(leftPoints, true);
    var rightCurve = new THREE.CatmullRomCurve3(rightPoints, true);

    var leftRail = new THREE.Mesh(new THREE.TubeGeometry(leftCurve, 180, 0.25, 6, true), railMat);
    var rightRail = new THREE.Mesh(new THREE.TubeGeometry(rightCurve, 180, 0.25, 6, true), railMat);
    scene.add(leftRail);
    scene.add(rightRail);
  }

  function buildFinishBanner() {
    var p0 = trackCurve.getPointAt(0);
    var t0 = trackCurve.getTangentAt(0);
    var b0 = new THREE.Vector3(0, 1, 0).cross(t0).normalize();

    var bannerGroup = new THREE.Group();
    bannerGroup.position.copy(p0);

    // Arch Pillars
    var postMat = new THREE.MeshStandardMaterial({ color: 0xD6246E, metalness: 0.7, roughness: 0.3 });
    var pL = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 8), postMat);
    var pR = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 8), postMat);
    pL.position.copy(b0.clone().multiplyScalar(-8)).add(new THREE.Vector3(0, 4, 0));
    pR.position.copy(b0.clone().multiplyScalar(8)).add(new THREE.Vector3(0, 4, 0));

    // Overhead Banner
    var bMat = new THREE.MeshStandardMaterial({ color: 0xFFB000, metalness: 0.8, roughness: 0.2 });
    var crossBar = new THREE.Mesh(new THREE.BoxGeometry(16.5, 1.8, 0.5), bMat);
    crossBar.position.set(0, 7.5, 0);
    crossBar.lookAt(crossBar.position.clone().add(t0));

    bannerGroup.add(pL);
    bannerGroup.add(pR);
    bannerGroup.add(crossBar);
    scene.add(bannerGroup);
  }

  /* ================= 2. HYPER-REALISTIC 3D BIKE MODEL BUILDER ================= */
  function buildRealisticBike(themeKey) {
    var theme = BIKE_THEMES[themeKey] || BIKE_THEMES.sport;
    var bike = new THREE.Group();

    // High Spec Materials
    var bodyPaint = new THREE.MeshStandardMaterial({
      color: theme.bodyColor,
      metalness: theme.metalness,
      roughness: theme.roughness
    });

    var accentPaint = new THREE.MeshStandardMaterial({
      color: theme.accentColor,
      metalness: 0.8,
      roughness: 0.2
    });

    var chromeMat = new THREE.MeshStandardMaterial({
      color: 0xEEEEEE,
      metalness: 0.95,
      roughness: 0.1
    });

    var tireMat = new THREE.MeshStandardMaterial({
      color: 0x1A1A1A,
      metalness: 0.05,
      roughness: 0.85
    });

    var leatherMat = new THREE.MeshStandardMaterial({
      color: 0x221100,
      metalness: 0.1,
      roughness: 0.7
    });

    var ledMat = new THREE.MeshBasicMaterial({ color: 0xE0FFFF });

    // Wheel Sub-builder
    function createWheel() {
      var wGroup = new THREE.Group();
      // Tire Torus
      var tire = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.24, 12, 32), tireMat);
      tire.castShadow = true;
      wGroup.add(tire);
      // Rim
      var rim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.22, 16), chromeMat);
      rim.rotation.x = Math.PI / 2;
      wGroup.add(rim);
      // Brake Disc
      var disc = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 16), chromeMat);
      disc.rotation.x = Math.PI / 2;
      disc.position.z = 0.12;
      wGroup.add(disc);
      return wGroup;
    }

    // Front & Rear Wheels
    var rearWheel = createWheel();
    rearWheel.position.set(0, 0.7, -1.3);
    bike.add(rearWheel);
    bike.rearWheel = rearWheel;

    // Steerable Front Fork & Wheel Assembly
    var frontFork = new THREE.Group();
    frontFork.position.set(0, 0, 1.4);

    var frontWheel = createWheel();
    frontWheel.position.set(0, 0.7, 0);
    frontFork.add(frontWheel);
    bike.frontWheel = frontWheel;

    // Fork tubes
    var forkL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8), chromeMat);
    var forkR = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8), chromeMat);
    forkL.position.set(-0.24, 0.9, 0);
    forkR.position.set(0.24, 0.9, 0);
    forkL.rotation.x = -Math.PI / 8;
    forkR.rotation.x = -Math.PI / 8;
    frontFork.add(forkL);
    frontFork.add(forkR);

    bike.add(frontFork);
    bike.frontFork = frontFork;

    // Chassis Frame (Tubular Steel)
    var frameMat = new THREE.MeshStandardMaterial({ color: 0x2A2A2A, metalness: 0.8, roughness: 0.4 });
    var frameMain = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 8), frameMat);
    frameMain.rotation.x = Math.PI / 3.2;
    frameMain.position.set(0, 1.15, 0.1);
    bike.add(frameMain);

    // Engine Block (V-Twin with Cooling Fins)
    var engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.85), chromeMat);
    engineBlock.position.set(0, 0.9, -0.2);
    bike.add(engineBlock);

    // Chrome Dual Exhaust Pipes
    var exhaustL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.8, 8), chromeMat);
    exhaustL.rotation.x = Math.PI / 2.2;
    exhaustL.position.set(0.38, 0.6, -1.0);
    bike.add(exhaustL);

    // Nitro Exhaust Flame (Ignites on Boost)
    var flameGeom = new THREE.ConeGeometry(0.18, 1.1, 8);
    flameGeom.rotateX(-Math.PI / 2);
    var flameMat = new THREE.MeshBasicMaterial({ color: 0x00FFFF, transparent: true, opacity: 0 });
    var exhaustFlame = new THREE.Mesh(flameGeom, flameMat);
    exhaustFlame.position.set(0.38, 0.6, -2.1);
    bike.add(exhaustFlame);
    bike.exhaustFlame = exhaustFlame;

    // Sculpted Fuel Tank (Curved teardrop shape)
    var tankGeom = new THREE.SphereGeometry(0.65, 16, 16);
    tankGeom.scale(0.6, 0.55, 1.3);
    var tank = new THREE.Mesh(tankGeom, bodyPaint);
    tank.position.set(0, 1.6, 0.35);
    tank.castShadow = true;
    bike.add(tank);

    // Tank Racing Stripe
    var stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.58, 1.4), accentPaint);
    stripe.position.set(0, 1.65, 0.35);
    bike.add(stripe);

    // Contoured Leather Seat
    var seatGeom = new THREE.BoxGeometry(0.48, 0.18, 0.95);
    var seat = new THREE.Mesh(seatGeom, leatherMat);
    seat.position.set(0, 1.45, -0.6);
    bike.add(seat);

    // Aerodynamic Front Fairing / Cowl
    var cowlGeom = new THREE.ConeGeometry(0.42, 1.1, 16);
    cowlGeom.scale(0.9, 1.1, 0.65);
    var cowl = new THREE.Mesh(cowlGeom, bodyPaint);
    cowl.rotation.x = -Math.PI / 2.6;
    cowl.position.set(0, 1.7, 1.25);
    bike.add(cowl);

    // Twin LED Projector Headlights
    var lightL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), ledMat);
    var lightR = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), ledMat);
    lightL.position.set(-0.16, 1.62, 1.7);
    lightR.position.set(0.16, 1.62, 1.7);
    bike.add(lightL);
    bike.add(lightR);

    // Headlight Glow Beam
    var spotLight = new THREE.SpotLight(0xE0FFFF, 2, 45, Math.PI / 6, 0.4);
    spotLight.position.set(0, 1.6, 1.7);
    var targetObj = new THREE.Object3D();
    targetObj.position.set(0, 0, 10);
    bike.add(targetObj);
    spotLight.target = targetObj;
    bike.add(spotLight);

    // Handlebars & Mirrors
    var bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 8), chromeMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 1.85, 0.95);
    bike.add(bar);

    // Stylized Rider Silhouette Group
    var riderGroup = new THREE.Group();
    var riderMat = new THREE.MeshStandardMaterial({ color: 0x181822, roughness: 0.7 });
    // Torso (leaning forward)
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.35), riderMat);
    torso.position.set(0, 2.05, -0.25);
    torso.rotation.x = Math.PI / 6;
    riderGroup.add(torso);
    // Helmet
    var helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), accentPaint);
    helmet.position.set(0, 2.5, 0.0);
    riderGroup.add(helmet);

    bike.add(riderGroup);
    bike.rider = riderGroup;

    bike.scale.set(1.4, 1.4, 1.4);
    return bike;
  }

  /* ================= 3. ENVIRONMENT & LIGHTING ================= */
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

    // Distant Terrain Ground
    var groundGeom = new THREE.PlaneGeometry(2400, 2400);
    var groundMat = new THREE.MeshStandardMaterial({
      color: 0x221230,
      roughness: 0.95,
      metalness: 0.05
    });
    var ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -8;
    ground.receiveShadow = true;
    scene.add(ground);
  }

  /* ================= 3.5 2D MINIMAP & 3D NAMEPLATE SPRITE ================= */
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

  /* ================= 3.6 3D COLLISION SPARKS SYSTEM ================= */
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

  /* ================= 4. GAME LOOP & DRIVING PHYSICS ================= */
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
    engineAudio.setRPM(speedRatio, isAccelerating);

    // Lateral Steering & Banking Lean
    var turnRate = 0;
    if (ctrl.left) turnRate -= 1;
    if (ctrl.right) turnRate += 1;

    var steerStrength = (p.speed / p.maxSpeed) * 1.8;
    p.lateralOffset = Math.max(-0.85, Math.min(0.85, p.lateralOffset + turnRate * steerStrength * delta));

    // Natural banking lean into corners
    var targetTilt = -turnRate * 0.45 * Math.min(1, Math.abs(p.speed) / 15);
    p.tiltAngle += (targetTilt - p.tiltAngle) * delta * 8;

    // Progress along spline track
    var totalCurveLen = trackCurve.getLength();
    var deltaProgress = (p.speed * delta) / totalCurveLen;
    p.trackProgress = (p.trackProgress + deltaProgress) % 1.0;
    if (p.trackProgress < 0) p.trackProgress += 1.0;

    // Lap progress tracking for Player
    if (p.lastTrackProgress > 0.85 && p.trackProgress < 0.15 && p.speed > 0) {
      raceState.playerLap++;
      if (window.JodiAudio) window.JodiAudio.playUnlock();
    } else if (p.lastTrackProgress < 0.15 && p.trackProgress > 0.85 && p.speed < 0) {
      raceState.playerLap = Math.max(1, raceState.playerLap - 1);
    }
    p.lastTrackProgress = p.trackProgress;

    // Calculate 3D Position & Heading from Spline for Player
    var safePlayerProgress = Math.max(0.0001, Math.min(0.9999, p.trackProgress));
    var trackPt = trackCurve.getPointAt(safePlayerProgress);
    var tangent = trackCurve.getTangentAt(safePlayerProgress);
    var up = new THREE.Vector3(0, 1, 0);
    var binormal = up.clone().cross(tangent).normalize();

    // Add lateral lane offset
    var finalPos = trackPt.clone().add(binormal.clone().multiplyScalar(p.lateralOffset * 6));
    p.pos.copy(finalPos);

    if (playerBike) {
      playerBike.position.copy(finalPos);
      playerBike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
      // Apply banking roll
      playerBike.rotateZ(p.tiltAngle);

      // Steer front fork realistically
      if (playerBike.frontFork) {
        playerBike.frontFork.rotation.y = -turnRate * 0.45;
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
    var camDistance = 11 + (p.isNitro ? 3 : 0);
    var camHeight = 4.2;
    var camPos = finalPos.clone()
      .sub(tangent.clone().multiplyScalar(camDistance))
      .add(new THREE.Vector3(0, camHeight, 0));

    camera.position.lerp(camPos, delta * 8);
    camera.lookAt(finalPos.clone().add(new THREE.Vector3(0, 1.8, 0)).add(tangent.clone().multiplyScalar(6)));

    // ================= PARTNER BIKE UPDATE (PHASE 2) =================
    if (partnerBike && trackCurve) {
      if (raceState.isSoloAI) {
        // Autopilot AI partner for solo practice
        partnerPhysics.speed = 31 + Math.sin(Date.now() * 0.001) * 6;
        var aiDelta = (partnerPhysics.speed * delta) / totalCurveLen;
        partnerPhysics.trackProgress = (partnerPhysics.trackProgress + aiDelta) % 1.0;
        partnerPhysics.lateralOffset = Math.sin(Date.now() * 0.0015) * 0.5;
        partnerPhysics.tiltAngle = -Math.cos(Date.now() * 0.0015) * 0.25;

        if (partnerPhysics.lastTrackProgress > 0.85 && partnerPhysics.trackProgress < 0.15) {
          raceState.partnerLap++;
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
      var partTan = trackCurve.getTangentAt(safePartProgress);
      var partUp = new THREE.Vector3(0, 1, 0);
      var partBinorm = partUp.clone().cross(partTan).normalize();
      var partFinalPos = partPt.clone().add(partBinorm.clone().multiplyScalar(partnerPhysics.lateralOffset * 6));
      partnerPhysics.pos.copy(partFinalPos);

      partnerBike.position.copy(partFinalPos);
      partnerBike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), partTan);
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

    // ================= COLLISION, TAKEDOWN & CRASH SYSTEM (PHASE 3) =================
    if (bikePhysics.collisionCooldown > 0) {
      bikePhysics.collisionCooldown -= delta;
    }

    // Check collision between Player & Partner
    if (playerBike && partnerBike && !bikePhysics.isCrashed && !partnerPhysics.isCrashed && bikePhysics.collisionCooldown <= 0) {
      var collisionDist = p.pos.distanceTo(partnerPhysics.pos);
      if (collisionDist < 2.2) {
        var partnerSpd = (typeof partnerPhysics.speed === 'number') ? partnerPhysics.speed : 0;
        var speedDiff = p.speed - partnerSpd;

        // A takedown requires real speed (> 16) AND either Nitro or closing speed advantage (> 7)
        var pRamming = (p.speed > 16) && (p.isNitro || speedDiff > 7);
        var partnerRamming = (partnerSpd > 16) && (partnerPhysics.isNitro || speedDiff < -7);

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
        playerBike.rotateZ(delta * 9);
        playerBike.position.y = finalPos.y + Math.sin((2.0 - bikePhysics.crashTimer) * Math.PI) * 0.8;
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

  /* ================= 5. LIFECYCLE & TOUCH CONTROLS ================= */
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
      // Host takes Pole Position (Left lane, slightly ahead)
      bikePhysics.trackProgress = 0.012;
      bikePhysics.lastTrackProgress = 0.012;
      bikePhysics.lateralOffset = -0.38;

      partnerPhysics.trackProgress = 0.005;
      partnerPhysics.targetProgress = 0.005;
      partnerPhysics.lastTrackProgress = 0.005;
      partnerPhysics.lateralOffset = 0.38;
      partnerPhysics.targetLateralOffset = 0.38;
    } else {
      // Guest takes Grid 2 (Right lane, slightly behind)
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
    generateProceduralTrack(trackSeed);
    buildTrackMesh();

    // 3D Player Bike
    playerBike = buildRealisticBike(bikeThemeKey || 'sport');
    scene.add(playerBike);

    // 3D Partner Bike with floating Nametag Sprite (Phase 2)
    partnerBike = buildRealisticBike(partnerPhysics.theme || 'bullet');
    partnerNameSprite = createNameplateSprite(partnerPhysics.name, partnerPhysics.avatar);
    partnerBike.add(partnerNameSprite);
    scene.add(partnerBike);

    // Spark Particles System (Phase 3)
    createSparkSystem();

    // Audio Engine
    engineAudio.init();

    // Bind Controls
    bindControls();

    // Animation Loop
    isRunning = true;
    var clock = new THREE.Clock();

    function animate() {
      if (!isRunning) return;
      animFrameId = requestAnimationFrame(animate);
      var delta = Math.min(clock.getDelta(), 0.05);
      updatePhysics(delta);
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', onWindowResize);
  }

  function onWindowResize() {
    if (!renderer || !containerEl) return;
    camera.aspect = containerEl.clientWidth / containerEl.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(containerEl.clientWidth, containerEl.clientHeight);
  }

  function bindControls() {
    // Keyboard Controls
    function onKeyDown(e) {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') bikePhysics.controls.gas = true;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') bikePhysics.controls.brake = true;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') bikePhysics.controls.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') bikePhysics.controls.right = true;
      if (e.key === 'Shift') bikePhysics.controls.nitro = true;
    }

    function onKeyUp(e) {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') bikePhysics.controls.gas = false;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') bikePhysics.controls.brake = false;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') bikePhysics.controls.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') bikePhysics.controls.right = false;
      if (e.key === 'Shift') bikePhysics.controls.nitro = false;
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Mobile Touch Driving Controls
    function setupTouchBtn(btnId, controlKey) {
      var el = document.getElementById(btnId);
      if (!el) return;
      el.addEventListener('touchstart', function (e) {
        e.preventDefault();
        bikePhysics.controls[controlKey] = true;
      }, { passive: false });
      el.addEventListener('touchend', function (e) {
        e.preventDefault();
        bikePhysics.controls[controlKey] = false;
      }, { passive: false });
      el.addEventListener('mousedown', function () { bikePhysics.controls[controlKey] = true; });
      el.addEventListener('mouseup', function () { bikePhysics.controls[controlKey] = false; });
      el.addEventListener('mouseleave', function () { bikePhysics.controls[controlKey] = false; });
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
    engineAudio.stop();
    window.removeEventListener('resize', onWindowResize);
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
    BIKE_THEMES: BIKE_THEMES,
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
