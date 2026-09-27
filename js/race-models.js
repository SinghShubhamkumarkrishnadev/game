/* Jodi Race - 3D Hyper-Realistic Modular Motorcycle Engineering Engine
   Pure procedural Three.js (r128) geometry + Procedural Canvas Textures + PBR MeshStandardMaterial.
   Modular Micro-Subassembly Architecture:
     - Precision Wheel & Ventilated Brake Rotors with Gold Floating Bobbins
     - Brembo Monobloc Radial Calipers with Braided Hydraulic Lines
     - Inverted USD Gold Stanchions & Telescopic Chrome Fork Legs
     - Billet Aluminum Triple Clamps, Steering Stem Nut & Hydraulic Steering Damper
     - Clip-ons with Grips, Bar-End Weights, Translucent Fluid Reservoirs & TFT Digital Dash
     - 4 Authentic Engine Architectures (V4 Superbike, 350cc Finned Single, Supercharged V4, 650cc Twin)
     - Akrapovič Carbon-Hex, Royal Peashooter, Titanium Slash-Cut & Heat-Wrapped Megaphone Exhausts
     - Masterclass Pro Racer in MotoGP Leathers, Back Racing Number Patch & AGV Pista Ducktail Helmet
   -------------------------------------------------------------------------------------------------
   ENGINE CONTRACT (100% Preserved):
     bike.frontWheel   -> mesh/group, animated via frontWheel.rotation.x += spin
     bike.rearWheel    -> mesh/group, animated via rearWheel.rotation.x += spin
     bike.frontFork    -> steerable group (handlebars + forks + frontWheel + headlight),
                          steered via frontFork.rotation.y = steerAngle
     bike.exhaustFlame -> mesh, material.opacity & scale settable for Nitro boost
     bike.rider        -> pro racer group with rider.updatePose(tiltAngle, isNitro, speed)
     Orientation: forward = +Z, up = +Y, left = +X
     Wheelbase / pivots:
       Rear wheel: (0, 0.72, -1.3)
       Front fork: (0, 0, 1.4) with front wheel at (0, 0.72, 0)
       Scale: (1.4, 1.4, 1.4) -> Ground contact at exact Y = 0.
*/
(function (global) {
  'use strict';

  // ================= 4 Distinct Realistic Superbike Themes =================
  var BIKE_THEMES = {
    sport: {
      key: 'sport',
      name: 'Rani Neon Sport',
      tagline: '1000cc V4 MotoGP Superbike',
      bodyColor: 0xD6246E,
      accentColor: 0xFFB000,
      metalColor: 0x1A1B20,
      frameColor: 0x88929A,
      roughness: 0.16,
      metalness: 0.68,
      specular: 0xFFA0C0,
      caliperColor: 0xE60020,
      forkColor: 0xD4AF37,       // Gold Inverted USD Forks
      rimStripe: '#FFB000',
      exhaustType: 'carbon-hex',
      badgeText: 'RANI 93',
      riderSuit: { primary: '#181116', secondary: '#D6246E', accent: '#FFB000' }
    },
    bullet: {
      key: 'bullet',
      name: 'Royal Bullet 350',
      tagline: 'Heavy Metal Heritage Cruiser',
      bodyColor: 0x111113,
      accentColor: 0xD4AF37,      // Pure Gold Leaf Pinstripes
      metalColor: 0xE8ECEF,       // Mirror Chrome
      frameColor: 0x141416,
      roughness: 0.20,
      metalness: 0.78,
      specular: 0xD4AF37,
      caliperColor: 0x222226,
      forkColor: 0xEEEEEE,       // Classic Chrome Telescopic
      rimStripe: null,
      exhaustType: 'peashooter',
      badgeText: 'ROYAL 350',
      riderSuit: { primary: '#281912', secondary: '#4A2E1D', accent: '#D4AF37' }
    },
    turbo: {
      key: 'turbo',
      name: 'Mor Teal Turbo',
      tagline: 'Supercharged Cyber Streetfighter',
      bodyColor: 0x0B7A7C,
      accentColor: 0x38E1E4,      // Neon Cyan Luminous Glow
      metalColor: 0x18191C,
      frameColor: 0x38E1E4,       // Electric Teal Trellis Frame
      roughness: 0.18,
      metalness: 0.72,
      specular: 0x58F0F4,
      caliperColor: 0x38E1E4,
      forkColor: 0x2A2B30,       // Carbon Black USD Forks
      rimStripe: '#38E1E4',
      exhaustType: 'slash-cut',
      badgeText: 'TURBO V4',
      riderSuit: { primary: '#0C1318', secondary: '#0B7A7C', accent: '#38E1E4' }
    },
    cafe: {
      key: 'cafe',
      name: 'Kesar Cafe Racer',
      tagline: 'Neo-Retro 650cc Twin Custom',
      bodyColor: 0xDD4B00,      // Kesar Burnt Saffron
      accentColor: 0xFFC107,      // Vintage Gold
      metalColor: 0xDCDFE3,       // Brushed Billet Aluminum
      frameColor: 0x1F2024,
      roughness: 0.20,
      metalness: 0.65,
      specular: 0xFFA040,
      caliperColor: 0xD4AF37,
      forkColor: 0xD4AF37,       // Gold Inverted USD Forks
      rimStripe: '#FFC107',
      exhaustType: 'reverse-cone',
      badgeText: 'KESAR GT',
      riderSuit: { primary: '#26170E', secondary: '#DD4B00', accent: '#FFC107' }
    }
  };

  /* ======================================================================
     PROCEDURAL TEXTURE CACHE & GENERATORS (Instant In-Memory Generation)
     ====================================================================== */
  var _texCache = {};

  function getCachedTexture(key, drawFn) {
    if (_texCache[key]) return _texCache[key];
    if (typeof document === 'undefined' || !document.createElement) return null;

    var canvas = document.createElement('canvas');
    drawFn(canvas);
    var tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    _texCache[key] = tex;
    return tex;
  }

  // 1. Carbon Fiber Twill Weave Pattern
  function getCarbonTexture() {
    return getCachedTexture('carbon_twill', function (cvs) {
      cvs.width = 64;
      cvs.height = 64;
      var ctx = cvs.getContext('2d');
      ctx.fillStyle = '#101114';
      ctx.fillRect(0, 0, 64, 64);

      var sz = 8;
      for (var y = 0; y < 64; y += sz) {
        for (var x = 0; x < 64; x += sz) {
          var isAlt = ((x / sz) + (y / sz)) % 2 === 0;
          var grad = ctx.createLinearGradient(x, y, x + sz, y + sz);
          if (isAlt) {
            grad.addColorStop(0, '#262930');
            grad.addColorStop(0.5, '#16181C');
            grad.addColorStop(1, '#0C0D0F');
          } else {
            grad.addColorStop(0, '#16181C');
            grad.addColorStop(0.5, '#2C3038');
            grad.addColorStop(1, '#131417');
          }
          ctx.fillStyle = grad;
          ctx.fillRect(x, y, sz, sz);

          ctx.fillStyle = isAlt ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.35)';
          ctx.fillRect(x + 1, y + 1, sz - 2, 1);
        }
      }
    });
  }

  // 2. High-Performance Motorcycle Tire Tread & Sidewall
  function getTireTexture(isSport, rimStripeColor) {
    var key = 'tire_' + (isSport ? 'sport' : 'classic') + '_' + (rimStripeColor || 'none');
    return getCachedTexture(key, function (cvs) {
      cvs.width = 512;
      cvs.height = 128;
      var ctx = cvs.getContext('2d');

      ctx.fillStyle = '#141416';
      ctx.fillRect(0, 0, 512, 128);

      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      for (var n = 0; n < 3000; n++) {
        ctx.fillRect(Math.random() * 512, Math.random() * 128, 1.5, 1.5);
      }

      var yCenter = 64;
      if (isSport) {
        ctx.strokeStyle = '#050506';
        ctx.lineWidth = 5.5;
        ctx.lineCap = 'round';
        for (var x = -20; x < 540; x += 32) {
          ctx.beginPath();
          ctx.moveTo(x, yCenter - 8);
          ctx.lineTo(x + 22, yCenter - 48);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(x + 16, yCenter + 8);
          ctx.lineTo(x + 38, yCenter + 48);
          ctx.stroke();
        }

        ctx.fillStyle = '#42454C';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText('DIABLO SUPERCORSA SP • 200/55 ZR17 • COMPETITION', 16, 16);
        ctx.fillText('DIABLO SUPERCORSA SP • 200/55 ZR17 • COMPETITION', 266, 16);
        ctx.fillText('MAX LOAD 320KG • TUBELESS • ROTATION ▶', 36, 116);
        ctx.fillText('MAX LOAD 320KG • TUBELESS • ROTATION ▶', 286, 116);
      } else {
        ctx.strokeStyle = '#050506';
        ctx.lineWidth = 6;
        for (var cx = 0; cx < 520; cx += 20) {
          ctx.beginPath();
          ctx.moveTo(cx, yCenter - 14);
          ctx.lineTo(cx + 10, yCenter + 14);
          ctx.lineTo(cx + 20, yCenter - 14);
          ctx.stroke();

          ctx.fillStyle = '#060608';
          ctx.fillRect(cx + 4, yCenter - 48, 10, 22);
          ctx.fillRect(cx + 4, yCenter + 26, 10, 22);
        }

        ctx.fillStyle = '#403D38';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText('ROYAL SPEEDMASTER • 3.50-19 4PR • HEAVY DUTY', 20, 16);
        ctx.fillText('ROYAL SPEEDMASTER • 3.50-19 4PR • HEAVY DUTY', 260, 16);
      }

      if (rimStripeColor) {
        ctx.fillStyle = rimStripeColor;
        ctx.fillRect(0, 0, 512, 4);
        ctx.fillRect(0, 124, 512, 4);
      }
    });
  }

  // 3. Ventilated Drilled Racing Brake Rotor
  function getDiscRotorTexture() {
    return getCachedTexture('brake_disc_ventilated', function (cvs) {
      cvs.width = 256;
      cvs.height = 256;
      var ctx = cvs.getContext('2d');
      var cx = 128, cy = 128;

      ctx.clearRect(0, 0, 256, 256);

      var grad = ctx.createRadialGradient(cx, cy, 55, cx, cy, 125);
      grad.addColorStop(0, '#282A2E');
      grad.addColorStop(0.3, '#E2E5EB');
      grad.addColorStop(0.65, '#9BA0A8');
      grad.addColorStop(0.9, '#D0D4DC');
      grad.addColorStop(1, '#1A1B1D');

      ctx.beginPath();
      ctx.arc(cx, cy, 124, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(cx, cy, 52, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      for (var r = 60; r < 122; r += 5) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      var holeCount = 36;
      for (var i = 0; i < holeCount; i++) {
        var ang = (i / holeCount) * Math.PI * 2;
        var r1 = 70 + (i % 3) * 18;
        var r2 = 78 + ((i + 1) % 3) * 16;
        var hx1 = cx + Math.cos(ang) * r1;
        var hy1 = cy + Math.sin(ang) * r1;
        var hx2 = cx + Math.cos(ang + 0.05) * r2;
        var hy2 = cy + Math.sin(ang + 0.05) * r2;

        ctx.fillStyle = '#08080A';
        ctx.beginPath();
        ctx.arc(hx1, hy1, 3.8, 0, Math.PI * 2);
        ctx.arc(hx2, hy2, 3.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.arc(hx1, hy1, 4.2, Math.PI * 0.2, Math.PI * 1.2);
        ctx.stroke();
      }

      for (var b = 0; b < 10; b++) {
        var bAng = (b / 10) * Math.PI * 2;
        var bx = cx + Math.cos(bAng) * 58;
        var by = cy + Math.sin(bAng) * 58;

        ctx.fillStyle = '#D4AF37';
        ctx.beginPath();
        ctx.arc(bx, by, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#08080A';
        ctx.beginPath();
        ctx.arc(bx, by, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  // 4. Digital Full-Color TFT Cockpit Display
  function getTFTDisplayTexture(themeKey) {
    return getCachedTexture('tft_dash_' + themeKey, function (cvs) {
      cvs.width = 256;
      cvs.height = 128;
      var ctx = cvs.getContext('2d');

      ctx.fillStyle = '#07090C';
      ctx.fillRect(0, 0, 256, 128);

      var bgGrad = ctx.createLinearGradient(0, 0, 256, 128);
      bgGrad.addColorStop(0, '#0D141C');
      bgGrad.addColorStop(1, '#060B12');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(6, 6, 244, 116);

      ctx.fillStyle = '#1A2836';
      ctx.fillRect(16, 14, 224, 12);

      var rpmGrad = ctx.createLinearGradient(16, 0, 240, 0);
      rpmGrad.addColorStop(0, '#38E1E4');
      rpmGrad.addColorStop(0.65, '#FFD54F');
      rpmGrad.addColorStop(0.85, '#FF3366');
      ctx.fillStyle = rpmGrad;
      ctx.fillRect(16, 14, 192, 12);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 8px monospace';
      ctx.fillText('0   2   4   6   8   10  12  14k', 18, 36);

      ctx.fillStyle = '#E8FFFF';
      ctx.font = 'bold 42px sans-serif';
      ctx.fillText('184', 70, 78);
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#38E1E4';
      ctx.fillText('KM/H', 156, 64);

      ctx.strokeStyle = '#FFB000';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(18, 50, 40, 48);
      ctx.fillStyle = '#FFB000';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('6', 29, 86);

      ctx.fillStyle = '#FF4488';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('❤️ JODI SYNC ONLINE', 18, 114);

      ctx.fillStyle = '#38E1E4';
      ctx.fillText('⚡ NITRO: 100%', 152, 114);
    });
  }

  // 5. Classic Motorcycle Tank Emblems & Badges
  function getTankBadgeTexture(themeKey) {
    return getCachedTexture('badge_' + themeKey, function (cvs) {
      cvs.width = 128;
      cvs.height = 64;
      var ctx = cvs.getContext('2d');
      ctx.clearRect(0, 0, 128, 64);

      if (themeKey === 'bullet') {
        ctx.fillStyle = '#D4AF37';
        ctx.beginPath();
        ctx.ellipse(64, 32, 54, 24, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#141416';
        ctx.beginPath();
        ctx.ellipse(64, 32, 48, 19, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#D4AF37';
        ctx.font = 'bold 14px "Baloo 2", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ROYAL', 64, 30);
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('— 350 —', 64, 43);
      } else if (themeKey === 'sport') {
        ctx.fillStyle = '#D6246E';
        ctx.fillRect(14, 10, 100, 44);
        ctx.fillStyle = '#FFB000';
        ctx.fillRect(18, 14, 92, 6);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('RANI #93', 64, 42);
      } else if (themeKey === 'turbo') {
        ctx.fillStyle = '#0B7A7C';
        ctx.fillRect(12, 12, 104, 40);
        ctx.strokeStyle = '#38E1E4';
        ctx.lineWidth = 3;
        ctx.strokeRect(14, 14, 100, 36);
        ctx.fillStyle = '#38E1E4';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('TURBO // V4', 64, 38);
      } else {
        ctx.fillStyle = '#DD4B00';
        ctx.beginPath();
        ctx.ellipse(64, 32, 52, 22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFD54F';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('KESAR GT', 64, 37);
      }
    });
  }

  // 6. Pro Racer Back Racing Number & Suit Livery Texture
  function getRiderBackTexture(themeKey) {
    return getCachedTexture('rider_back_' + themeKey, function (cvs) {
      cvs.width = 128;
      cvs.height = 128;
      var ctx = cvs.getContext('2d');

      var theme = BIKE_THEMES[themeKey] || BIKE_THEMES.sport;
      ctx.fillStyle = theme.riderSuit.primary;
      ctx.fillRect(0, 0, 128, 128);

      ctx.strokeStyle = theme.riderSuit.secondary;
      ctx.lineWidth = 4;
      ctx.strokeRect(6, 6, 116, 116);

      ctx.fillStyle = theme.riderSuit.secondary;
      ctx.beginPath();
      ctx.moveTo(10, 10);
      ctx.lineTo(64, 44);
      ctx.lineTo(118, 10);
      ctx.lineTo(118, 26);
      ctx.lineTo(64, 60);
      ctx.lineTo(10, 26);
      ctx.fill();

      var num = (themeKey === 'sport' ? '93' : (themeKey === 'bullet' ? '350' : (themeKey === 'turbo' ? '01' : '7')));
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 6;
      ctx.fillText(num, 64, 98);
      ctx.shadowBlur = 0;

      ctx.fillStyle = theme.riderSuit.accent;
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(theme.badgeText || 'RACING', 64, 32);
    });
  }

  // 7. Textured Heat-Wrap Tape (for Cafe Racer exhaust headers)
  function getHeatWrapTexture() {
    return getCachedTexture('heat_wrap_tape', function (cvs) {
      cvs.width = 64;
      cvs.height = 64;
      var ctx = cvs.getContext('2d');
      ctx.fillStyle = '#7A6B56';
      ctx.fillRect(0, 0, 64, 64);

      ctx.strokeStyle = '#4A3E30';
      ctx.lineWidth = 4;
      for (var y = -20; y < 84; y += 12) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(64, y + 24);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y + 1);
        ctx.lineTo(64, y + 25);
        ctx.stroke();
        ctx.strokeStyle = '#4A3E30';
        ctx.lineWidth = 4;
      }
    });
  }

  /* ======================================================================
     PREMIUM MATERIALS SUITE (PBR Automotive Clearcoat + Real Metal)
     ====================================================================== */
  function createMaterials(theme) {
    var carbonTex = getCarbonTexture();
    if (carbonTex) { carbonTex.repeat.set(4, 4); }

    var heatWrapTex = getHeatWrapTexture();
    if (heatWrapTex) { heatWrapTex.repeat.set(2, 6); }

    return {
      body: new THREE.MeshStandardMaterial({
        color: theme.bodyColor,
        metalness: theme.metalness,
        roughness: theme.roughness
      }),
      accent: new THREE.MeshStandardMaterial({
        color: theme.accentColor,
        metalness: 0.65,
        roughness: 0.22
      }),
      chrome: new THREE.MeshStandardMaterial({
        color: 0xF2F4F7,
        metalness: 0.98,
        roughness: 0.05
      }),
      chassisAlloy: new THREE.MeshStandardMaterial({
        color: theme.frameColor || 0x7E858E,
        metalness: 0.85,
        roughness: 0.28
      }),
      darkMetal: new THREE.MeshStandardMaterial({
        color: 0x18191C,
        metalness: 0.88,
        roughness: 0.32
      }),
      goldAlloy: new THREE.MeshStandardMaterial({
        color: theme.forkColor || 0xD4AF37,
        metalness: 0.92,
        roughness: 0.16
      }),
      carbonFiber: new THREE.MeshStandardMaterial({
        color: 0x22242A,
        map: carbonTex,
        roughness: 0.32,
        metalness: 0.45
      }),
      exhaustTitanium: new THREE.MeshStandardMaterial({
        color: 0x5D74A8,
        metalness: 0.95,
        roughness: 0.22
      }),
      heatWrap: new THREE.MeshStandardMaterial({
        color: 0x8A7B68,
        map: heatWrapTex,
        roughness: 0.88,
        metalness: 0.05
      }),
      tireSport: new THREE.MeshStandardMaterial({
        color: 0x18181A,
        map: getTireTexture(true, theme.rimStripe),
        metalness: 0.04,
        roughness: 0.86
      }),
      tireClassic: new THREE.MeshStandardMaterial({
        color: 0x18181A,
        map: getTireTexture(false, null),
        metalness: 0.04,
        roughness: 0.88
      }),
      brakeRotor: new THREE.MeshStandardMaterial({
        color: 0xDEE2E8,
        map: getDiscRotorTexture(),
        transparent: true,
        metalness: 0.94,
        roughness: 0.20
      }),
      caliper: new THREE.MeshStandardMaterial({
        color: theme.caliperColor,
        metalness: 0.70,
        roughness: 0.25
      }),
      leatherVintage: new THREE.MeshStandardMaterial({
        color: 0x362115,
        roughness: 0.76,
        metalness: 0.08
      }),
      leatherBlack: new THREE.MeshStandardMaterial({
        color: 0x141416,
        roughness: 0.70,
        metalness: 0.10
      }),
      cockpitScreen: new THREE.MeshBasicMaterial({
        map: getTFTDisplayTexture(theme.key)
      }),
      windscreen: new THREE.MeshStandardMaterial({
        color: 0x12222E,
        metalness: 0.25,
        roughness: 0.08,
        transparent: true,
        opacity: 0.65
      }),
      headlightLed: new THREE.MeshBasicMaterial({ color: 0xF2FFFF }),
      tailLed: new THREE.MeshBasicMaterial({ color: 0xFF1E38 }),
      cyberNeon: new THREE.MeshBasicMaterial({ color: 0x38E1E4 }),
      tankBadge: new THREE.MeshStandardMaterial({
        map: getTankBadgeTexture(theme.key),
        transparent: true,
        metalness: 0.85,
        roughness: 0.2
      }),
      visor: new THREE.MeshStandardMaterial({
        color: 0x111E26,
        metalness: 0.95,
        roughness: 0.06,
        transparent: true,
        opacity: 0.90
      }),
      suitPrimary: new THREE.MeshStandardMaterial({
        color: theme.riderSuit.primary,
        roughness: 0.62,
        metalness: 0.12
      }),
      suitAccent: new THREE.MeshStandardMaterial({
        color: theme.riderSuit.secondary,
        roughness: 0.50,
        metalness: 0.20
      }),
      suitBack: new THREE.MeshStandardMaterial({
        map: getRiderBackTexture(theme.key),
        roughness: 0.55,
        metalness: 0.15
      }),
      armorSlider: new THREE.MeshStandardMaterial({
        color: 0x32343A,
        metalness: 0.85,
        roughness: 0.22
      }),
      kneePuck: new THREE.MeshStandardMaterial({
        color: 0xF0F2F5,
        roughness: 0.35,
        metalness: 0.10
      })
    };
  }

  /* ======================================================================
     MODULAR SUB-ASSEMBLY: WHEEL & BRAKE SYSTEM
     ====================================================================== */
  function createModularWheel(mats, opts) {
    opts = opts || {};
    var isFront = !!opts.isFront;
    var spokeStyle = opts.spokeStyle || 'sport-y';
    var tireR = opts.tireR || 0.60;
    var tubeR = opts.tubeR || (isFront ? 0.12 : 0.18);
    var rimR = opts.rimR || 0.44;

    var wheelGroup = new THREE.Group();

    // 1. Profiled Tire Torus
    var tireMat = (spokeStyle === 'wire') ? mats.tireClassic : mats.tireSport;
    var tireGeo = new THREE.TorusGeometry(tireR, tubeR, 18, 44);
    tireGeo.rotateY(Math.PI / 2);
    var tireMesh = new THREE.Mesh(tireGeo, tireMat);
    tireMesh.castShadow = true;
    wheelGroup.add(tireMesh);

    // 2. Alloy Rim Ring
    var rimGeo = new THREE.TorusGeometry(rimR, 0.038, 12, 36);
    rimGeo.rotateY(Math.PI / 2);
    var rimMesh = new THREE.Mesh(rimGeo, mats.chrome);
    wheelGroup.add(rimMesh);

    // 3. Central Machined Hub & Axle Nut
    var hubGeo = new THREE.CylinderGeometry(0.11, 0.11, tubeR * 2.3, 16);
    hubGeo.rotateZ(Math.PI / 2);
    var hubMesh = new THREE.Mesh(hubGeo, mats.darkMetal);
    wheelGroup.add(hubMesh);

    var axleNut = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, tubeR * 2.6, 6), mats.goldAlloy);
    axleNut.rotateZ(Math.PI / 2);
    wheelGroup.add(axleNut);

    // 4. Rim Spokes Architecture
    if (spokeStyle === 'wire') {
      var spokeCount = 36;
      for (var s = 0; s < spokeCount; s++) {
        var sAng = (s / spokeCount) * Math.PI * 2;
        var offsetZ = (s % 2 === 0 ? 1 : -1) * (tubeR * 0.45);
        var spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, rimR * 0.95, 4), mats.chrome);
        spoke.position.set(offsetZ, Math.cos(sAng) * (rimR * 0.48), Math.sin(sAng) * (rimR * 0.48));
        spoke.rotation.x = sAng;
        spoke.rotation.z = (s % 2 === 0 ? 0.08 : -0.08);
        wheelGroup.add(spoke);
      }
    } else if (spokeStyle === 'turbo-turbine') {
      for (var t = 0; t < 3; t++) {
        var tAng = (t / 3) * Math.PI * 2;
        var blade = new THREE.Mesh(new THREE.BoxGeometry(tubeR * 0.9, rimR * 0.88, 0.06), mats.carbonFiber);
        blade.position.set(0, Math.cos(tAng) * (rimR * 0.46), Math.sin(tAng) * (rimR * 0.46));
        blade.rotation.x = tAng;
        blade.rotation.y = 0.22;
        wheelGroup.add(blade);
      }
    } else {
      for (var y = 0; y < 5; y++) {
        var yAng = (y / 5) * Math.PI * 2;
        var stem = new THREE.Mesh(new THREE.BoxGeometry(0.042, rimR * 0.48, 0.048), mats.darkMetal);
        stem.position.set(0, Math.cos(yAng) * (rimR * 0.28), Math.sin(yAng) * (rimR * 0.28));
        stem.rotation.x = yAng;
        wheelGroup.add(stem);

        for (var b = -1; b <= 1; b += 2) {
          var branch = new THREE.Mesh(new THREE.BoxGeometry(0.032, rimR * 0.42, 0.038), mats.darkMetal);
          var bAng = yAng + b * 0.14;
          branch.position.set(0, Math.cos(bAng) * (rimR * 0.68), Math.sin(bAng) * (rimR * 0.68));
          branch.rotation.x = bAng;
          wheelGroup.add(branch);
        }
      }
    }

    // 5. Ventilated Drilled Brake Discs
    if (isFront) {
      for (var side = -1; side <= 1; side += 2) {
        var discMesh = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.74, rimR * 0.74, 0.016, 24), mats.brakeRotor);
        discMesh.rotateZ(Math.PI / 2);
        discMesh.position.x = side * (tubeR * 0.88);
        wheelGroup.add(discMesh);
      }
    } else {
      var rearDisc = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.65, rimR * 0.65, 0.016, 24), mats.brakeRotor);
      rearDisc.rotateZ(Math.PI / 2);
      rearDisc.position.x = tubeR * 0.88;
      wheelGroup.add(rearDisc);

      // Lightweight Sprocket with Chain
      var sprocket = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.68, rimR * 0.68, 0.024, 28), mats.goldAlloy);
      sprocket.rotateZ(Math.PI / 2);
      sprocket.position.x = -tubeR * 0.88;
      wheelGroup.add(sprocket);
    }

    return wheelGroup;
  }

  /* ======================================================================
     MODULAR SUB-ASSEMBLY: BREMBO MONOBLOC RADIAL BRAKE CALIPER
     ====================================================================== */
  function createBrakeCaliper(mats, colorMat) {
    var group = new THREE.Group();

    // Caliper Body
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.16, 0.12), colorMat || mats.caliper);
    group.add(body);

    // Opposing Hydraulic Piston Caps
    for (var p = -1; p <= 1; p += 2) {
      var piston = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.01, 8), mats.chrome);
      piston.rotation.z = Math.PI / 2;
      piston.position.set(p * 0.034, 0.03, 0);
      group.add(piston);
    }

    // Bleed Nipple & Mounting Bolt Studs
    var nipple = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 6), mats.goldAlloy);
    nipple.position.set(0, 0.09, 0.02);
    group.add(nipple);

    // Braided Stainless Steel Hydraulic Line running upward
    var line = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.45, 6), mats.darkMetal);
    line.position.set(0, 0.28, 0.03);
    line.rotation.x = -0.15;
    group.add(line);

    return group;
  }

  /* ======================================================================
     MODULAR SUB-ASSEMBLY: PRO RACER RIDER SYSTEM
     ====================================================================== */
  function createMasterclassRacer(mats, themeKey, posture) {
    var riderGroup = new THREE.Group();
    var isUpright = (posture === 'upright');
    var isAggressive = (posture === 'aggressive');

    var seatY = isUpright ? 2.05 : (isAggressive ? 1.82 : 1.92);
    var baseLean = isUpright ? 0.14 : (isAggressive ? 0.54 : 0.38);

    // 1. Lower Pelvis & Leather Trousers
    var hips = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.32), mats.suitPrimary);
    hips.position.set(0, seatY, -0.52);
    riderGroup.add(hips);

    // 2. Anatomical V-Taper Racer Torso with Back Number & Speed Hump
    var torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, seatY + 0.34, -0.52 + Math.sin(baseLean) * 0.28);
    torsoGroup.rotation.x = baseLean;

    var chest = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.54, 0.34), mats.suitPrimary);
    torsoGroup.add(chest);

    var chestStripe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.52, 0.03), mats.suitAccent);
    chestStripe.position.set(0, 0, 0.17);
    torsoGroup.add(chestStripe);

    // Stitched Back Number Patch
    var backPatch = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.48), mats.suitBack);
    backPatch.position.set(0, 0.02, -0.172);
    backPatch.rotation.y = Math.PI;
    torsoGroup.add(backPatch);

    // Aerodynamic MotoGP Speed Hump
    var hump = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.44, 8), mats.suitAccent);
    hump.rotation.x = Math.PI * 0.78;
    hump.position.set(0, 0.14, -0.23);
    torsoGroup.add(hump);

    // Titanium Injected Shoulder Sliders
    for (var s = -1; s <= 1; s += 2) {
      var shSlider = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), mats.armorSlider);
      shSlider.scale.set(1.5, 0.85, 1.1);
      shSlider.position.set(s * 0.32, 0.22, 0);
      torsoGroup.add(shSlider);
    }
    riderGroup.add(torsoGroup);

    // 3. Wide MotoGP Flared Arms & Elbow Sliders
    for (var a = -1; a <= 1; a += 2) {
      var armUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.38, 8), mats.suitPrimary);
      armUpper.position.set(a * 0.34, seatY + 0.46, -0.32);
      armUpper.rotation.x = baseLean + 0.48;
      armUpper.rotation.z = -a * 0.28;
      riderGroup.add(armUpper);

      var elbowPuck = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.05), mats.armorSlider);
      elbowPuck.position.set(a * 0.42, seatY + 0.36, -0.38);
      riderGroup.add(elbowPuck);

      var forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.38, 8), mats.suitAccent);
      forearm.position.set(a * 0.36, seatY + 0.26, -0.06);
      forearm.rotation.x = baseLean + 0.98;
      forearm.rotation.z = a * 0.16;
      riderGroup.add(forearm);

      var glove = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), mats.suitPrimary);
      glove.scale.set(1, 0.8, 1.35);
      glove.position.set(a * 0.35, seatY + 0.18, 0.12);
      riderGroup.add(glove);
    }

    // 4. Ergonomic Racing Legs & Knee Drag Sliders (Pucks)
    for (var l = -1; l <= 1; l += 2) {
      var thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.46, 8), mats.suitPrimary);
      thigh.position.set(l * 0.25, seatY - 0.18, -0.30);
      thigh.rotation.x = -0.75;
      thigh.rotation.z = -l * 0.32;
      riderGroup.add(thigh);

      var kneePuck = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.06), mats.kneePuck);
      kneePuck.position.set(l * 0.36, seatY - 0.32, -0.15);
      kneePuck.rotation.y = -l * 0.38;
      riderGroup.add(kneePuck);

      var shin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.44, 8), mats.suitPrimary);
      shin.position.set(l * 0.26, seatY - 0.46, -0.42);
      shin.rotation.x = 0.85;
      riderGroup.add(shin);

      var boot = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.095, 0.22), mats.suitPrimary);
      boot.position.set(l * 0.26, seatY - 0.58, -0.48);
      riderGroup.add(boot);

      var toeSlider = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.045, 0.07), mats.armorSlider);
      toeSlider.position.set(l * 0.32, seatY - 0.59, -0.44);
      riderGroup.add(toeSlider);
    }

    // 5. Pro Aerodynamic Racing Helmet (AGV Pista Profile)
    var headY = seatY + 0.38 + Math.cos(baseLean) * 0.35;
    var headZ = -0.52 + Math.sin(baseLean) * 0.46;

    var helmetGroup = new THREE.Group();
    helmetGroup.position.set(0, headY, headZ);
    helmetGroup.rotation.x = baseLean * 0.45;

    var helmetShell = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), mats.suitAccent);
    helmetShell.scale.set(0.92, 1.05, 1.15);
    helmetGroup.add(helmetShell);

    var neckCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.12, 10), mats.suitPrimary);
    neckCollar.position.set(0, -0.14, -0.02);
    helmetGroup.add(neckCollar);

    var aeroSpoiler = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.16), mats.darkMetal);
    aeroSpoiler.position.set(0, 0.04, -0.22);
    aeroSpoiler.rotation.x = -0.25;
    helmetGroup.add(aeroSpoiler);

    var helmetStripe = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.34, 0.22), mats.suitPrimary);
    helmetStripe.position.set(0, 0.04, -0.12);
    helmetGroup.add(helmetStripe);

    var chinBar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.12), mats.darkMetal);
    chinBar.position.set(0, -0.12, 0.20);
    helmetGroup.add(chinBar);

    var visor = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), mats.visor);
    visor.rotation.x = Math.PI * 0.54;
    visor.position.set(0, -0.01, 0.12);
    helmetGroup.add(visor);

    var visorSpec = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.28, 4), mats.chrome);
    visorSpec.rotation.z = Math.PI / 2;
    visorSpec.position.set(0, 0.06, 0.23);
    helmetGroup.add(visorSpec);

    riderGroup.add(helmetGroup);

    riderGroup.updatePose = function (tiltAngle, isNitro, speed) {
      var hangOff = (tiltAngle || 0) * 0.45;
      torsoGroup.rotation.z = -hangOff * 0.35;
      torsoGroup.position.x = hangOff * 0.12;

      helmetGroup.rotation.z = hangOff * 0.25;

      var targetTuck = isNitro ? 0.20 : 0;
      torsoGroup.rotation.x = baseLean + targetTuck;
      helmetGroup.position.y = headY - (isNitro ? 0.06 : 0);
      helmetGroup.position.z = headZ + (isNitro ? 0.08 : 0);
    };

    return riderGroup;
  }

  /* ======================================================================
     MODULAR SUB-ASSEMBLY: COCKPIT, CONTROLS & STEERING
     ====================================================================== */
  function createModularCockpit(mats, style, themeKey) {
    var group = new THREE.Group();

    // Billet Aluminum Top Triple Clamp
    var tripleClamp = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.06, 0.14), mats.chassisAlloy);
    tripleClamp.position.set(0, 1.05, 0.02);
    group.add(tripleClamp);

    // Gold/Titanium Center Steering Stem Nut
    var stemNut = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 6), mats.goldAlloy);
    stemNut.position.set(0, 1.08, 0.02);
    group.add(stemNut);

    // Linear Hydraulic Steering Damper across steering head
    var damper = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.34, 8), mats.goldAlloy);
    damper.rotation.z = Math.PI / 2.8;
    damper.position.set(0.06, 1.02, -0.06);
    group.add(damper);

    if (style === 'cruiser-upright') {
      var barC = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.035, 8, 16, Math.PI), mats.chrome);
      barC.rotation.z = Math.PI;
      barC.position.set(0, 1.25, -0.05);
      group.add(barC);

      for (var cm = -1; cm <= 1; cm += 2) {
        var mStem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.24, 6), mats.chrome);
        mStem.position.set(cm * 0.38, 1.38, -0.05);
        mStem.rotation.z = -cm * 0.4;
        var mHead = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.02, 14), mats.chrome);
        mHead.position.set(cm * 0.46, 1.48, -0.05);
        mHead.rotation.x = Math.PI / 2;
        group.add(mStem, mHead);
      }
    } else if (style === 'cafe-bar-end') {
      for (var cb = -1; cb <= 1; cb += 2) {
        var cBar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.32, 8), mats.darkMetal);
        cBar.rotation.z = Math.PI / 2 + cb * 0.35;
        cBar.position.set(cb * 0.28, 0.96, 0.08);
        group.add(cBar);

        var bem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.018, 12), mats.darkMetal);
        bem.position.set(cb * 0.44, 0.92, 0.08);
        bem.rotation.z = Math.PI / 2;
        group.add(bem);
      }
    } else {
      // Racing Clip-ons Clamped below Triple Tree
      for (var rb = -1; rb <= 1; rb += 2) {
        var rBar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.30, 8), mats.darkMetal);
        rBar.rotation.z = Math.PI / 2 + rb * 0.22;
        rBar.position.set(rb * 0.28, 1.02, 0.06);
        group.add(rBar);

        var grip = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.16, 8), mats.leatherBlack);
        grip.rotation.z = rBar.rotation.z;
        grip.position.set(rb * 0.38, 1.00, 0.06);
        group.add(grip);

        var barEnd = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.04, 8), mats.goldAlloy);
        barEnd.rotation.z = rBar.rotation.z;
        barEnd.position.set(rb * 0.47, 0.98, 0.06);
        group.add(barEnd);
      }
    }

    if (style === 'cruiser-upright') {
      var speedo = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.08, 0.08, 16), mats.chrome);
      speedo.rotation.x = Math.PI * 0.25;
      speedo.position.set(0, 1.28, 0.08);
      group.add(speedo);
    } else {
      // Full Color TFT Screen
      var dashBody = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.15, 0.04), mats.darkMetal);
      dashBody.position.set(0, 1.25, 0.08);
      dashBody.rotation.x = Math.PI * 0.22;
      group.add(dashBody);

      var screen = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.12), mats.cockpitScreen);
      screen.position.set(0, 1.25, 0.102);
      screen.rotation.x = dashBody.rotation.x;
      group.add(screen);

      // Translucent Gold Fluid Reservoir
      var res = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.06, 10), mats.goldAlloy);
      res.position.set(0.36, 1.16, 0.10);
      group.add(res);
    }

    return group;
  }

  /* ======================================================================
     MODULAR SUB-ASSEMBLY: NITRO FLAME SYSTEM
     ====================================================================== */
  function createNitroFlame() {
    var outGeom = new THREE.ConeGeometry(0.20, 1.2, 10);
    outGeom.rotateX(-Math.PI / 2);
    var outMat = new THREE.MeshBasicMaterial({ color: 0x38E1E4, transparent: true, opacity: 0 });
    var outerCone = new THREE.Mesh(outGeom, outMat);

    var inGeom = new THREE.ConeGeometry(0.10, 0.85, 8);
    inGeom.rotateX(-Math.PI / 2);
    var inMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0 });
    var innerCone = new THREE.Mesh(inGeom, inMat);
    outerCone.add(innerCone);

    var flameProxy = {
      set opacity(val) {
        outMat.opacity = val;
        inMat.opacity = val > 0 ? Math.min(1, val * 1.25) : 0;
      },
      get opacity() { return outMat.opacity; }
    };

    outerCone.material = flameProxy;
    return outerCone;
  }

  /* ======================================================================
     BIKE 1: RANI NEON SPORT (1000cc MotoGP Superbike with Winglets)
     ====================================================================== */
  function buildSportBike(mats) {
    var bike = new THREE.Group();

    // 1. Rear Wheel Assembly (Fat 200/55 ZR17 Superbike Rear Tire)
    var rearWheel = createModularWheel(mats, { spokeStyle: 'sport-y', isFront: false, tireR: 0.60, tubeR: 0.18, rimR: 0.44 });
    rearWheel.position.set(0, 0.72, -1.3);
    bike.add(rearWheel);
    bike.rearWheel = rearWheel;

    // Carbon Rear Hugger
    var hugger = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.74, 0.28, 14, 1, true, 0, Math.PI * 0.58), mats.carbonFiber);
    hugger.rotation.z = Math.PI / 2;
    hugger.position.set(0, 0.76, -1.35);
    bike.add(hugger);

    // 2. Front Fork Steerable Assembly (Z = 1.4)
    var frontFork = new THREE.Group();
    frontFork.position.set(0, 0, 1.4);

    var frontWheel = createModularWheel(mats, { spokeStyle: 'sport-y', isFront: true, tireR: 0.60, tubeR: 0.12, rimR: 0.44 });
    frontWheel.position.set(0, 0.72, 0);
    frontFork.add(frontWheel);
    bike.frontWheel = frontWheel;

    // Gold Inverted USD Forks & Radial Dropouts
    for (var f = -1; f <= 1; f += 2) {
      var forkUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.72, 10), mats.goldAlloy);
      forkUpper.position.set(f * 0.22, 1.15, -0.05);
      forkUpper.rotation.x = -Math.PI / 7.2;

      var forkLower = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.75, 10), mats.chrome);
      forkLower.position.set(f * 0.22, 0.75, 0.04);
      forkLower.rotation.x = -Math.PI / 7.2;

      // Radial Mount Brembo Caliper
      var caliper = createBrakeCaliper(mats, mats.caliper);
      caliper.position.set(f * 0.14, 0.68, 0.08);
      frontFork.add(forkUpper, forkLower, caliper);
    }

    var frontFender = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.74, 0.22, 14, 1, true, Math.PI * 0.2, Math.PI * 0.65), mats.carbonFiber);
    frontFender.rotation.z = Math.PI / 2;
    frontFender.position.set(0, 0.76, 0.02);
    frontFork.add(frontFender);

    // Predatory Twin-Slit LED Projectors
    for (var hl = -1; hl <= 1; hl += 2) {
      var slit = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.14), mats.headlightLed);
      slit.position.set(hl * 0.15, 1.48, 0.48);
      slit.rotation.y = hl * 0.25;
      slit.rotation.x = -0.15;
      frontFork.add(slit);
    }

    frontFork.add(createModularCockpit(mats, 'racing-clipon', 'sport'));

    bike.add(frontFork);
    bike.frontFork = frontFork;

    // 3. Aluminum Twin-Spar Frame & Aerodynamic Fairing
    for (var sp = -1; sp <= 1; sp += 2) {
      var spar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 1.45), mats.chassisAlloy);
      spar.position.set(sp * 0.28, 1.25, 0.12);
      spar.rotation.y = -sp * 0.08;
      bike.add(spar);
    }

    var fairing = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.25, 12), mats.body);
    fairing.scale.set(0.95, 1.15, 0.65);
    fairing.rotation.x = -Math.PI / 2.35;
    fairing.position.set(0, 1.48, 1.05);
    bike.add(fairing);

    // MotoGP Bi-Plane Carbon Downforce Winglets
    for (var w = -1; w <= 1; w += 2) {
      var winglet = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.18), mats.carbonFiber);
      winglet.position.set(w * 0.38, 1.40, 1.15);
      winglet.rotation.z = -w * 0.18;
      winglet.rotation.y = -w * 0.12;
      bike.add(winglet);
    }

    var screen = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), mats.windscreen);
    screen.rotation.x = Math.PI * 0.65;
    screen.position.set(0, 1.74, 0.95);
    bike.add(screen);

    // 4. 1000cc V4 Engine + Curved Honeycomb Radiator
    var engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.54, 0.72), mats.darkMetal);
    engineBlock.position.set(0, 0.88, -0.15);
    bike.add(engineBlock);

    var radiator = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.38, 0.08), mats.chassisAlloy);
    radiator.position.set(0, 1.02, 0.48);
    radiator.rotation.x = 0.18;
    bike.add(radiator);

    // 4 Titanium Exhaust Headers with Rainbow Heat Burn
    for (var eh = 0; eh < 4; eh++) {
      var hX = -0.18 + eh * 0.12;
      var header = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.75, 8), mats.exhaustTitanium);
      header.position.set(hX, 0.78, 0.22 - eh * 0.02);
      header.rotation.x = Math.PI * 0.32;
      bike.add(header);
    }

    // Dual Upswept Akrapovič-Style Carbon Mufflers
    for (var mx = -1; mx <= 1; mx += 2) {
      var muffler = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.65, 6), mats.carbonFiber);
      muffler.rotation.x = Math.PI * 0.42;
      muffler.position.set(mx * 0.24, 1.05, -1.35);
      bike.add(muffler);

      var endCap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.08, 6), mats.darkMetal);
      endCap.rotation.x = muffler.rotation.x;
      endCap.position.set(mx * 0.24, 1.24, -1.64);
      bike.add(endCap);

      var hole = new THREE.Mesh(new THREE.CircleGeometry(0.04, 10), mats.darkMetal);
      hole.position.set(mx * 0.24, 1.26, -1.69);
      hole.rotation.x = Math.PI * 0.42;
      bike.add(hole);
    }

    var exhaustFlame = createNitroFlame();
    exhaustFlame.position.set(0.24, 1.28, -2.05);
    bike.add(exhaustFlame);
    bike.exhaustFlame = exhaustFlame;

    // 5. Fuel Tank, Seat & Hollow Tail Cowl
    var tank = new THREE.Mesh(new THREE.SphereGeometry(0.52, 16, 16), mats.body);
    tank.scale.set(0.72, 0.58, 1.35);
    tank.position.set(0, 1.58, 0.32);
    bike.add(tank);

    var tankStripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 1.15), mats.accent);
    tankStripe.position.set(0, 1.62, 0.32);
    bike.add(tankStripe);

    for (var tb = -1; tb <= 1; tb += 2) {
      var badge = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.09), mats.tankBadge);
      badge.position.set(tb * 0.38, 1.58, 0.32);
      badge.rotation.y = tb * (Math.PI / 2);
      bike.add(badge);
    }

    var riderSeat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.48), mats.leatherBlack);
    riderSeat.position.set(0, 1.48, -0.42);
    bike.add(riderSeat);

    var tailCowl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 0.70), mats.body);
    tailCowl.position.set(0, 1.60, -1.05);
    tailCowl.rotation.x = 0.08;
    bike.add(tailCowl);

    for (var tl = -1; tl <= 1; tl += 2) {
      var tailBlade = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.14, 0.04), mats.tailLed);
      tailBlade.position.set(tl * 0.12, 1.62, -1.42);
      bike.add(tailBlade);
    }

    // 6. Pro Racer Rider
    var racer = createMasterclassRacer(mats, 'sport', 'aggressive');
    bike.add(racer);
    bike.rider = racer;

    bike.scale.set(1.4, 1.4, 1.4);
    return bike;
  }

  /* ======================================================================
     BIKE 2: ROYAL BULLET 350 (Heavy Metal Heritage Indian Cruiser)
     ====================================================================== */
  function buildBulletBike(mats) {
    var bike = new THREE.Group();

    var rearWheel = createModularWheel(mats, { spokeStyle: 'wire', isFront: false, tireR: 0.60, tubeR: 0.14, rimR: 0.44 });
    rearWheel.position.set(0, 0.72, -1.3);
    bike.add(rearWheel);
    bike.rearWheel = rearWheel;

    var rearFender = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.26, 16, 1, true, 0, Math.PI * 0.95), mats.body);
    rearFender.rotation.z = Math.PI / 2;
    rearFender.position.set(0, 0.76, -1.35);
    bike.add(rearFender);

    for (var fs = -1; fs <= 1; fs += 2) {
      var stay = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.85, 6), mats.chrome);
      stay.position.set(fs * 0.20, 0.82, -1.45);
      stay.rotation.x = Math.PI * 0.32;
      bike.add(stay);
    }

    var frontFork = new THREE.Group();
    frontFork.position.set(0, 0, 1.4);

    var frontWheel = createModularWheel(mats, { spokeStyle: 'wire', isFront: true, tireR: 0.60, tubeR: 0.12, rimR: 0.44 });
    frontWheel.position.set(0, 0.72, 0);
    frontFork.add(frontWheel);
    bike.frontWheel = frontWheel;

    for (var bf = -1; bf <= 1; bf += 2) {
      var tube = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 1.45, 10), mats.chrome);
      tube.position.set(bf * 0.24, 0.96, -0.02);
      tube.rotation.x = -Math.PI / 8.5;

      var gaiter = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.32, 10), mats.leatherBlack);
      gaiter.position.set(bf * 0.24, 0.78, 0.05);
      gaiter.rotation.x = tube.rotation.x;
      frontFork.add(tube, gaiter);
    }

    var frontFender = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.24, 16, 1, true, Math.PI * 0.15, Math.PI * 0.78), mats.body);
    frontFender.rotation.z = Math.PI / 2;
    frontFender.position.set(0, 0.76, 0.04);
    frontFork.add(frontFender);

    var nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.18, 16), mats.chrome);
    nacelle.rotation.x = Math.PI / 2;
    nacelle.position.set(0, 1.62, 0.32);
    frontFork.add(nacelle);

    var mainLamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 14), mats.headlightLed);
    mainLamp.position.set(0, 1.62, 0.42);
    frontFork.add(mainLamp);

    for (var te = -1; te <= 1; te += 2) {
      var pilotLamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), mats.headlightLed);
      pilotLamp.position.set(te * 0.22, 1.70, 0.34);
      frontFork.add(pilotLamp);
    }

    frontFork.add(createModularCockpit(mats, 'cruiser-upright', 'bullet'));

    bike.add(frontFork);
    bike.frontFork = frontFork;

    var frameCradle = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 2.1, 8), mats.darkMetal);
    frameCradle.rotation.x = Math.PI / 3.0;
    frameCradle.position.set(0, 1.12, 0.05);
    bike.add(frameCradle);

    var engineGroup = new THREE.Group();
    engineGroup.position.set(0, 0.88, -0.15);

    var cylinderHead = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.52, 12), mats.darkMetal);
    engineGroup.add(cylinderHead);

    for (var fin = 0; fin < 8; fin++) {
      var finPlate = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.022, 0.56), mats.chassisAlloy);
      finPlate.position.y = -0.22 + fin * 0.06;
      engineGroup.add(finPlate);
    }

    for (var pr = -1; pr <= 1; pr += 2) {
      var pushrod = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.44, 8), mats.chrome);
      pushrod.position.set(pr * 0.08, 0.02, 0.22);
      engineGroup.add(pushrod);
    }

    var crankcase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 16), mats.chrome);
    crankcase.rotation.z = Math.PI / 2;
    crankcase.position.set(0.28, -0.15, 0);
    engineGroup.add(crankcase);

    bike.add(engineGroup);

    var headerPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.1, 10), mats.chrome);
    headerPipe.rotation.x = Math.PI * 0.38;
    headerPipe.position.set(0.32, 0.65, 0.15);
    bike.add(headerPipe);

    var bottleSilencer = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.6, 12), mats.chrome);
    bottleSilencer.rotation.x = Math.PI / 2.12;
    bottleSilencer.position.set(0.32, 0.46, -1.25);
    bike.add(bottleSilencer);

    var exhaustFlame = createNitroFlame();
    exhaustFlame.position.set(0.32, 0.46, -2.25);
    bike.add(exhaustFlame);
    bike.exhaustFlame = exhaustFlame;

    var tank = new THREE.Mesh(new THREE.SphereGeometry(0.58, 16, 16), mats.body);
    tank.scale.set(0.66, 0.60, 1.30);
    tank.position.set(0, 1.58, 0.34);
    bike.add(tank);

    for (var ps = -1; ps <= 1; ps += 2) {
      var pinstripe = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.012, 6, 16), mats.accent);
      pinstripe.rotation.y = Math.PI / 2;
      pinstripe.position.set(ps * 0.32, 1.58, 0.34);
      bike.add(pinstripe);

      var pad = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.38), mats.leatherBlack);
      pad.position.set(ps * 0.34, 1.45, 0.20);
      bike.add(pad);

      var badge = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.09), mats.tankBadge);
      badge.position.set(ps * 0.36, 1.60, 0.34);
      badge.rotation.y = ps * (Math.PI / 2);
      bike.add(badge);
    }

    var soloSeat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.58), mats.leatherVintage);
    soloSeat.position.set(0, 1.44, -0.44);
    bike.add(soloSeat);

    for (var sp = -1; sp <= 1; sp += 2) {
      var seatSpring = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.20, 8), mats.chrome);
      seatSpring.position.set(sp * 0.16, 1.30, -0.66);
      bike.add(seatSpring);
    }

    var tailLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.05, 12), mats.tailLed);
    tailLamp.rotation.x = Math.PI / 2;
    tailLamp.position.set(0, 1.35, -1.55);
    bike.add(tailLamp);

    var rider = createMasterclassRacer(mats, 'bullet', 'upright');
    bike.add(rider);
    bike.rider = rider;

    bike.scale.set(1.4, 1.4, 1.4);
    return bike;
  }

  /* ======================================================================
     BIKE 3: MOR TEAL TURBO (Supercharged Hyper-Streetfighter)
     ====================================================================== */
  function buildTurboBike(mats) {
    var bike = new THREE.Group();

    var rearWheel = createModularWheel(mats, { spokeStyle: 'turbo-turbine', isFront: false, tireR: 0.60, tubeR: 0.19, rimR: 0.44 });
    rearWheel.position.set(0, 0.72, -1.3);
    bike.add(rearWheel);
    bike.rearWheel = rearWheel;

    var singleArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 1.35), mats.darkMetal);
    singleArm.position.set(-0.24, 0.68, -0.62);
    bike.add(singleArm);

    var frontFork = new THREE.Group();
    frontFork.position.set(0, 0, 1.4);

    var frontWheel = createModularWheel(mats, { spokeStyle: 'turbo-turbine', isFront: true, tireR: 0.60, tubeR: 0.12, rimR: 0.44 });
    frontWheel.position.set(0, 0.72, 0);
    frontFork.add(frontWheel);
    bike.frontWheel = frontWheel;

    for (var tf = -1; tf <= 1; tf += 2) {
      var forkU = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.72, 10), mats.darkMetal);
      forkU.position.set(tf * 0.22, 1.15, -0.05);
      forkU.rotation.x = -Math.PI / 7.2;

      var forkL = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.75, 10), mats.chrome);
      forkL.position.set(tf * 0.22, 0.75, 0.04);
      forkL.rotation.x = -Math.PI / 7.2;

      var cal = createBrakeCaliper(mats, mats.caliper);
      cal.position.set(tf * 0.14, 0.68, 0.08);
      frontFork.add(forkU, forkL, cal);
    }

    var mask = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.26, 0.16), mats.darkMetal);
    mask.position.set(0, 1.48, 0.46);
    mask.rotation.x = 0.22;
    frontFork.add(mask);

    for (var ql = -1; ql <= 1; ql += 2) {
      var projTop = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.04, 10), mats.headlightLed);
      projTop.rotation.x = Math.PI / 2;
      projTop.position.set(ql * 0.11, 1.54, 0.54);
      var projBot = projTop.clone();
      projBot.position.set(ql * 0.07, 1.44, 0.56);
      frontFork.add(projTop, projBot);
    }

    frontFork.add(createModularCockpit(mats, 'racing-clipon', 'turbo'));

    bike.add(frontFork);
    bike.frontFork = frontFork;

    var trellisPts = [
      [[-0.22, 1.52, 0.45], [-0.28, 1.05, -0.28]],
      [[0.22, 1.52, 0.45], [0.28, 1.05, -0.28]],
      [[-0.28, 1.05, -0.28], [0.28, 1.05, -0.28]],
      [[-0.28, 1.05, -0.28], [-0.20, 0.78, -1.05]],
      [[0.28, 1.05, -0.28], [0.20, 0.78, -1.05]],
      [[-0.22, 1.52, 0.45], [0, 1.62, 0.15]],
      [[0.22, 1.52, 0.45], [0, 1.62, 0.15]]
    ];
    trellisPts.forEach(function (seg) {
      var a = new THREE.Vector3(seg[0][0], seg[0][1], seg[0][2]);
      var b = new THREE.Vector3(seg[1][0], seg[1][1], seg[1][2]);
      var len = a.distanceTo(b);
      var tube = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, len, 8), mats.chassisAlloy);
      tube.position.copy(a).lerp(b, 0.5);
      tube.lookAt(b);
      tube.rotateX(Math.PI / 2);
      bike.add(tube);
    });

    var supercharger = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.14, 16), mats.darkMetal);
    supercharger.rotation.z = Math.PI / 2;
    supercharger.position.set(0.30, 0.95, -0.05);
    bike.add(supercharger);

    var turbineGlow = new THREE.Mesh(new THREE.CircleGeometry(0.14, 14), mats.cyberNeon);
    turbineGlow.rotation.y = Math.PI / 2;
    turbineGlow.position.set(0.38, 0.95, -0.05);
    bike.add(turbineGlow);

    var engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.60, 0.78), mats.darkMetal);
    engineBlock.position.set(0, 0.90, -0.18);
    bike.add(engineBlock);

    for (var ex = -1; ex <= 1; ex += 2) {
      var pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.52, 10), mats.exhaustTitanium);
      pipe.rotation.x = Math.PI * 0.45;
      pipe.rotation.y = ex * 0.15;
      pipe.position.set(ex * 0.24, 0.62, -1.48);
      bike.add(pipe);
    }

    var exhaustFlame = createNitroFlame();
    exhaustFlame.position.set(0.24, 0.62, -1.95);
    bike.add(exhaustFlame);
    bike.exhaustFlame = exhaustFlame;

    var tank = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.52, 0.82), mats.body);
    tank.position.set(0, 1.54, 0.20);
    tank.rotation.x = 0.08;
    bike.add(tank);

    var tankHump = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), mats.body);
    tankHump.scale.set(1.0, 0.8, 1.1);
    tankHump.position.set(0, 1.80, 0.04);
    bike.add(tankHump);

    var seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.52), mats.leatherBlack);
    seat.position.set(0, 1.48, -0.55);
    bike.add(seat);

    var neonTail = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.035, 0.05), mats.cyberNeon);
    neonTail.position.set(0, 1.42, -1.55);
    bike.add(neonTail);

    var racer = createMasterclassRacer(mats, 'turbo', 'sport');
    bike.add(racer);
    bike.rider = racer;

    bike.scale.set(1.4, 1.4, 1.4);
    return bike;
  }

  /* ======================================================================
     BIKE 4: KESAR CAFE RACER (Neo-Retro 650cc Twin Custom)
     ====================================================================== */
  function buildCafeBike(mats) {
    var bike = new THREE.Group();

    var rearWheel = createModularWheel(mats, { spokeStyle: 'sport-y', isFront: false, tireR: 0.60, tubeR: 0.15, rimR: 0.44 });
    rearWheel.position.set(0, 0.72, -1.3);
    bike.add(rearWheel);
    bike.rearWheel = rearWheel;

    for (var rs = -1; rs <= 1; rs += 2) {
      var shockBody = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.65, 8), mats.goldAlloy);
      shockBody.position.set(rs * 0.28, 1.02, -0.92);
      shockBody.rotation.x = Math.PI * 0.22;
      var reservoir = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.22, 8), mats.goldAlloy);
      reservoir.position.set(rs * 0.34, 1.20, -0.84);
      bike.add(shockBody, reservoir);
    }

    var frontFork = new THREE.Group();
    frontFork.position.set(0, 0, 1.4);

    var frontWheel = createModularWheel(mats, { spokeStyle: 'sport-y', isFront: true, tireR: 0.60, tubeR: 0.12, rimR: 0.44 });
    frontWheel.position.set(0, 0.72, 0);
    frontFork.add(frontWheel);
    bike.frontWheel = frontWheel;

    for (var cf = -1; cf <= 1; cf += 2) {
      var forkU = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.72, 10), mats.goldAlloy);
      forkU.position.set(cf * 0.23, 1.15, -0.05);
      forkU.rotation.x = -Math.PI / 7.5;

      var forkL = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.75, 10), mats.chrome);
      forkL.position.set(cf * 0.23, 0.75, 0.04);
      forkL.rotation.x = -Math.PI / 7.5;

      var cal = createBrakeCaliper(mats, mats.caliper);
      cal.position.set(cf * 0.14, 0.68, 0.08);
      frontFork.add(forkU, forkL, cal);
    }

    var headlamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 14), mats.headlightLed);
    headlamp.position.set(0, 1.55, 0.42);
    frontFork.add(headlamp);

    var rimBezel = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.024, 8, 16), mats.darkMetal);
    rimBezel.position.set(0, 1.55, 0.42);
    frontFork.add(rimBezel);

    for (var xg = -1; xg <= 1; xg += 2) {
      var tape = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.32, 0.01), mats.darkMetal);
      tape.position.set(0, 1.55, 0.58);
      tape.rotation.z = xg * (Math.PI / 4);
      frontFork.add(tape);
    }

    frontFork.add(createModularCockpit(mats, 'cafe-bar-end', 'cafe'));

    bike.add(frontFork);
    bike.frontFork = frontFork;

    var frameMain = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 2.05, 8), mats.darkMetal);
    frameMain.rotation.x = Math.PI / 3.15;
    frameMain.position.set(0, 1.12, 0.05);
    bike.add(frameMain);

    var engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.55, 0.72), mats.darkMetal);
    engineBlock.position.set(0, 0.88, -0.15);
    bike.add(engineBlock);

    for (var cv = -1; cv <= 1; cv += 2) {
      var cover = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.10, 14), mats.chrome);
      cover.rotation.z = Math.PI / 2;
      cover.position.set(cv * 0.32, 0.82, -0.15);
      bike.add(cover);
    }

    for (var hw = -1; hw <= 1; hw += 2) {
      var wrapPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.1, 10), mats.heatWrap);
      wrapPipe.position.set(hw * 0.22, 0.68, 0.12);
      wrapPipe.rotation.x = Math.PI * 0.38;
      bike.add(wrapPipe);
    }

    for (var rc = -1; rc <= 1; rc += 2) {
      var mega = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.07, 1.35, 12), mats.chrome);
      mega.rotation.x = Math.PI / 2.22;
      mega.position.set(rc * 0.30, 0.52, -1.15);
      bike.add(mega);
    }

    var exhaustFlame = createNitroFlame();
    exhaustFlame.position.set(0.30, 0.52, -1.95);
    bike.add(exhaustFlame);
    bike.exhaustFlame = exhaustFlame;

    var tank = new THREE.Mesh(new THREE.SphereGeometry(0.58, 16, 16), mats.body);
    tank.scale.set(0.58, 0.52, 1.48);
    tank.position.set(0, 1.58, 0.28);
    bike.add(tank);

    var strap = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.54, 1.25), mats.leatherVintage);
    strap.position.set(0, 1.62, 0.28);
    bike.add(strap);

    var buckle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.08), mats.goldAlloy);
    buckle.position.set(0, 1.88, 0.36);
    bike.add(buckle);

    var seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.13, 0.55), mats.leatherVintage);
    seat.position.set(0, 1.46, -0.48);
    bike.add(seat);

    for (var r = 0; r < 5; r++) {
      var rib = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.025, 0.05), mats.darkMetal);
      rib.position.set(0, 1.53, -0.68 + r * 0.10);
      bike.add(rib);
    }

    var rearCowl = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 14), mats.body);
    rearCowl.scale.set(0.95, 0.72, 1.35);
    rearCowl.position.set(0, 1.55, -0.92);
    bike.add(rearCowl);

    var tail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12), mats.tailLed);
    tail.rotation.x = Math.PI / 2;
    tail.position.set(0, 1.52, -1.35);
    bike.add(tail);

    var racer = createMasterclassRacer(mats, 'cafe', 'sport');
    bike.add(racer);
    bike.rider = racer;

    bike.scale.set(1.4, 1.4, 1.4);
    return bike;
  }

  /* ======================================================================
     PUBLIC FACTORY ENTRY POINT
     ====================================================================== */
  function buildRealisticBike(themeKey) {
    var key = themeKey || 'sport';
    var theme = BIKE_THEMES[key] || BIKE_THEMES.sport;
    var mats = createMaterials(theme);

    var bike;
    switch (key) {
      case 'bullet': bike = buildBulletBike(mats); break;
      case 'turbo': bike = buildTurboBike(mats); break;
      case 'cafe': bike = buildCafeBike(mats); break;
      case 'sport':
      default: bike = buildSportBike(mats); break;
    }

    bike.traverse(function (obj) {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    return bike;
  }

  global.JodiRaceModels = {
    BIKE_THEMES: BIKE_THEMES,
    buildRealisticBike: buildRealisticBike
  };
})(window);