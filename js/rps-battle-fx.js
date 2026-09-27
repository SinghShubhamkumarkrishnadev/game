/* Jodi Sync — Rock Paper Scissors Battle Visual Effects Engine
 * SOLID Architecture:
 * - Single Responsibility: Pure visual simulation of clash sparks, fake-out flickers, and stage shake.
 * - Resource Safety: Automatic RAF cancellation, canvas auto-resizing, zero memory leaks.
 * Exposes: window.JodiRPSFx
 */
(function (global) {
  'use strict';

  var _particles = [];
  var _animId = null;
  var _activeCanvas = null;
  var _isRunning = false;

  var PALETTE = ['#FFD166', '#FFB000', '#FF5C36', '#FF3B30', '#FFFFFF', '#38E1E4'];

  function _random(min, max) {
    return Math.random() * (max - min) + min;
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
      p.vx *= 0.94;
      p.vy *= 0.94;
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

  function setCanvas(canvas) {
    _activeCanvas = canvas;
    if (canvas) {
      var rect = canvas.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = (rect.width || 340) * dpr;
      canvas.height = (rect.height || 260) * dpr;
      var ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
    }
  }

  /**
   * Spawns clash sparks at stage center
   */
  function burstClash(x, y, isPowerThrow) {
    if (!_activeCanvas) return;
    var count = isPowerThrow ? 32 : 18;

    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = _random(isPowerThrow ? 5 : 3, isPowerThrow ? 12 : 8);
      _particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        radius: _random(isPowerThrow ? 4 : 2.5, isPowerThrow ? 7 : 5),
        alpha: 1,
        decay: _random(0.035, 0.065)
      });
    }
    _startLoopIfNeeded();
  }

  /**
   * Snappy 160ms stage screen shake
   */
  function shakeStage(stageEl, isHeavy) {
    if (!stageEl) return;
    var cls = isHeavy ? 'rps-shake-heavy' : 'rps-shake-light';
    stageEl.classList.remove('rps-shake-light', 'rps-shake-heavy');
    void stageEl.offsetWidth;
    stageEl.classList.add(cls);
    setTimeout(function () {
      if (stageEl) stageEl.classList.remove(cls);
    }, 180);
  }

  /**
   * Fake-out mechanic: rapidly flickers glyphs before settling on true locked move
   */
  function triggerFakeoutFlicker(targetEl, finalGlyph, onComplete) {
    if (!targetEl) {
      if (onComplete) onComplete();
      return;
    }

    var sequence = ['🪨', '📄', '✂️', '🪨', '✂️', '📄', finalGlyph];
    var idx = 0;

    var interval = setInterval(function () {
      if (!targetEl) {
        clearInterval(interval);
        return;
      }
      targetEl.textContent = sequence[idx];
      idx += 1;
      if (idx >= sequence.length) {
        clearInterval(interval);
        targetEl.textContent = finalGlyph;
        if (onComplete) onComplete();
      }
    }, 45); // 45ms * 6 frames ≈ 270ms crisp flicker
  }

  function cleanup() {
    if (_animId) {
      cancelAnimationFrame(_animId);
      _animId = null;
    }
    _particles = [];
    _isRunning = false;
    _activeCanvas = null;
  }

  global.JodiRPSFx = {
    setCanvas: setCanvas,
    burstClash: burstClash,
    shakeStage: shakeStage,
    triggerFakeoutFlicker: triggerFakeoutFlicker,
    cleanup: cleanup
  };

})(window);
