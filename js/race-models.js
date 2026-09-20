/* Jodi Race - 3D Realistic Motorcycle Models & Themes Engine */
(function (global) {
  'use strict';

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

  /* ================= 3D BIKE MODEL BUILDER ================= */
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

  global.JodiRaceModels = {
    BIKE_THEMES: BIKE_THEMES,
    buildRealisticBike: buildRealisticBike
  };
})(window);
