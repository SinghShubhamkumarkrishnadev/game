/* Jodi Race - Procedural 3D Track & Road Geometry Engine */
(function (global) {
  'use strict';

  var trackCurve = null;
  var trackMesh = null;
  var trackLength = 1600;
  var minimapPoints = [];
  var minimapBounds = { minX: -400, maxX: 400, minZ: -400, maxZ: 400 };

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

  function buildTrackMesh(scene) {
    if (!trackCurve || !scene) return;
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
    buildGuardRails(scene, segments, roadWidth);

    // Start & Finish Banner
    buildFinishBanner(scene);
  }

  function buildGuardRails(scene, segments, roadWidth) {
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

  function buildFinishBanner(scene) {
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

  global.JodiRaceTrack = {
    generate: generateProceduralTrack,
    buildMesh: buildTrackMesh,
    getCurve: function () { return trackCurve; },
    getLength: function () { return trackLength; },
    getMinimapPoints: function () { return minimapPoints; },
    getMinimapBounds: function () { return minimapBounds; }
  };
})(window);
