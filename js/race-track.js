/* Jodi Race - Procedural 3D Circuit & Environment Engine  (Three.js r128)
 * ---------------------------------------------------------------------------
 * 100% procedural: no external models / textures. Deterministic per seed, so
 * every multiplayer client builds the identical circuit and scenery.
 *
 * Required API (unchanged):
 *   JodiRaceTrack.generate(seed)   -> closed THREE.CatmullRomCurve3
 *   JodiRaceTrack.buildMesh(scene)
 *   JodiRaceTrack.getCurve() / getLength() / getMinimapPoints() / getMinimapBounds()
 *
 * Optional extras (safe to ignore):
 *   getFrameAt(u)            -> {forward, right, up, bank}  (banked road frame)
 *   getRoadPoint(u, lateral) -> THREE.Vector3 on the road surface (bank + lift aware)
 *   getGridSlots(count)      -> starting grid slots matching the painted boxes
 *   setStartLights(n|'green'|'off')  -> drive the gantry lights (0-5 red, then green)
 *   dispose()                -> remove & free everything buildMesh() created
 */
(function (global) {
  'use strict';

  var THREE = global.THREE;
  var TAU = Math.PI * 2;

  /* ============================== CONFIG ============================== */
  var CFG = {
    segments: 400,          // road samples (also used for barriers / kerbs)
    roadWidth: 14,
    roadLift: 0.1,          // road surface height above the spline (legacy value)
    kerbWidth: 1.5,
    kerbHeight: 0.16,
    railOffset: 3.7,        // guard-rail line, measured from the road edge
    tireOffset: 2.4,        // tyre wall line, measured from the road edge
    shoulderWidth: 6,
    maxBank: 0.11,          // radians (~6.3 deg) - kept gentle so bikes stay planted
    bankGain: 8,
    minRadius: 38,          // tightest allowed corner radius
    sectors: 10,            // props are merged per sector => frustum culling works
    terrainGrid: 128,
    terrainTiles: 4,
    sunElevation: 0.38,
    sunAzimuth: 2.6,
    haze: 0xd79b82,
    targetLengthMin: 1620,
    targetLengthMax: 1880
  };
  var HW = CFG.roadWidth / 2;
  var SHOULDER_DROP = -0.3;   // shoulder outer edge height (relative to spline plane)
  var GROUND_DROP = 0.35;     // terrain sits this far under the spline plane near the road
  var LAT_FLAT = HW + CFG.shoulderWidth;
  var SHARP = 0.0125;         // curvature threshold for "sharp" corners (R <= 80)

  /* ============================== STATE =============================== */
  var trackCurve = null;
  var trackMesh = null;
  var trackLength = 1600;
  var minimapPoints = [];
  var minimapBounds = { minX: -400, maxX: 400, minZ: -400, maxZ: 400 };
  var layoutSeed = 0;
  var S = null;               // sampled frames of the accepted layout
  var corners = [];
  var TER = null;             // spatial index + terrain params
  var built = null;

  /* ============================== UTILS =============================== */
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function mix3(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
  function scale3(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function norm3(v) { var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashSeed(seed) {
    var s = String(seed), h = 2166136261, i;
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function hash2(ix, iy, seed) {
    var h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y, seed) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    var a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed);
    var c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
    return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
  }
  function fbm(x, y, seed) {
    return vnoise(x, y, seed) * 0.55 + vnoise(x * 2.1, y * 2.1, seed + 1) * 0.3 + vnoise(x * 4.3, y * 4.3, seed + 2) * 0.15;
  }
  function smoothCircular(arr, r, passes) {
    var N = arr.length, cur = new Float64Array(arr), p, i, k, sum, nxt;
    for (p = 0; p < passes; p++) {
      nxt = new Float64Array(N);
      for (i = 0; i < N; i++) {
        sum = 0;
        for (k = -r; k <= r; k++) sum += cur[(i + k + N) % N];
        nxt[i] = sum / (2 * r + 1);
      }
      cur = nxt;
    }
    return cur;
  }

  /* ========================= 1. LAYOUT GENERATION ===================== */
  function makeControlPoints(rng, calm) {
    var n = 28, R = 300, i, k, j;
    var amp = calm ? 0.35 : 1;
    var el = calm ? 1.2 : 1.10 + rng() * 0.32;
    var a2 = (0.10 + rng() * 0.12) * amp, a3 = (0.05 + rng() * 0.10) * amp;
    var a5 = (0.04 + rng() * 0.07) * amp, a7 = (0.02 + rng() * 0.05) * amp;
    var p2 = rng() * TAU, p3 = rng() * TAU, p5 = rng() * TAU, p7 = rng() * TAU;
    var h1 = (6 + rng() * 5) * amp, h2 = (4 + rng() * 4) * amp, h3 = (2 + rng() * 3) * amp;
    var q1 = rng() * TAU, q2 = rng() * TAU, q3 = rng() * TAU;
    var pts = [];
    for (i = 0; i < n; i++) {
      var a = i / n * TAU;
      var r = R * (1 + a2 * Math.sin(2 * a + p2) + a3 * Math.sin(3 * a + p3) + a5 * Math.sin(5 * a + p5) + a7 * Math.sin(7 * a + p7));
      var d = Math.min(a, TAU - a);
      var w = smoothstep(0.42, 1.5, d);                       // flat start straight
      var y = w * (h1 * Math.sin(2 * a + q1) + h2 * Math.sin(3 * a + q2) + h3 * Math.sin(5 * a + q3));
      pts.push([Math.cos(a) * r, y, Math.sin(a) * r * el]);
    }
    if (!calm) {                                              // chicane: two opposing kinks
      var base = pts.map(function (p) { return p.slice(); });
      var ci = 4 + Math.floor(rng() * (n - 12));
      var A = 11 + rng() * 7, dir = rng() < 0.5 ? -1 : 1;
      for (k = 0; k < 2; k++) {
        j = ci + k;
        var tx = base[j + 1][0] - base[j - 1][0], tz = base[j + 1][2] - base[j - 1][2];
        var tl = Math.sqrt(tx * tx + tz * tz) || 1;
        var off = A * (k === 0 ? 1 : -1) * dir;
        pts[j][0] += (-tz / tl) * off;
        pts[j][2] += (tx / tl) * off;
      }
    }
    // dead-straight start / finish: 5 collinear, evenly spaced control points
    var tdx = pts[1][0] - pts[n - 1][0], tdz = pts[1][2] - pts[n - 1][2];
    var tdl = Math.sqrt(tdx * tdx + tdz * tdz) || 1; tdx /= tdl; tdz /= tdl;
    function dist2(p, q) { return Math.sqrt((p[0] - q[0]) * (p[0] - q[0]) + (p[2] - q[2]) * (p[2] - q[2])); }
    var sp = (dist2(pts[0], pts[1]) + dist2(pts[0], pts[n - 1])) * 0.5;
    var s0x = pts[0][0], s0z = pts[0][2];
    for (k = -2; k <= 2; k++) pts[(k + n) % n] = [s0x + tdx * k * sp, 0, s0z + tdz * k * sp];
    return pts;
  }

  function mkCurve(pts) {
    var v = pts.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); });
    var c = new THREE.CatmullRomCurve3(v, true, 'centripetal');
    c.arcLengthDivisions = 1000;
    if (c.updateArcLengths) c.updateArcLengths();
    return c;
  }
  function buildCurve(pts, target) {
    var c = mkCurve(pts), pass;
    for (pass = 0; pass < 2; pass++) {
      var f = target / c.getLength();
      pts = pts.map(function (p) { return [p[0] * f, p[1], p[2] * f]; });
      c = mkCurve(pts);
    }
    return c;
  }

  function sampleTrack(curve) {
    var N = CFG.segments, L = curve.getLength(), ds = L / N, i, a, b;
    var tmp = new THREE.Vector3();
    var s = {
      N: N, L: L, ds: ds,
      PX: new Float64Array(N), PY: new Float64Array(N), PZ: new Float64Array(N),
      FWD: new Float64Array(N * 3), LAT: new Float64Array(N * 3), NRM: new Float64Array(N * 3),
      RX: new Float64Array(N), RZ: new Float64Array(N), TB: new Float64Array(N),
      BANK: new Float64Array(N), KAP: new Float64Array(N), KC: null
    };
    var thx = new Float64Array(N), thz = new Float64Array(N);
    for (i = 0; i < N; i++) {
      curve.getPointAt(i / N, tmp);
      s.PX[i] = tmp.x; s.PY[i] = tmp.y; s.PZ[i] = tmp.z;
    }
    for (i = 0; i < N; i++) {
      a = (i + N - 1) % N; b = (i + 1) % N;
      var fx = s.PX[b] - s.PX[a], fy = s.PY[b] - s.PY[a], fz = s.PZ[b] - s.PZ[a];
      var hl = Math.sqrt(fx * fx + fz * fz) || 1e-9, fl = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1e-9;
      thx[i] = fx / hl; thz[i] = fz / hl;
      s.FWD[i * 3] = fx / fl; s.FWD[i * 3 + 1] = fy / fl; s.FWD[i * 3 + 2] = fz / fl;
      s.RX[i] = -fz / hl; s.RZ[i] = fx / hl;               // horizontal "right" = forward x up
    }
    for (i = 0; i < N; i++) {                              // signed curvature, + = turning right
      a = (i + N - 1) % N; b = (i + 1) % N;
      s.KAP[i] = ((thx[b] - thx[a]) * (-thz[i]) + (thz[b] - thz[a]) * thx[i]) / (2 * ds);
    }
    s.KC = smoothCircular(s.KAP, 2, 1);
    var kb = smoothCircular(s.KAP, 11, 2);
    for (i = 0; i < N; i++) {
      var bank = clamp(kb[i] * CFG.bankGain, -CFG.maxBank, CFG.maxBank);
      s.BANK[i] = bank; s.TB[i] = Math.tan(bank);
      var cb = Math.cos(bank), sb = Math.sin(bank);
      var Fx = s.FWD[i * 3], Fy = s.FWD[i * 3 + 1], Fz = s.FWD[i * 3 + 2];
      var rx = s.RX[i], rz = s.RZ[i];
      var ux = -rz * Fy, uy = rz * Fx - rx * Fz, uz = rx * Fy;   // slope-aware up = R x F
      s.LAT[i * 3] = rx * cb - ux * sb; s.LAT[i * 3 + 1] = -uy * sb; s.LAT[i * 3 + 2] = rz * cb - uz * sb;
      s.NRM[i * 3] = ux * cb + rx * sb; s.NRM[i * 3 + 1] = uy * cb; s.NRM[i * 3 + 2] = uz * cb + rz * sb;
    }
    return s;
  }

  function findCorners(s) {
    var N = s.N, KC = s.KC, th = 0.0085, start = 0, i = 0, out = [];
    for (i = 0; i < N; i++) if (Math.abs(KC[i]) < th * 0.5) { start = i; break; }
    i = 0;
    while (i < N) {
      var k = (start + i) % N, kv = KC[k];
      if (Math.abs(kv) > th) {
        var sgn = kv > 0 ? 1 : -1, j = i, peak = 0, pk = k;
        while (j < N) {
          var kk = (start + j) % N, v = KC[kk];
          if (Math.abs(v) <= th || (v > 0) !== (sgn > 0)) break;
          if (Math.abs(v) > peak) { peak = Math.abs(v); pk = kk; }
          j++;
        }
        out.push({ i0: k, len: j - i, i1: (start + j - 1) % N, peak: peak, pk: pk, sign: sgn });
        i = j;
      } else i++;
    }
    return out;
  }

  function validate(s) {
    if (s.L < 1500 || s.L > 2000) return false;
    var N = s.N, i, j, kmax = 0, gmax = 0;
    for (i = 0; i < N; i++) {
      kmax = Math.max(kmax, Math.abs(s.KC[i]));
      gmax = Math.max(gmax, Math.abs(s.PY[(i + 1) % N] - s.PY[i]) / s.ds);
    }
    if (kmax > 1 / CFG.minRadius || gmax > 0.14) return false;
    var gap = Math.ceil(150 / s.ds), minSep2 = 62 * 62;
    for (i = 0; i < N; i += 2) {
      for (j = i + gap; j < N; j += 2) {
        if (Math.min(j - i, N - (j - i)) < gap) continue;
        var dx = s.PX[i] - s.PX[j], dz = s.PZ[i] - s.PZ[j];
        if (dx * dx + dz * dz < minSep2) return false;
      }
    }
    var cs = findCorners(s), sharp = 0;
    for (i = 0; i < cs.length; i++) if (cs[i].peak >= SHARP) sharp++;
    return sharp >= 2;
  }

  function generate(seed) {
    if (typeof seed !== 'number' || !isFinite(seed)) seed = Math.floor(Math.random() * 1e9);
    var base = hashSeed(seed), curve = null, samp = null, used = base, attempt, rng, pts;
    for (attempt = 0; attempt < 40; attempt++) {
      used = (base + Math.imul(attempt, 7919)) >>> 0;
      rng = mulberry32(used);
      pts = makeControlPoints(rng, false);
      var target = CFG.targetLengthMin + rng() * (CFG.targetLengthMax - CFG.targetLengthMin);
      var c = buildCurve(pts, target);
      var sm = sampleTrack(c);
      if (validate(sm)) { curve = c; samp = sm; break; }
    }
    if (!curve) {                                          // guaranteed-safe fallback layout
      used = base; rng = mulberry32(base);
      pts = makeControlPoints(rng, true);
      curve = buildCurve(pts, 1720);
      samp = sampleTrack(curve);
    }
    layoutSeed = used;
    trackCurve = curve;
    S = samp;
    corners = findCorners(S);
    trackLength = Math.round(curve.getLength());

    // 2D minimap samples (first point repeated at the end to close the loop, as before)
    minimapPoints = [];
    var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, m;
    for (m = 0; m <= 80; m++) {
      var mp = curve.getPointAt(m / 80);
      minimapPoints.push({ x: mp.x, z: mp.z });
      if (mp.x < minX) minX = mp.x;
      if (mp.x > maxX) maxX = mp.x;
      if (mp.z < minZ) minZ = mp.z;
      if (mp.z > maxZ) maxZ = mp.z;
    }
    var pad = 45;
    minimapBounds = { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad };
    return trackCurve;
  }

  /* ===================== 2. ROAD FRAME HELPERS ======================== */
  function wrapIdx(i) { var N = S.N; i %= N; return i < 0 ? i + N : i; }
  function secOf(i) { return Math.min(CFG.sectors - 1, Math.floor(wrapIdx(Math.floor(i)) * CFG.sectors / S.N)); }
  function secOfS(s) { return secOf(s / S.ds); }

  function roadPt(i, l, h) {
    i = wrapIdx(i);
    var k = i * 3;
    return [S.PX[i] + S.LAT[k] * l + S.NRM[k] * h,
            S.PY[i] + S.LAT[k + 1] * l + S.NRM[k + 1] * h,
            S.PZ[i] + S.LAT[k + 2] * l + S.NRM[k + 2] * h];
  }
  function roadPtF(f, l, h) {
    var N = S.N; f = ((f % N) + N) % N;
    var i0 = Math.floor(f), t = f - i0, a = roadPt(i0, l, h), b = roadPt(i0 + 1, l, h);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function roadPtS(s, l, h) { return roadPtF(s / S.ds, l, h); }

  function frameS(s) {          // interpolated frame at arc distance s
    var N = S.N, f = ((s / S.ds) % N + N) % N, i0 = Math.floor(f), t = f - i0, i1 = (i0 + 1) % N;
    function m3(A, o) { return [lerp(A[i0 * 3 + o], A[i1 * 3 + o], t)]; }
    function v3(A) { return norm3([m3(A, 0)[0], m3(A, 1)[0], m3(A, 2)[0]]); }
    return {
      p: [lerp(S.PX[i0], S.PX[i1], t), lerp(S.PY[i0], S.PY[i1], t), lerp(S.PZ[i0], S.PZ[i1], t)],
      f: v3(S.FWD), l: v3(S.LAT), n: v3(S.NRM),
      r: norm3([lerp(S.RX[i0], S.RX[i1], t), 0, lerp(S.RZ[i0], S.RZ[i1], t)]),
      bank: lerp(S.BANK[i0], S.BANK[i1], t)
    };
  }
  function padH(l) {            // height (along plane normal) of road / shoulder at lateral offset l
    var a = Math.abs(l);
    if (a <= HW) return CFG.roadLift;
    if (a >= LAT_FLAT) return SHOULDER_DROP;
    return lerp(CFG.roadLift, SHOULDER_DROP, (a - HW) / CFG.shoulderWidth);
  }
  function kerbZone(c) {
    var lo = 0, hi = 0, KC = S.KC;
    while (lo < 28 && Math.abs(KC[wrapIdx(c.pk - lo - 1)]) >= 0.6 * c.peak) lo++;
    while (hi < 28 && Math.abs(KC[wrapIdx(c.pk + hi + 1)]) >= 0.6 * c.peak) hi++;
    return { a: c.pk - lo - 2, b: c.pk + hi + 2 };
  }

  /* ===================== 3. TERRAIN HEIGHT FIELD ====================== */
  function prepareTerrainIndex() {
    var CELL = 100, minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity, i;
    for (i = 0; i < S.N; i++) {
      minX = Math.min(minX, S.PX[i]); maxX = Math.max(maxX, S.PX[i]);
      minZ = Math.min(minZ, S.PZ[i]); maxZ = Math.max(maxZ, S.PZ[i]);
    }
    TER = { cell: CELL, ox: minX - 300, oz: minZ - 300, cells: {}, ci: new Int32Array(4096), cd: new Float64Array(4096),
            cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, rMax: 0, sd: layoutSeed & 0xffff, lastD: 0 };
    for (i = 0; i < S.N; i++) {
      var cx = Math.floor((S.PX[i] - TER.ox) / CELL), cz = Math.floor((S.PZ[i] - TER.oz) / CELL);
      var key = (cx + 1024) * 4096 + (cz + 1024);
      (TER.cells[key] || (TER.cells[key] = [])).push(i);
      var dx = S.PX[i] - TER.cx, dz = S.PZ[i] - TER.cz;
      TER.rMax = Math.max(TER.rMax, Math.sqrt(dx * dx + dz * dz));
    }
  }
  function farH(x, z) {
    var T = TER, dx = x - T.cx, dz = z - T.cz, r = Math.sqrt(dx * dx + dz * dz);
    var base = (fbm(x * 0.0035, z * 0.0035, T.sd) - 0.5) * 34;
    var ring = smoothstep(T.rMax + 90, T.rMax + 300, r) * (1 - smoothstep(T.rMax + 430, T.rMax + 540, r));
    var ridge = 1 - Math.abs(2 * fbm(x * 0.0022 + 7.3, z * 0.0022 - 3.1, T.sd + 5) - 1);
    return base + ring * (30 + 95 * ridge * ridge);
  }
  function terrainH(x, z) {
    var T = TER, cx = Math.floor((x - T.ox) / T.cell), cz = Math.floor((z - T.oz) / T.cell);
    var n = 0, dmin2 = 1e18, a, b, k, i, d2, list, dx, dz;
    for (a = -1; a <= 1; a++) {
      for (b = -1; b <= 1; b++) {
        list = T.cells[(cx + a + 1024) * 4096 + (cz + b + 1024)];
        if (!list) continue;
        for (k = 0; k < list.length; k++) {
          i = list[k]; dx = x - S.PX[i]; dz = z - S.PZ[i]; d2 = dx * dx + dz * dz;
          T.ci[n] = i; T.cd[n] = d2; n++;
          if (d2 < dmin2) dmin2 = d2;
        }
      }
    }
    T.lastD = n ? Math.sqrt(dmin2) : 1e9;
    var far = farH(x, z);
    if (!n || dmin2 > 75 * 75) return far;
    var wsum = 0, hsum = 0, w, l, h;
    for (k = 0; k < n; k++) {
      i = T.ci[k]; d2 = T.cd[k]; w = 1 / (d2 * d2 + 1);
      l = (x - S.PX[i]) * S.RX[i] + (z - S.PZ[i]) * S.RZ[i];
      l = clamp(l, -LAT_FLAT, LAT_FLAT);
      h = S.PY[i] - l * S.TB[i] - GROUND_DROP;             // follows the banked road plane
      wsum += w; hsum += w * h;
    }
    var t = smoothstep(LAT_FLAT, 75, T.lastD);
    return (hsum / wsum) * (1 - t) + far * t;
  }
  function trackDist(x, z) { terrainH(x, z); return TER.lastD; }

  /* =========================== 4. TEXTURES =========================== */
  function makeCanvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function tex(canvas, repeat, aniso) {
    var t = new THREE.CanvasTexture(canvas);
    if (repeat) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; }
    if (aniso) t.anisotropy = aniso;
    return t;
  }

  function makeRoadTexture(rng) {
    var W = 512, H = 1024, cv = makeCanvas(W, H), g = cv.getContext('2d'), i, s, t, k;
    var img = g.createImageData(W, H), d = img.data, p = 0, v, r;
    for (i = 0; i < W * H; i++) {                          // asphalt aggregate
      v = 38 + rng() * 16; r = rng();
      if (r > 0.985) v += 34 + rng() * 40; else if (r < 0.03) v -= 12;
      d[p++] = v; d[p++] = v; d[p++] = v + 3; d[p++] = 255;
    }
    g.putImageData(img, 0, 0);
    function wrapBlob(x, y, rx, ry, col) {
      var ox, oy;
      g.fillStyle = col;
      for (ox = -W; ox <= W; ox += W) for (oy = -H; oy <= H; oy += H) {
        var cx = x + ox, cy = y + oy;
        if (cx + rx < 0 || cx - rx > W || cy + ry < 0 || cy - ry > H) continue;
        g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill();
      }
    }
    for (i = 0; i < 46; i++) wrapBlob(rng() * W, rng() * H, 30 + rng() * 90, 40 + rng() * 160, rng() < 0.6 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.025)');
    // rubbered-in racing lines (high-grip bands)
    [0.30, 0.70].forEach(function (f) {
      var x = W * f, gr = g.createLinearGradient(x - 62, 0, x + 62, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.30)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - 62, 0, 124, H);
    });
    // tyre skid marks (wrap vertically so the tile stays seamless)
    g.lineCap = 'round';
    for (s = 0; s < 16; s++) {
      var lane = rng() < 0.5 ? 0.30 : 0.70;
      var x0 = W * (lane + (rng() - 0.5) * 0.2), y0 = rng() * H, len = 200 + rng() * 520;
      var wob = 4 + rng() * 9, fr = 1 + Math.floor(rng() * 3), wd = 3 + rng() * 4, al = 0.16 + rng() * 0.26;
      for (t = 0; t < len; t += 8) {
        var fade = Math.sqrt(Math.sin(t / len * Math.PI)) * al;
        g.strokeStyle = 'rgba(6,6,8,' + fade.toFixed(3) + ')'; g.lineWidth = wd;
        for (k = -1; k <= 1; k++) {
          g.beginPath();
          g.moveTo(x0 + Math.sin(t / len * Math.PI * fr) * wob, y0 + t + k * H);
          g.lineTo(x0 + Math.sin((t + 8) / len * Math.PI * fr) * wob, y0 + t + 8 + k * H);
          g.stroke();
        }
      }
    }
    for (s = 0; s < 9; s++) {                              // heavy braking marks
      var bx = W * (rng() < 0.5 ? 0.30 : 0.70) + (rng() - 0.5) * 60, by = rng() * H, bl = 90 + rng() * 150;
      for (t = 0; t < bl; t += 6) {
        g.strokeStyle = 'rgba(4,4,6,' + (0.42 * Math.min(1, t / 22) * (1 - t / bl * 0.6)).toFixed(3) + ')';
        g.lineWidth = 8 + rng() * 2;
        for (k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(bx, by + t + k * H); g.lineTo(bx, by + t + 6 + k * H); g.stroke(); }
      }
    }
    for (i = 0; i < 5; i++) {                              // tar seams
      var yy = (i + 0.3 + rng() * 0.4) * H / 5;
      g.strokeStyle = 'rgba(8,8,10,0.24)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, yy);
      for (k = 1; k <= 16; k++) g.lineTo(k * W / 16, yy + (rng() - 0.5) * 6);
      g.stroke();
    }
    // painted lines: edge lines + dashed centre line
    g.fillStyle = 'rgba(240,240,236,0.93)';
    g.fillRect(16, 0, 7, H); g.fillRect(W - 23, 0, 7, H);
    g.fillStyle = 'rgba(255,214,120,0.82)';
    for (i = 0; i < 4; i++) g.fillRect(W / 2 - 3.5, i * 256 + 20, 7, 100);
    g.fillStyle = 'rgba(28,28,30,0.55)';                   // paint wear
    for (i = 0; i < 7000; i++) {
      var pick = rng(), px = pick < 0.34 ? 16 + rng() * 7 : (pick < 0.68 ? W - 23 + rng() * 7 : W / 2 - 3.5 + rng() * 7);
      g.fillRect(px, rng() * H, 1 + rng() * 1.5, 1 + rng() * 2);
    }
    return tex(cv, true, 4);
  }
  function makeKerbTexture() {
    var cv = makeCanvas(32, 128), g = cv.getContext('2d');
    g.fillStyle = '#d8201c'; g.fillRect(0, 0, 32, 64);
    g.fillStyle = '#f4f4ef'; g.fillRect(0, 64, 32, 64);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, 32, 3); g.fillRect(0, 61, 32, 6); g.fillRect(0, 125, 32, 3);
    return tex(cv, true, 4);
  }
  function makeNoiseTexture(rng) {
    var W = 256, cv = makeCanvas(W, W), g = cv.getContext('2d'), img = g.createImageData(W, W), d = img.data, i, p = 0, v;
    for (i = 0; i < W * W; i++) { v = 196 + rng() * 59; d[p++] = v; d[p++] = v; d[p++] = v; d[p++] = 255; }
    g.putImageData(img, 0, 0);
    for (i = 0; i < 60; i++) {
      var x = rng() * W, y = rng() * W, r = 8 + rng() * 26;
      g.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';
      [-W, 0, W].forEach(function (ox) { [-W, 0, W].forEach(function (oy) { g.beginPath(); g.arc(x + ox, y + oy, r, 0, TAU); g.fill(); }); });
    }
    return tex(cv, true, 2);
  }
  function makeGlowTexture() {
    var cv = makeCanvas(64, 64), g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return tex(cv, false, 0);
  }
  function makeCheckerTexture() {
    var cv = makeCanvas(448, 48), g = cv.getContext('2d'), x, y;
    for (y = 0; y < 3; y++) for (x = 0; x < 28; x++) { g.fillStyle = ((x + y) % 2) ? '#f6f6f2' : '#101012'; g.fillRect(x * 16, y * 16, 16, 16); }
    return tex(cv, false, 4);
  }
  function makeGridBoxTexture(big, small) {
    var cv = makeCanvas(164, 240), g = cv.getContext('2d');
    g.fillStyle = 'rgba(245,245,240,0.95)';
    g.fillRect(6, 6, 9, 228); g.fillRect(149, 6, 9, 228); g.fillRect(6, 6, 152, 9);   // U-box, open at the rear
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 118px "Arial Black", Impact, Arial, sans-serif'; g.fillText(big, 82, 118);
    g.font = 'bold 26px "Arial Black", Impact, Arial, sans-serif'; g.fillText(small, 82, 190);
    g.fillStyle = 'rgba(20,20,22,0.35)';
    for (var i = 0; i < 500; i++) g.fillRect(Math.random() * 164, Math.random() * 240, 1, 1 + Math.random() * 2);
    return tex(cv, false, 4);
  }
  function makeSignAtlas() {
    var cv = makeCanvas(384, 128), g = cv.getContext('2d');
    function board(x, label, bars) {
      g.fillStyle = '#f4f4f0'; g.fillRect(x, 0, 128, 128);
      g.strokeStyle = '#141414'; g.lineWidth = 8; g.strokeRect(x + 4, 4, 120, 120);
      g.fillStyle = '#c8102e';
      for (var i = 0; i < bars; i++) { g.save(); g.translate(x + 34 + i * 26, 118); g.rotate(-0.6); g.fillRect(-8, -46, 12, 60); g.restore(); }
      g.fillStyle = '#141414'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = 'bold 54px "Arial Black", Impact, Arial, sans-serif'; g.fillText(label, x + 64, 48);
    }
    board(0, '100', 3); board(128, '50', 2);
    g.fillStyle = '#232326'; g.fillRect(256, 0, 128, 128);
    return tex(cv, false, 4);
  }
  function makeGantrySignTexture() {
    var cv = makeCanvas(1024, 112), g = cv.getContext('2d');
    var bg = g.createLinearGradient(0, 0, 0, 112); bg.addColorStop(0, '#0d1226'); bg.addColorStop(1, '#05070f');
    g.fillStyle = bg; g.fillRect(0, 0, 1024, 112);
    g.fillStyle = '#d6246e'; g.fillRect(0, 0, 1024, 6); g.fillStyle = '#ffb000'; g.fillRect(0, 106, 1024, 6);
    for (var i = 0; i < 20; i++) { g.fillStyle = i % 2 ? '#f4f4f0' : '#d8201c'; g.fillRect(i * 12, 20, 12, 72); g.fillRect(1024 - (i + 1) * 12, 20, 12, 72); }
    var tg = g.createLinearGradient(0, 0, 1024, 0); tg.addColorStop(0, '#ffb000'); tg.addColorStop(1, '#ff4d94');
    g.fillStyle = tg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 66px "Arial Black", Impact, Arial, sans-serif'; g.fillText('JODI GRAND PRIX', 512, 58);
    return tex(cv, false, 4);
  }
  function makeCrowdTexture(rng) {
    var cv = makeCanvas(256, 128), g = cv.getContext('2d'), i;
    g.fillStyle = '#8d8f94'; g.fillRect(0, 0, 256, 20);             // solid strip (v 0.85-1) for concrete
    g.fillStyle = '#25252b'; g.fillRect(0, 32, 256, 96);            // crowd area (v 0-0.75)
    var pal = ['#d6246e', '#ffb000', '#f4f4f0', '#3b6fd6', '#d8201c', '#2fa66a', '#9aa0b4'];
    for (i = 0; i < 1300; i++) { g.fillStyle = pal[Math.floor(rng() * pal.length)]; g.fillRect(rng() * 256, 32 + rng() * 96, 2 + rng() * 2, 2 + rng() * 3); }
    return tex(cv, true, 2);
  }
  function makeSkyTexture(rng, sunU, sunRow) {
    var W = 2048, H = 512, cv = makeCanvas(W, H), g = cv.getContext('2d'), i;
    var gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#141d45'); gr.addColorStop(0.30, '#33447f'); gr.addColorStop(0.55, '#8a6f9c');
    gr.addColorStop(0.78, '#e0967a'); gr.addColorStop(1, '#d79b82');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    var sx = sunU * W;
    [-W, 0, W].forEach(function (o) {
      var rg = g.createRadialGradient(sx + o, sunRow, 0, sx + o, sunRow, 380);
      rg.addColorStop(0, 'rgba(255,224,170,0.95)'); rg.addColorStop(0.08, 'rgba(255,190,120,0.7)');
      rg.addColorStop(0.35, 'rgba(255,150,100,0.26)'); rg.addColorStop(1, 'rgba(255,140,100,0)');
      g.fillStyle = rg; g.fillRect(sx + o - 380, sunRow - 380, 760, 760);
      g.fillStyle = 'rgba(255,240,205,0.95)'; g.beginPath(); g.arc(sx + o, sunRow, 20, 0, TAU); g.fill();
    });
    for (i = 0; i < 26; i++) {                                       // streaky dusk clouds
      var cx = rng() * W, cy = 150 + rng() * 210, rx = 90 + rng() * 260, ry = 6 + rng() * 14;
      var col = cy > 300 ? 'rgba(255,170,120,' : 'rgba(205,150,190,';
      [-W, 0, W].forEach(function (o) {
        g.save(); g.translate(cx + o, cy); g.scale(1, ry / rx);
        var rg = g.createRadialGradient(0, 0, 0, 0, 0, rx);
        rg.addColorStop(0, col + '0.34)'); rg.addColorStop(1, col + '0)');
        g.fillStyle = rg; g.fillRect(-rx, -rx, rx * 2, rx * 2); g.restore();
      });
    }
    function range(baseH, amp, c0, c1) {
      var ph = [rng() * TAU, rng() * TAU, rng() * TAU, rng() * TAU], x;
      var lg = g.createLinearGradient(0, H - baseH - amp * 1.2, 0, H);
      lg.addColorStop(0, c0); lg.addColorStop(1, c1);
      g.fillStyle = lg; g.beginPath(); g.moveTo(0, H);
      for (x = 0; x <= W; x += 4) {
        var t = x / W * TAU;
        var h = baseH + amp * (0.5 * Math.abs(Math.sin(3 * t + ph[0])) + 0.3 * Math.abs(Math.sin(7 * t + ph[1])) +
                               0.18 * Math.pow(Math.sin(19 * t + ph[2]), 2) + 0.06 * Math.sin(53 * t + ph[3]));
        g.lineTo(x, H - h);
      }
      g.lineTo(W, H); g.closePath(); g.fill();
    }
    range(30, 34, '#8d7296', '#d79b82');
    range(16, 30, '#5f4c7a', '#cc907e');
    range(6, 22, '#3f3560', '#bd8474');
    return tex(cv, false, 0);
  }

  /* ========================= 5. GEOMETRY BUILDER ====================== */
  var BOX_FACES = [
    [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]],
    [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]],
    [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]],
    [[1, -1, 1], [1, 1, 1], [-1, 1, 1], [-1, -1, 1]],
    [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]]
  ];
  function Builder(withUV) { this.p = []; this.n = []; this.c = []; this.u = withUV ? [] : null; }
  Builder.prototype.tri = function (a, b, c, ca, cb, cc, ua, ub, uc) {
    var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    var l = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (l < 1e-9) return;
    nx /= l; ny /= l; nz /= l;
    cb = cb || ca; cc = cc || ca;
    this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    this.c.push(ca[0], ca[1], ca[2], cb[0], cb[1], cb[2], cc[0], cc[1], cc[2]);
    if (this.u) this.u.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
  };
  Builder.prototype.quad = function (a, b, c, d, col, ua, ub, uc, ud) {
    var ca, cb, cc, cd;
    if (typeof col[0] === 'number') { ca = cb = cc = cd = col; } else { ca = col[0]; cb = col[1]; cc = col[2]; cd = col[3]; }
    this.tri(a, b, c, ca, cb, cc, ua, ub, uc);
    this.tri(a, c, d, ca, cc, cd, ua, uc, ud);
  };
  Builder.prototype.obox = function (c, ax, ay, az, hx, hy, hz, col, uv) {
    var f, k, pts, s, X, Y, Z;
    for (f = 0; f < 5; f++) {                                       // no bottom face
      pts = [];
      for (k = 0; k < 4; k++) {
        s = BOX_FACES[f][k]; X = s[0] * hx; Y = s[1] * hy; Z = s[2] * hz;
        pts.push([c[0] + ax[0] * X + ay[0] * Y + az[0] * Z, c[1] + ax[1] * X + ay[1] * Y + az[1] * Z, c[2] + ax[2] * X + ay[2] * Y + az[2] * Z]);
      }
      this.quad(pts[0], pts[1], pts[2], pts[3], col, uv, uv, uv, uv);
    }
  };
  Builder.prototype.tube = function (p0, p1, r0, r1, n, c0, c1) {
    var ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
    var l = Math.sqrt(ax * ax + ay * ay + az * az), i, j;
    if (l < 1e-9) return;
    ax /= l; ay /= l; az /= l;
    var ux, uy, uz;
    if (Math.abs(ay) < 0.9) { ux = -az; uy = 0; uz = ax; } else { ux = 0; uy = az; uz = -ay; }
    var ul = Math.sqrt(ux * ux + uy * uy + uz * uz); ux /= ul; uy /= ul; uz /= ul;
    var vx = ay * uz - az * uy, vy = az * ux - ax * uz, vz = ax * uy - ay * ux;
    var ring0 = [], ring1 = [];
    for (i = 0; i < n; i++) {
      var a = i / n * TAU, ca = Math.cos(a), sa = Math.sin(a);
      var dx = ux * ca + vx * sa, dy = uy * ca + vy * sa, dz = uz * ca + vz * sa;
      ring0.push([p0[0] + dx * r0, p0[1] + dy * r0, p0[2] + dz * r0]);
      ring1.push([p1[0] + dx * r1, p1[1] + dy * r1, p1[2] + dz * r1]);
    }
    for (i = 0; i < n; i++) {
      j = (i + 1) % n;
      if (r1 < 1e-6) this.tri(ring0[i], ring0[j], p1, c0, c0, c1);
      else this.quad(ring0[i], ring0[j], ring1[j], ring1[i], [c0, c0, c1, c1]);
    }
  };
  Builder.prototype.disc = function (c, r, n, col) {
    for (var i = 0; i < n; i++) {
      var a = i / n * TAU, b = (i + 1) / n * TAU;
      this.tri(c, [c[0] + Math.cos(a) * r, c[1], c[2] + Math.sin(a) * r], [c[0] + Math.cos(b) * r, c[1], c[2] + Math.sin(b) * r], col);
    }
  };
  Builder.prototype.build = function () {
    if (!this.p.length) return null;
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    if (this.u) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    return g;
  };

  // Ribbon of rows: each row {a, b (left/right points), n, ua, ub, ca?, cb?}
  function stripGeometry(rows, withColor) {
    var n = rows.length, r, o, w;
    var pos = new Float32Array(n * 6), nor = new Float32Array(n * 6), uv = new Float32Array(n * 4);
    var col = withColor ? new Float32Array(n * 6) : null, idx = [];
    for (r = 0; r < n; r++) {
      w = rows[r];
      pos.set(w.a, r * 6); pos.set(w.b, r * 6 + 3);
      nor.set(w.n, r * 6); nor.set(w.n, r * 6 + 3);
      uv.set(w.ua, r * 4); uv.set(w.ub, r * 4 + 2);
      if (col) { col.set(w.ca, r * 6); col.set(w.cb, r * 6 + 3); }
      if (r < n - 1) { o = r * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    return g;
  }
  function nrmAt(i) { i = wrapIdx(i); return [S.NRM[i * 3], S.NRM[i * 3 + 1], S.NRM[i * 3 + 2]]; }

  /* ========================= 6. PROP GENERATORS ======================= */
  var RED = [0.85, 0.12, 0.1], WHITE = [0.93, 0.93, 0.9];

  function addTireStack(b, p, col) {
    var t, y0, dark = scale3(col, 0.62);
    for (t = 0; t < 3; t++) {
      y0 = p[1] + t * 0.35;
      b.tube([p[0], y0, p[2]], [p[0], y0 + 0.33, p[2]], 0.55, 0.55, 7, dark, col);
    }
    b.disc([p[0], p[1] + 1.05 + 0.02, p[2]], 0.34, 7, [0.04, 0.04, 0.04]);
  }
  function addPine(b, x, y, z, s, rng) {
    var trunk = [0.30, 0.20, 0.12], tv = 0.8 + rng() * 0.4, k;
    var l0 = scale3([0.07, 0.21, 0.11], tv), l1 = scale3([0.14, 0.34, 0.17], tv);
    b.tube([x, y - 0.2, z], [x, y + 2.2 * s, z], 0.34 * s, 0.22 * s, 5, trunk, trunk);
    for (k = 0; k < 4; k++) {
      var by = y + (1.6 + k * 1.9) * s;
      b.tube([x, by, z], [x, by + 3.4 * s, z], (2.7 - k * 0.55) * s, 0, 7, l0, l1);
    }
  }
  function addPalm(b, x, y, z, s, rng) {
    var lean = rng() * TAU, lx = Math.cos(lean), lz = Math.sin(lean), lc = 0.12 + rng() * 0.22;
    var H = (6.5 + rng() * 3) * s, segs = 5, prev = [x, y - 0.2, z], k, f, q;
    var tA = [0.42, 0.32, 0.2], tB = [0.55, 0.44, 0.28];
    for (k = 1; k <= segs; k++) {
      var t = k / segs, p = [x + lx * lc * H * t * t * 1.4, y + H * t, z + lz * lc * H * t * t * 1.4];
      b.tube(prev, p, (0.34 - 0.13 * (k - 1) / segs) * s, (0.34 - 0.13 * k / segs) * s, 5, tA, tB);
      prev = p;
    }
    var fa = [0.09, 0.30, 0.12], fb = [0.22, 0.46, 0.18];
    for (f = 0; f < 7; f++) {
      var a = f / 7 * TAU + rng() * 0.4, dx = Math.cos(a), dz = Math.sin(a), len = (3.2 + rng() * 1.2) * s;
      var st = [];
      for (q = 0; q <= 3; q++) {
        var u = q / 3, hw = 0.55 * s * (1 - 0.75 * u), cy = prev[1] + len * (0.45 * u - 0.75 * u * u) + 0.3 * s;
        var cxp = prev[0] + dx * len * u, czp = prev[2] + dz * len * u;
        st.push([[cxp - dz * hw, cy, czp + dx * hw], [cxp + dz * hw, cy, czp - dx * hw]]);
      }
      for (q = 0; q < 3; q++) {
        var c0 = mix3(fa, fb, q / 3), c1 = mix3(fa, fb, (q + 1) / 3);
        b.quad(st[q][0], st[q][1], st[q + 1][1], st[q + 1][0], [c0, c0, c1, c1]);
      }
    }
  }

  /* =========================== 7. BUILD PIPELINE ====================== */
  function newCtx(scene) {
    var B = { root: new THREE.Group(), rng: mulberry32((layoutSeed ^ 0x9e3779b9) >>> 0), disp: [], scene: scene, lamps: null };
    B.root.name = 'JodiRaceTrack';
    B.mat = function (m) { B.disp.push(m); return m; };
    B.tx = function (t) { B.disp.push(t); return t; };
    B.mesh = function (geo, mat, opts) {
      B.disp.push(geo);
      var m = new THREE.Mesh(geo, mat);
      m.matrixAutoUpdate = false;
      if (opts) for (var k in opts) m[k] = opts[k];
      B.root.add(m);
      return m;
    };
    return B;
  }
  function disposeBuilt() {
    if (!built) return;
    if (built.root.parent) built.root.parent.remove(built.root);
    built.disp.forEach(function (d) { if (d && d.dispose) d.dispose(); });
    built = null; trackMesh = null;
  }

  function buildSky(B) {
    var el = CFG.sunElevation, az = CFG.sunAzimuth;
    var sdx = Math.cos(az), sdz = Math.sin(az);
    var phi = Math.atan2(sdz, -sdx), sunU = ((phi / TAU) % 1 + 1) % 1;
    var sunRow = 512 * (1 - el / (Math.PI / 2));
    var skyTex = B.tx(makeSkyTexture(B.rng, sunU, sunRow));
    var geo = new THREE.SphereGeometry(1, 32, 16, 0, TAU, 0, Math.PI / 2);
    var mat = B.mat(new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false }));
    var sky = B.mesh(geo, mat, { renderOrder: -1000, frustumCulled: false });
    sky.matrixAutoUpdate = true;
    sky.onBeforeRender = function (renderer, scene, camera) {     // dome follows the camera => infinite backdrop
      var far = camera.far || 1000, r = Math.max(20, far * 0.45);
      this.position.setFromMatrixPosition(camera.matrixWorld);
      this.scale.set(r, r, r);
      this.updateMatrixWorld(true);
    };
    var hasLight = false;
    B.scene.traverse(function (o) { if (o.isLight) hasLight = true; });
    if (!hasLight) {
      var hemi = new THREE.HemisphereLight(0x8090c4, 0x5a4436, 0.75);
      var sun = new THREE.DirectionalLight(0xffc890, 1.0);
      sun.position.set(sdx * Math.cos(el) * 400, Math.sin(el) * 400, sdz * Math.cos(el) * 400);
      B.root.add(hemi); B.root.add(sun);
    }
    if (!B.scene.background) B.scene.background = new THREE.Color(CFG.haze);
    if (!B.scene.fog) B.scene.fog = new THREE.FogExp2(CFG.haze, 0.0017);
  }

  function buildRoad(B, T) {
    var N = S.N, i, rows = [], lift = CFG.roadLift, M = Math.max(1, Math.round(S.L / 28)), tile = S.L / M;
    for (i = 0; i <= N; i++) {
      var v = i * S.ds / tile;
      rows.push({ a: roadPt(i, -HW, lift), b: roadPt(i, HW, lift), n: nrmAt(i), ua: [0, v], ub: [1, v] });
    }
    var mat = B.mat(new THREE.MeshStandardMaterial({ map: T.road, roughness: 0.86, metalness: 0.05 }));
    trackMesh = B.mesh(stripGeometry(rows, false), mat, { receiveShadow: true, name: 'road' });

    // gravel / grass shoulders blend the road into the terrain
    var shMat = B.mat(new THREE.MeshLambertMaterial({ map: T.noise, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    var cIn = [0.55, 0.51, 0.45], cOut = [0.31, 0.38, 0.18], sd, hOut = SHOULDER_DROP;
    for (sd = -1; sd <= 1; sd += 2) {
      rows = [];
      for (i = 0; i <= N; i++) {
        var inner = roadPt(i, sd * HW, lift), outer = roadPt(i, sd * LAT_FLAT, hOut), vv = i * S.ds / 12;
        var left = sd < 0 ? outer : inner, right = sd < 0 ? inner : outer;
        rows.push({ a: left, b: right, n: nrmAt(i), ua: [0, vv], ub: [0.5, vv],
                    ca: sd < 0 ? cOut : cIn, cb: sd < 0 ? cIn : cOut });
      }
      B.mesh(stripGeometry(rows, true), shMat, { receiveShadow: true });
    }
  }

  function buildKerbs(B, T) {
    var kb = new Builder(true), kw = CFG.kerbWidth, kh = CFG.kerbHeight, lift = CFG.roadLift;
    var lats = [HW, HW + 0.12, HW + kw - 0.12, HW + kw], hs = [lift, lift + kh, lift + kh, padH(HW + kw) + 0.01];
    var us = [0, 0.15, 0.85, 1], white = [1, 1, 1];
    function row(i, sd) { var r = [], c; for (c = 0; c < 4; c++) r.push(roadPt(i, sd * lats[c], hs[c])); return r; }
    corners.forEach(function (c) {
      if (c.len < 5) return;
      var z = kerbZone(c), i, q, r0, r1, v0, v1;
      for (i = z.a; i < z.b; i++) {
        r0 = row(i, c.sign); r1 = row(i + 1, c.sign);
        v0 = i * S.ds / 1.6; v1 = (i + 1) * S.ds / 1.6;
        for (q = 0; q < 3; q++) kb.quad(r0[q], r0[q + 1], r1[q + 1], r1[q], white, [us[q], v0], [us[q + 1], v0], [us[q + 1], v1], [us[q], v1]);
      }
    });
    var g = kb.build();
    if (g) B.mesh(g, B.mat(new THREE.MeshStandardMaterial({ map: T.kerb, roughness: 0.6, metalness: 0.02, side: THREE.DoubleSide })), { receiveShadow: true });
  }

  function addDecal(B, mat, sC, len, latC, wid, rowsN) {
    var rows = [], r, s, fr, h = CFG.roadLift + 0.025;
    for (r = 0; r <= rowsN; r++) {
      s = sC - len / 2 + len * r / rowsN;
      fr = frameS(s);
      rows.push({ a: roadPtS(s, latC - wid / 2, h), b: roadPtS(s, latC + wid / 2, h), n: fr.n, ua: [0, r / rowsN], ub: [1, r / rowsN] });
    }
    B.mesh(stripGeometry(rows, false), mat, { renderOrder: 2 });
  }
  function buildDecals(B) {
    function dm(t) {
      return B.mat(new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.85, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    }
    var chk = B.tx(makeCheckerTexture()), p1 = B.tx(makeGridBoxTexture('1', 'POLE')), g2 = B.tx(makeGridBoxTexture('2', 'GRID'));
    addDecal(B, dm(chk), 0, 1.5, 0, CFG.roadWidth, 1);                 // start / finish line
    addDecal(B, dm(p1), -6.4, 4.4, -3.2, 3.0, 4);                      // pole position box
    addDecal(B, dm(g2), -13.0, 4.4, 3.2, 3.0, 4);                      // grid 2 box
  }

  function buildTerrain(B, T) {
    var G = CFG.terrainGrid, TS = CFG.terrainTiles, per = G / TS, V = G + 1;
    var half = TER.rMax + 560, sp = half * 2 / G, x0 = TER.cx - half, z0 = TER.cz - half;
    var H = new Float32Array(V * V), D = new Float32Array(V * V), gx, gz, i;
    for (gz = 0; gz < V; gz++) for (gx = 0; gx < V; gx++) {
      i = gz * V + gx; H[i] = terrainH(x0 + gx * sp, z0 + gz * sp); D[i] = TER.lastD;
    }
    var grass = [0.30, 0.37, 0.15], grass2 = [0.40, 0.42, 0.19], dry = [0.50, 0.44, 0.27], rock = [0.43, 0.39, 0.36], gravel = [0.46, 0.42, 0.35];
    var NX = new Float32Array(V * V), NY = new Float32Array(V * V), NZ = new Float32Array(V * V), COL = new Float32Array(V * V * 3);
    for (gz = 0; gz < V; gz++) for (gx = 0; gx < V; gx++) {
      i = gz * V + gx;
      var hl = H[gz * V + Math.max(gx - 1, 0)], hr = H[gz * V + Math.min(gx + 1, G)];
      var hd = H[Math.max(gz - 1, 0) * V + gx], hu = H[Math.min(gz + 1, G) * V + gx];
      var dx = (hr - hl) / (2 * sp), dz = (hu - hd) / (2 * sp), nl = Math.sqrt(dx * dx + 1 + dz * dz);
      NX[i] = -dx / nl; NY[i] = 1 / nl; NZ[i] = -dz / nl;
      var slope = Math.sqrt(dx * dx + dz * dz), x = x0 + gx * sp, z = z0 + gz * sp;
      var g1 = fbm(x * 0.02, z * 0.02, TER.sd + 9), g2n = fbm(x * 0.011, z * 0.011, TER.sd + 21);
      var c = mix3(grass, grass2, g1);
      c = mix3(c, dry, smoothstep(0.6, 0.8, g2n));
      c = mix3(c, rock, Math.max(smoothstep(0.5, 1.0, slope), smoothstep(50, 95, H[i])));
      c = mix3(c, gravel, (1 - smoothstep(14, 34, D[i])) * 0.7);
      COL[i * 3] = c[0]; COL[i * 3 + 1] = c[1]; COL[i * 3 + 2] = c[2];
    }
    var mat = B.mat(new THREE.MeshLambertMaterial({ map: T.noise, vertexColors: true }));
    var tx, tz, nv = per + 1;
    for (tz = 0; tz < TS; tz++) for (tx = 0; tx < TS; tx++) {
      var pos = new Float32Array(nv * nv * 3), nor = new Float32Array(nv * nv * 3), col = new Float32Array(nv * nv * 3), uv = new Float32Array(nv * nv * 2), idx = [];
      var a, b, o = 0;
      for (b = 0; b < nv; b++) for (a = 0; a < nv; a++) {
        var vx = tx * per + a, vz = tz * per + b, vi = vz * V + vx;
        pos[o * 3] = x0 + vx * sp; pos[o * 3 + 1] = H[vi]; pos[o * 3 + 2] = z0 + vz * sp;
        nor[o * 3] = NX[vi]; nor[o * 3 + 1] = NY[vi]; nor[o * 3 + 2] = NZ[vi];
        col[o * 3] = COL[vi * 3]; col[o * 3 + 1] = COL[vi * 3 + 1]; col[o * 3 + 2] = COL[vi * 3 + 2];
        uv[o * 2] = pos[o * 3] / 28; uv[o * 2 + 1] = pos[o * 3 + 2] / 28;
        o++;
      }
      for (b = 0; b < per; b++) for (a = 0; a < per; a++) {
        var q0 = b * nv + a, q1 = q0 + 1, q2 = q0 + nv, q3 = q2 + 1;
        idx.push(q0, q2, q1, q1, q2, q3);
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex(idx);
      B.mesh(g, mat, { receiveShadow: true });
    }
  }

  function buildBarriers(B) {
    var N = S.N, i, sd, r, q;
    var prof = [[0, -0.16], [0.07, 0], [0, 0.16]], hc = [0.52, 1.0];
    var cLo = [0.6, 0.63, 0.68], cMid = [0.76, 0.79, 0.83], cHi = [0.9, 0.92, 0.95], postC = [0.3, 0.32, 0.36];
    function railRow(idx, s2, L0, h) { var out = [], k; for (k = 0; k < 3; k++) out.push(roadPt(idx, L0 + s2 * prof[k][0], h + prof[k][1])); return out; }
    for (i = 0; i < N; i++) {
      var rb = B.rails[secOf(i)], pb = B.props[secOf(i)];
      for (sd = -1; sd <= 1; sd += 2) {
        var L0 = sd * (HW + CFG.railOffset), g = padH(L0);
        for (r = 0; r < 2; r++) {
          var a = railRow(i, sd, L0, g + hc[r]), b = railRow(i + 1, sd, L0, g + hc[r]);
          for (q = 0; q < 2; q++) {
            var cs = q === 0 ? [cLo, cMid, cMid, cLo] : [cMid, cHi, cHi, cMid];
            rb.quad(a[q], a[q + 1], b[q + 1], b[q], cs);
          }
        }
        if (i % 2 === 0) {
          var k = i * 3, c0 = roadPt(i, L0 + sd * 0.12, g + 0.55);
          pb.obox(c0, [S.LAT[k], S.LAT[k + 1], S.LAT[k + 2]], [S.NRM[k], S.NRM[k + 1], S.NRM[k + 2]], [S.FWD[k], S.FWD[k + 1], S.FWD[k + 2]], 0.06, 0.62, 0.06, postC);
        }
      }
    }
    // tyre walls on the outside of hairpins
    corners.forEach(function (c) {
      if (c.peak < SHARP) return;
      var sdo = -c.sign, L1 = sdo * (HW + CFG.tireOffset), g1 = padH(L1);
      var sA = (c.i0 - 3) * S.ds, sB = (c.i0 + c.len + 6) * S.ds, k = 0, s;
      for (s = sA; s < sB; s += 1.35, k++) {
        addTireStack(B.props[secOfS(s)], roadPtS(s, L1, g1), (Math.floor(k / 2) % 2) ? WHITE : RED);
      }
    });
  }

  function buildSigns(B, T) {
    var sb = new Builder(true), solid = [5 / 6, 0.5], dark = [0.25, 0.26, 0.28], white = [1, 1, 1], any = false;
    corners.forEach(function (c) {
      if (c.peak < SHARP) return;
      [100, 50].forEach(function (dist, kind) {
        var i = Math.round(c.i0 - dist / S.ds), k;
        for (k = -2; k <= 2; k++) if (Math.abs(S.KC[wrapIdx(i + k)]) > 0.0085) return;   // never inside another bend
        var s = i * S.ds, lat = HW + 4.9, fr = frameS(s), base = roadPtS(s, lat, padH(lat));
        var R = fr.l, U = [0, 1, 0], F = fr.f;
        sb.obox([base[0], base[1] + 1.0, base[2]], R, U, F, 0.06, 1.05, 0.06, dark, solid);
        var c0 = [base[0], base[1] + 2.55, base[2]], hw = 0.95, hh = 0.95;
        sb.obox(c0, R, U, F, hw, hh, 0.04, dark, solid);
        function pt(a, b) { return [c0[0] + R[0] * a + U[0] * b - F[0] * 0.06, c0[1] + R[1] * a + U[1] * b - F[1] * 0.06, c0[2] + R[2] * a + U[2] * b - F[2] * 0.06]; }
        var u0 = kind / 3 + 0.004, u1 = (kind + 1) / 3 - 0.004;
        sb.quad(pt(-hw, -hh), pt(hw, -hh), pt(hw, hh), pt(-hw, hh), white, [u0, 0.01], [u1, 0.01], [u1, 0.99], [u0, 0.99]);
        any = true;
      });
    });
    var g = any ? sb.build() : null;
    if (g) B.mesh(g, B.mat(new THREE.MeshLambertMaterial({ map: T.signs, vertexColors: true, side: THREE.DoubleSide })));
  }

  function buildFloodlights(B, T) {
    var count = Math.max(6, Math.round(S.L / 96)), step = S.L / count, k;
    var pool = new Builder(true), glowPts = [], poleC = [0.55, 0.58, 0.62], headC = [0.16, 0.17, 0.19], bulbC = [1.0, 0.93, 0.7];
    for (k = 0; k < count; k++) {
      var s = (k + 0.4) * step;
      if (s < 20 || s > S.L - 20) continue;
      var sd = (k % 2) ? 1 : -1, sSigned = s > S.L / 2 ? s - S.L : s;
      if (sd > 0 && sSigned > -90 && sSigned < 65) sd = -1;            // keep the grandstand side clear
      var fr = frameS(s), lat = 14.8 * sd;
      var x = fr.p[0] + fr.r[0] * lat, z = fr.p[2] + fr.r[2] * lat, y = terrainH(x, z);
      var inw = [-fr.r[0] * sd, 0, -fr.r[2] * sd], fh = norm3([fr.f[0], 0, fr.f[2]]);
      var pb = B.props[secOfS(s)], H = 15.5, top = [x, y + H, z];
      pb.obox([x, y + 0.2, z], [1, 0, 0], [0, 1, 0], [0, 0, 1], 0.5, 0.3, 0.5, [0.5, 0.5, 0.52]);
      pb.tube([x, y, z], top, 0.32, 0.17, 6, poleC, poleC);
      pb.tube(top, [top[0] + inw[0] * 1.7, top[1] + 0.35, top[2] + inw[2] * 1.7], 0.1, 0.1, 4, poleC, poleC);
      var hc = [top[0] + inw[0] * 1.9, top[1] + 0.55, top[2] + inw[2] * 1.9];
      pb.obox(hc, fh, [0, 1, 0], inw, 2.4, 0.45, 0.28, headC);
      var row, col2;
      for (row = 0; row < 2; row++) for (col2 = 0; col2 < 4; col2++) {
        var off = -1.65 + col2 * 1.1, yo = 0.17 * (row ? -1 : 1);
        var bc = [hc[0] + inw[0] * 0.3 + fh[0] * off, hc[1] + yo, hc[2] + inw[2] * 0.3 + fh[2] * off];
        B.emit.obox(bc, fh, [0, 1, 0], inw, 0.42, 0.13, 0.05, bulbC);
      }
      glowPts.push(hc[0] + inw[0] * 1.2, hc[1], hc[2] + inw[2] * 1.2);
      // warm light pool painted onto the asphalt
      var r, rowsN = 4, s1;
      for (r = 0; r < rowsN; r++) {
        var sa = s - 14 + 28 * r / rowsN, sb2 = s - 14 + 28 * (r + 1) / rowsN, lc = 4 * sd;
        var A = roadPtS(sa, lc - 14, CFG.roadLift + 0.05), Bp = roadPtS(sa, lc + 14, CFG.roadLift + 0.05);
        var C = roadPtS(sb2, lc + 14, CFG.roadLift + 0.05), D = roadPtS(sb2, lc - 14, CFG.roadLift + 0.05);
        pool.quad(A, Bp, C, D, [1, 1, 1], [0, r / rowsN], [1, r / rowsN], [1, (r + 1) / rowsN], [0, (r + 1) / rowsN]);
      }
    }
    var pg = pool.build();
    if (pg) B.mesh(pg, B.mat(new THREE.MeshBasicMaterial({ map: T.glow, color: 0xffa64a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })), { renderOrder: 3 });
    if (glowPts.length) {
      var gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.Float32BufferAttribute(glowPts, 3));
      B.disp.push(gg);
      var pm = B.mat(new THREE.PointsMaterial({ map: T.glow, color: 0xffb46a, size: 8, sizeAttenuation: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      var pts = new THREE.Points(gg, pm); pts.matrixAutoUpdate = false; B.root.add(pts);
    }
  }

  function buildTrees(B) {
    var rng = B.rng, N = S.N, i = 0, n = 0, guard = 0;
    while (i < N && n < 420 && guard++ < 2000) {
      i += 2 + Math.floor(rng() * 4);
      var cnt = 1 + Math.floor(rng() * 3), c;
      for (c = 0; c < cnt; c++) {
        var side = rng() < 0.5 ? -1 : 1, l = 19 + Math.pow(rng(), 1.4) * 55, jf = (rng() - 0.5) * 10;
        var ii = wrapIdx(i);
        if (side > 0 && (ii > N - 24 || ii < 22)) continue;              // grandstand zone
        var fx = S.FWD[ii * 3], fz = S.FWD[ii * 3 + 2], fl = Math.sqrt(fx * fx + fz * fz) || 1;
        var x = S.PX[ii] + S.RX[ii] * side * l + fx / fl * jf, z = S.PZ[ii] + S.RZ[ii] * side * l + fz / fl * jf;
        if (trackDist(x, z) < 21) continue;
        var y = terrainH(x, z) - 0.15, sc = 0.8 + rng() * 0.7, pb = B.props[secOf(ii)];
        if (rng() < 0.32) addPalm(pb, x, y, z, sc * 0.9, rng); else addPine(pb, x, y, z, sc, rng);
        n++;
      }
    }
  }

  function buildGantry(B, T) {
    var gb = new Builder(false), lb = new Builder(false), lift = CFG.roadLift, gy = S.PY[0] + lift, i;
    var Fh = norm3([S.FWD[0], 0, S.FWD[2]]), Rh = [-Fh[2], 0, Fh[0]], UP = [0, 1, 0];
    function W(lat, up, fwd) { return [S.PX[0] + Rh[0] * lat + Fh[0] * fwd, gy + up, S.PZ[0] + Rh[2] * lat + Fh[2] * fwd]; }
    var body = [0.66, 0.68, 0.72], navy = [0.07, 0.08, 0.13], pink = [0.84, 0.14, 0.43], amber = [1.0, 0.69, 0.0], black = [0.02, 0.02, 0.03];
    [-1, 1].forEach(function (sd) {                                   // stepped, modern pylons
      gb.obox(W(sd * 12.6, 3.0, 0), Rh, UP, Fh, 1.0, 3.0, 1.1, body);
      gb.obox(W(sd * 12.6, 8.3, 0), Rh, UP, Fh, 0.72, 2.3, 0.85, [0.55, 0.57, 0.62]);
      gb.obox(W(sd * 12.6, 6.05, 0), Rh, UP, Fh, 1.02, 0.08, 1.12, pink);
    });
    gb.obox(W(0, 9.3, 0), Rh, UP, Fh, 13.3, 1.3, 0.7, navy);
    gb.obox(W(0, 7.97, 0), Rh, UP, Fh, 13.3, 0.05, 0.72, pink);
    gb.obox(W(0, 10.62, 0), Rh, UP, Fh, 13.3, 0.05, 0.72, amber);
    gb.obox(W(0, 8.6, -0.74), Rh, UP, Fh, 5.6, 0.75, 0.08, black);   // lamp housing (faces the grid)
    var gg = gb.build();
    if (gg) B.mesh(gg, B.mat(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));

    // start lamps: 5 columns x 2 rows, colours driven by setStartLights()
    var lampCols = [-4, -2, 0, 2, 4], rows = [8.95, 8.25], c, r, k, n = 8, off = [0.16, 0.03, 0.03];
    for (c = 0; c < 5; c++) for (r = 0; r < 2; r++) {
      var ctr = W(lampCols[c], rows[r], -0.84);
      for (k = 0; k < n; k++) {
        var a0 = k / n * TAU, a1 = (k + 1) / n * TAU, rr = 0.4;
        lb.tri(ctr, [ctr[0] + Rh[0] * Math.cos(a0) * rr, ctr[1] + Math.sin(a0) * rr, ctr[2] + Rh[2] * Math.cos(a0) * rr],
                    [ctr[0] + Rh[0] * Math.cos(a1) * rr, ctr[1] + Math.sin(a1) * rr, ctr[2] + Rh[2] * Math.cos(a1) * rr], off);
      }
    }
    var lg = lb.build();
    B.mesh(lg, B.mat(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    B.lamps = { geo: lg, vertsPer: n * 3 };

    // "JODI GRAND PRIX" boards on both faces
    var signMat = B.mat(new THREE.MeshBasicMaterial({ map: T.gantry }));
    var pg = new THREE.PlaneGeometry(21, 1.2);
    B.disp.push(pg);
    var rear = new THREE.Mesh(pg, signMat), front = new THREE.Mesh(pg, signMat);
    var p = W(0, 10.0, -0.73), q = W(0, 9.3, 0.73);
    rear.position.set(p[0], p[1], p[2]); rear.rotation.y = Math.atan2(-Fh[0], -Fh[2]);
    front.position.set(q[0], q[1], q[2]); front.scale.set(1, 1.5, 1); front.rotation.y = Math.atan2(Fh[0], Fh[2]);
    B.root.add(rear); B.root.add(front);
  }

  function buildGrandstand(B, T) {
    var sb = new Builder(true), lift = CFG.roadLift, gy = S.PY[0] + lift - 0.3;
    var Fh = norm3([S.FWD[0], 0, S.FWD[2]]), Rh = [-Fh[2], 0, Fh[0]], UP = [0, 1, 0];
    function W(lat, up, fwd) { return [S.PX[0] + Rh[0] * lat + Fh[0] * fwd, up, S.PZ[0] + Rh[2] * lat + Fh[2] * fwd]; }
    var steps = 6, depth = 2.4, rise = 1.05, lat0 = 17.5, f0 = -72, f1 = 48, k;
    var solid = [0.5, 0.92], concrete = [0.86, 0.87, 0.9], white = [1, 1, 1], vLo = 0.03, vHi = 0.72, sink = gy - 6;
    for (k = 0; k < steps; k++) {
      var l0 = lat0 + k * depth, l1 = l0 + depth, top = gy + (k + 1) * rise, prevTop = gy + k * rise + (k ? 0 : -0.5);
      var uA = f0 / 9, uB = f1 / 9;
      sb.quad(W(l0, top, f0), W(l1, top, f0), W(l1, top, f1), W(l0, top, f1), white, [uA, vLo], [uA, vHi], [uB, vHi], [uB, vLo]);         // seats
      sb.quad(W(l0, prevTop, f0), W(l0, top, f0), W(l0, top, f1), W(l0, prevTop, f1), white, [uA, vLo], [uA, vHi], [uB, vHi], [uB, vLo]); // riser (crowd)
      [f0, f1].forEach(function (ff) { sb.quad(W(l0, sink, ff), W(l0, top, ff), W(l1, top, ff), W(l1, sink, ff), concrete, solid, solid, solid, solid); });
    }
    var lb = lat0 + steps * depth, tTop = gy + steps * rise;
    sb.quad(W(lb, sink, f0), W(lb, tTop, f0), W(lb, tTop, f1), W(lb, sink, f1), concrete, solid, solid, solid, solid);   // back wall
    var roofY = gy + 9.0;
    sb.obox(W(25.5, roofY, (f0 + f1) / 2), Rh, UP, Fh, 9.5, 0.18, (f1 - f0) / 2 + 1, [0.86, 0.87, 0.9], solid);
    sb.obox(W(16.1, roofY, (f0 + f1) / 2), Rh, UP, Fh, 0.15, 0.3, (f1 - f0) / 2 + 1, [0.84, 0.14, 0.43], solid);
    for (k = 0; k < 5; k++) sb.obox(W(lb - 0.6, (roofY + sink) / 2, f0 + k * (f1 - f0) / 4), Rh, UP, Fh, 0.28, (roofY - sink) / 2, 0.28, [0.6, 0.62, 0.66], solid);
    B.mesh(sb.build(), B.mat(new THREE.MeshLambertMaterial({ map: T.crowd, vertexColors: true, side: THREE.DoubleSide })));
  }

  function buildMesh(scene) {
    if (!scene) return;
    if (!trackCurve || !S) generate();
    disposeBuilt();
    prepareTerrainIndex();
    var B = newCtx(scene), k;
    var T = {
      road: B.tx(makeRoadTexture(B.rng)), kerb: B.tx(makeKerbTexture()), noise: B.tx(makeNoiseTexture(B.rng)),
      glow: B.tx(makeGlowTexture()), signs: B.tx(makeSignAtlas()), gantry: B.tx(makeGantrySignTexture()), crowd: B.tx(makeCrowdTexture(B.rng))
    };
    B.props = []; B.rails = [];
    for (k = 0; k < CFG.sectors; k++) { B.props.push(new Builder(false)); B.rails.push(new Builder(false)); }
    B.emit = new Builder(false);

    buildSky(B);
    buildRoad(B, T);
    buildKerbs(B, T);
    buildDecals(B);
    buildTerrain(B, T);
    buildBarriers(B);
    buildSigns(B, T);
    buildFloodlights(B, T);
    buildTrees(B);
    buildGantry(B, T);
    buildGrandstand(B, T);

    var propMat = B.mat(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    var railMat = B.mat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.35, side: THREE.DoubleSide }));
    for (k = 0; k < CFG.sectors; k++) {
      var pg = B.props[k].build(), rg = B.rails[k].build();
      if (pg) B.mesh(pg, propMat);
      if (rg) B.mesh(rg, railMat);
    }
    var eg = B.emit.build();
    if (eg) B.mesh(eg, B.mat(new THREE.MeshBasicMaterial({ vertexColors: true })));

    scene.add(B.root);
    built = B;
    setStartLights('off');
  }

  /* ============================ 8. PUBLIC API ========================= */
  function setStartLights(state) {
    if (!built || !built.lamps) return;
    var L = built.lamps, attr = L.geo.attributes.color, arr = attr.array, c, r, k, rgb;
    for (c = 0; c < 5; c++) for (r = 0; r < 2; r++) {
      if (state === 'green') rgb = [0.1, 1.0, 0.35];
      else if (typeof state === 'number' && c < state) rgb = [1.0, 0.1, 0.08];
      else rgb = [0.16, 0.03, 0.03];
      for (k = 0; k < L.vertsPer; k++) {
        var o = ((c * 2 + r) * L.vertsPer + k) * 3;
        arr[o] = rgb[0]; arr[o + 1] = rgb[1]; arr[o + 2] = rgb[2];
      }
    }
    attr.needsUpdate = true;
  }
  function getFrameAt(u) {
    if (!S) return null;
    var fr = frameS(((u % 1) + 1) % 1 * S.L);
    return { forward: new THREE.Vector3(fr.f[0], fr.f[1], fr.f[2]), right: new THREE.Vector3(fr.l[0], fr.l[1], fr.l[2]),
             up: new THREE.Vector3(fr.n[0], fr.n[1], fr.n[2]), bank: fr.bank };
  }
  function getRoadPoint(u, lateral) {
    if (!S) return null;
    var p = roadPtF((((u % 1) + 1) % 1) * S.N, lateral || 0, CFG.roadLift);
    return new THREE.Vector3(p[0], p[1], p[2]);
  }
  function getGridSlots(count) {
    if (!S) return [];
    var out = [], n = count || 2, i;
    for (i = 0; i < n; i++) {
      var s = -(6.4 + 6.6 * i), lat = (i % 2 === 0) ? -3.2 : 3.2, u = ((s % S.L) + S.L) % S.L / S.L;
      var fr = frameS(s), p = roadPtS(s, lat, CFG.roadLift);
      out.push({ index: i, u: u, lateral: lat, position: new THREE.Vector3(p[0], p[1], p[2]),
                 forward: new THREE.Vector3(fr.f[0], fr.f[1], fr.f[2]), bank: fr.bank });
    }
    return out;
  }
  function dispose() { disposeBuilt(); }

  global.JodiRaceTrack = {
    generate: generate,
    buildMesh: buildMesh,
    getCurve: function () { return trackCurve; },
    getLength: function () { return trackLength; },
    getMinimapPoints: function () { return minimapPoints; },
    getMinimapBounds: function () { return minimapBounds; },
    getFrameAt: getFrameAt,
    getRoadPoint: getRoadPoint,
    getGridSlots: getGridSlots,
    setStartLights: setStartLights,
    dispose: dispose,
    config: CFG
  };
})(window);