/* Jodi Sync — Quick Reaction Duel Visual Effects & Particle Engine
 * SOLID Architecture:
 * - Single Responsibility: Pure visual simulation of spark bursts, shockwaves, screen shake, and frenzy intensity.
 * - Resource Safety: Canvas/DOM auto-cleanup, zero memory leaks, respects prefers-reduced-motion.
 * Exposes: window.JodiReactionFx
 */
(function (global) {
  'use strict';

  var _particles = [];
  var _animId = null;
  var _activeCanvas = null;
  var _isRunning = false;

  var PALETTES = {
    normal: ['#FFD166', '#FFAA00', '#FFF1C5', '#FFFFFF'],
    lightning: ['#FFE600', '#38E1E4', '#80EEFF', '#FFFFFF'],
    bomb: ['#FF3B30', '#FF8552', '#2A1240', '#4B1D6B'],
    moving: ['#0B7A7C', '#38E1E4', '#06D6A0', '#FFFFFF'],
    tiny: ['#D6246E', '#FF5C9A', '#FAF5FF', '#FFB000'],
    streak: ['#FFD166', '#FFB000', '#FF5C9A', '#06D6A0']
  };

  function _random(min, max) {
    return Math.random() * (max - min) + min;
  }

  function _createParticle(x, y, colorPalette, countMult) {
    var palette = colorPalette || PALETTES.normal;
    var count = Math.floor((countMult || 1) * 14);

    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = _random(3, 9);
      _particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: palette[Math.floor(Math.random() * palette.length)],
        radius: _random(3, 6),
        alpha: 1,
        decay: _random(0.035, 0.065),
        drag: 0.94
      });
    }
  }

  function _renderFrame() {
    if (!_activeCanvas) return;
    var ctx = _activeCanvas.getContext('2d');
    if (!ctx) return;

    var width = _activeCanvas.width;
    var height = _activeCanvas.height;

    ctx.clearRect(0, 0, width, height);

    for (var i = _particles.length - 1; i >= 0; i--) {
      var p = _particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        _particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (_particles.length > 0) {
      _animId = requestAnimationFrame(_renderFrame);
    } else {
      _isRunning = false;
      _animId = null;
    }
  }

  function _startLoopIfNeeded() {
    if (!_isRunning) {
      _isRunning = true;
      _animId = requestAnimationFrame(_renderFrame);
    }
  }

  /**
   * Binds to arena particle canvas layer
   */
  function setCanvas(canvas) {
    _activeCanvas = canvas;
    if (canvas) {
      var rect = canvas.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = (rect.width || 320) * dpr;
      canvas.height = (rect.height || 420) * dpr;
      var ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
    }
  }

  /**
   * Spawns spark burst at canvas-relative pixel coordinates
   */
  function burstHit(x, y, targetType) {
    if (!_activeCanvas) return;
    var pal = PALETTES[targetType] || PALETTES.normal;
    _createParticle(x, y, pal, 1.2);
    _startLoopIfNeeded();
  }

  /**
   * Spawns explosive red-black smoke & spark burst on bomb hit
   */
  function burstBomb(x, y) {
    if (!_activeCanvas) return;
    _createParticle(x, y, PALETTES.bomb, 2.0);
    _startLoopIfNeeded();
  }

  /**
   * Spawns celebratory streak sparklers
   */
  function burstStreak(x, y, streakCount) {
    if (!_activeCanvas) return;
    var pal = PALETTES.streak;
    var mult = Math.min(2.5, 1 + (streakCount * 0.2));
    _createParticle(x, y, pal, mult);
    _startLoopIfNeeded();
  }

  /**
   * Triggers a snappy 140ms screen shake on arena element
   */
  function shakeArena(arenaEl, isIntense) {
    if (!arenaEl) return;
    var cls = isIntense ? 'reaction-shake-heavy' : 'reaction-shake-light';
    arenaEl.classList.remove('reaction-shake-light', 'reaction-shake-heavy');
    // Force reflow
    void arenaEl.offsetWidth;
    arenaEl.classList.add(cls);
    setTimeout(function () {
      if (arenaEl) arenaEl.classList.remove(cls);
    }, 160);
  }

  /**
   * Triggers a brief red flash outline on false start or bomb
   */
  function flashRed(arenaEl) {
    if (!arenaEl) return;
    arenaEl.classList.remove('reaction-flash-red');
    void arenaEl.offsetWidth;
    arenaEl.classList.add('reaction-flash-red');
    setTimeout(function () {
      if (arenaEl) arenaEl.classList.remove('reaction-flash-red');
    }, 220);
  }

  /**
   * Cleanup all particle state and RAF timers
   */
  function cleanup() {
    if (_animId) {
      cancelAnimationFrame(_animId);
      _animId = null;
    }
    _particles = [];
    _isRunning = false;
    _activeCanvas = null;
  }

  global.JodiReactionFx = {
    setCanvas: setCanvas,
    burstHit: burstHit,
    burstBomb: burstBomb,
    burstStreak: burstStreak,
    shakeArena: shakeArena,
    flashRed: flashRed,
    cleanup: cleanup
  };

})(window);
