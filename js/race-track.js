/* Jodi Race - Procedural 3D Track & Road Geometry Engine
 * Drop-in global script for Three.js r128. No external assets.
 */
(function (global) {
  'use strict';

  var trackCurve = null;
  var trackLength = 1600;
  var minimapPoints = [];
  var minimapBounds = { minX: -400, maxX: 400, minZ: -400, maxZ: 400 };
  var trackRoot = null;
  var generatedSeed = 1;
  var samples = null;

  var SEGMENTS = 400;
  var ROAD_WIDTH = 14;
  var HALF_ROAD = ROAD_WIDTH * 0.5;
  var WORLD_FLOOR = -32;

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashSeed(seed) {
    var n = Number(seed);
    if (!isFinite(n)) n = 1;
    n = Math.floor(Math.abs(n) * 1000003) >>> 0;
    return n || 1;
  }

  function generateProceduralTrack(seed) {
    generatedSeed = hashSeed(seed);
    var random = mulberry32(generatedSeed);
    var count = 20;
    var targetLength = 1640 + random() * 250;
    var baseRadius = 255;
    var phaseA = random() * Math.PI * 2;
    var phaseB = random() * Math.PI * 2;
    var points = [];

    for (var i = 0; i < count; i++) {
      var angle = (i / count) * Math.PI * 2;
      var alternating = (i % 2 === 0 ? 1 : -1) * (16 + random() * 20);
      var radial = baseRadius +
        Math.sin(angle * 2 + phaseA) * 58 +
        Math.sin(angle * 5 + phaseB) * 26 + alternating;
      var squash = 0.91 + 0.11 * Math.sin(angle + phaseB);
      var x = Math.cos(angle) * radial;
      var z = Math.sin(angle) * radial * squash;
      var y = Math.sin(angle * 2 + phaseA) * 12 +
        Math.sin(angle * 4 - phaseB) * 8 +
        Math.cos(angle * 3 + phaseA) * 5;
      points.push(new THREE.Vector3(x, y, z));
    }

    trackCurve = new THREE.CatmullRomCurve3(points, true, 'centripetal');
    var firstLength = trackCurve.getLength();
    var scale = targetLength / firstLength;
    for (var p = 0; p < points.length; p++) {
      points[p].x *= scale;
      points[p].z *= scale;
    }
    trackCurve = new THREE.CatmullRomCurve3(points, true, 'centripetal');
    trackLength = Math.round(trackCurve.getLength());

    minimapPoints = [];
    var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (var m = 0; m < 80; m++) {
      var mp = trackCurve.getPointAt(m / 80);
      minimapPoints.push({ x: mp.x, z: mp.z });
      minX = Math.min(minX, mp.x); maxX = Math.max(maxX, mp.x);
      minZ = Math.min(minZ, mp.z); maxZ = Math.max(maxZ, mp.z);
    }
    var pad = 45;
    minimapBounds = { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad };
    samples = null;
    return trackCurve;
  }

  function disposeObject(object) {
    object.traverse(function (child) {
      if (child.geometry && child.geometry.dispose) child.geometry.dispose();
      if (child.material) {
        var materials = Array.isArray(child.material) ? child.material : [child.material];
        for (var i = 0; i < materials.length; i++) {
          var mat = materials[i];
          if (mat.map && mat.map.dispose) mat.map.dispose();
          if (mat.bumpMap && mat.bumpMap !== mat.map && mat.bumpMap.dispose) mat.bumpMap.dispose();
          if (mat.dispose) mat.dispose();
        }
      }
    });
  }

  function makeMaterial(options) {
    return new THREE.MeshStandardMaterial(options);
  }

  function makeAsphaltTexture() {
    var canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 1024;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#25262a'; ctx.fillRect(0, 0, 512, 1024);
    var random = mulberry32(generatedSeed ^ 0xA55A12);
    for (var i = 0; i < 8500; i++) {
      var shade = Math.floor(26 + random() * 38);
      ctx.fillStyle = 'rgba(' + shade + ',' + shade + ',' + (shade + 2) + ',' + (0.08 + random() * 0.2) + ')';
      var size = 0.5 + random() * 2.2;
      ctx.fillRect(random() * 512, random() * 1024, size, size);
    }
    ctx.fillStyle = 'rgba(232,235,230,0.9)';
    ctx.fillRect(18, 0, 5, 1024); ctx.fillRect(489, 0, 5, 1024);
    ctx.strokeStyle = 'rgba(10,10,12,0.36)'; ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(185, 0); ctx.bezierCurveTo(175, 220, 202, 610, 181, 1024);
    ctx.moveTo(327, 0); ctx.bezierCurveTo(339, 260, 309, 690, 331, 1024); ctx.stroke();
    for (var s = 0; s < 16; s++) {
      ctx.strokeStyle = 'rgba(8,8,9,' + (0.05 + random() * 0.08) + ')';
      ctx.lineWidth = 1 + random() * 3;
      ctx.beginPath();
      var sx = 70 + random() * 372;
      ctx.moveTo(sx, 0); ctx.lineTo(sx + (random() - 0.5) * 45, 1024); ctx.stroke();
    }
    var tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, Math.max(18, trackLength / 22));
    tex.anisotropy = 4;
    return tex;
  }

  function makeGrassTexture() {
    var canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#49683b'; ctx.fillRect(0, 0, 256, 256);
    var random = mulberry32(generatedSeed ^ 0x41F04D);
    for (var i = 0; i < 2600; i++) {
      var light = random() > 0.55;
      ctx.fillStyle = light ? 'rgba(119,142,73,0.32)' : 'rgba(30,65,38,0.28)';
      ctx.fillRect(random() * 256, random() * 256, 1 + random() * 3, 1 + random() * 2);
    }
    var tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(32, 32);
    tex.anisotropy = 2;
    return tex;
  }

  function sampleTrack() {
    var centers = [], tangents = [], rights = [], normals = [], banks = [], curvatures = [];
    var clampFn = (THREE.MathUtils && THREE.MathUtils.clamp) || THREE.Math.clamp || function (val, min, max) { return Math.max(min, Math.min(max, val)); };

    for (var i = 0; i <= SEGMENTS; i++) {
      var u = i / SEGMENTS;
      var center = trackCurve.getPointAt(u);
      var tangent = trackCurve.getTangentAt(u).normalize();
      var before = trackCurve.getTangentAt((u - 0.008 + 1) % 1).normalize();
      var after = trackCurve.getTangentAt((u + 0.008) % 1).normalize();
      var signedTurn = before.x * after.z - before.z * after.x;
      var horizontalRight = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      var bank = clampFn(signedTurn * 3.25, -0.22, 0.22);
      var right = horizontalRight.clone().multiplyScalar(Math.cos(bank));
      right.y = Math.sin(bank);
      var normal = tangent.clone().cross(right).normalize();
      if (normal.y < 0) normal.negate();
      centers.push(center); tangents.push(tangent); rights.push(right); normals.push(normal);
      banks.push(bank); curvatures.push(Math.abs(signedTurn));
    }
    return { centers: centers, tangents: tangents, rights: rights, normals: normals, banks: banks, curvatures: curvatures };
  }

  function buildRibbon(width, yOffset, material, name) {
    var positions = [], uvs = [], indices = [];
    for (var i = 0; i <= SEGMENTS; i++) {
      var c = samples.centers[i]; var r = samples.rights[i]; var n = samples.normals[i];
      var left = c.clone().addScaledVector(r, -width * 0.5).addScaledVector(n, yOffset);
      var right = c.clone().addScaledVector(r, width * 0.5).addScaledVector(n, yOffset);
      positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
      uvs.push(0, (i / SEGMENTS) * Math.max(18, trackLength / 22), 1, (i / SEGMENTS) * Math.max(18, trackLength / 22));
      if (i < SEGMENTS) {
        var a = i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    var mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.receiveShadow = true;
    trackRoot.add(mesh); return mesh;
  }

  function makeTrackMatrix(u, lateral, vertical, sx, sy, sz) {
    var index = Math.round((((u % 1) + 1) % 1) * SEGMENTS) % SEGMENTS;
    var c = samples.centers[index]; var r = samples.rights[index];
    var t = samples.tangents[index]; var n = samples.normals[index];
    var position = c.clone().addScaledVector(r, lateral).addScaledVector(n, vertical);
    var basis = new THREE.Matrix4().makeBasis(r, n, t.clone().negate());
    var quaternion = new THREE.Quaternion().setFromRotationMatrix(basis);
    return new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3(sx, sy, sz));
  }

  function createInstanced(geometry, material, matrices, name, shadows) {
    if (!matrices.length) return null;
    var mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    for (var i = 0; i < matrices.length; i++) mesh.setMatrixAt(i, matrices[i]);
    mesh.instanceMatrix.needsUpdate = true; mesh.name = name;
    mesh.castShadow = !!shadows; mesh.receiveShadow = !!shadows;
    trackRoot.add(mesh); return mesh;
  }

  function buildKerbsAndSkids(materials) {
    var red = [], white = [], skid = [];
    for (var i = 0; i < SEGMENTS; i += 2) {
      var curvature = samples.curvatures[i];
      if (curvature > 0.028) {
        var before = samples.tangents[(i - 3 + SEGMENTS) % SEGMENTS];
        var after = samples.tangents[(i + 3) % SEGMENTS];
        var turn = before.x * after.z - before.z * after.x;
        var outside = turn > 0 ? -1 : 1;
        var list = (Math.floor(i / 2) % 2 === 0) ? red : white;
        list.push(makeTrackMatrix(i / SEGMENTS, outside * (HALF_ROAD + 0.55), 0.22, 1.35, 0.24, 3.1));
      }
      if (curvature > 0.034 && i % 6 === 0) {
        skid.push(makeTrackMatrix(i / SEGMENTS, -1.45, 0.125, 0.18, 0.012, 5.2));
        skid.push(makeTrackMatrix((i + 1) / SEGMENTS, 1.45, 0.126, 0.18, 0.012, 5.2));
      }
    }
    var kerbGeo = new THREE.BoxGeometry(1, 1, 1);
    createInstanced(kerbGeo, materials.red, red, 'apex-kerbs-red', true);
    createInstanced(kerbGeo.clone(), materials.white, white, 'apex-kerbs-white', true);
    createInstanced(new THREE.BoxGeometry(1, 1, 1), materials.rubber, skid, 'braking-skid-marks', false);
  }

  function buildGuardRails(materials) {
    var leftLow = [], leftHigh = [], rightLow = [], rightHigh = [], posts = [];
    for (var i = 0; i <= SEGMENTS; i += 2) {
      var c = samples.centers[i], r = samples.rights[i], n = samples.normals[i];
      leftLow.push(c.clone().addScaledVector(r, -9.1).addScaledVector(n, 0.85));
      leftHigh.push(c.clone().addScaledVector(r, -9.1).addScaledVector(n, 1.55));
      rightLow.push(c.clone().addScaledVector(r, 9.1).addScaledVector(n, 0.85));
      rightHigh.push(c.clone().addScaledVector(r, 9.1).addScaledVector(n, 1.55));
      if (i < SEGMENTS && i % 6 === 0) {
        posts.push(makeTrackMatrix(i / SEGMENTS, -9.1, 0.75, 0.16, 1.5, 0.16));
        posts.push(makeTrackMatrix(i / SEGMENTS, 9.1, 0.75, 0.16, 1.5, 0.16));
      }
    }
    var curves = [leftLow, leftHigh, rightLow, rightHigh];
    for (var c = 0; c < curves.length; c++) {
      var rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curves[c], true, 'centripetal'), 200, 0.18, 5, true), materials.metal);
      rail.name = 'double-guardrail'; trackRoot.add(rail);
    }
    createInstanced(new THREE.BoxGeometry(1, 1, 1), materials.darkMetal, posts, 'guardrail-posts', false);
  }

  function buildTireBarriers(materials) {
    var red = [], white = [];
    var hotSpots = [];
    for (var i = 0; i < SEGMENTS; i += 8) if (samples.curvatures[i] > 0.045) hotSpots.push(i);
    for (var h = 0; h < hotSpots.length; h += 2) {
      var idx = hotSpots[h];
      var before = samples.tangents[(idx - 4 + SEGMENTS) % SEGMENTS];
      var after = samples.tangents[(idx + 4) % SEGMENTS];
      var side = (before.x * after.z - before.z * after.x) > 0 ? -1 : 1;
      for (var row = 0; row < 7; row++) {
        for (var level = 0; level < 2; level++) {
          var list = ((row + level) % 2) ? red : white;
          list.push(makeTrackMatrix((idx + row * 1.1) / SEGMENTS, side * (11.0 + level * 0.08), 0.55 + level * 0.95, 0.82, 0.82, 0.82));
        }
      }
    }
    var tireGeo = new THREE.TorusGeometry(0.58, 0.22, 6, 10);
    createInstanced(tireGeo, materials.tireRed, red, 'red-tire-barriers', true);
    createInstanced(tireGeo.clone(), materials.tireWhite, white, 'white-tire-barriers', true);
  }

  function buildFloodlights(materials) {
    var poles = [], arms = [], lamps = [];
    var bulbPositions = [];
    for (var i = 18; i < SEGMENTS; i += 34) {
      var side = ((i / 34) | 0) % 2 ? -1 : 1;
      poles.push(makeTrackMatrix(i / SEGMENTS, side * 15, 6.0, 0.28, 12, 0.28));
      arms.push(makeTrackMatrix(i / SEGMENTS, side * 12.9, 11.7, 4.5, 0.18, 0.22));
      lamps.push(makeTrackMatrix(i / SEGMENTS, side * 10.8, 11.45, 2.7, 0.7, 0.26));
      if (bulbPositions.length < 4) {
        var idx = i % SEGMENTS;
        bulbPositions.push(samples.centers[idx].clone().addScaledVector(samples.rights[idx], side * 10.8).addScaledVector(samples.normals[idx], 11.2));
      }
    }
    createInstanced(new THREE.CylinderGeometry(0.5, 0.72, 1, 8), materials.darkMetal, poles, 'floodlight-poles', false);
    createInstanced(new THREE.BoxGeometry(1, 1, 1), materials.darkMetal, arms, 'floodlight-arms', false);
    createInstanced(new THREE.BoxGeometry(1, 1, 1), materials.lamp, lamps, 'warm-floodlights', false);
    for (var p = 0; p < bulbPositions.length; p++) {
      var light = new THREE.PointLight(0xffd29a, 1.15, 55, 2);
      light.position.copy(bulbPositions[p]); light.name = 'floodlight-pool'; trackRoot.add(light);
    }
  }

  function buildTreesAndMountains(materials) {
    var random = mulberry32(generatedSeed ^ 0x6B39C1);
    var trunks = [], crownsA = [], crownsB = [];
    for (var i = 0; i < 190; i++) {
      var u = random(); var idx = Math.floor(u * SEGMENTS);
      var side = random() > 0.5 ? 1 : -1;
      var distance = 24 + random() * 55;
      var scale = 0.75 + random() * 1.25;
      var base = samples.centers[idx].clone().addScaledVector(samples.rights[idx], side * distance);
      base.y -= 1.4 + Math.min(8, (distance - 24) * 0.09);
      var trunkPos = base.clone(); trunkPos.y += 2.2 * scale;
      var crown1 = base.clone(); crown1.y += 5.1 * scale;
      var crown2 = base.clone(); crown2.y += 7.0 * scale;
      var q = new THREE.Quaternion();
      trunks.push(new THREE.Matrix4().compose(trunkPos, q, new THREE.Vector3(scale, 4.4 * scale, scale)));
      crownsA.push(new THREE.Matrix4().compose(crown1, q, new THREE.Vector3(2.6 * scale, 4.5 * scale, 2.6 * scale)));
      crownsB.push(new THREE.Matrix4().compose(crown2, q, new THREE.Vector3(1.85 * scale, 3.4 * scale, 1.85 * scale)));
    }
    createInstanced(new THREE.CylinderGeometry(0.28, 0.46, 1, 6), materials.trunk, trunks, 'pine-trunks', false);
    createInstanced(new THREE.ConeGeometry(1, 1, 7), materials.foliageA, crownsA, 'pine-crowns-lower', false);
    createInstanced(new THREE.ConeGeometry(1, 1, 7), materials.foliageB, crownsB, 'pine-crowns-upper', false);

    var mountains = [];
    for (var m = 0; m < 42; m++) {
      var angle = (m / 42) * Math.PI * 2;
      var radius = 610 + random() * 80;
      var height = 65 + random() * 105;
      var pos = new THREE.Vector3(Math.cos(angle) * radius, WORLD_FLOOR + height * 0.48, Math.sin(angle) * radius);
      mountains.push(new THREE.Matrix4().compose(pos, new THREE.Quaternion(), new THREE.Vector3(42 + random() * 48, height, 42 + random() * 48)));
    }
    createInstanced(new THREE.ConeGeometry(1, 1, 7), materials.mountain, mountains, 'mountain-horizon', false);
  }

  function createSignTexture(text, background, foreground, width, height) {
    var canvas = document.createElement('canvas'); canvas.width = width || 1024; canvas.height = height || 256;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = foreground; ctx.lineWidth = 14; ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
    ctx.fillStyle = foreground; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 ' + Math.floor(canvas.height * 0.43) + 'px Arial, sans-serif';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
    return new THREE.CanvasTexture(canvas);
  }

  function buildStartGrid(materials) {
    var checks = [];
    for (var x = 0; x < 14; x++) for (var z = 0; z < 4; z++) {
      if ((x + z) % 2 === 0) checks.push(makeTrackMatrix((z - 1.5) * 0.0022, -6.5 + x, 0.135, 0.95, 0.015, 0.95));
    }
    createInstanced(new THREE.BoxGeometry(1, 1, 1), materials.gridWhite, checks, 'checkered-start-line', false);

    function addGridBox(u, lateral, label) {
      var group = new THREE.Group();
      var outline = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.025, 5.5), materials.gridWhite);
      var inset = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.03, 5.15), materials.asphaltPlain);
      inset.position.y = 0.02; group.add(outline); group.add(inset);
      var tex = createSignTexture(label, '#ecebe5', '#17181b', 256, 256);
      var labelMat = makeMaterial({ map: tex, transparent: true, roughness: 0.75 });
      var badge = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.25), labelMat);
      badge.rotation.x = -Math.PI / 2; badge.position.set(0, 0.06, -1.55); group.add(badge);
      group.applyMatrix4(makeTrackMatrix(u, lateral, 0.14, 1, 1, 1)); trackRoot.add(group);
    }
    addGridBox(0.016, -2.2, 'POLE 1'); addGridBox(0.026, 2.2, 'GRID 2');
  }

  function buildDistanceBoards(materials) {
    var candidates = [];
    for (var i = 0; i < SEGMENTS; i += 10) if (samples.curvatures[i] > 0.04) candidates.push(i);
    for (var c = 0; c < candidates.length; c += 3) {
      var apex = candidates[c];
      var boardData = [{ offset: 22, text: '100' }, { offset: 11, text: '50' }];
      for (var b = 0; b < boardData.length; b++) {
        var idx = (apex - boardData[b].offset + SEGMENTS) % SEGMENTS;
        var group = new THREE.Group();
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 2.5, 6), materials.darkMetal);
        pole.position.y = -1.4; group.add(pole);
        var tex = createSignTexture(boardData[b].text, '#f2f0e8', '#15171a', 256, 256);
        var sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.7 }));
        group.add(sign);
        var matrix = makeTrackMatrix(idx / SEGMENTS, 11.2, 3.2, 1, 1, 1);
        group.applyMatrix4(matrix); trackRoot.add(group);
      }
    }
  }

  function buildGantry(materials) {
    var group = new THREE.Group();
    var postGeo = new THREE.BoxGeometry(0.65, 8.5, 0.65);
    var left = new THREE.Mesh(postGeo, materials.gantry); left.position.set(-8.2, 4.15, 0);
    var right = new THREE.Mesh(postGeo.clone(), materials.gantry); right.position.set(8.2, 4.15, 0);
    var cross = new THREE.Mesh(new THREE.BoxGeometry(17.1, 2.35, 0.8), materials.darkMetal); cross.position.y = 8.1;
    group.add(left); group.add(right); group.add(cross);
    var signTexture = createSignTexture('JODI GRAND PRIX', '#111317', '#f4d35e', 1024, 220);
    var signMaterial = new THREE.MeshStandardMaterial({ map: signTexture, emissive: 0x332300, emissiveIntensity: 0.45, side: THREE.DoubleSide, roughness: 0.45 });
    var sign = new THREE.Mesh(new THREE.PlaneGeometry(14.8, 1.65), signMaterial); sign.position.set(0, 8.15, -0.42); group.add(sign);
    var lightGeo = new THREE.SphereGeometry(0.32, 10, 8);
    for (var i = 0; i < 5; i++) {
      var isGreen = i === 4;
      var lightMat = new THREE.MeshStandardMaterial({ color: isGreen ? 0x20d96b : 0xe62d36, emissive: isGreen ? 0x16b95a : 0x7a090d, emissiveIntensity: isGreen ? 1.2 : 0.7, roughness: 0.2 });
      var bulb = new THREE.Mesh(lightGeo, lightMat); bulb.position.set(-2.1 + i * 1.05, 7.25, -0.7); group.add(bulb);
    }
    group.applyMatrix4(makeTrackMatrix(0.003, 0, 0.1, 1, 1, 1)); group.name = 'jodi-grand-prix-gantry'; trackRoot.add(group);
  }

  function buildGround(materials) {
    buildRibbon(74, -0.38, materials.grass, 'trackside-terrain');
    var floor = new THREE.Mesh(new THREE.CircleGeometry(760, 64), materials.ground);
    floor.rotation.x = -Math.PI / 2; floor.position.y = WORLD_FLOOR; floor.receiveShadow = true; floor.name = 'valley-floor'; trackRoot.add(floor);
  }

  function buildMesh(scene) {
    if (!trackCurve || !scene) return;
    if (trackRoot && trackRoot.parent) {
      trackRoot.parent.remove(trackRoot); disposeObject(trackRoot);
    }
    trackRoot = new THREE.Group(); trackRoot.name = 'JodiRaceTrackEnvironment'; scene.add(trackRoot);
    samples = sampleTrack();

    var asphaltTexture = makeAsphaltTexture();
    var grassTexture = makeGrassTexture();
    var materials = {
      asphalt: makeMaterial({ map: asphaltTexture, bumpMap: asphaltTexture, bumpScale: 0.045, roughness: 0.91, metalness: 0.03 }),
      asphaltPlain: makeMaterial({ color: 0x242529, roughness: 0.94 }),
      grass: makeMaterial({ map: grassTexture, color: 0x78905b, roughness: 1 }),
      ground: makeMaterial({ map: grassTexture.clone(), color: 0x536d43, roughness: 1 }),
      red: makeMaterial({ color: 0xc92532, roughness: 0.72 }),
      white: makeMaterial({ color: 0xe8e7df, roughness: 0.76 }),
      gridWhite: makeMaterial({ color: 0xecebe5, roughness: 0.84 }),
      rubber: makeMaterial({ color: 0x0d0e10, roughness: 1, transparent: true, opacity: 0.72 }),
      metal: makeMaterial({ color: 0xaeb3b4, metalness: 0.86, roughness: 0.3 }),
      darkMetal: makeMaterial({ color: 0x343a3f, metalness: 0.78, roughness: 0.36 }),
      tireRed: makeMaterial({ color: 0xa61f29, roughness: 0.92 }),
      tireWhite: makeMaterial({ color: 0xd9d7cd, roughness: 0.94 }),
      lamp: makeMaterial({ color: 0xffe4ae, emissive: 0xffb34f, emissiveIntensity: 1.7, roughness: 0.22 }),
      trunk: makeMaterial({ color: 0x553c29, roughness: 1 }),
      foliageA: makeMaterial({ color: 0x274f35, roughness: 1, flatShading: true }),
      foliageB: makeMaterial({ color: 0x3c6a43, roughness: 1, flatShading: true }),
      mountain: makeMaterial({ color: 0x58645e, roughness: 1, flatShading: true }),
      gantry: makeMaterial({ color: 0xc92532, metalness: 0.72, roughness: 0.3 })
    };
    materials.ground.map.wrapS = materials.ground.map.wrapT = THREE.RepeatWrapping;
    materials.ground.map.repeat.set(10, 10);

    buildGround(materials);
    buildRibbon(ROAD_WIDTH, 0.08, materials.asphalt, 'high-grip-asphalt');
    buildKerbsAndSkids(materials);
    buildGuardRails(materials);
    buildTireBarriers(materials);
    buildFloodlights(materials);
    buildTreesAndMountains(materials);
    buildStartGrid(materials);
    buildDistanceBoards(materials);
    buildGantry(materials);
  }

  global.JodiRaceTrack = {
    generate: generateProceduralTrack,
    buildMesh: buildMesh,
    getCurve: function () { return trackCurve; },
    getLength: function () { return trackLength; },
    getMinimapPoints: function () { return minimapPoints; },
    getMinimapBounds: function () { return minimapBounds; }
  };
})(window);
