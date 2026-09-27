/* Jodi Sync — Rock Paper Scissors Battle Presentation & Interaction Orchestrator
 * SOLID Architecture:
 * - Single Responsibility: Manages RPS Battle UI components, countdown flow, fake-out animations, and move selection.
 * - Open/Closed: Distinct modular sub-renderers for Scoreboard, Stage, Controls, Specials, and Celebration Modal.
 * - Interface Segregation: Clean separation between domain rules, particle FX, and DOM view layers.
 * Exposes: window.JodiRPSUI
 */
(function (global) {
  'use strict';

  var esc = function (s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var ctx = null;
  var _roundCountdownTimer = null;
  var _autoAdvanceTimer = null;
  var _keyboardBound = false;

  function init(appContext) {
    ctx = appContext;
  }

  function getCtx() {
    return ctx || global.JodiContext || {};
  }

  function getEngine() {
    return global.JodiRPSEngine;
  }

  function getFx() {
    return global.JodiRPSFx;
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
   * 1. Modular Sub-Renderers
   * ═══════════════════════════════════════════════════════════════ */

  /**
   * Renders the top match progress and scoreboard
   */
  function _renderScoreboard(game) {
    var p1 = game.p1;
    var p2 = game.p2;

    // Render 5 match progress pips (Best of 5)
    var pipsHtml = '';
    var totalPips = 5;
    for (var i = 0; i < totalPips; i++) {
      var rData = game.roundsHistory[i];
      var pipCls = 'pip-empty';
      var pipContent = '';
      if (rData) {
        if (rData.winner === 'p1') {
          pipCls = 'pip-p1';
          pipContent = '●';
        } else if (rData.winner === 'p2') {
          pipCls = 'pip-p2';
          pipContent = '●';
        } else {
          pipCls = 'pip-draw';
          pipContent = '—';
        }
      } else if (i === game.roundsHistory.length) {
        pipCls = 'pip-active';
      }
      pipsHtml += '<span class="rps-round-pip ' + pipCls + '">' + pipContent + '</span>';
    }

    var p1StreakBadge = p1.streak >= 2 ? '<span class="rps-streak-badge streak-p1">🔥 x' + p1.streak + '</span>' : '';
    var p2StreakBadge = p2.streak >= 2 ? '<span class="rps-streak-badge streak-p2">🔥 x' + p2.streak + '</span>' : '';

    return '<div class="rps-top-header">' +
      '<div class="rps-match-meta">' +
        '<div class="rps-round-indicator">ROUND <b>' + game.roundNumber + '</b> <span class="rps-pips-row">' + pipsHtml + '</span></div>' +
        '<button class="rps-exit-icon-btn" data-action="rpsLeave" title="Exit Battle" aria-label="Exit Game">✕</button>' +
      '</div>' +

      '<div class="rps-scoreboard">' +
        // Player 1 (Me)
        '<div class="rps-score-card is-p1 ' + (p1.streak >= 3 ? 'has-combo' : '') + '">' +
          '<div class="rps-p-avatar-wrap">' +
            '<span class="rps-p-avatar">' + p1.avatar + '</span>' +
            p1StreakBadge +
          '</div>' +
          '<div class="rps-p-meta">' +
            '<div class="rps-p-name">' + esc(p1.name) + ' <small>(Aap)</small></div>' +
            '<div class="rps-p-score">' + p1.score + ' <span class="rps-pts-sub">/ ' + game.targetWins + '</span></div>' +
          '</div>' +
        '</div>' +

        '<div class="rps-vs-divider">' +
          '<span class="rps-vs-glyph">⚔️</span>' +
        '</div>' +

        // Player 2 (Partner / AI)
        '<div class="rps-score-card is-p2 ' + (p2.streak >= 3 ? 'has-combo' : '') + '">' +
          '<div class="rps-p-avatar-wrap">' +
            '<span class="rps-p-avatar">' + p2.avatar + '</span>' +
            p2StreakBadge +
          '</div>' +
          '<div class="rps-p-meta">' +
            '<div class="rps-p-name">' + esc(p2.name) + '</div>' +
            '<div class="rps-p-score">' + p2.score + ' <span class="rps-pts-sub">/ ' + game.targetWins + '</span></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /**
   * Renders the spotlit duel battle stage
   */
  function _renderVSStage(game) {
    var p1 = game.p1;
    var p2 = game.p2;
    var Engine = getEngine();
    var moves = Engine ? Engine.MOVES : {};
    var state = game.state;
    var res = game.lastRoundResult;

    // Pedestal glyphs
    var p1Glyph = '❓';
    var p2Glyph = '❓';
    var p1SpecialTag = p1.activeSpecial ? '<span class="rps-special-active-pill">' + (Engine.SPECIALS[p1.activeSpecial].glyph) + '</span>' : '';
    var p2SpecialTag = p2.activeSpecial ? '<span class="rps-special-active-pill">' + (Engine.SPECIALS[p2.activeSpecial].glyph) + '</span>' : '';

    if (state === 'CHOOSING' || state === 'COUNTDOWN') {
      if (p1.currentMove && p1.activeSpecial !== 'mystery') {
        p1Glyph = moves[p1.currentMove] ? moves[p1.currentMove].glyph : '❓';
      }
      p2Glyph = '❓';
    } else if (state === 'FAKEOUT') {
      p1Glyph = '🪨';
      p2Glyph = '✂️';
    } else if (state === 'REVEAL' || state === 'RESULT' || state === 'FINISHED') {
      p1Glyph = (res && moves[res.p1Move]) ? moves[res.p1Move].glyph : (moves[p1.currentMove] ? moves[p1.currentMove].glyph : '🪨');
      p2Glyph = (res && moves[res.p2Move]) ? moves[res.p2Move].glyph : (moves[p2.currentMove] ? moves[p2.currentMove].glyph : '✂️');
    }

    // Pedestal status classes
    var p1PedestalCls = '';
    var p2PedestalCls = '';
    if (state === 'RESULT' || state === 'FINISHED') {
      if (res) {
        if (res.winner === 'p1') {
          p1PedestalCls = 'is-winner-attack';
          p2PedestalCls = 'is-loser-recoil';
        } else if (res.winner === 'p2') {
          p2PedestalCls = 'is-winner-attack';
          p1PedestalCls = 'is-loser-recoil';
        } else {
          p1PedestalCls = 'is-draw-clash';
          p2PedestalCls = 'is-draw-clash';
        }
      }
    }

    // Center Stage Status Text
    var centerStatusHtml = '';
    if (state === 'COUNTDOWN' || state === 'CHOOSING') {
      centerStatusHtml = '<div class="rps-countdown-wrap">' +
        '<div class="rps-countdown-timer">' + (game.countdownSec > 0 ? game.countdownSec : 'LOCK!') + '</div>' +
        '<div class="rps-countdown-sub">' + (p1.currentMove ? 'Move Locked in! ✓' : 'Apna move chuno...') + '</div>' +
      '</div>';
    } else if (state === 'FAKEOUT') {
      centerStatusHtml = '<div class="rps-fakeout-banner">🎭 BLUFFING...</div>';
    } else if (state === 'RESULT' || state === 'FINISHED') {
      var rText = res ? res.text : '';
      centerStatusHtml = '<div class="rps-result-headline ' + (res && res.winner === 'p1' ? 'res-win' : (res && res.winner === 'p2' ? 'res-lose' : 'res-draw')) + '">' +
        esc(rText) +
      '</div>';
    }

    // Combo callout banner
    var comboBannerHtml = '';
    if (p1.streak >= 3) {
      comboBannerHtml = '<div class="rps-combo-fire-banner">🔥 ' + esc(p1.name) + ' — ' + p1.streak + ' WIN COMBO!</div>';
    } else if (p2.streak >= 3) {
      comboBannerHtml = '<div class="rps-combo-fire-banner">🔥 ' + esc(p2.name) + ' — ' + p2.streak + ' WIN COMBO!</div>';
    }

    return '<div class="rps-stage" id="rpsStage">' +
      '<canvas class="rps-fx-canvas" id="rpsFxCanvas"></canvas>' +
      '<div class="rps-spotlight-beam" aria-hidden="true"></div>' +
      comboBannerHtml +

      '<div class="rps-combatants-row">' +
        // Player 1 Combatant
        '<div class="rps-combatant p1-side ' + p1PedestalCls + '">' +
          p1SpecialTag +
          '<div class="rps-hand-disc" id="rpsP1Hand">' + p1Glyph + '</div>' +
          '<div class="rps-combatant-name">' + esc(p1.name) + '</div>' +
        '</div>' +

        // Center Stage Clash Zone
        '<div class="rps-stage-center">' +
          centerStatusHtml +
        '</div>' +

        // Player 2 Combatant
        '<div class="rps-combatant p2-side ' + p2PedestalCls + '">' +
          p2SpecialTag +
          '<div class="rps-hand-disc" id="rpsP2Hand">' + p2Glyph + '</div>' +
          '<div class="rps-combatant-name">' + esc(p2.name) + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /**
   * Renders the 3 tactile Move Buttons (🪨 Rock, 📄 Paper, ✂️ Scissors)
   */
  function _renderMoveControls(game) {
    if (game.state === 'FINISHED') return '';

    var p1 = game.p1;
    var selected = p1.currentMove;
    var isLocked = game.state !== 'COUNTDOWN' && game.state !== 'CHOOSING';

    return '<div class="rps-controls-wrap">' +
      '<div class="rps-controls-header">' +
        '<span>Move Chuno (Choose Move)</span>' +
        '<small>' + (isLocked ? '🔒 Locked' : 'Tap to change') + '</small>' +
      '</div>' +
      '<div class="rps-moves-grid">' +
        // Rock Button
        '<button class="rps-move-btn move-rock ' + (selected === 'rock' ? 'is-selected' : '') + '" ' +
          'data-action="rpsMoveSelect" data-move="rock" ' + (isLocked ? 'disabled' : '') + '>' +
          '<span class="rps-move-glyph">🪨</span>' +
          '<span class="rps-move-label">Rock</span>' +
          '<span class="rps-move-sub">Beats ✂️</span>' +
          (selected === 'rock' ? '<span class="rps-lock-check">✓</span>' : '') +
        '</button>' +

        // Paper Button
        '<button class="rps-move-btn move-paper ' + (selected === 'paper' ? 'is-selected' : '') + '" ' +
          'data-action="rpsMoveSelect" data-move="paper" ' + (isLocked ? 'disabled' : '') + '>' +
          '<span class="rps-move-glyph">📄</span>' +
          '<span class="rps-move-label">Paper</span>' +
          '<span class="rps-move-sub">Beats 🪨</span>' +
          (selected === 'paper' ? '<span class="rps-lock-check">✓</span>' : '') +
        '</button>' +

        // Scissors Button
        '<button class="rps-move-btn move-scissors ' + (selected === 'scissors' ? 'is-selected' : '') + '" ' +
          'data-action="rpsMoveSelect" data-move="scissors" ' + (isLocked ? 'disabled' : '') + '>' +
          '<span class="rps-move-glyph">✂️</span>' +
          '<span class="rps-move-label">Scissors</span>' +
          '<span class="rps-move-sub">Beats 📄</span>' +
          (selected === 'scissors' ? '<span class="rps-lock-check">✓</span>' : '') +
        '</button>' +
      '</div>' +
    '</div>';
  }

  /**
   * Renders the Special Abilities Tray along the bottom
   */
  function _renderSpecialTray(game) {
    if (game.state === 'FINISHED') return '';

    var p1 = game.p1;
    var specials = p1.specials || {};
    var isLocked = game.state !== 'COUNTDOWN' && game.state !== 'CHOOSING';

    return '<div class="rps-specials-tray">' +
      '<div class="rps-specials-label">⚡ SPECIAL MOVES (1x Use)</div>' +
      '<div class="rps-specials-row">' +
        // Power Throw
        '<button class="rps-special-btn ' + (p1.activeSpecial === 'powerThrow' ? 'active' : '') + ' ' + (specials.powerThrow <= 0 ? 'used' : '') + '" ' +
          'data-action="rpsSpecialActivate" data-special="powerThrow" ' +
          (isLocked || specials.powerThrow <= 0 ? 'disabled' : '') + ' title="Super Giant Attack">' +
          '<span class="rps-spec-icon">💥</span>' +
          '<span class="rps-spec-text">Power Throw</span>' +
          '<span class="rps-spec-charges">' + (specials.powerThrow > 0 ? '1x' : '✕') + '</span>' +
        '</button>' +

        // Double Down
        '<button class="rps-special-btn ' + (p1.activeSpecial === 'doubleDown' ? 'active' : '') + ' ' + (specials.doubleDown <= 0 ? 'used' : '') + '" ' +
          'data-action="rpsSpecialActivate" data-special="doubleDown" ' +
          (isLocked || specials.doubleDown <= 0 ? 'disabled' : '') + ' title="Win = +2 Points!">' +
          '<span class="rps-spec-icon">⚡</span>' +
          '<span class="rps-spec-text">Double Down</span>' +
          '<span class="rps-spec-charges">' + (specials.doubleDown > 0 ? '1x' : '✕') + '</span>' +
        '</button>' +

        // Mystery Bluff
        '<button class="rps-special-btn ' + (p1.activeSpecial === 'mystery' ? 'active' : '') + ' ' + (specials.mystery <= 0 ? 'used' : '') + '" ' +
          'data-action="rpsSpecialActivate" data-special="mystery" ' +
          (isLocked || specials.mystery <= 0 ? 'disabled' : '') + ' title="Hide move until reveal">' +
          '<span class="rps-spec-icon">🎭</span>' +
          '<span class="rps-spec-text">Mystery</span>' +
          '<span class="rps-spec-charges">' + (specials.mystery > 0 ? '1x' : '✕') + '</span>' +
        '</button>' +
      '</div>' +
    '</div>';
  }

  /**
   * Renders the celebratory bottom-sheet modal upon match finish
   */
  function _renderCelebrationModal(game) {
    if (game.state !== 'FINISHED') return '';

    var p1 = game.p1;
    var p2 = game.p2;
    var winner = game.winner === 'p1' ? p1 : p2;
    var runnerUp = game.winner === 'p1' ? p2 : p1;

    var headline = winner.name + ' Jeet Gaye! 🏆';
    var subtext = 'Shandaar mind-game aur strategies se match jeeta!';

    // Render round transcript
    var transcriptHtml = game.roundsHistory.map(function (r) {
      var Engine = getEngine();
      var moves = Engine ? Engine.MOVES : {};
      var m1 = moves[r.p1Move] ? moves[r.p1Move].glyph : '—';
      var m2 = moves[r.p2Move] ? moves[r.p2Move].glyph : '—';
      var wTag = r.winner === 'p1' ? 'P1 +' + r.ptsAwarded : (r.winner === 'p2' ? 'P2 +' + r.ptsAwarded : 'Draw');
      return '<div class="rps-transcript-row">' +
        '<span>R' + r.roundNumber + '</span>' +
        '<b>' + m1 + ' vs ' + m2 + '</b>' +
        '<span class="rps-trans-winner ' + (r.winner === 'p1' ? 'win-p1' : (r.winner === 'p2' ? 'win-p2' : '')) + '">' + wTag + '</span>' +
      '</div>';
    }).join('');

    return '<div class="rps-celebration-backdrop" id="rpsCelebrationModal">' +
      '<div class="rps-celebration-sheet">' +
        '<div class="rps-win-crown">👑</div>' +
        '<h2 class="rps-win-title">' + esc(headline) + '</h2>' +
        '<p class="rps-win-sub">' + esc(subtext) + '</p>' +

        // Winner / Runner cards
        '<div class="rps-final-score-card">' +
          '<div class="rps-final-player is-winner">' +
            '<span class="rps-final-avatar">' + winner.avatar + '</span>' +
            '<div class="rps-final-name">' + esc(winner.name) + ' 🥇</div>' +
            '<div class="rps-final-score-val">' + winner.score + '</div>' +
          '</div>' +
          '<div class="rps-final-vs">VS</div>' +
          '<div class="rps-final-player is-runner">' +
            '<span class="rps-final-avatar">' + runnerUp.avatar + '</span>' +
            '<div class="rps-final-name">' + esc(runnerUp.name) + ' 🥈</div>' +
            '<div class="rps-final-score-val">' + runnerUp.score + '</div>' +
          '</div>' +
        '</div>' +

        // Match Transcript box
        '<div class="rps-transcript-box">' +
          '<div class="rps-trans-title">MATCH TRANSCRIPT</div>' +
          transcriptHtml +
        '</div>' +

        // Actions
        '<div class="rps-modal-actions">' +
          '<button class="btn gold rps-modal-btn" data-action="rpsPlayAgain">Dobara Khelo 🔄</button>' +
          '<button class="btn ghost rps-modal-btn" data-action="rpsLeave">Exit 🏠</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ═══════════════════════════════════════════════════════════════
   * 2. Main Screen View
   * ═══════════════════════════════════════════════════════════════ */
  function vGame() {
    var c = getCtx();
    var game = c.state ? c.state.rpsGame : null;
    if (!game) {
      return '<section class="screen rps-screen"><div class="rps-loading">Loading RPS Battle...</div></section>';
    }

    return '<section class="screen rps-screen">' +
      _renderScoreboard(game) +
      _renderVSStage(game) +
      _renderMoveControls(game) +
      _renderSpecialTray(game) +
      _renderCelebrationModal(game) +
    '</section>';
  }

  /* ═══════════════════════════════════════════════════════════════
   * 3. Round Lifecycle & Animation Sequencing
   * ═══════════════════════════════════════════════════════════════ */

  /**
   * Starts the 3 -> 2 -> 1 -> LOCK countdown for the current round
   */
  function _startRoundCountdown() {
    var c = getCtx();
    var game = c.state ? c.state.rpsGame : null;
    if (!game || game.state === 'FINISHED') return;

    _stopAllTimers();

    game.state = 'COUNTDOWN';
    game.countdownSec = 3;
    game.p1.currentMove = null;
    game.p2.currentMove = null;

    var Audio = getAudio();
    if (Audio && Audio.playTick) Audio.playTick(false);
    _partialRender();

    _roundCountdownTimer = setInterval(function () {
      if (!c.state || !c.state.rpsGame || c.state.screen !== 'rps') {
        _stopAllTimers();
        return;
      }

      game.countdownSec -= 1;
      if (game.countdownSec > 0) {
        if (Audio && Audio.playTick) Audio.playTick(false);
        _partialRender();
      } else {
        clearInterval(_roundCountdownTimer);
        _roundCountdownTimer = null;
        _lockAndExecuteRound();
      }
    }, 900);
  }

  /**
   * Locks moves, executes fake-out flicker, then reveals outcome with attack animations
   */
  function _lockAndExecuteRound() {
    var c = getCtx();
    var game = c.state ? c.state.rpsGame : null;
    if (!game) return;

    var Engine = getEngine();
    var Audio = getAudio();
    var Fx = getFx();

    // Default random move if player didn't pick in time
    if (!game.p1.currentMove) {
      game.p1.currentMove = Engine ? Engine.pickRandomMove() : 'rock';
    }

    // Solo Mode: AI decides move & special
    if (game.isSolo && Engine) {
      game.p2.currentMove = Engine.decideAiMove(game);
      Engine.decideAiSpecial(game);
    }

    game.state = 'FAKEOUT';
    if (Audio && Audio.playWhoosh) Audio.playWhoosh();
    _partialRender();

    // Trigger fake-out flicker on both hands (approx 270ms)
    var p1Hand = document.getElementById('rpsP1Hand');
    var p2Hand = document.getElementById('rpsP2Hand');

    var p1FinalGlyph = Engine.MOVES[game.p1.currentMove].glyph;
    var p2FinalGlyph = Engine.MOVES[game.p2.currentMove].glyph;

    if (Fx) {
      Fx.triggerFakeoutFlicker(p1Hand, p1FinalGlyph);
      Fx.triggerFakeoutFlicker(p2Hand, p2FinalGlyph, function () {
        _resolveAndAnimateClash();
      });
    } else {
      setTimeout(_resolveAndAnimateClash, 300);
    }
  }

  /**
   * Resolves round outcome and plays attack/slam animation
   */
  function _resolveAndAnimateClash() {
    var c = getCtx();
    var game = c.state ? c.state.rpsGame : null;
    if (!game) return;

    var Engine = getEngine();
    var Audio = getAudio();
    var Fx = getFx();

    var result = Engine.resolveRound(game);

    // Audio & Shockwaves
    if (Audio) {
      if (Audio.playClash) Audio.playClash();
      if ((result.winner === 'p1' && game.p1.streak >= 3) || (result.winner === 'p2' && game.p2.streak >= 3)) {
        if (Audio.playComboSting) Audio.playComboSting();
      }
    }

    var stage = document.getElementById('rpsStage');
    if (Fx && stage) {
      var rect = stage.getBoundingClientRect();
      var cx = rect.width / 2;
      var cy = rect.height / 2;
      Fx.burstClash(cx, cy, result.isPowerThrow);
      Fx.shakeStage(stage, result.isPowerThrow || result.isDoubleDown);
    }

    // Multiplayer sync if connected
    var Net = getNet();
    if (Net && Net.getStatus() === 'connected' && !game.isSolo) {
      Net.send('RPS_MOVE', {
        roundNumber: game.roundNumber,
        move: game.p1.currentMove,
        special: game.p1.activeSpecial
      });
    }

    _partialRender();

    // Auto-advance to next round after 1.4s if match isn't finished
    if (game.state !== 'FINISHED') {
      if (_autoAdvanceTimer) clearTimeout(_autoAdvanceTimer);
      _autoAdvanceTimer = setTimeout(function () {
        if (game.state !== 'FINISHED') {
          game.roundNumber += 1;
          _startRoundCountdown();
        }
      }, 1400);
    } else {
      // Match Finished! Celebratory fanfare
      if (Audio && Audio.playMatch) Audio.playMatch();
      if (c.burstCenter) c.burstCenter(40);
    }
  }

  function _stopAllTimers() {
    if (_roundCountdownTimer) {
      clearInterval(_roundCountdownTimer);
      _roundCountdownTimer = null;
    }
    if (_autoAdvanceTimer) {
      clearTimeout(_autoAdvanceTimer);
      _autoAdvanceTimer = null;
    }
  }

  function _partialRender() {
    var c = getCtx();
    if (c.render) {
      c.render();
    } else {
      var view = document.getElementById('view');
      if (view) view.innerHTML = vGame();
      bindRoundEvents();
    }
  }

  /* ═══════════════════════════════════════════════════════════════
   * 4. User Interaction Handlers
   * ═══════════════════════════════════════════════════════════════ */

  function handleMoveSelect(move) {
    var c = getCtx();
    var game = c.state ? c.state.rpsGame : null;
    if (!game || (game.state !== 'COUNTDOWN' && game.state !== 'CHOOSING')) return;

    game.p1.currentMove = move;
    var Audio = getAudio();
    if (Audio && Audio.playTap) Audio.playTap();

    _partialRender();
  }

  function handleSpecialActivate(specialId) {
    var c = getCtx();
    var game = c.state ? c.state.rpsGame : null;
    if (!game || (game.state !== 'COUNTDOWN' && game.state !== 'CHOOSING')) return;

    var p1 = game.p1;
    if (!p1.specials || p1.specials[specialId] <= 0) return;

    if (p1.activeSpecial === specialId) {
      // Toggle off
      p1.activeSpecial = null;
    } else {
      // Activate
      p1.activeSpecial = specialId;
      p1.specials[specialId] -= 1;
      var Audio = getAudio();
      if (Audio && Audio.playSpecialActivate) Audio.playSpecialActivate();
    }

    _partialRender();
  }

  function bindRoundEvents() {
    var canvas = document.getElementById('rpsFxCanvas');
    var Fx = getFx();
    if (canvas && Fx) {
      Fx.setCanvas(canvas);
    }

    // Keyboard support: 1 = Rock, 2 = Paper, 3 = Scissors
    if (!_keyboardBound) {
      _keyboardBound = true;
      window.addEventListener('keydown', function (e) {
        var c = getCtx();
        if (!c.state || c.state.screen !== 'rps') return;
        if (e.key === '1') handleMoveSelect('rock');
        else if (e.key === '2') handleMoveSelect('paper');
        else if (e.key === '3') handleMoveSelect('scissors');
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════════
   * 5. Public API: Solo Launcher & Match Reset
   * ═══════════════════════════════════════════════════════════════ */

  function launchSolo(options) {
    var c = getCtx();
    var Engine = getEngine();
    if (!Engine) return;

    var profile = c.profile || { name: 'Player', avatar: '💖' };
    var opts = options || {};

    _stopAllTimers();

    var game = Engine.createGame({
      targetWins: opts.targetWins || 3,
      isSolo: true,
      p1Name: profile.name,
      p1Avatar: profile.avatar,
      p2Name: 'AI Mind 🤖',
      p2Avatar: '🧠'
    });

    c.state.rpsGame = game;
    c.state.screen = 'rps';

    var Audio = getAudio();
    if (Audio && Audio.playTap) Audio.playTap();

    _partialRender();
    _startRoundCountdown();
  }

  function resetMatch(preserveScores) {
    var c = getCtx();
    var game = c.state ? c.state.rpsGame : null;
    if (!game) return;

    var Engine = getEngine();
    _stopAllTimers();

    var newGame = Engine.createGame({
      targetWins: game.targetWins,
      isSolo: game.isSolo,
      p1Name: game.p1.name,
      p1Avatar: game.p1.avatar,
      p2Name: game.p2.name,
      p2Avatar: game.p2.avatar
    });

    c.state.rpsGame = newGame;
    _partialRender();
    _startRoundCountdown();
  }

  function cleanup() {
    _stopAllTimers();
    var Fx = getFx();
    if (Fx) Fx.cleanup();
  }

  global.JodiRPSUI = {
    init: init,
    vGame: vGame,
    bindRoundEvents: bindRoundEvents,
    launchSolo: launchSolo,
    resetMatch: resetMatch,
    handleMoveSelect: handleMoveSelect,
    handleSpecialActivate: handleSpecialActivate,
    startRoundCountdown: _startRoundCountdown,
    cleanup: cleanup
  };

})(window);
