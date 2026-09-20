/* Jodi Race - 3D Realistic Motorcycle Models & Themes Engine
   Pure procedural Three.js (r128) geometry + PBR MeshStandardMaterial.
   4 distinct hyper-realistic bikes: bullet, sport, turbo, cafe.
   ------------------------------------------------------------------
   ENGINE CONTRACT (do not break):
     bike.frontWheel  -> mesh/group, animated via frontWheel.rotation.x += spin
     bike.rearWheel   -> mesh/group, animated via rearWheel.rotation.x += spin
     bike.frontFork   -> steerable group (handlebars+fork+frontWheel),
                         steered via frontFork.rotation.y = -turnRate * 0.45
     bike.exhaustFlame-> mesh, material.opacity settable 0..1 for Nitro boost
     bike.rider       -> rider group attached to bike
     Orientation: forward = +Z, up = +Y, right = +X
     Wheelbase / pivot positions preserved from the original baseline so
     existing physics / camera / ground-contact tuning keeps working.
*/
(function (global) {
  'use strict';

  // ================= 4 Hyper-Realistic Color Themes =================
  var BIKE_THEMES = {
    bullet: {
      name: 'Royal Bullet 350',
      bodyColor: 0x1A1A1A,
      accentColor: 0xE6C280,
      metalColor: 0xE8E8E8,
      specular: 0x999999,
      roughness: 0.28,
      metalness: 0.55
    },
    sport: {
      name: 'Rani Neon Sport',
      bodyColor: 0xD6246E,
      accentColor: 0xFFB000,
      metalColor: 0x1c1c1e,
      specular: 0xFF88AA,
      roughness: 0.18,
      metalness: 0.55
    },
    turbo: {
      name: 'Mor Teal Turbo',
      bodyColor: 0x0B7A7C,
      accentColor: 0x38E1E4,
      metalColor: 0x262626,
      specular: 0x88EEEE,
      roughness: 0.25,
      metalness: 0.65
    },
    cafe: {
      name: 'Kesar Cafe Racer',
      bodyColor: 0xE65100,
      accentColor: 0xFFD54F,
      metalColor: 0xCFCFCF,
      specular: 0xFFA726,
      roughness: 0.24,
      metalness: 0.6
    }
  };

  /* ======================================================================
     SHARED HELPERS
     ====================================================================== */

  function createMaterials(theme) {
    return {
      body: new THREE.MeshStandardMaterial({ color: theme.bodyColor, metalness: theme.metalness, roughness: theme.roughness }),
      accent: new THREE.MeshStandardMaterial({ color: theme.accentColor, metalness: 0.75, roughness: 0.25 }),
      chrome: new THREE.MeshStandardMaterial({ color: 0xEDEDED, metalness: 0.95, roughness: 0.08 }),
      darkMetal: new THREE.MeshStandardMaterial({ color: 0x1c1c1e, metalness: 0.8, roughness: 0.35 }),
      engineAlloy: new THREE.MeshStandardMaterial({ color: 0xB8BCC0, metalness: 0.85, roughness: 0.3 }),
      tire: new THREE.MeshStandardMaterial({ color: 0x121212, metalness: 0.05, roughness: 0.92 }),
      leather: new THREE.MeshStandardMaterial({ color: 0x2b1608, metalness: 0.1, roughness: 0.75 }),
      leatherBrown: new THREE.MeshStandardMaterial({ color: 0x4a2c14, metalness: 0.05, roughness: 0.8 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xD4AF37, metalness: 0.9, roughness: 0.22 }),
      glassTint: new THREE.MeshStandardMaterial({ color: 0x142530, metalness: 0.3, roughness: 0.12, transparent: true, opacity: 0.55 }),
      visor: new THREE.MeshStandardMaterial({ color: 0x0c1a22, metalness: 0.6, roughness: 0.1, transparent: true, opacity: 0.85 }),
      led: new THREE.MeshBasicMaterial({ color: 0xE8FFFF }),
      redLed: new THREE.MeshBasicMaterial({ color: 0xff2b2b }),
      amberLed: new THREE.MeshBasicMaterial({ color: 0xffa500 }),
      screenGlow: new THREE.MeshBasicMaterial({ color: 0x3fd0ff }),
      rubber: new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.9 }),
      carbon: new THREE.MeshStandardMaterial({ color: 0x0f0f12, metalness: 0.45, roughness: 0.35 }),
      jacket: new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.65, metalness: 0.1 }),
      helmetShell: new THREE.MeshStandardMaterial({ color: theme.accentColor, metalness: 0.4, roughness: 0.25 }),
      skin: new THREE.MeshStandardMaterial({ color: 0x8a5a3c, roughness: 0.8 })
    };
  }

  // ---------------- Wheel ----------------
  // spokeStyle: 'wire' | 'alloy' | 'slick'
  function createWheel(mats, opts) {
    opts = opts || {};
    var tireR = opts.tireR || 0.72;
    var tubeR = opts.tubeR || 0.22;
    var rimR = opts.rimR || 0.48;
    var spokeStyle = opts.spokeStyle || 'alloy';
    var wGroup = new THREE.Group();

    var tire = new THREE.Mesh(new THREE.TorusGeometry(tireR, tubeR, 10, 28), mats.tire);
    tire.castShadow = true;
    wGroup.add(tire);

    var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.34, 12), mats.darkMetal);
    hub.rotation.x = Math.PI / 2;
    wGroup.add(hub);

    if (spokeStyle === 'wire') {
      var spokeCount = 24;
      for (var i = 0; i < spokeCount; i++) {
        var spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, rimR * 0.95, 4), mats.chrome);
        var ang = (i / spokeCount) * Math.PI * 2;
        spoke.position.set(Math.cos(ang) * (rimR * 0.95) / 2, Math.sin(ang) * (rimR * 0.95) / 2, 0);
        spoke.rotation.z = ang + Math.PI / 2;
        wGroup.add(spoke);
      }
      var rimWire = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.032, 8, 24), mats.chrome);
      wGroup.add(rimWire);
    } else if (spokeStyle === 'slick') {
      var rimSlick = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.92, rimR * 0.92, 0.2, 6), mats.darkMetal);
      rimSlick.rotation.x = Math.PI / 2;
      wGroup.add(rimSlick);
      for (var s = 0; s < 5; s++) {
        var cut = new THREE.Mesh(new THREE.BoxGeometry(0.05, rimR * 1.5, 0.24), mats.tire);
        cut.rotation.z = (s / 5) * Math.PI * 2;
        wGroup.add(cut);
      }
    } else {
      var rimAlloy = new THREE.Mesh(new THREE.CylinderGeometry(rimR, rimR, 0.2, 6), mats.chrome);
      rimAlloy.rotation.x = Math.PI / 2;
      wGroup.add(rimAlloy);
      for (var j = 0; j < 5; j++) {
        var sp = new THREE.Mesh(new THREE.BoxGeometry(0.06, rimR * 1.75, 0.17), mats.chrome);
        sp.rotation.z = (j / 5) * Math.PI * 2;
        wGroup.add(sp);
      }
    }

    var disc = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.78, rimR * 0.78, 0.03, 20, 1, false), mats.chrome);
    disc.rotation.x = Math.PI / 2;
    disc.position.z = tubeR * 0.85;
    wGroup.add(disc);
    // ventilation holes (approximated by small dark ring)
    var ventRing = new THREE.Mesh(new THREE.TorusGeometry(rimR * 0.6, 0.015, 6, 20), mats.darkMetal);
    ventRing.position.z = tubeR * 0.85 + 0.001;
    wGroup.add(ventRing);

    var caliper = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.24, 0.13), opts.caliperMat || mats.accent);
    caliper.position.set(0, rimR * 0.78, tubeR * 0.85);
    wGroup.add(caliper);

    return wGroup;
  }

  // ---------------- Engine block (shared, with cooling fins) ----------------
  function createEngine(mats, opts) {
    opts = opts || {};
    var group = new THREE.Group();
    var w = opts.width || 0.6, h = opts.height || 0.55, d = opts.depth || 0.78;

    var block = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.engineAlloy);
    group.add(block);

    // horizontal cooling fins
    var finCount = opts.fins || 6;
    for (var i = 0; i < finCount; i++) {
      var fin = new THREE.Mesh(new THREE.BoxGeometry(w * 1.08, 0.025, d * 0.9), mats.darkMetal);
      fin.position.y = -h / 2 + (i + 0.5) * (h / finCount);
      group.add(fin);
    }

    // crankcase cover with embossed ring
    var crank = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.42, w * 0.42, 0.12, 16), mats.chrome);
    crank.rotation.z = Math.PI / 2;
    crank.position.set(w / 2 + 0.02, -h * 0.15, 0);
    group.add(crank);
    var emboss = new THREE.Mesh(new THREE.TorusGeometry(w * 0.3, 0.015, 6, 16), mats.darkMetal);
    emboss.rotation.y = Math.PI / 2;
    emboss.position.copy(crank.position);
    emboss.position.x += 0.065;
    group.add(emboss);

    // foot pegs
    var pegL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.32, 6), mats.darkMetal);
    var pegR = pegL.clone();
    pegL.rotation.z = Math.PI / 2;
    pegR.rotation.z = Math.PI / 2;
    pegL.position.set(-w / 2 - 0.14, -h / 2, d * 0.15);
    pegR.position.set(w / 2 + 0.14, -h / 2, d * 0.15);
    group.add(pegL, pegR);

    // gear lever
    var gear = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 6), mats.darkMetal);
    gear.position.set(-w / 2 - 0.08, -h / 2 + 0.1, d * 0.32);
    gear.rotation.x = Math.PI / 8;
    group.add(gear);

    group.position.set(0, opts.posY || 0.92, opts.posZ || -0.15);
    return group;
  }

  // ---------------- Swingarm + monoshock + chain ----------------
  function createRearSuspension(mats, opts) {
    opts = opts || {};
    var group = new THREE.Group();
    var armL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 1.35), mats.darkMetal);
    armL.position.set(-0.26, 0.68, -0.6);
    armL.rotation.x = -0.05;
    var armR = armL.clone();
    armR.position.x = 0.26;
    group.add(armL, armR);

    // monoshock spring
    var shockRod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8), mats.chrome);
    var coil = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 6, 12), opts.springColor ? new THREE.MeshStandardMaterial({ color: opts.springColor, metalness: 0.7, roughness: 0.3 }) : mats.accent);
    shockRod.position.set(0, 1.02, -0.85);
    shockRod.rotation.x = Math.PI / 7;
    group.add(shockRod);
    for (var i = 0; i < 5; i++) {
      var c = coil.clone();
      c.position.set(0, 0.85 + i * 0.09, -0.98 + i * 0.02);
      c.rotation.x = Math.PI / 2;
      group.add(c);
    }

    // chain drive (approximate flattened strip of segments)
    var chainMat = mats.darkMetal;
    for (var s = 0; s < 10; s++) {
      var link = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.09), chainMat);
      link.position.set(0.22, 0.55 - s * 0.01, -0.25 - s * 0.11);
      group.add(link);
    }

    return group;
  }

  // ---------------- Nitro flame ----------------
  function createFlame() {
    var flameGeom = new THREE.ConeGeometry(0.16, 1.0, 8);
    flameGeom.rotateX(-Math.PI / 2);
    var flameMat = new THREE.MeshBasicMaterial({ color: 0x66d9ff, transparent: true, opacity: 0 });
    return new THREE.Mesh(flameGeom, flameMat);
  }

  // ---------------- Rider ----------------
  // posture: 'upright' | 'sport' | 'aggressive' | 'cafe'
  function createRider(mats, posture) {
    var group = new THREE.Group();
    var lean = { upright: 0.12, sport: Math.PI / 6, aggressive: Math.PI / 4.2, cafe: Math.PI / 5.2 }[posture] || 0.3;
    var seatY = { upright: 2.0, sport: 1.9, aggressive: 1.8, cafe: 1.88 }[posture] || 1.9;

    var hips = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.28), mats.jacket);
    hips.position.set(0, seatY, -0.55);
    group.add(hips);

    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.3), mats.jacket);
    torso.position.set(0, seatY + 0.42, -0.55 + Math.sin(lean) * 0.3);
    torso.rotation.x = lean;
    // fold lines: thin darker bands
    var foldMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0d, roughness: 0.8 });
    for (var f = 0; f < 3; f++) {
      var fold = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.03, 0.31), foldMat);
      fold.position.set(0, -0.15 + f * 0.14, 0.005);
      torso.add(fold);
    }
    group.add(torso);

    // arms reaching to bars
    var armGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.55, 8);
    var armL = new THREE.Mesh(armGeom, mats.jacket);
    var armR = armL.clone();
    armL.position.set(-0.28, seatY + 0.55, -0.3);
    armR.position.set(0.28, seatY + 0.55, -0.3);
    armL.rotation.x = lean + 0.6;
    armR.rotation.x = lean + 0.6;
    armL.rotation.z = 0.18;
    armR.rotation.z = -0.18;
    group.add(armL, armR);

    // gripping hands
    var handGeom = new THREE.SphereGeometry(0.075, 8, 8);
    var handL = new THREE.Mesh(handGeom, mats.jacket);
    var handR = handL.clone();
    handL.position.set(-0.34, seatY + 0.28, 0.05);
    handR.position.set(0.34, seatY + 0.28, 0.05);
    group.add(handL, handR);

    // legs to pegs
    var legGeom = new THREE.CylinderGeometry(0.075, 0.06, 0.5, 8);
    var legL = new THREE.Mesh(legGeom, mats.jacket);
    var legR = legL.clone();
    legL.position.set(-0.2, seatY - 0.35, -0.15);
    legR.position.set(0.2, seatY - 0.35, -0.15);
    legL.rotation.x = -0.4;
    legR.rotation.x = -0.4;
    group.add(legL, legR);

    // helmet with visor + chin vent
    var helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), mats.helmetShell);
    var headY = seatY + 0.42 + Math.cos(lean) * 0.42 + 0.18;
    var headZ = -0.55 + Math.sin(lean) * 0.62;
    helmet.position.set(0, headY, headZ);
    helmet.rotation.x = lean * 0.5;
    group.add(helmet);

    var visorGeom = new THREE.SphereGeometry(0.2, 14, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    var visor = new THREE.Mesh(visorGeom, mats.visor);
    visor.rotation.x = Math.PI / 2 + lean * 0.5 + 0.15;
    visor.position.set(0, headY - 0.02, headZ + 0.14);
    group.add(visor);

    var chinVent = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.05), mats.darkMetal);
    chinVent.position.set(0, headY - 0.16, headZ + 0.19);
    group.add(chinVent);

    return group;
  }

  // ---------------- Cockpit: handlebars, levers, TFT, mirrors ----------------
  // barStyle: 'upright' | 'clipon-race' | 'clipon-drop' | 'street'
  function createCockpit(mats, barStyle) {
    var group = new THREE.Group();

    if (barStyle === 'upright') {
      var bar = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 8, 12, Math.PI), mats.chrome);
      bar.rotation.z = Math.PI;
      bar.position.set(0, 1.15, 0.05);
      group.add(bar);
    } else if (barStyle === 'street') {
      var barS = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 8), mats.darkMetal);
      barS.rotation.z = Math.PI / 2;
      barS.position.set(0, 1.12, 0.02);
      group.add(barS);
      var riser = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 8), mats.chrome);
      riser.position.set(0, 1.02, 0.02);
      group.add(riser);
    } else {
      // clip-ons (low, mounted each side on the fork tubes)
      var clipL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.32, 8), mats.darkMetal);
      var clipR = clipL.clone();
      var dropAngle = barStyle === 'clipon-drop' ? 0.55 : 0.25;
      clipL.rotation.z = Math.PI / 2 + dropAngle;
      clipR.rotation.z = Math.PI / 2 - dropAngle;
      clipL.position.set(-0.27, 0.98, 0.12);
      clipR.position.set(0.27, 0.98, 0.12);
      group.add(clipL, clipR);
    }

    // brake / clutch levers
    var leverGeom = new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6);
    var leverL = new THREE.Mesh(leverGeom, mats.chrome);
    var leverR = leverL.clone();
    leverL.position.set(-0.42, 1.1, 0.14);
    leverR.position.set(0.42, 1.1, 0.14);
    leverL.rotation.z = 0.5;
    leverR.rotation.z = -0.5;
    group.add(leverL, leverR);

    // digital TFT display
    var dashBody = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.03), mats.darkMetal);
    dashBody.position.set(0, 1.28, 0.06);
    group.add(dashBody);
    var screen = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.1), mats.screenGlow);
    screen.position.set(0, 1.28, 0.076);
    group.add(screen);

    // aerodynamic mirrors
    var mirrorStalkGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.18, 6);
    var mirrorHeadGeom = new THREE.SphereGeometry(0.07, 8, 8);
    var stalkL = new THREE.Mesh(mirrorStalkGeom, mats.darkMetal);
    var stalkR = stalkL.clone();
    stalkL.position.set(-0.38, 1.3, 0.02);
    stalkR.position.set(0.38, 1.3, 0.02);
    stalkL.rotation.z = 0.6;
    stalkR.rotation.z = -0.6;
    var headL = new THREE.Mesh(mirrorHeadGeom, mats.chrome);
    headL.scale.set(1, 0.6, 1.2);
    var headR = headL.clone();
    headL.position.set(-0.48, 1.36, 0.02);
    headR.position.set(0.48, 1.36, 0.02);
    group.add(stalkL, stalkR, headL, headR);

    return group;
  }

  // ---------------- Headlight rigs ----------------
  // style: 'round-nacelle' | 'twin-slit' | 'lightbar' | 'round-single'
  function createHeadlightRig(mats, style) {
    var group = new THREE.Group();

    if (style === 'round-nacelle') {
      var nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 16), mats.chrome);
      nacelle.rotation.x = Math.PI / 2;
      group.add(nacelle);
      var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), mats.led);
      lamp.position.z = 0.08;
      group.add(lamp);
    } else if (style === 'twin-slit') {
      for (var i = -1; i <= 1; i += 2) {
        var slit = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.06), mats.led);
        slit.position.set(i * 0.16, 0, 0);
        slit.rotation.z = i * 0.35;
        group.add(slit);
        var housing = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.1), mats.darkMetal);
        housing.position.set(i * 0.16, 0, -0.03);
        group.add(housing);
      }
    } else if (style === 'lightbar') {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.05), mats.led);
      group.add(bar);
      var barHousing = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.1, 0.08), mats.darkMetal);
      barHousing.position.z = -0.03;
      group.add(barHousing);
    } else {
      var round = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), mats.led);
      group.add(round);
    }

    var spotLight = new THREE.SpotLight(0xE0FFFF, 2, 45, Math.PI / 6, 0.4);
    spotLight.position.set(0, 0, 0.05);
    group.add(spotLight);
    var targetObj = new THREE.Object3D();
    targetObj.position.set(0, -0.3, 10);
    group.add(targetObj);
    spotLight.target = targetObj;

    // rear tail light strip (returned via userData so caller can place it elsewhere)
    return group;
  }

  function createTailLight(mats) {
    return new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.03), mats.redLed);
  }

  function createBlinkers(mats, spread) {
    var group = new THREE.Group();
    var geo = new THREE.SphereGeometry(0.035, 8, 8);
    var bL = new THREE.Mesh(geo, mats.amberLed);
    var bR = bL.clone();
    bL.position.set(-spread, 0, 0);
    bR.position.set(spread, 0, 0);
    group.add(bL, bR);
    return group;
  }

  /* ======================================================================
     BIKE 1: BULLET (Royal Bullet 350 / Classic Cruiser)
     ====================================================================== */
  function buildBulletBike(mats) {
    var bike = new THREE.Group();

    // Rear wheel - wire spoke, deep chrome fender
    var rearWheel = createWheel(mats, { spokeStyle: 'wire', tireR: 0.74, tubeR: 0.24, rimR: 0.5, caliperMat: mats.accent });
    rearWheel.position.set(0, 0.74, -1.3);
    bike.add(rearWheel);
    bike.rearWheel = rearWheel;

    var rearFender = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.86, 0.34, 16, 1, true, 0, Math.PI * 0.95), mats.chrome);
    rearFender.rotation.z = Math.PI / 2;
    rearFender.position.set(0, 1.05, -1.55);
    bike.add(rearFender);

    // Front fork assembly
    var frontFork = new THREE.Group();
    frontFork.position.set(0, 0, 1.4);
    var frontWheel = createWheel(mats, { spokeStyle: 'wire', tireR: 0.74, tubeR: 0.24, rimR: 0.5, caliperMat: mats.accent });
    frontWheel.position.set(0, 0.74, 0);
    frontFork.add(frontWheel);
    bike.frontWheel = frontWheel;

    var forkL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.45, 8), mats.chrome);
    var forkR = forkL.clone();
    forkL.position.set(-0.24, 0.95, 0);
    forkR.position.set(0.24, 0.95, 0);
    forkL.rotation.x = -Math.PI / 9;
    forkR.rotation.x = -Math.PI / 9;
    frontFork.add(forkL, forkR);

    var frontFender = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.3, 16, 1, true, Math.PI * 0.15, Math.PI * 0.8), mats.chrome);
    frontFender.rotation.z = Math.PI / 2;
    frontFender.position.set(0, 1.05, 0.05);
    frontFork.add(frontFender);

    // Round chrome headlight nacelle
    var headRig = createHeadlightRig(mats, 'round-nacelle');
    headRig.position.set(0, 1.62, 0.32);
    frontFork.add(headRig);

    // upright handlebars mounted to steering
    frontFork.add(createCockpit(mats, 'upright'));

    bike.add(frontFork);
    bike.frontFork = frontFork;

    // Frame - simple tubular cradle
    var frameMain = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 2.1, 8), mats.darkMetal);
    frameMain.rotation.x = Math.PI / 3.1;
    frameMain.position.set(0, 1.12, 0.05);
    bike.add(frameMain);
    var frameLower = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 8), mats.darkMetal);
    frameLower.rotation.x = Math.PI / 2.3;
    frameLower.position.set(0, 0.85, -0.4);
    bike.add(frameLower);

    // Engine - air-cooled single with big fins
    var engine = createEngine(mats, { width: 0.55, height: 0.6, depth: 0.7, fins: 8, posY: 0.88, posZ: -0.15 });
    bike.add(engine);
    bike.add(createRearSuspension(mats, { springColor: 0x333333 }));

    // Single wide sweeping chrome exhaust
    var exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 2.0, 10), mats.chrome);
    exhaust.rotation.x = Math.PI / 2.15;
    exhaust.position.set(0.32, 0.55, -1.05);
    bike.add(exhaust);
    var muffler = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.5, 10), mats.chrome);
    muffler.rotation.z = Math.PI / 2;
    muffler.position.set(0.32, 0.5, -1.95);
    bike.add(muffler);

    var exhaustFlame = createFlame();
    exhaustFlame.position.set(0.32, 0.5, -2.35);
    bike.add(exhaustFlame);
    bike.exhaustFlame = exhaustFlame;

    // Teardrop fuel tank with knee pads + gold pinstripes
    var tankGeom = new THREE.SphereGeometry(0.62, 16, 16);
    tankGeom.scale(0.62, 0.58, 1.25);
    var tank = new THREE.Mesh(tankGeom, mats.body);
    tank.position.set(0, 1.58, 0.32);
    tank.castShadow = true;
    bike.add(tank);

    var pinstripe = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 1.15), mats.gold);
    pinstripe.position.set(0.32, 1.6, 0.32);
    bike.add(pinstripe);
    var pinstripe2 = pinstripe.clone();
    pinstripe2.position.x = -0.32;
    bike.add(pinstripe2);

    var kneePadL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.4), mats.rubber);
    var kneePadR = kneePadL.clone();
    kneePadL.position.set(0.34, 1.42, 0.15);
    kneePadR.position.set(-0.34, 1.42, 0.15);
    bike.add(kneePadL, kneePadR);

    // Sprung single saddle seat, leather
    var seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.65), mats.leather);
    seat.position.set(0, 1.4, -0.45);
    bike.add(seat);
    var springGeo = new THREE.TorusGeometry(0.06, 0.014, 6, 10);
    for (var sp = -1; sp <= 1; sp += 2) {
      var seatSpring = new THREE.Mesh(springGeo, mats.chrome);
      seatSpring.position.set(sp * 0.16, 1.28, -0.7);
      bike.add(seatSpring);
    }

    var tail = createTailLight(mats);
    tail.position.set(0, 1.35, -1.35);
    bike.add(tail);
    var blinkers = createBlinkers(mats, 0.3);
    blinkers.position.set(0, 1.3, -1.4);
    bike.add(blinkers);

    // Rider - upright relaxed cruiser posture
    var rider = createRider(mats, 'upright');
    bike.add(rider);
    bike.rider = rider;

    bike.scale.set(1.4, 1.4, 1.4);
    return bike;
  }

  /* ======================================================================
     BIKE 2: SPORT (Rani Neon Sport / 1000cc Superbike)
     ====================================================================== */
  function buildSportBike(mats) {
    var bike = new THREE.Group();

    var rearWheel = createWheel(mats, { spokeStyle: 'alloy', tireR: 0.72, tubeR: 0.24, rimR: 0.46 });
    rearWheel.position.set(0, 0.72, -1.3);
    bike.add(rearWheel);
    bike.rearWheel = rearWheel;

    var hugger = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.4, 12, 1, true, 0, Math.PI * 0.6), mats.body);
    hugger.rotation.z = Math.PI / 2;
    hugger.position.set(0, 0.95, -1.5);
    bike.add(hugger);

    var frontFork = new THREE.Group();
    frontFork.position.set(0, 0, 1.4);
    var frontWheel = createWheel(mats, { spokeStyle: 'alloy', tireR: 0.7, tubeR: 0.22, rimR: 0.44 });
    frontWheel.position.set(0, 0.7, 0);
    frontFork.add(frontWheel);
    bike.frontWheel = frontWheel;

    var forkL = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.3, 8), mats.darkMetal);
    var forkR = forkL.clone();
    forkL.position.set(-0.22, 0.92, 0.02);
    forkR.position.set(0.22, 0.92, 0.02);
    forkL.rotation.x = -Math.PI / 7;
    forkR.rotation.x = -Math.PI / 7;
    frontFork.add(forkL, forkR);

    // twin sharp LED "alien eye" headlights
    var headRig = createHeadlightRig(mats, 'twin-slit');
    headRig.position.set(0, 1.55, 0.55);
    frontFork.add(headRig);

    // clip-on low handlebars
    frontFork.add(createCockpit(mats, 'clipon-race'));

    bike.add(frontFork);
    bike.frontFork = frontFork;

    // Aggressive angular fairing with air intakes
    var fairingGeom = new THREE.ConeGeometry(0.4, 1.15, 12);
    fairingGeom.scale(1.0, 1.15, 0.6);
    var fairing = new THREE.Mesh(fairingGeom, mats.body);
    fairing.rotation.x = -Math.PI / 2.5;
    fairing.position.set(0, 1.55, 1.2);
    bike.add(fairing);

    var intakeL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.18), mats.darkMetal);
    var intakeR = intakeL.clone();
    intakeL.position.set(-0.3, 1.4, 1.35);
    intakeR.position.set(0.3, 1.4, 1.35);
    bike.add(intakeL, intakeR);

    // tinted race windscreen
    var screenGeom = new THREE.SphereGeometry(0.34, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2.2);
    var windscreen = new THREE.Mesh(screenGeom, mats.glassTint);
    windscreen.rotation.x = Math.PI / 2 + 0.35;
    windscreen.position.set(0, 1.78, 1.05);
    bike.add(windscreen);

    // frame (twin-spar, visible alongside tank)
    var spar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 1.4), mats.darkMetal);
    var sparL = spar.clone(), sparR = spar.clone();
    sparL.position.set(-0.28, 1.35, 0.15);
    sparR.position.set(0.28, 1.35, 0.15);
    bike.add(sparL, sparR);

    var engine = createEngine(mats, { width: 0.62, height: 0.5, depth: 0.7, fins: 5, posY: 0.85, posZ: -0.15 });
    bike.add(engine);
    bike.add(createRearSuspension(mats, { springColor: 0xFFB000 }));

    // high-mounted short carbon race exhaust (single, upswept, undertail)
    var exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.65, 12), mats.carbon);
    exhaust.rotation.x = Math.PI / 2.6;
    exhaust.position.set(0.28, 1.0, -1.55);
    bike.add(exhaust);

    var exhaustFlame = createFlame();
    exhaustFlame.scale.set(0.8, 0.8, 0.8);
    exhaustFlame.position.set(0.28, 1.08, -1.95);
    bike.add(exhaustFlame);
    bike.exhaustFlame = exhaustFlame;

    // aggressive tank hugging rider tuck
    var tankGeom = new THREE.SphereGeometry(0.5, 16, 16);
    tankGeom.scale(0.78, 0.62, 1.35);
    var tank = new THREE.Mesh(tankGeom, mats.body);
    tank.position.set(0, 1.62, 0.3);
    bike.add(tank);
    var tankStripe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 1.1), mats.accent);
    tankStripe.position.set(0, 1.7, 0.3);
    bike.add(tankStripe);

    // split-level step-up passenger seat + sharp tail cowl
    var seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.5), mats.body);
    seat.position.set(0, 1.5, -0.4);
    bike.add(seat);
    var passSeat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.35), mats.body);
    passSeat.position.set(0, 1.62, -0.75);
    bike.add(passSeat);
    var tailCowlGeom = new THREE.ConeGeometry(0.28, 0.7, 10);
    tailCowlGeom.scale(1, 1, 0.9);
    var tailCowl = new THREE.Mesh(tailCowlGeom, mats.accent);
    tailCowl.rotation.x = Math.PI / 2;
    tailCowl.position.set(0, 1.68, -1.15);
    bike.add(tailCowl);

    var tail = createTailLight(mats);
    tail.position.set(0, 1.65, -1.42);
    bike.add(tail);
    var blinkers = createBlinkers(mats, 0.26);
    blinkers.position.set(0, 1.6, -1.4);
    bike.add(blinkers);

    // Rider - aggressive forward-leaning racing tuck
    var rider = createRider(mats, 'aggressive');
    bike.add(rider);
    bike.rider = rider;

    bike.scale.set(1.4, 1.4, 1.4);
    return bike;
  }

  /* ======================================================================
     BIKE 3: TURBO (Mor Teal Turbo / Cyberpunk Streetfighter)
     ====================================================================== */
  function buildTurboBike(mats) {
    var bike = new THREE.Group();
    var neonMat = new THREE.MeshBasicMaterial({ color: 0x38E1E4 });

    // chunky extra-wide rear slick
    var rearWheel = createWheel(mats, { spokeStyle: 'slick', tireR: 0.82, tubeR: 0.3, rimR: 0.5 });
    rearWheel.position.set(0, 0.82, -1.3);
    bike.add(rearWheel);
    bike.rearWheel = rearWheel;

    var frontFork = new THREE.Group();
    frontFork.position.set(0, 0, 1.4);
    var frontWheel = createWheel(mats, { spokeStyle: 'alloy', tireR: 0.68, tubeR: 0.2, rimR: 0.42 });
    frontWheel.position.set(0, 0.68, 0);
    frontFork.add(frontWheel);
    bike.frontWheel = frontWheel;

    var forkL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.25, 8), mats.darkMetal);
    var forkR = forkL.clone();
    forkL.position.set(-0.22, 0.9, 0.02);
    forkR.position.set(0.22, 0.9, 0.02);
    frontFork.add(forkL, forkR);

    // futuristic LED lightbar headlight
    var headRig = createHeadlightRig(mats, 'lightbar');
    headRig.position.set(0, 1.45, 0.5);
    frontFork.add(headRig);

    frontFork.add(createCockpit(mats, 'street'));

    bike.add(frontFork);
    bike.frontFork = frontFork;

    // exposed neon-accented tubular trellis frame
    var trellisMat = mats.darkMetal;
    var trellisPts = [
      [[-0.2, 1.5, 0.5], [0.2, 1.5, 0.5]],
      [[-0.2, 1.5, 0.5], [-0.25, 1.0, -0.3]],
      [[0.2, 1.5, 0.5], [0.25, 1.0, -0.3]],
      [[-0.25, 1.0, -0.3], [0.25, 1.0, -0.3]],
      [[-0.25, 1.0, -0.3], [0, 0.85, -1.1]],
      [[0.25, 1.0, -0.3], [0, 0.85, -1.1]]
    ];
    trellisPts.forEach(function (seg) {
      var a = new THREE.Vector3(seg[0][0], seg[0][1], seg[0][2]);
      var b = new THREE.Vector3(seg[1][0], seg[1][1], seg[1][2]);
      var len = a.distanceTo(b);
      var tube = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, len, 8), trellisMat);
      tube.position.copy(a).lerp(b, 0.5);
      tube.lookAt(b);
      tube.rotateX(Math.PI / 2);
      bike.add(tube);
      // neon accent strip along tube
      var neon = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len * 0.9, 6), neonMat);
      neon.position.copy(tube.position);
      neon.rotation.copy(tube.rotation);
      bike.add(neon);
    });

    // muscular hunchback tank + angular radiator shrouds
    var tankGeom = new THREE.BoxGeometry(0.55, 0.5, 0.75);
    tankGeom.translate(0, 0, 0);
    var tank = new THREE.Mesh(tankGeom, mats.body);
    tank.position.set(0, 1.55, 0.15);
    tank.rotation.x = 0.08;
    bike.add(tank);
    var hump = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), mats.body);
    hump.scale.set(1, 0.8, 1.1);
    hump.position.set(0, 1.82, -0.05);
    bike.add(hump);

    var shroudL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.5), mats.darkMetal);
    var shroudR = shroudL.clone();
    shroudL.position.set(-0.3, 1.35, -0.05);
    shroudR.position.set(0.3, 1.35, -0.05);
    shroudL.rotation.y = 0.25;
    shroudR.rotation.y = -0.25;
    bike.add(shroudL, shroudR);

    // industrial engine block, exposed
    var engine = createEngine(mats, { width: 0.68, height: 0.62, depth: 0.8, fins: 7, posY: 0.9, posZ: -0.2 });
    bike.add(engine);
    bike.add(createRearSuspension(mats, { springColor: 0x38E1E4 }));

    // digital console (dash already in cockpit); add extra glow strip on tank
    var digiStrip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.03), neonMat);
    digiStrip.position.set(0, 1.15, 0.6);
    bike.add(digiStrip);

    // dual slash-cut stubby exhausts
    var exL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.55, 10), mats.darkMetal);
    var exR = exL.clone();
    exL.rotation.x = Math.PI / 2.3;
    exR.rotation.x = Math.PI / 2.3;
    exL.position.set(0.22, 0.62, -1.5);
    exR.position.set(-0.22, 0.62, -1.5);
    bike.add(exL, exR);

    var exhaustFlame = createFlame();
    exhaustFlame.position.set(0.22, 0.62, -1.85);
    bike.add(exhaustFlame);
    bike.exhaustFlame = exhaustFlame;
    var exhaustFlame2 = createFlame();
    exhaustFlame2.material = exhaustFlame.material; // share opacity control
    exhaustFlame2.position.set(-0.22, 0.62, -1.85);
    bike.add(exhaustFlame2);

    // minimal seat
    var seat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.5), mats.leather);
    seat.position.set(0, 1.5, -0.55);
    bike.add(seat);

    var tail = createTailLight(mats);
    tail.material = neonMat;
    tail.position.set(0, 1.4, -1.55);
    bike.add(tail);

    var rider = createRider(mats, 'sport');
    bike.add(rider);
    bike.rider = rider;

    bike.scale.set(1.4, 1.4, 1.4);
    return bike;
  }

  /* ======================================================================
     BIKE 4: CAFE (Kesar Cafe Racer / Vintage Racer)
     ====================================================================== */
  function buildCafeBike(mats) {
    var bike = new THREE.Group();

    var rearWheel = createWheel(mats, { spokeStyle: 'alloy', tireR: 0.72, tubeR: 0.22, rimR: 0.46, caliperMat: mats.gold });
    rearWheel.position.set(0, 0.72, -1.3);
    bike.add(rearWheel);
    bike.rearWheel = rearWheel;

    var smallFenderR = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.16, 14, 1, true, 0, Math.PI * 0.5), mats.darkMetal);
    smallFenderR.rotation.z = Math.PI / 2;
    smallFenderR.position.set(0, 1.0, -1.5);
    bike.add(smallFenderR);

    var frontFork = new THREE.Group();
    frontFork.position.set(0, 0, 1.4);
    var frontWheel = createWheel(mats, { spokeStyle: 'alloy', tireR: 0.72, tubeR: 0.22, rimR: 0.46, caliperMat: mats.gold });
    frontWheel.position.set(0, 0.72, 0);
    frontFork.add(frontWheel);
    bike.frontWheel = frontWheel;

    // inverted front fork suspension (wider tube on top)
    var forkL = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.045, 1.35, 8), mats.darkMetal);
    var forkR = forkL.clone();
    forkL.position.set(-0.23, 0.95, 0);
    forkR.position.set(0.23, 0.95, 0);
    forkL.rotation.x = -Math.PI / 8.5;
    forkR.rotation.x = -Math.PI / 8.5;
    frontFork.add(forkL, forkR);

    var smallFenderF = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.76, 0.14, 14, 1, true, Math.PI * 0.2, Math.PI * 0.7), mats.darkMetal);
    smallFenderF.rotation.z = Math.PI / 2;
    smallFenderF.position.set(0, 1.0, 0.02);
    frontFork.add(smallFenderF);

    var headRig = createHeadlightRig(mats, 'round-single');
    headRig.position.set(0, 1.55, 0.4);
    frontFork.add(headRig);

    // clip-on low drop bars with bar-end round mirrors
    frontFork.add(createCockpit(mats, 'clipon-drop'));

    bike.add(frontFork);
    bike.frontFork = frontFork;

    var frameMain = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.0, 8), mats.darkMetal);
    frameMain.rotation.x = Math.PI / 3.2;
    frameMain.position.set(0, 1.1, 0.05);
    bike.add(frameMain);

    var engine = createEngine(mats, { width: 0.58, height: 0.55, depth: 0.72, fins: 7, posY: 0.88, posZ: -0.15 });
    bike.add(engine);
    bike.add(createRearSuspension(mats, { springColor: 0xFFD54F }));

    // twin classic pipes tucked low
    var pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.7, 10), mats.chrome);
    pipe.rotation.x = Math.PI / 2.2;
    pipe.position.set(0.3, 0.5, -1.0);
    bike.add(pipe);

    var exhaustFlame = createFlame();
    exhaustFlame.scale.set(0.7, 0.7, 0.7);
    exhaustFlame.position.set(0.3, 0.45, -1.95);
    bike.add(exhaustFlame);
    bike.exhaustFlame = exhaustFlame;

    // elongated indented vintage tank
    var tankGeom = new THREE.SphereGeometry(0.6, 16, 16);
    tankGeom.scale(0.55, 0.5, 1.5);
    var tank = new THREE.Mesh(tankGeom, mats.body);
    tank.position.set(0, 1.58, 0.28);
    bike.add(tank);
    var indent = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.85), mats.darkMetal);
    indent.position.set(0, 1.5, 0.28);
    bike.add(indent);
    var goldStripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.9), mats.gold);
    goldStripe.position.set(0, 1.68, 0.28);
    bike.add(goldStripe);

    // rounded cafe racer rear seat cowl / aero hump
    var cowlGeom = new THREE.SphereGeometry(0.3, 14, 14);
    cowlGeom.scale(0.95, 0.7, 1.4);
    var cowl = new THREE.Mesh(cowlGeom, mats.body);
    cowl.position.set(0, 1.55, -0.85);
    bike.add(cowl);

    // brown distressed ribbed leather seat
    var seat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.13, 0.55), mats.leatherBrown);
    seat.position.set(0, 1.45, -0.5);
    bike.add(seat);
    for (var r = 0; r < 4; r++) {
      var rib = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.02, 0.06), mats.darkMetal);
      rib.position.set(0, 1.52, -0.7 + r * 0.13);
      bike.add(rib);
    }

    var tail = createTailLight(mats);
    tail.position.set(0, 1.5, -1.15);
    bike.add(tail);

    var rider = createRider(mats, 'cafe');
    bike.add(rider);
    bike.rider = rider;

    bike.scale.set(1.4, 1.4, 1.4);
    return bike;
  }

  /* ======================================================================
     PUBLIC ENTRY POINT
     ====================================================================== */
  function buildRealisticBike(themeKey) {
    var theme = BIKE_THEMES[themeKey] || BIKE_THEMES.sport;
    var mats = createMaterials(theme);

    var bike;
    switch (themeKey) {
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