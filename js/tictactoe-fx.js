/* Jodi Sync — Tic-Tac-Toe Celebratory Sprinkler & Confetti Engine
 * SOLID Architecture:
 * - Single Responsibility: Pure visual simulation of festive upward sprinkler fountains.
 * - Zero Game Logic: Decoupled entirely from game rules, network, and DOM business logic.
 * - Resource Safety: Automatic animation cancellation, canvas auto-resizing, and zero memory leaks.
 * Exposes: window.JodiTTTFx
 */
(function (global) {
  'use strict';

  var _rafId = null;
  var _activeCanvas = null;
  var _particles = [];
  var _isRunning = false;
  var _spawnTimer = 0;
  var _stopSpawningTimeout = null;

  var PALETTE = [
    '#FFD166', // Festive Gold
    '#FFAA00', // Deep Marigold (Genda)
    '#D6246E', // Rani Pink
    '#FF4D8D', // Bright Rose
    '#06D6A0', // Fresh Peacock Turquoise
    '#4ECDC4', // Soft Mint Cyan
    '#FFFFFF', // Sparkling White
    '#FFF1C5'  // Warm Starlight Cream
  ];

  function _randomRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  function _createParticle(x, y, isSideNozzle) {
    var angleVariance = isSideNozzle ? _randomRange(-0.45, 0.45) : _randomRange(-0.35, 0.35);
    var speed = _randomRange(15, 24);
    var rad = -Math.PI / 2 + angleVariance;

    return {
      x: x + _randomRange(-12, 12),
      y: y + _randomRange(0, 10),
      vx: Math.cos(rad) * speed,
      vy: Math.sin(rad) * speed,
      gravity: _randomRange(0.38, 0.48),
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      size: _randomRange(6, 12),
      width: _randomRange(8, 14),
      height: _randomRange(6, 10),
      rotation: _randomRange(0, Math.PI * 2),
      rotSpeed: _randomRange(-0.15, 0.15),
      wobble: _randomRange(0, 10),
      wobbleSpeed: _randomRange(0.08, 0.16),
      type: Math.random() > 0.4 ? 'confetti' : (Math.random() > 0.5 ? 'petal' : 'star'),
      opacity: 1,
      decay: _randomRange(0.003, 0.007)
    };
  }

  function _drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius, color) {
    var rot = Math.PI / 2 * 3;
    var step = Math.PI / spikes;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (var i = 0; i < spikes; i++) {
      var x = cx + Math.cos(rot) * outerRadius;
      var y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;
      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function _resizeCanvas(canvas) {
    var rect = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = (rect.width || window.innerWidth) * dpr;
    canvas.height = (rect.height || window.innerHeight) * dpr;
    var ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }

  function _renderFrame() {
    if (!_isRunning || !_activeCanvas) return;

    var canvas = _activeCanvas;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var width = canvas.width / Math.min(window.devicePixelRatio || 1, 2);
    var height = canvas.height / Math.min(window.devicePixelRatio || 1, 2);

    ctx.clearRect(0, 0, width, height);

    // Continuous sprinkler fountain nozzles at bottom
    if (_spawnTimer > 0) {
      _spawnTimer--;
      // 4 fountain nozzle points along the bottom
      var nozzles = [
        { x: width * 0.16, side: true },
        { x: width * 0.38, side: false },
        { x: width * 0.62, side: false },
        { x: width * 0.84, side: true }
      ];

      for (var n = 0; n < nozzles.length; n++) {
        // Spawn 2-3 particles per nozzle per frame
        var count = Math.random() > 0.3 ? 3 : 2;
        for (var p = 0; p < count; p++) {
          if (_particles.length < 180) {
            _particles.push(_createParticle(nozzles[n].x, height, nozzles[n].side));
          }
        }
      }
    }

    // Update and draw active particles
    for (var i = _particles.length - 1; i >= 0; i--) {
      var pt = _particles[i];

      // Physics integration
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vy += pt.gravity;
      pt.rotation += pt.rotSpeed;
      pt.wobble += pt.wobbleSpeed;
      pt.opacity -= pt.decay;

      // Air drag on horizontal velocity
      pt.vx *= 0.985;

      if (pt.opacity <= 0 || pt.y > height + 40) {
        _particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.opacity);

      if (pt.type === 'confetti') {
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rotation);
        var scaleX = Math.cos(pt.wobble);
        ctx.scale(scaleX, 1);
        ctx.fillStyle = pt.color;
        ctx.fillRect(-pt.width / 2, -pt.height / 2, pt.width, pt.height);
      } else if (pt.type === 'petal') {
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rotation);
        ctx.beginPath();
        ctx.ellipse(0, 0, pt.size * 0.8, pt.size * 1.4, 0, 0, Math.PI * 2);
        ctx.fillStyle = pt.color;
        ctx.fill();
      } else {
        _drawStar(ctx, pt.x, pt.y, 5, pt.size * 0.9, pt.size * 0.45, pt.color);
      }

      ctx.restore();
    }

    // Continue loop if running and particles remain
    if (_isRunning && (_particles.length > 0 || _spawnTimer > 0)) {
      _rafId = requestAnimationFrame(_renderFrame);
    } else {
      stopSprinkler();
    }
  }

  /**
   * Start the celebratory upward sprinkler fountain.
   * @param {HTMLCanvasElement} canvas
   * @param {number} [durationMs=3200]
   */
  function startSprinkler(canvas, durationMs) {
    stopSprinkler();
    if (!canvas) return;

    _activeCanvas = canvas;
    _resizeCanvas(canvas);
    _particles = [];
    _isRunning = true;
    _spawnTimer = Math.round(((durationMs || 3200) / 1000) * 60);

    // Initial burst from nozzles
    var width = canvas.width / Math.min(window.devicePixelRatio || 1, 2);
    var height = canvas.height / Math.min(window.devicePixelRatio || 1, 2);
    var initialNozzles = [width * 0.16, width * 0.38, width * 0.62, width * 0.84];
    for (var n = 0; n < initialNozzles.length; n++) {
      for (var k = 0; k < 12; k++) {
        _particles.push(_createParticle(initialNozzles[n], height, n === 0 || n === 3));
      }
    }

    _rafId = requestAnimationFrame(_renderFrame);

    clearTimeout(_stopSpawningTimeout);
    _stopSpawningTimeout = setTimeout(function () {
      _spawnTimer = 0;
    }, durationMs || 3200);
  }

  /**
   * Stop sprinkler, cancel animation loop, and clear canvas.
   */
  function stopSprinkler() {
    _isRunning = false;
    _spawnTimer = 0;
    clearTimeout(_stopSpawningTimeout);
    if (_rafId) {
      cancelAnimationFrame(_rafId);
      _rafId = null;
    }
    if (_activeCanvas) {
      var ctx = _activeCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, _activeCanvas.width, _activeCanvas.height);
      }
      _activeCanvas = null;
    }
    _particles = [];
  }

  global.JodiTTTFx = {
    startSprinkler: startSprinkler,
    stopSprinkler: stopSprinkler
  };

})(window);
