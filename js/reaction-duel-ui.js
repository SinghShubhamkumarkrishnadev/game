/* Jodi Sync — Quick Reaction Duel Presentation & Interaction Orchestrator
 * SOLID Architecture:
 * - Single Responsibility: Manages Reaction Duel UI components, mobile touch events, animation frames, and timer loops.
 * - Open/Closed: Uses modular sub-renderers for Scoreboard, Arena, Target, Timer, and Celebration Modal.
 * - Liskov Substitution: Human pointer and keyboard inputs follow unified event pipeline.
 * - Interface Segregation: Clean separation between domain engine (JodiReactionEngine), visual FX (JodiReactionFx), and UI.
 * Exposes: window.JodiReactionUI
 */
(function (global) {
  'use strict';

  var esc = function (s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var ctx = null;
  var _matchTimer = null;
  var _roundTimer = null;
  var _targetExpiryTimer = null;
  var _aiReactionTimer = null;
  var _aiFalseStartTimer = null;
  var _movingRaf = null;
  var _keyboardBound = false;

  function init(appContext) {
    ctx = appContext;
  }

  function getCtx() {
    return ctx || global.JodiContext || {};
  }

  function getEngine() {
    return global.JodiReactionEngine;
  }

  function getFx() {
    return global.JodiReactionFx;
  }

  function getAudio() {
    var c = getCtx();
    return c.Audio || global.JodiAudio;
  }

  function getNet() {
    var c = getCtx();
    return c.Net || global.JodiNet;
  }

  /* ═══════════════════════════════════════════════════════════════
   * 1. Sub-Renderers (Interface Segregation & Modularity)
   * ═══════════════════════════════════════════════════════════════ */

  /**
   * Renders the top match progress and frenzy bar
   */
  function _renderMatchTimer(game) {
    var totalMs = game.duration * 1000;
    var remainingMs = Math.max(0, game.remainingMs);
    var progressPct = Math.min(100, Math.max(0, (1 - (remainingMs / totalMs)) * 100));
    var secLeft = Math.ceil(remainingMs / 1000);
    var isFrenzy = game.currentPhase === 'frenzy';

    var phaseBadge = '';
    if (isFrenzy) {
      phaseBadge = '<div class="reaction-phase-pill frenzy-pulse">⚡ FRENZY MODE ⚡</div>';
    } else if (game.currentPhase === 'fast') {
      phaseBadge = '<div class="reaction-phase-pill fast-pill">⚡ FAST SPEED</div>';
    }

    return '<div class="reaction-timer-wrap">' +
      '<div class="reaction-timer-header">' +
        '<div class="reaction-time-badge ' + (isFrenzy ? 'is-frenzy' : '') + '">' +
          '<span class="reaction-timer-glyph">⏱️</span> ' +
          '<b>' + secLeft + 's</b>' +
        '</div>' +
        phaseBadge +
        '<button class="reaction-exit-icon-btn" data-action="reactionLeave" title="Exit Duel" aria-label="Exit Game">✕</button>' +
      '</div>' +
      '<div class="reaction-progress-bar-track" aria-hidden="true">' +
        '<div class="reaction-progress-bar-fill ' + (isFrenzy ? 'fill-frenzy' : '') + '" style="width:' + progressPct + '%"></div>' +
        '<div class="reaction-frenzy-marker" style="left:70%" title="Frenzy Phase at 70%">⚡</div>' +
      '</div>' +
    '</div>';
  }

  /**
   * Renders Head-to-Head Scoreboard
   */
  function _renderScoreboard(game) {
    var p1 = game.p1;
    var p2 = game.p2;

    var p1Streak = p1.streak >= 2 ? '<span class="reaction-streak-tag streak-p1">⚡ x' + p1.streak + '</span>' : '';
    var p2Streak = p2.streak >= 2 ? '<span class="reaction-streak-tag streak-p2">⚡ x' + p2.streak + '</span>' : '';

    return '<div class="reaction-scoreboard">' +
      // Player 1 Card (Left - Me / Host)
      '<div class="reaction-player-score is-p1 ' + (p1.streak >= 3 ? 'has-streak' : '') + '">' +
        '<div class="reaction-p-avatar-wrap">' +
          '<span class="reaction-p-avatar">' + p1.avatar + '</span>' +
          p1Streak +
        '</div>' +
        '<div class="reaction-p-info">' +
          '<div class="reaction-p-name">' + esc(p1.name) + ' <span class="reaction-p-tag">(Aap)</span></div>' +
          '<div class="reaction-p-pts" id="reactionScoreP1">' + p1.score + '</div>' +
        '</div>' +
      '</div>' +

      // VS & Micro-round count
      '<div class="reaction-vs-divider">' +
        '<span class="reaction-vs-badge">VS</span>' +
        '<span class="reaction-round-num">R' + (game.roundNumber || 1) + '</span>' +
      '</div>' +

      // Player 2 Card (Right - Partner / AI)
      '<div class="reaction-player-score is-p2 ' + (p2.streak >= 3 ? 'has-streak' : '') + '">' +
        '<div class="reaction-p-avatar-wrap">' +
          '<span class="reaction-p-avatar">' + p2.avatar + '</span>' +
          p2Streak +
        '</div>' +
        '<div class="reaction-p-info">' +
          '<div class="reaction-p-name">' + esc(p2.name) + '</div>' +
          '<div class="reaction-p-pts" id="reactionScoreP2">' + p2.score + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /**
   * Renders a live spawned target
   */
  function _renderTarget(target) {
    if (!target) return '';

    var style = 'left:' + target.x + '%; top:' + target.y + '%; width:' + target.size + 'px; height:' + target.size + 'px;';

    return '<div class="reaction-target reaction-target-' + target.type + '" ' +
      'id="reactionTargetEl" ' +
      'data-action="reactionTargetTap" ' +
      'data-target-id="' + target.id + '" ' +
      'data-target-type="' + target.type + '" ' +
      'style="' + style + '" ' +
      'role="button" ' +
      'aria-label="' + target.name + ' Target">' +
      '<div class="reaction-target-ring-outer"></div>' +
      '<div class="reaction-target-ring-inner"></div>' +
      '<div class="reaction-target-glyph">' + target.glyph + '</div>' +
      '<div class="reaction-target-pts-tag">' + (target.points > 0 ? '+' + target.points : target.points) + '</div>' +
    '</div>';
  }

  /**
   * Renders the Central Arena
   */
  function _renderArena(game) {
    var state = game.state;
    var innerHtml = '';
    var isFrenzy = game.currentPhase === 'frenzy';

    if (state === 'COUNTDOWN') {
      innerHtml = '<div class="reaction-arena-center-msg">' +
        '<div class="reaction-countdown-glyph">⚡</div>' +
        '<div class="reaction-countdown-num">' + (game.countdownSec > 0 ? game.countdownSec : 'READY!') + '</div>' +
        '<div class="reaction-countdown-hint">Target aate hi sabse pehle tap karo!</div>' +
      '</div>';
    } else if (state === 'WAITING') {
      innerHtml = '<div class="reaction-arena-center-msg reaction-waiting-pulse">' +
        '<div class="reaction-wait-spinner"></div>' +
        '<div class="reaction-wait-text">WAIT... RUKO</div>' +
        '<div class="reaction-wait-sub">Pehle tap kiya to False Start lag jayega!</div>' +
      '</div>';
    } else if (state === 'TARGET_ACTIVE') {
      innerHtml = _renderTarget(game.currentTarget);
    } else if (state === 'RESOLVED') {
      var callout = game.callout;
      var cText = callout ? callout.text : '';
      var isBad = callout && (callout.type === 'FALSE_START' || callout.type === 'BOMB');
      innerHtml = '<div class="reaction-callout-banner ' + (isBad ? 'callout-bad' : 'callout-good') + '">' +
        esc(cText) +
      '</div>';
    }

    return '<div class="reaction-arena ' + (isFrenzy ? 'is-frenzy' : '') + '" id="reactionArena" data-action="reactionArenaTap">' +
      '<canvas class="reaction-fx-canvas" id="reactionFxCanvas"></canvas>' +
      '<div class="reaction-arena-bg-grid" aria-hidden="true"></div>' +
      innerHtml +
      '<div class="reaction-arena-safe-hint" aria-hidden="true">🎯 Fast Reflex Arena</div>' +
    '</div>';
  }

  /**
   * Renders Celebration & Results Bottom Sheet Modal
   */
  function _renderCelebrationModal(game) {
    if (game.state !== 'FINISHED') return '';

    var Engine = getEngine();
    var p1 = game.p1;
    var p2 = game.p2;

    var isDraw = game.isDraw;
    var winner = game.winner === 'p1' ? p1 : (game.winner === 'p2' ? p2 : null);
    var runnerUp = game.winner === 'p1' ? p2 : (game.winner === 'p2' ? p1 : null);

    var headline = isDraw ? 'Barabar Takkar! 🤝' : (winner ? winner.name + ' Jeet Gaye! 🏆' : 'Khel Khatam!');
    var subtext = isDraw
      ? 'Dono ke reflexes kamaal ke the! Score bilkul barabar raha.'
      : (winner ? winner.name + ' ne super-fast reflexes se baazi maar li!' : '');

    var p1Avg = Engine ? Engine.getAverageReaction(p1.reactionTimes) : 0;
    var p2Avg = Engine ? Engine.getAverageReaction(p2.reactionTimes) : 0;

    return '<div class="reaction-celebration-backdrop" id="reactionCelebrationModal">' +
      '<div class="reaction-celebration-sheet">' +
        '<div class="reaction-win-crown">' + (isDraw ? '🤝' : '🥇') + '</div>' +
        '<h2 class="reaction-win-title">' + esc(headline) + '</h2>' +
        '<p class="reaction-win-sub">' + esc(subtext) + '</p>' +

        // Head to Head Results Card
        '<div class="reaction-result-cards-grid">' +
          // P1 Card
          '<div class="reaction-result-card ' + (game.winner === 'p1' ? 'is-winner' : (isDraw ? 'is-draw' : 'is-runner')) + '">' +
            '<div class="reaction-res-header">' +
              '<span class="reaction-res-avatar">' + p1.avatar + '</span>' +
              '<span class="reaction-res-name">' + esc(p1.name) + '</span>' +
              (game.winner === 'p1' ? '<span class="reaction-res-badge">WINNER 👑</span>' : '') +
            '</div>' +
            '<div class="reaction-res-score">' + p1.score + ' <small>PTS</small></div>' +
            '<div class="reaction-res-stats">' +
              '<div class="reaction-stat-row"><span>Fastest:</span> <b>' + (p1.fastestMs ? p1.fastestMs + 'ms ⚡' : '—') + '</b></div>' +
              '<div class="reaction-stat-row"><span>Avg Reflex:</span> <b>' + (p1Avg ? p1Avg + 'ms' : '—') + '</b></div>' +
              '<div class="reaction-stat-row"><span>Max Streak:</span> <b>🔥 x' + p1.maxStreak + '</b></div>' +
              '<div class="reaction-stat-row"><span>Hits / Bombs:</span> <b>' + p1.hits + ' / ' + p1.bombsHit + '</b></div>' +
            '</div>' +
          '</div>' +

          // P2 Card
          '<div class="reaction-result-card ' + (game.winner === 'p2' ? 'is-winner' : (isDraw ? 'is-draw' : 'is-runner')) + '">' +
            '<div class="reaction-res-header">' +
              '<span class="reaction-res-avatar">' + p2.avatar + '</span>' +
              '<span class="reaction-res-name">' + esc(p2.name) + '</span>' +
              (game.winner === 'p2' ? '<span class="reaction-res-badge">WINNER 👑</span>' : '') +
            '</div>' +
            '<div class="reaction-res-score">' + p2.score + ' <small>PTS</small></div>' +
            '<div class="reaction-res-stats">' +
              '<div class="reaction-stat-row"><span>Fastest:</span> <b>' + (p2.fastestMs ? p2.fastestMs + 'ms ⚡' : '—') + '</b></div>' +
              '<div class="reaction-stat-row"><span>Avg Reflex:</span> <b>' + (p2Avg ? p2Avg + 'ms' : '—') + '</b></div>' +
              '<div class="reaction-stat-row"><span>Max Streak:</span> <b>🔥 x' + p2.maxStreak + '</b></div>' +
              '<div class="reaction-stat-row"><span>Hits / Bombs:</span> <b>' + p2.hits + ' / ' + p2.bombsHit + '</b></div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // Rematch & Exit Action Buttons
        '<div class="reaction-modal-actions">' +
          '<button class="btn gold reaction-modal-btn" data-action="reactionPlayAgain">Dobara Khelo 🔄</button>' +
          '<button class="btn ghost reaction-modal-btn" data-action="reactionLeave">Exit 🏠</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ═══════════════════════════════════════════════════════════════
   * 2. Main Game View Renderer
   * ═══════════════════════════════════════════════════════════════ */
  function vGame() {
    var c = getCtx();
    var game = c.state ? c.state.reactionGame : null;
    if (!game) {
      return '<section class="screen reaction-screen"><div class="reaction-loading">Loading Reaction Duel...</div></section>';
    }

    return '<section class="screen reaction-screen">' +
      _renderMatchTimer(game) +
      _renderScoreboard(game) +
      _renderArena(game) +
      _renderCelebrationModal(game) +
    '</section>';
  }

  /* ═══════════════════════════════════════════════════════════════
   * 3. Game Loops & Timing Orchestrator
   * ═══════════════════════════════════════════════════════════════ */

  /**
   * Starts the initial 3 -> 2 -> 1 countdown then enters micro-round loop
   */
  function _startCountdownSequence() {
    var c = getCtx();
    var game = c.state ? c.state.reactionGame : null;
    if (!game) return;

    game.state = 'COUNTDOWN';
    game.countdownSec = 3;
    var Audio = getAudio();
    if (Audio && Audio.playTick) Audio.playTick(false);
    _partialRender();

    var cdTimer = setInterval(function () {
      if (!c.state || !c.state.reactionGame || c.state.screen !== 'reaction') {
        clearInterval(cdTimer);
        return;
      }
      game.countdownSec -= 1;
      if (game.countdownSec > 0) {
        if (Audio && Audio.playTick) Audio.playTick(false);
        _partialRender();
      } else {
        clearInterval(cdTimer);
        if (Audio && Audio.playTap) Audio.playTap();
        _startMatchClock();
        _scheduleNextMicroRound();
      }
    }, 900);
  }

  /**
   * Starts match countdown clock (100ms intervals)
   */
  function _startMatchClock() {
    var c = getCtx();
    var game = c.state ? c.state.reactionGame : null;
    if (!game) return;

    game.matchStartedAt = Date.now();
    var Engine = getEngine();
    var Audio = getAudio();
    var lastPhase = game.currentPhase;

    if (_matchTimer) clearInterval(_matchTimer);

    _matchTimer = setInterval(function () {
      if (!c.state || !c.state.reactionGame || c.state.screen !== 'reaction') {
        _stopAllTimers();
        return;
      }

      game.remainingMs = Math.max(0, game.remainingMs - 100);
      var currentPhase = Engine ? Engine.calculatePhase(game.remainingMs, game.duration) : 'normal';

      if (currentPhase !== game.currentPhase) {
        game.currentPhase = currentPhase;
        if (currentPhase === 'frenzy') {
          if (Audio && Audio.playFrenzySting) Audio.playFrenzySting();
          var arena = document.getElementById('reactionArena');
          var Fx = getFx();
          if (Fx && arena) Fx.shakeArena(arena, true);
        }
      }

      // Update timer DOM directly for smooth performance without full screen re-render
      _updateTimerDom(game);

      if (game.remainingMs <= 0) {
        _finishMatch();
      }
    }, 100);
  }

  /**
   * Efficiently updates the timer bar in DOM without tearing down arena
   */
  function _updateTimerDom(game) {
    var totalMs = game.duration * 1000;
    var progressPct = Math.min(100, Math.max(0, (1 - (game.remainingMs / totalMs)) * 100));
    var secLeft = Math.ceil(game.remainingMs / 1000);

    var fillEl = document.querySelector('.reaction-progress-bar-fill');
    var badgeEl = document.querySelector('.reaction-time-badge b');
    var phaseWrap = document.querySelector('.reaction-phase-pill');

    if (fillEl) {
      fillEl.style.width = progressPct + '%';
      if (game.currentPhase === 'frenzy') fillEl.classList.add('fill-frenzy');
    }
    if (badgeEl) badgeEl.textContent = secLeft + 's';

    if (game.currentPhase === 'frenzy') {
      var arena = document.getElementById('reactionArena');
      if (arena) arena.classList.add('is-frenzy');
    }
  }

  /**
   * Schedules next micro-round with random delay
   */
  function _scheduleNextMicroRound() {
    var c = getCtx();
    var game = c.state ? c.state.reactionGame : null;
    if (!game || game.remainingMs <= 0) return;

    var Engine = getEngine();
    if (!Engine) return;

    game.state = 'WAITING';
    game.currentTarget = null;
    game.roundNumber += 1;
    _partialRender();

    var delayMs = Engine.getRandomSpawnDelay(game.currentPhase);

    // Solo Mode: occasional AI false start simulation (4-8% probability)
    if (game.isSolo) {
      var aiFalseProb = game.currentPhase === 'frenzy' ? 0.08 : 0.04;
      if (Math.random() < aiFalseProb) {
        _aiFalseStartTimer = setTimeout(function () {
          if (game.state === 'WAITING') {
            _handleFalseStart('p2');
          }
        }, Math.floor(delayMs * 0.5));
      }
    }

    if (_roundTimer) clearTimeout(_roundTimer);
    _roundTimer = setTimeout(function () {
      if (!c.state || !c.state.reactionGame || game.remainingMs <= 0) return;
      _spawnTarget();
    }, delayMs);
  }

  /**
   * Spawns target in the arena
   */
  function _spawnTarget() {
    var c = getCtx();
    var game = c.state ? c.state.reactionGame : null;
    if (!game || game.remainingMs <= 0) return;

    var Engine = getEngine();
    if (!Engine) return;

    var target = Engine.generateTarget(game.currentPhase);
    game.currentTarget = target;
    game.state = 'TARGET_ACTIVE';
    game.targetSpawnedAt = target.spawnedAt;

    var Audio = getAudio();
    if (Audio && Audio.playTap) Audio.playTap();

    _partialRender();

    // Solo Mode AI reaction
    if (game.isSolo) {
      var aiDecision = Engine.getAiReactionDecision(game.currentPhase, target.type);
      if (aiDecision.willTap) {
        _aiReactionTimer = setTimeout(function () {
          if (game.state === 'TARGET_ACTIVE' && game.currentTarget && game.currentTarget.id === target.id) {
            handleTargetTap(target.id, 'p2');
          }
        }, aiDecision.delayMs);
      }
    }

    // Moving target dynamic drift
    if (target.type === 'moving') {
      _startMovingAnimation(target);
    }

    // Target lifespan expiration timer
    if (_targetExpiryTimer) clearTimeout(_targetExpiryTimer);
    _targetExpiryTimer = setTimeout(function () {
      if (game.state === 'TARGET_ACTIVE' && game.currentTarget && game.currentTarget.id === target.id) {
        _handleTargetExpired(target);
      }
    }, target.lifespan);
  }

  /**
   * Smoothly moves a drifting target using requestAnimationFrame
   */
  function _startMovingAnimation(target) {
    if (_movingRaf) cancelAnimationFrame(_movingRaf);
    var startTime = Date.now();

    function step() {
      var targetEl = document.getElementById('reactionTargetEl');
      if (!targetEl || !target) return;

      var elapsed = (Date.now() - startTime) / 1000;
      var curX = target.x + (target.vx * elapsed);
      var curY = target.y + (target.vy * elapsed);

      // Bounce off walls within 12% to 88%
      if (curX <= 12 || curX >= 88) target.vx *= -1;
      if (curY <= 15 || curY >= 85) target.vy *= -1;

      target.x = Math.max(12, Math.min(88, curX));
      target.y = Math.max(15, Math.min(85, curY));

      targetEl.style.left = target.x + '%';
      targetEl.style.top = target.y + '%';

      _movingRaf = requestAnimationFrame(step);
    }
    _movingRaf = requestAnimationFrame(step);
  }

  /**
   * Handles target expiration when no player taps in time
   */
  function _handleTargetExpired(target) {
    var c = getCtx();
    var game = c.state ? c.state.reactionGame : null;
    if (!game) return;

    if (_movingRaf) {
      cancelAnimationFrame(_movingRaf);
      _movingRaf = null;
    }

    var Audio = getAudio();
    if (target.type === 'bomb') {
      // Safe! Bomb was avoided!
      game.callout = {
        type: 'AVOIDED',
        text: '🛡️ Safe! Bomb avoided!'
      };
      if (Audio && Audio.playPop) Audio.playPop();
    } else {
      // Normal target missed
      game.callout = {
        type: 'MISSED',
        text: '⏳ Missed! Kaun so raha tha?'
      };
      if (Audio && Audio.playMiss) Audio.playMiss();
    }

    game.state = 'RESOLVED';
    game.currentTarget = null;
    _partialRender();

    setTimeout(function () {
      if (game && game.remainingMs > 0) {
        _scheduleNextMicroRound();
      }
    }, 380);
  }

  /**
   * Handles False Start
   */
  function _handleFalseStart(playerKey) {
    var c = getCtx();
    var game = c.state ? c.state.reactionGame : null;
    if (!game || game.state !== 'WAITING') return;

    var Engine = getEngine();
    var Audio = getAudio();
    var Fx = getFx();

    var result = Engine.processFalseStart(game, playerKey);
    if (!result) return;

    if (_roundTimer) clearTimeout(_roundTimer);
    if (_aiFalseStartTimer) clearTimeout(_aiFalseStartTimer);

    // Audio & Screen Flash
    if (Audio && Audio.playFalseStart) Audio.playFalseStart();
    var arena = document.getElementById('reactionArena');
    if (Fx && arena) {
      Fx.flashRed(arena);
      Fx.shakeArena(arena, false);
    }

    game.state = 'RESOLVED';
    _partialRender();

    // Roll immediately into next round after 450ms
    setTimeout(function () {
      if (game && game.remainingMs > 0) {
        _scheduleNextMicroRound();
      }
    }, 450);
  }

  /**
   * Handles Target Tap
   */
  function handleTargetTap(targetId, playerKeyOverride, clientX, clientY) {
    var c = getCtx();
    var game = c.state ? c.state.reactionGame : null;
    if (!game || game.state !== 'TARGET_ACTIVE' || !game.currentTarget) return;

    var playerKey = playerKeyOverride || 'p1'; // Default p1 (Local Player)
    var target = game.currentTarget;
    if (target.id !== targetId) return;

    var Engine = getEngine();
    var Audio = getAudio();
    var Fx = getFx();

    if (_targetExpiryTimer) clearTimeout(_targetExpiryTimer);
    if (_aiReactionTimer) clearTimeout(_aiReactionTimer);
    if (_movingRaf) {
      cancelAnimationFrame(_movingRaf);
      _movingRaf = null;
    }

    var callout = Engine.processTargetTap(game, playerKey, targetId, Date.now());
    if (!callout) return;

    // Visual FX & Audio
    var arena = document.getElementById('reactionArena');
    var arenaRect = arena ? arena.getBoundingClientRect() : null;
    var x = arenaRect && clientX ? (clientX - arenaRect.left) : (arenaRect ? (arenaRect.width * (target.x / 100)) : 150);
    var y = arenaRect && clientY ? (clientY - arenaRect.top) : (arenaRect ? (arenaRect.height * (target.y / 100)) : 150);

    if (target.type === 'bomb') {
      if (Audio && Audio.playBomb) Audio.playBomb();
      if (Fx && arena) {
        Fx.burstBomb(x, y);
        Fx.shakeArena(arena, true);
        Fx.flashRed(arena);
      }
    } else {
      if (Audio && Audio.playHit) Audio.playHit();
      if (Fx) {
        Fx.burstHit(x, y, target.type);
        if (callout.streak >= 3) {
          Fx.burstStreak(x, y, callout.streak);
          if (Audio && Audio.playStreak) Audio.playStreak();
        }
      }
    }

    // Multiplayer sync if connected
    var Net = getNet();
    if (Net && Net.getStatus() === 'connected' && !game.isSolo) {
      Net.send('REACTION_HIT', {
        targetId: targetId,
        playerKey: playerKey,
        targetType: target.type,
        points: callout.points,
        streak: callout.streak,
        reactionMs: callout.reactionMs
      });
    }

    game.state = 'RESOLVED';
    game.currentTarget = null;
    _partialRender();

    // Fast cadence: next round starts in 340ms
    setTimeout(function () {
      if (game && game.remainingMs > 0) {
        _scheduleNextMicroRound();
      }
    }, 340);
  }

  /**
   * Handles Arena tap (false start during WAITING or tap miss)
   */
  function handleArenaTap(e) {
    var c = getCtx();
    var game = c.state ? c.state.reactionGame : null;
    if (!game) return;

    if (game.state === 'WAITING' || game.state === 'COUNTDOWN') {
      _handleFalseStart('p1');
    }
  }

  /**
   * Finalizes the match and presents celebration modal
   */
  function _finishMatch() {
    _stopAllTimers();
    var c = getCtx();
    var game = c.state ? c.state.reactionGame : null;
    if (!game) return;

    var Engine = getEngine();
    if (Engine) Engine.finalizeMatch(game);

    var Audio = getAudio();
    if (Audio && Audio.playMatch) Audio.playMatch();

    if (c.burstCenter) c.burstCenter(40);

    // Multiplayer sync final result
    var Net = getNet();
    if (Net && Net.getStatus() === 'connected' && !game.isSolo && Net.isHostUser()) {
      Net.send('REACTION_FINISH', {
        winner: game.winner,
        isDraw: game.isDraw,
        p1Score: game.p1.score,
        p2Score: game.p2.score
      });
    }

    _partialRender();
  }

  function _stopAllTimers() {
    if (_matchTimer) {
      clearInterval(_matchTimer);
      _matchTimer = null;
    }
    if (_roundTimer) {
      clearTimeout(_roundTimer);
      _roundTimer = null;
    }
    if (_targetExpiryTimer) {
      clearTimeout(_targetExpiryTimer);
      _targetExpiryTimer = null;
    }
    if (_aiReactionTimer) {
      clearTimeout(_aiReactionTimer);
      _aiReactionTimer = null;
    }
    if (_aiFalseStartTimer) {
      clearTimeout(_aiFalseStartTimer);
      _aiFalseStartTimer = null;
    }
    if (_movingRaf) {
      cancelAnimationFrame(_movingRaf);
      _movingRaf = null;
    }
  }

  /**
   * Re-renders the current screen view cleanly
   */
  function _partialRender() {
    var c = getCtx();
    if (c.render) {
      c.render();
    } else {
      var view = document.getElementById('view');
      if (view) view.innerHTML = vGame();
      bindArenaEvents();
    }
  }

  /* ═══════════════════════════════════════════════════════════════
   * 4. Event Binding (Zero-Lag Mobile Pointer & Keyboard)
   * ═══════════════════════════════════════════════════════════════ */
  function bindArenaEvents() {
    var canvas = document.getElementById('reactionFxCanvas');
    var Fx = getFx();
    if (canvas && Fx) {
      Fx.setCanvas(canvas);
    }

    var arena = document.getElementById('reactionArena');
    if (!arena) return;

    // Use pointerdown for instant touch without 300ms delay
    arena.onpointerdown = function (e) {
      var targetEl = e.target.closest('[data-action="reactionTargetTap"]');
      if (targetEl) {
        e.preventDefault();
        e.stopPropagation();
        var targetId = targetEl.dataset.targetId;
        handleTargetTap(targetId, 'p1', e.clientX, e.clientY);
      } else {
        handleArenaTap(e);
      }
    };

    // Desktop Keyboard support: Spacebar or Enter taps
    if (!_keyboardBound) {
      _keyboardBound = true;
      window.addEventListener('keydown', function (e) {
        var c = getCtx();
        if (!c.state || c.state.screen !== 'reaction') return;
        if (e.code === 'Space' || e.key === ' ' || e.code === 'Enter') {
          e.preventDefault();
          var game = c.state.reactionGame;
          if (!game) return;
          if (game.state === 'TARGET_ACTIVE' && game.currentTarget) {
            handleTargetTap(game.currentTarget.id, 'p1');
          } else if (game.state === 'WAITING' || game.state === 'COUNTDOWN') {
            _handleFalseStart('p1');
          }
        }
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════════
   * 5. Public API: Solo Launcher & Lifecycle
   * ═══════════════════════════════════════════════════════════════ */
  function launchSolo(options) {
    var c = getCtx();
    var Engine = getEngine();
    if (!Engine) return;

    var profile = c.profile || { name: 'Player', avatar: '💖' };
    var opts = options || {};

    _stopAllTimers();

    var game = Engine.createGame({
      duration: opts.duration || 15,
      hardMode: !!opts.hardMode,
      isSolo: true,
      p1Name: profile.name,
      p1Avatar: profile.avatar,
      p2Name: 'AI Reflex 🤖',
      p2Avatar: '⚡'
    });

    c.state.reactionGame = game;
    c.state.screen = 'reaction';

    var Audio = getAudio();
    if (Audio && Audio.playTap) Audio.playTap();

    _partialRender();
    _startCountdownSequence();
  }

  function resetMatch(preserveScores) {
    var c = getCtx();
    var game = c.state ? c.state.reactionGame : null;
    if (!game) return;

    var Engine = getEngine();
    var prevP1Score = preserveScores ? game.p1.score : 0;
    var prevP2Score = preserveScores ? game.p2.score : 0;

    _stopAllTimers();

    var newGame = Engine.createGame({
      duration: game.duration,
      hardMode: game.hardMode,
      isSolo: game.isSolo,
      p1Name: game.p1.name,
      p1Avatar: game.p1.avatar,
      p2Name: game.p2.name,
      p2Avatar: game.p2.avatar
    });

    if (preserveScores) {
      newGame.p1.score = prevP1Score;
      newGame.p2.score = prevP2Score;
    }

    c.state.reactionGame = newGame;
    _partialRender();
    _startCountdownSequence();
  }

  function cleanup() {
    _stopAllTimers();
    var Fx = getFx();
    if (Fx) Fx.cleanup();
  }

  global.JodiReactionUI = {
    init: init,
    vGame: vGame,
    bindArenaEvents: bindArenaEvents,
    launchSolo: launchSolo,
    resetMatch: resetMatch,
    handleTargetTap: handleTargetTap,
    handleArenaTap: handleArenaTap,
    startCountdownSequence: _startCountdownSequence,
    cleanup: cleanup
  };

})(window);
