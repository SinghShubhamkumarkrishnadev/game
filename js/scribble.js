/* Jodi Sync — Scribble Draw & Guess Modular Game Engine */
(function (global) {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var esc = function (s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var ctx = null;

  function init(appContext) {
    ctx = appContext;
    if (appContext) {
      appContext.updateChatFeedDOM = updateChatFeedDOM;
      appContext.addChatMessage = addChatMessage;
      appContext.showChatPopup = showChatPopup;
      appContext.dismissChatPopup = dismissChatPopup;
    }
  }

  function getCtx() {
    return ctx || global.JodiContext || {};
  }

  /* Category Meta with relatable Indian Couple Icons */
  function getCategoryMeta(cat) {
    var c = String(cat || 'Khaana').trim();
    var icons = {
      'Khaana': '🍛', 'Food': '🍲', 'Treats': '🍧', 'Drinks': '☕',
      'Romance': '💖', 'Shaadi': '💍', 'Gifts': '🎁', 'Style': '🥻',
      'Kitchen': '🍳', 'Ghar': '🏡', 'Daily': '☀️',
      'Safar': '🧳', 'Travel': '✈️',
      'Masti': '🥳', 'Fun': '🎈',
      'Tyohar': '🪔',
      'Music': '🎶',
      'Drama': '🎬', 'Bollywood': '🍿',
      'Nature': '🌿', 'Winter': '❄️', 'Animals': '🐾',
      'Fantasy': '✨', 'Science': '🔭'
    };
    return {
      name: c,
      icon: icons[c] || '🏷️'
    };
  }

  /* Difficulty Meta with culturally resonant phrasings */
  function getDifficultyMeta(diff) {
    var d = String(diff || 'easy').toLowerCase();
    if (d === 'hard') {
      return { level: 'hard', label: 'Mushkil', icon: '🔴', cls: 'diff-hard' };
    } else if (d === 'medium') {
      return { level: 'medium', label: 'Theek-Thaak', icon: '🟡', cls: 'diff-medium' };
    }
    return { level: 'easy', label: 'Aasaan', icon: '🟢', cls: 'diff-easy' };
  }

  /* Render Blanks Tiles for word groups */
  function renderBlanksHtml(word, revealedIndices) {
    var clean = String(word || '').toUpperCase();
    var words = clean.split(' ');
    var charOffset = 0;
    var html = '';

    words.forEach(function (part) {
      html += '<span class="word-group">';
      for (var i = 0; i < part.length; i++) {
        var overallIdx = charOffset + i;
        var ch = part.charAt(i);
        var isRevealed = revealedIndices && revealedIndices.indexOf(overallIdx) !== -1;
        if (isRevealed) {
          html += '<span class="blank-slot revealed" data-idx="' + overallIdx + '">' + esc(ch) + '</span>';
        } else {
          html += '<span class="blank-slot unrevealed" data-idx="' + overallIdx + '">_</span>';
        }
      }
      html += '</span>';
      charOffset += part.length + 1;
    });
    return html;
  }

  /* Distance calculation for close guesses */
  function levenshteinDistance(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var row = [];
    for (var i = 0; i <= b.length; i++) row[i] = i;
    for (var i = 1; i <= a.length; i++) {
      var prev = i;
      for (var j = 1; j <= b.length; j++) {
        var val;
        if (a.charAt(i - 1) === b.charAt(j - 1)) {
          val = row[j - 1];
        } else {
          val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
        }
        row[j - 1] = prev;
        prev = val;
      }
      row[b.length] = prev;
    }
    return row[b.length];
  }

  /* Responsive Canvas Drawing Engine */
  function getCanvasDPR() {
    return window.devicePixelRatio || 1;
  }

  function resizeCanvas() {
    var canvas = $('#drawCanvas');
    var wrap = $('#canvasWrap');
    if (!canvas || !wrap) return;

    var rect = wrap.getBoundingClientRect();
    var dpr = getCanvasDPR();
    var w = rect.width || 360;
    var h = rect.height || 260;

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    var c = canvas.getContext('2d');
    c.scale(dpr, dpr);
    c.lineCap = 'round';
    c.lineJoin = 'round';

    redrawAllStrokes();
  }

  function redrawAllStrokes() {
    var app = getCtx();
    var canvas = $('#drawCanvas');
    if (!canvas || !app.state) return;
    var c = canvas.getContext('2d');
    var rect = canvas.getBoundingClientRect();
    c.clearRect(0, 0, rect.width, rect.height);

    var strokes = app.state.strokes || [];
    for (var i = 0; i < strokes.length; i++) {
      drawStrokeOnCanvas(strokes[i], c, rect.width, rect.height);
    }
  }

  function drawStrokeOnCanvas(stk, context, w, h) {
    var canvas = $('#drawCanvas');
    if (!canvas) return;
    var c = context || canvas.getContext('2d');
    var cw = w || canvas.getBoundingClientRect().width;
    var ch = h || canvas.getBoundingClientRect().height;

    c.beginPath();
    c.strokeStyle = stk.color;
    c.lineWidth = stk.size;

    if (stk.type === 'dot') {
      c.arc(stk.x * cw, stk.y * ch, stk.size / 2, 0, Math.PI * 2);
      c.fillStyle = stk.color;
      c.fill();
    } else {
      c.moveTo(stk.x1 * cw, stk.y1 * ch);
      c.lineTo(stk.x2 * cw, stk.y2 * ch);
      c.stroke();
    }
  }

  function bindCanvasEvents() {
    var app = getCtx();
    var canvas = $('#drawCanvas');
    var wrap = $('#canvasWrap');
    if (!canvas || !wrap || !app.state) return;

    resizeCanvas();
    window.removeEventListener('resize', resizeCanvas);
    window.addEventListener('resize', resizeCanvas);

    var Net = global.JodiNet;
    var turn = app.state.game ? (app.state.game.turnIndex % 2) : 0;
    var isDrawer = app.state.game && !app.state.game.isTransitioning && !app.state.game.solved &&
      (app.state.game.isSolo
        ? (app.state.game.soloRole !== 'guesser')
        : ((turn === 0 && Net.isHostUser()) || (turn === 1 && !Net.isHostUser())));
    if (!isDrawer) {
      canvas.style.cursor = 'default';
      return;
    }

    canvas.style.cursor = 'crosshair';
    var drawing = false;
    var lastX = 0, lastY = 0;

    function getCoords(e) {
      var rect = canvas.getBoundingClientRect();
      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      var clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        nx: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
        ny: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
      };
    }

    function onDown(e) {
      if (!app.state.game || app.state.game.isTransitioning || app.state.game.solved) return;
      drawing = true;
      var pos = getCoords(e);
      lastX = pos.nx;
      lastY = pos.ny;

      var dotStk = {
        type: 'dot',
        x: pos.nx,
        y: pos.ny,
        color: app.state.currentColor,
        size: app.state.currentSize
      };
      app.state.strokes.push(dotStk);
      drawStrokeOnCanvas(dotStk);
      if (!app.state.game.isSolo && Net.getStatus() === 'connected') {
        Net.send('DRAW_STROKE', dotStk);
      }
      e.preventDefault();
    }

    function onMove(e) {
      if (!drawing) return;
      var pos = getCoords(e);

      var lineStk = {
        type: 'line',
        x1: lastX,
        y1: lastY,
        x2: pos.nx,
        y2: pos.ny,
        color: app.state.currentColor,
        size: app.state.currentSize
      };

      app.state.strokes.push(lineStk);
      drawStrokeOnCanvas(lineStk);
      if (!app.state.game.isSolo && Net.getStatus() === 'connected') {
        Net.send('DRAW_STROKE', lineStk);
      }

      lastX = pos.nx;
      lastY = pos.ny;
      e.preventDefault();
    }

    function onUp(e) {
      drawing = false;
      if (e) e.preventDefault();
    }

    // Touch events for mobile phones
    canvas.addEventListener('touchstart', onDown, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onUp, { passive: false });
    canvas.addEventListener('touchcancel', onUp, { passive: false });

    // Mouse events for desktop
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onUp);
    canvas.addEventListener('mouseleave', onUp);
  }

  /* Timer & Turns Engine */
  function getCurrentWord() {
    var app = getCtx();
    if (!app.state || !app.state.game || !app.state.game.deck || !app.state.game.deck.length) {
      return { word: 'SAMOSA', hint: 'Aloo bhara triangle snack', cat: 'Khaana', diff: 'easy', lang: 'hi' };
    }
    return app.state.game.deck[app.state.game.turnIndex % app.state.game.deck.length];
  }

  /* Guesser Bottom-Right Hint Controller */
  function updateGuesserHintDOM(leftSec) {
    var app = getCtx();
    if (!app.state || !app.state.game) return;
    var hintBtn = $('#guesserHintBtn');
    if (!hintBtn) return;

    if (leftSec <= 10) {
      if (!hintBtn.classList.contains('is-ready')) {
        hintBtn.classList.remove('is-disabled');
        hintBtn.classList.add('is-ready');
        var badge = $('#hintStatusBadge');
        if (badge) badge.textContent = '✨';
        var label = hintBtn.querySelector('.hint-btn-label');
        if (label) label.textContent = 'Hint Kholein';

        if (!app.state.game.hintUnlockedNotified) {
          app.state.game.hintUnlockedNotified = true;
          var Audio = global.JodiAudio;
          if (Audio) Audio.playPop();
          if (app.toast && !app.state.game.hintRevealed) {
            app.toast('💡 Clue Hint unlock ho gaya! Tap karke dekhein.');
          }
        }
      }
    } else {
      hintBtn.classList.add('is-disabled');
      hintBtn.classList.remove('is-ready');
      var badge = $('#hintStatusBadge');
      if (badge) badge.textContent = '🔒';
      var label = hintBtn.querySelector('.hint-btn-label');
      if (label) label.textContent = 'Hint (10s me)';
    }
  }

  function handleGuesserHintClick() {
    var app = getCtx();
    var Audio = global.JodiAudio;
    if (!app.state || !app.state.game) return;

    var now = Date.now();
    var leftSec = Math.max(0, Math.ceil((app.state.game.endAt - now) / 1000));

    if (leftSec > 10) {
      if (Audio) Audio.playTick(false);
      var btn = $('#guesserHintBtn');
      if (btn) {
        btn.classList.add('shake-btn');
        setTimeout(function () { btn.classList.remove('shake-btn'); }, 400);
      }
      if (app.toast) {
        app.toast('💡 Clue hint sirf aakhri 10 seconds mein unlock hoga! (' + leftSec + 's baaki hain)');
      }
      return;
    }

    app.state.game.hintRevealed = !app.state.game.hintRevealed;
    var hintCard = $('#guesserHintCard');
    var hintBtn = $('#guesserHintBtn');

    if (app.state.game.hintRevealed) {
      if (Audio) Audio.playUnlock();
      if (hintBtn) hintBtn.style.display = 'none';
      if (hintCard) {
        hintCard.style.display = 'flex';
      }
    } else {
      if (Audio) Audio.playTap();
      if (hintCard) hintCard.style.display = 'none';
      if (hintBtn) hintBtn.style.display = 'inline-flex';
    }
  }

  function startMatchTimer() {
    stopMatchTimer();
    var app = getCtx();
    var Audio = global.JodiAudio;
    var Net = global.JodiNet;

    app.state.timerInterval = setInterval(function () {
      if (!app.state.game || app.state.screen !== 'game') {
        stopMatchTimer();
        return;
      }

      var now = Date.now();
      var leftSec = Math.max(0, Math.ceil((app.state.game.endAt - now) / 1000));
      var timerEl = $('#timerDisplay');

      if (timerEl) {
        timerEl.textContent = '⏱️ ' + leftSec + 's';
        if (leftSec <= 10) {
          timerEl.classList.add('urgent');
          if (leftSec > 0 && Audio) {
            Audio.playTick(leftSec <= 4);
          }
        } else {
          timerEl.classList.remove('urgent');
        }
      }

      // Update guesser hint button state dynamically
      updateGuesserHintDOM(leftSec);

      // Time up check (Host or Solo schedules authoritative turn advance)
      if (leftSec <= 0 && !app.state.game.solved && !app.state.game.isTransitioning) {
        stopMatchTimer();
        var curWord = getCurrentWord().word;
        app.state.game.isTransitioning = true;
        if (Net.isHostUser()) {
          Net.send('TIME_EXPIRED', { word: curWord });
        }
        if (Audio) Audio.playMiss();
        if (app.toast) app.toast('⌛ Time Up! Sahi shabd tha: ' + curWord);
        var blanksRow = $('#blanksRow');
        if (blanksRow) {
          blanksRow.innerHTML = '<span style="color:var(--bad);font-weight:900;font-size:20px">⌛ ' + esc(curWord) + '</span>';
        }
        if (Net.isHostUser() || app.state.game.isSolo) {
          scheduleNextTurn(2800);
        }
      }
    }, 200);
  }

  function stopMatchTimer() {
    var app = getCtx();
    if (!app.state) return;
    if (app.state.timerInterval) {
      clearInterval(app.state.timerInterval);
      app.state.timerInterval = null;
    }
    if (app.state.game && app.state.game.transitionTimer) {
      clearTimeout(app.state.game.transitionTimer);
      app.state.game.transitionTimer = null;
    }
  }

  function scheduleNextTurn(delayMs) {
    var app = getCtx();
    if (!app.state || !app.state.game) return;
    app.state.game.isTransitioning = true;
    if (app.state.game.transitionTimer) {
      clearTimeout(app.state.game.transitionTimer);
    }
    app.state.game.transitionTimer = setTimeout(function () {
      advanceTurnAuthoritative();
    }, delayMs || 2200);
  }

  function advanceTurnAuthoritative() {
    stopMatchTimer();
    var app = getCtx();
    var Net = global.JodiNet;
    if (!app.state || !app.state.game) return;

    var nextTurn = app.state.game.turnIndex + 1;
    if (nextTurn < app.state.game.totalTurns) {
      var newEndAt = Date.now() + 60000;
      var turnPayload = {
        turnIndex: nextTurn,
        endAt: newEndAt,
        scores: app.state.game.scores
      };

      // 1. Authoritative broadcast to partner if connected
      if (!app.state.game.isSolo && Net.getStatus() === 'connected') {
        Net.send('ADVANCE_TURN', turnPayload);
      }

      // 2. Apply locally on Host or Solo
      applyTurnTransition(turnPayload);
    } else {
      var resultsPayload = {
        scores: app.state.game.scores
      };
      if (!app.state.game.isSolo && Net.getStatus() === 'connected') {
        Net.send('GAME_OVER', resultsPayload);
      }
      applyGameOver(resultsPayload);
    }
  }

  function applyTurnTransition(payload) {
    var app = getCtx();
    var Net = global.JodiNet;
    if (!app.state || !app.state.game) return;
    stopMatchTimer();

    app.state.game.turnIndex = payload.turnIndex;
    app.state.game.endAt = payload.endAt;
    app.state.game.scores = payload.scores;
    app.state.game.solved = false;
    app.state.game.isTransitioning = false;
    app.state.game.transitionTimer = null;
    app.state.game.revealedIndices = [];
    app.state.game.hintRevealed = false;
    app.state.game.hintUnlockedNotified = false;
    app.state.strokes = [];

    var canvas = $('#drawCanvas');
    if (canvas) {
      var c = canvas.getContext('2d');
      c.clearRect(0, 0, canvas.width, canvas.height);
    }

    if (app.state.game.isSolo) {
      if (app.toast) app.toast('Shabd ' + (payload.turnIndex + 1) + '/' + app.state.game.totalTurns + '! Naya word taiyar hai 🎨');
    } else {
      var nextDrawerIsHost = (payload.turnIndex % 2) === 0;
      var nextDrawerName = nextDrawerIsHost
        ? (Net.isHostUser() ? app.profile.name : Net.getPartnerName())
        : (Net.isHostUser() ? Net.getPartnerName() : app.profile.name);

      if (app.toast) app.toast('Turn ' + (payload.turnIndex + 1) + '/' + app.state.game.totalTurns + '! Ab ' + nextDrawerName + ' draw karenge 🎨');
    }
    if (app.render) app.render();
  }

  function applyGameOver(payload) {
    var app = getCtx();
    var Audio = global.JodiAudio;
    if (app.state && app.state.game) {
      app.state.game.scores = payload.scores;
      app.state.game.isTransitioning = false;
      app.state.game.transitionTimer = null;
    }
    stopMatchTimer();
    app.state.screen = 'results';
    if (Audio) Audio.playUnlock();
    if (app.burstCenter) app.burstCenter(35);
    if (app.render) app.render();
  }

  function updateBlanksDOM() {
    var app = getCtx();
    if (!app.state || !app.state.game) return;
    var blanksRow = $('#blanksRow');
    if (blanksRow) {
      var curWord = getCurrentWord();
      blanksRow.innerHTML = renderBlanksHtml(curWord.word, app.state.game.revealedIndices || []);
    }
  }

  /* Live Game Arena View */
  function vGame() {
    var app = getCtx();
    var curWord = getCurrentWord();
    var Net = global.JodiNet;
    var isHost = Net.isHostUser();
    var isSolo = app.state.game && app.state.game.isSolo;
    var turn = app.state.game.turnIndex % 2; // 0 = host draws, 1 = guest draws
    var isDrawer = isSolo
      ? (app.state.game.soloRole !== 'guesser')
      : ((turn === 0 && isHost) || (turn === 1 && !isHost));
    var drawerName = isSolo
      ? (isDrawer ? app.profile.name : 'AI Drawing')
      : (turn === 0
          ? (isHost ? app.profile.name : Net.getPartnerName())
          : (isHost ? Net.getPartnerName() : app.profile.name));
    var turnNumber = (app.state.game.turnIndex + 1);
    var totalTurns = app.state.game.totalTurns;

    var catMeta = getCategoryMeta(curWord.cat);
    var diffMeta = getDifficultyMeta(curWord.diff);

    // Solo Control Bar if in Solo Mode
    var soloBarHtml = '';
    if (isSolo) {
      soloBarHtml = '<div class="solo-control-bar">' +
        '<div class="solo-role-toggle">' +
        '<button type="button" class="solo-role-btn ' + (isDrawer ? 'active' : '') + '" data-action="setSoloRole" data-role="drawer">🖌️ Draw Mode</button>' +
        '<button type="button" class="solo-role-btn ' + (!isDrawer ? 'active' : '') + '" data-action="setSoloRole" data-role="guesser">👀 Guess Mode</button>' +
        '</div>' +
        '<button type="button" class="btn-solo-skip" data-action="soloNextWord" title="Agla shabd dekhein">Agla Shabd ⏩</button>' +
        '</div>';
    }

    // Top Bar (Exit Button, Countdown Timer, Word Counter)
    var topBarHtml = '<div class="arena-topbar">' +
      '<button type="button" class="btn-exit-scribble" data-action="exitScribbleGame" title="Game se bahar niklein">🚪 Exit</button>' +
      '<span class="timer-pill" id="timerDisplay">⏱️ 60s</span>' +
      '<span class="live-pill word-counter-pill">Word ' + turnNumber + '/' + totalTurns + '</span>' +
      '</div>';

    // Partner Offline In-Arena Alert
    var offlineBannerHtml = '';
    if (app.state.game && app.state.game.partnerOffline) {
      offlineBannerHtml = '<div class="partner-offline-strip">' +
        '<span>⚠️ Partner offline hain. Game ruk gaya hai.</span>' +
        '<button type="button" class="btn-strip-action" data-action="exitToLobbyAfterPartnerLeft">Lobby Jao 🏠</button>' +
        '</div>';
    }

    // Banner: Drawer sees only target word (no hint), Guesser sees Category, Diff, Blanks and Clue Hint
    var bannerHtml = '';
    if (isDrawer) {
      bannerHtml = '<div class="drawer-word-banner">' +
        '<div class="scribble-tags-row">' +
        '<span class="scribble-tag cat-tag"><span class="tag-icon">' + catMeta.icon + '</span> ' + esc(catMeta.name) + '</span>' +
        '<span class="scribble-tag diff-tag ' + diffMeta.cls + '"><span class="tag-icon">' + diffMeta.icon + '</span> ' + esc(diffMeta.label) + '</span>' +
        '</div>' +
        '<div class="target-title">Aapko banana hai:</div>' +
        '<div class="target-word">' + esc(curWord.word) + '</div>' +
        '</div>';
    } else {
      var blanksContent = renderBlanksHtml(curWord.word, app.state.game.revealedIndices || []);
      var isRevealed = !!(app.state.game && app.state.game.hintRevealed);
      var now = Date.now();
      var leftSec = app.state.game && app.state.game.endAt ? Math.max(0, Math.ceil((app.state.game.endAt - now) / 1000)) : 60;
      var isReady = (leftSec <= 10);

      bannerHtml = '<div class="guesser-blanks-banner">' +
        '<div class="scribble-tags-row">' +
        '<span class="scribble-tag cat-tag"><span class="tag-icon">' + catMeta.icon + '</span> ' + esc(catMeta.name) + '</span>' +
        '<span class="scribble-tag diff-tag ' + diffMeta.cls + '"><span class="tag-icon">' + diffMeta.icon + '</span> ' + esc(diffMeta.label) + '</span>' +
        '</div>' +
        '<div class="blanks-row" id="blanksRow">' + blanksContent + '</div>' +
        '<div class="guesser-hint-row">' +
        '<div class="guesser-hint-corner">' +
        '<button type="button" class="guesser-hint-trigger ' + (isReady ? 'is-ready' : 'is-disabled') + '" id="guesserHintBtn" data-action="toggleGuesserHint" style="' + (isRevealed ? 'display:none;' : '') + '" title="Clue hint dekhein">' +
        '<span class="hint-icon">💡</span>' +
        '<span class="hint-btn-label">' + (isReady ? 'Hint Kholein' : 'Hint (10s me)') + '</span>' +
        '<span class="hint-status-badge" id="hintStatusBadge">' + (isReady ? '✨' : '🔒') + '</span>' +
        '</button>' +
        '<div class="guesser-clue-card" id="guesserHintCard" style="' + (isRevealed ? 'display:flex;' : 'display:none;') + '">' +
        '<div class="clue-inner">' +
        '<div class="clue-label"><span class="tag-icon">💡</span> Hint Clue</div>' +
        '<div class="clue-text">"' + esc(curWord.hint) + '"</div>' +
        '</div>' +
        '<button type="button" class="clue-close-btn" data-action="toggleGuesserHint" title="Hint chupayein" aria-label="Close Hint">✕</button>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>';
    }

    // Canvas Container
    var canvasHtml = '<div class="canvas-wrap" id="canvasWrap">' +
      '<canvas id="drawCanvas"></canvas>' +
      '</div>';

    // Drawer Toolbar
    var toolsHtml = '';
    if (isDrawer) {
      var colors = ['#2A1240', '#D6246E', '#0B7A7C', '#FFB000', '#2C6E49', '#7A3E1D'];
      var swatchesHtml = colors.map(function (c) {
        return '<button type="button" class="color-swatch ' + (app.state.currentColor === c ? 'active' : '') + '" style="background:' + c + '" data-action="pickColor" data-color="' + c + '"></button>';
      }).join('');

      toolsHtml = '<div class="drawer-tools">' +
        '<div class="palette-group">' + swatchesHtml + '</div>' +
        '<div class="brush-sizes">' +
        '<button type="button" class="brush-btn ' + (app.state.currentSize === 3 ? 'active' : '') + '" data-action="pickSize" data-sz="3">S</button>' +
        '<button type="button" class="brush-btn ' + (app.state.currentSize === 6 ? 'active' : '') + '" data-action="pickSize" data-sz="6">M</button>' +
        '<button type="button" class="brush-btn ' + (app.state.currentSize === 12 ? 'active' : '') + '" data-action="pickSize" data-sz="12">L</button>' +
        '</div>' +
        '<button type="button" class="clear-btn" data-action="clearBoard">🗑️ Saaf</button>' +
        '</div>';
    }

    // Floating In-Game WhatsApp Notification Popup
    var popupHtml = '<div class="scribble-chat-popup" id="scribbleChatPopup" role="alert" style="display:none">' +
      '<div class="popup-inner">' +
      '<div class="popup-avatar"><span class="popup-avatar-icon">💬</span></div>' +
      '<div class="popup-body">' +
      '<div class="popup-meta">' +
      '<span class="popup-sender" id="popupSenderName">Partner</span>' +
      '<span class="popup-time" id="popupTimeText">Abhi</span>' +
      '</div>' +
      '<div class="popup-msg" id="popupMsgText">Message</div>' +
      '</div>' +
      '<button type="button" class="popup-close-btn" data-action="closeChatPopup" aria-label="Dismiss">✕</button>' +
      '</div></div>';

    // WhatsApp Style Chat Card (Newest messages at top so no scrolling is needed)
    var chatList = (app.state.game.chat || []).slice().reverse();
    var chatFeedHtml = '';
    if (chatList.length === 0) {
      chatFeedHtml = '<div class="wa-empty-state">💬 Chat ya Guess yahan aayenge</div>';
    } else {
      chatFeedHtml = chatList.map(function (c) {
        return renderMessageBubbleHtml(c, app.profile.name);
      }).join('');
    }

    var placeholderText = isDrawer
      ? 'Hint ya message...'
      : 'Guess ya message...';
    var sendBtnIcon = isDrawer ? '💬' : '🚀';
    var inputAutocap = isDrawer ? 'sentences' : 'characters';

    var chatSectionHtml = '<div class="scribble-chat-card">' +
      '<div class="chat-feed wa-feed" id="chatFeed">' +
      chatFeedHtml +
      '</div>' +
      '<div class="wa-quick-row">' +
      '<button type="button" class="wa-chip" data-action="sendQuickReaction" data-val="🔥 Garam!">🔥 Garam</button>' +
      '<button type="button" class="wa-chip" data-action="sendQuickReaction" data-val="❄️ Thanda!">❄️ Thanda</button>' +
      '<button type="button" class="wa-chip" data-action="sendQuickReaction" data-val="👏 Sahi ja rahe!">👏 Sahi</button>' +
      '<button type="button" class="wa-chip" data-action="sendQuickReaction" data-val="😂 Haha!">😂 Haha</button>' +
      '<button type="button" class="wa-chip" data-action="sendQuickReaction" data-val="❤️">❤️ Love</button>' +
      '</div>' +
      '<form class="guess-box wa-input-box" id="guessForm">' +
      '<input id="guessInput" placeholder="' + esc(placeholderText) + '" autocomplete="off" autocapitalize="' + inputAutocap + '" autocorrect="off" spellcheck="false">' +
      '<button class="btn gold wa-send-btn" type="submit" title="Bhejo">' +
      '<span class="send-icon">' + sendBtnIcon + '</span>' +
      '</button>' +
      '</form>' +
      '</div>';

    return '<section class="screen scribble-arena-screen" style="padding-bottom:10px">' +
      popupHtml +
      offlineBannerHtml +
      soloBarHtml +
      topBarHtml +
      bannerHtml +
      canvasHtml +
      toolsHtml +
      chatSectionHtml +
      '</section>';
  }

  /* Match Results View */
  function vResults() {
    var app = getCtx();
    var Net = global.JodiNet;
    var tot = app.state.game ? (app.state.game.scores[0] + app.state.game.scores[1]) : 0;
    var isHost = Net.isHostUser();
    var myScore = isHost ? app.state.game.scores[0] : app.state.game.scores[1];
    var partnerScore = isHost ? app.state.game.scores[1] : app.state.game.scores[0];

    var verdict = tot >= 100
      ? ['Picasso Jodi 🎨', 'Aap dono ka telepathic connection hai! Kamaal sync!']
      : tot >= 50
        ? ['Artist Material ✨', 'Bohot achha khele! Thodi aur speed se aur maza aayega.']
        : ['Fun Drawing Lovers 😅', 'Drawing thodi tedhi thi lekin pyaar aur masti poori thi!'];

    var headerHtml = app.renderHeader ? app.renderHeader() : '';

    return '<section class="screen">' +
      headerHtml +
      '<div style="text-align:center;padding:12px 0">' +
      '<div style="font-size:48px;margin-bottom:4px">🏆</div>' +
      '<h1 style="font-family:var(--font-display);font-size:clamp(26px, 7vw, 32px);color:var(--plum)">' + verdict[0] + '</h1>' +
      '<p style="color:var(--soft);font-size:14.5px;max-width:320px;margin:0 auto 14px">' + verdict[1] + '</p>' +
      '<div class="card elevated" style="margin-bottom:14px">' +
      '<div style="font-size:12.5px;font-weight:800;color:var(--soft);text-transform:uppercase">Combined Jodi Score</div>' +
      '<div style="font-family:var(--font-display);font-size:42px;color:var(--rani);line-height:1.1">' + tot + ' <span style="font-size:18px">pts</span></div>' +
      '<div class="duo-row" style="margin-top:10px">' +
      '<div class="player-card is-me">' +
      '<b>' + esc(app.profile.name) + '</b>' +
      '<div style="font-size:17px;font-weight:800;color:var(--plum);margin-top:2px">' + myScore + ' pts</div>' +
      '</div>' +
      '<div class="player-card">' +
      '<b>' + esc(Net.getPartnerName() || 'Partner') + '</b>' +
      '<div style="font-size:17px;font-weight:800;color:var(--plum);margin-top:2px">' + partnerScore + ' pts</div>' +
      '</div></div></div>' +
      '<div style="display:flex;flex-direction:column;gap:8px">' +
      '<button class="btn primary" data-action="playAgain">Agla Round Khelo 🔁</button>' +
      '<button class="btn alt" data-action="backToLobby">Room Lobby Mein Jao 🏠</button>' +
      '<button class="btn ghost sm" data-action="leaveRoom">Room Se Niklo</button>' +
      '</div></div></section>';
  }

  /* WhatsApp Style Chat Helpers & Logic */
  function getMsgTime(d) {
    var date = d ? new Date(d) : new Date();
    var h = date.getHours();
    var m = date.getMinutes();
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  function renderMessageBubbleHtml(c, myName) {
    var isMe = c.isMe || (c.by === myName);
    var timeStr = c.time || getMsgTime();

    if (c.type === 'system' || (c.correct === true && c.text)) {
      return '<div class="wa-msg-row is-system" data-id="' + esc(c.id || '') + '">' +
        '<div class="wa-bubble is-system">' +
          '<span>🎉 <b>' + esc(c.by || 'Partner') + '</b> ne sahi guess kiya: <b>' + esc(c.text) + '</b> (+25 pts)</span>' +
        '</div>' +
      '</div>';
    }

    var rowCls = isMe ? 'is-me' : 'is-partner';
    var senderTitle = '';
    if (!isMe) {
      senderTitle = '<div class="wa-sender-title">' +
        esc(c.by || 'Partner') +
        (c.isDrawer ? ' <span style="font-weight:600;font-size:10px">(Drawer 🖌️)</span>' : '') +
      '</div>';
    }

    var badgeHtml = '';
    if (c.correct === false) {
      badgeHtml = '<span class="wa-badge wrong" title="Galat Guess">❌ Guess</span>';
    } else if (c.isDrawer) {
      badgeHtml = '<span class="wa-badge drawer">🖌️ Hint</span>';
    } else if (c.type === 'reaction') {
      badgeHtml = '<span class="wa-badge reaction">✨</span>';
    }

    var metaHtml = '<div class="wa-meta">' +
      '<span class="wa-time">' + esc(timeStr) + '</span>' +
      (isMe ? '<span class="wa-ticks" title="Delivered">✓✓</span>' : '') +
    '</div>';

    return '<div class="wa-msg-row ' + rowCls + '" data-id="' + esc(c.id || '') + '">' +
      '<div class="wa-bubble ' + rowCls + '">' +
        senderTitle +
        '<div class="wa-content">' +
          '<span class="wa-text">' + esc(c.text) + '</span>' +
          badgeHtml +
          metaHtml +
        '</div>' +
      '</div>' +
    '</div>';
  }

  var popupTimer = null;
  function showChatPopup(entry) {
    var popup = $('#scribbleChatPopup');
    if (!popup) return;

    var senderEl = $('#popupSenderName');
    var timeEl = $('#popupTimeText');
    var msgEl = $('#popupMsgText');
    var Audio = global.JodiAudio;

    var sender = entry.by || 'Partner';
    var isCorrect = entry.correct === true;
    var isWrong = entry.correct === false;
    var isDrawer = !!entry.isDrawer;

    if (senderEl) {
      if (isCorrect) {
        senderEl.textContent = '🎉 ' + sender + ' (Sahi Guess!)';
      } else if (isDrawer) {
        senderEl.textContent = '🖌️ ' + sender + ' (Drawer)';
      } else {
        senderEl.textContent = '💬 ' + sender;
      }
    }

    if (timeEl) timeEl.textContent = entry.time || 'Abhi';

    if (msgEl) {
      if (isCorrect) {
        msgEl.innerHTML = '<span style="color:var(--good);font-weight:800">🎉 Sahi shabd: ' + esc(entry.text) + ' (+25 pts)</span>';
      } else if (isWrong) {
        msgEl.innerHTML = '<span>Guess: <b>' + esc(entry.text) + '</b> <span class="popup-badge-wrong">❌</span></span>';
      } else {
        msgEl.innerHTML = '<span>' + esc(entry.text) + '</span>';
      }
    }

    if (isCorrect) {
      popup.style.borderLeftColor = 'var(--good)';
    } else if (isWrong) {
      popup.style.borderLeftColor = 'var(--bad)';
    } else {
      popup.style.borderLeftColor = '#25D366';
    }

    popup.style.display = 'flex';
    void popup.offsetWidth;
    popup.classList.add('is-visible');

    if (Audio) {
      if (isCorrect) Audio.playMatch();
      else if (isWrong) Audio.playTick(false);
      else Audio.playPop();
    }

    if (popupTimer) clearTimeout(popupTimer);
    popupTimer = setTimeout(function () {
      dismissChatPopup();
    }, 3600);
  }

  function dismissChatPopup() {
    var popup = $('#scribbleChatPopup');
    if (!popup) return;
    popup.classList.remove('is-visible');
    if (popupTimer) {
      clearTimeout(popupTimer);
      popupTimer = null;
    }
    setTimeout(function () {
      if (!popup.classList.contains('is-visible')) {
        popup.style.display = 'none';
      }
    }, 300);
  }

  function addChatMessage(entry, isOutgoing) {
    var app = getCtx();
    if (!app.state || !app.state.game) return;
    if (!app.state.game.chat) app.state.game.chat = [];

    if (!entry.id) entry.id = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    if (!entry.time) entry.time = getMsgTime();
    if (isOutgoing) entry.isMe = true;

    // Check if duplicate entry already present
    var alreadyExists = app.state.game.chat.some(function (c) { return c.id && c.id === entry.id; });
    if (!alreadyExists) {
      app.state.game.chat.push(entry);
    }

    var feed = $('#chatFeed');
    if (feed) {
      var emptyEl = feed.querySelector('.wa-empty-state');
      if (emptyEl) emptyEl.remove();

      var temp = document.createElement('div');
      temp.innerHTML = renderMessageBubbleHtml(entry, app.profile.name);
      var rowEl = temp.firstElementChild;
      if (rowEl) {
        rowEl.classList.add('anim-enter');
        feed.insertBefore(rowEl, feed.firstChild);
        feed.scrollTop = 0;
      }
    }

    // Show popup notification if incoming message from partner
    if (!isOutgoing && entry.by !== app.profile.name) {
      showChatPopup(entry);
    }
  }

  function updateChatFeedDOM() {
    var app = getCtx();
    var feed = $('#chatFeed');
    if (!feed || !app.state || !app.state.game) return;

    var chatList = (app.state.game.chat || []).slice().reverse();
    if (chatList.length === 0) {
      feed.innerHTML = '<div class="wa-empty-state">✨ Yahan aap dono ki WhatsApp chat aur guesses aayenge (Naye messages upar)</div>';
    } else {
      feed.innerHTML = chatList.map(function (c) {
        return renderMessageBubbleHtml(c, app.profile.name);
      }).join('');
    }
    feed.scrollTop = 0;
  }

  function handleIncomingGuessFeed(entry) {
    var app = getCtx();
    if (!app.state || !app.state.game) return;
    addChatMessage(entry, false);
    if (!entry.correct) {
      var Audio = global.JodiAudio;
      if (Audio) Audio.playTick(false);
    }
  }

  function handleIncomingMatch(payload) {
    var app = getCtx();
    var Audio = global.JodiAudio;
    var Net = global.JodiNet;
    if (!app.state || !app.state.game || app.state.game.solved || app.state.game.isTransitioning) return;

    app.state.game.solved = true;
    if (payload.scores) {
      app.state.game.scores = payload.scores;
    } else {
      var gIdx = payload.guesserIndex || 0;
      app.state.game.scores[gIdx] += 25;
      app.state.game.scores[1 - gIdx] += 15;
    }

    var winEntry = {
      by: payload.by,
      text: payload.word,
      correct: true,
      type: 'guess',
      time: getMsgTime()
    };
    addChatMessage(winEntry, false);

    if (Audio) Audio.playMatch();
    if (app.burstCenter) app.burstCenter(30);
    if (app.toast) app.toast('🎉 ' + payload.by + ' ne sahi pehchana! +25 pts');

    var blanksRow = $('#blanksRow');
    if (blanksRow) {
      blanksRow.innerHTML = '<span style="color:var(--good);font-weight:900;font-size:20px">🎉 ' + esc(payload.word) + '</span>';
    }

    if (Net.isHostUser() && scheduleNextTurn) {
      scheduleNextTurn(2400);
    }
  }

  /* Guess & Chat Form Binding (Handles both Guesser guesses & Drawer banter/hints) */
  function bindGuessForm() {
    var form = $('#guessForm');
    if (!form) return;

    // Minimal keyboard-jump prevention:
    // When the soft keyboard opens, the browser auto-scrolls #view to keep
    // the input in view — which pushes the canvas up. We simply reset the
    // scroll immediately so nothing moves. Layout stays exactly as-is.
    var inputEl = $('#guessInput');
    if (inputEl) {
      inputEl.addEventListener('focus', function () {
        var view = document.getElementById('view');
        // Let keyboard animation start, then snap scroll back to 0
        requestAnimationFrame(function () {
          if (view) view.scrollTop = 0;
          setTimeout(function () {
            if (view) view.scrollTop = 0;
          }, 150);
        });
      });
    }

    form.onsubmit = function (e) {
      e.preventDefault();
      var input = $('#guessInput');
      if (!input) return;
      var val = input.value.trim();
      var app = getCtx();
      var Net = global.JodiNet;
      var Audio = global.JodiAudio;

      if (!val || !app.state.game || app.state.game.isTransitioning) return;
      input.value = '';

      var isSolo = app.state.game.isSolo;
      var isHost = Net.isHostUser();
      var turn = app.state.game.turnIndex % 2;
      var isDrawer = isSolo
        ? (app.state.game.soloRole !== 'guesser')
        : ((turn === 0 && isHost) || (turn === 1 && !isHost));

      var curWordObj = getCurrentWord();
      var curWord = curWordObj.word;
      var cleanTarget = curWord.toUpperCase().replace(/[^A-Z0-9]/g, '');

      // Case 1: DRAWER IS SENDING CHAT / HINT / CHEER
      if (isDrawer) {
        var cleanInput = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (cleanInput.indexOf(cleanTarget) !== -1 || (cleanTarget.length >= 4 && levenshteinDistance(cleanInput, cleanTarget) <= 1)) {
          if (Audio) Audio.playTick(false);
          if (app.toast) app.toast('⚠️ Aap drawer ho! Secret word partner ko mat batao 😉');
          return;
        }

        var drawerEntry = {
          by: app.profile.name,
          text: val,
          correct: null,
          isDrawer: true,
          type: 'chat',
          time: getMsgTime()
        };

        addChatMessage(drawerEntry, true);
        if (Audio) Audio.playPop();

        if (!isSolo && Net.getStatus() === 'connected') {
          Net.send('GUESS_FEED', drawerEntry);
        }
        return;
      }

      // Case 2: GUESSER IS SENDING GUESS / CHAT
      if (app.state.game.solved) {
        var casualEntry = {
          by: app.profile.name,
          text: val,
          correct: null,
          isDrawer: false,
          type: 'chat',
          time: getMsgTime()
        };
        addChatMessage(casualEntry, true);
        if (!isSolo && Net.getStatus() === 'connected') {
          Net.send('GUESS_FEED', casualEntry);
        }
        return;
      }

      var cleanGuess = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
      var isMatch = cleanGuess === cleanTarget;
      var myIndex = isHost ? 0 : 1;

      if (isMatch) {
        app.state.game.solved = true;
        if (!isSolo) {
          app.state.game.scores[myIndex] += 25;
          app.state.game.scores[1 - myIndex] += 15;
        } else {
          app.state.game.scores[0] += 25;
        }

        var matchEntry = {
          by: app.profile.name,
          text: curWord,
          correct: true,
          type: 'guess',
          time: getMsgTime()
        };

        addChatMessage(matchEntry, true);
        if (Audio) Audio.playMatch();
        if (app.burstCenter) app.burstCenter(30);
        if (app.toast) app.toast('🎉 Sahi pehchana! ' + curWord + ' (+25 pts)');

        // Reveal all letter blanks
        if (app.state.game.revealedIndices) {
          for (var r = 0; r < curWord.length; r++) {
            if (curWord.charAt(r) !== ' ' && app.state.game.revealedIndices.indexOf(r) === -1) {
              app.state.game.revealedIndices.push(r);
            }
          }
          updateBlanksDOM();
        }

        if (!isSolo && Net.getStatus() === 'connected') {
          Net.send('GUESS_MATCHED', {
            word: curWord,
            by: app.profile.name,
            guesserIndex: myIndex,
            scores: app.state.game.scores
          });
        }

        if (isHost || isSolo) {
          scheduleNextTurn(2200);
        }
      } else {
        var wrongEntry = {
          by: app.profile.name,
          text: val,
          correct: false,
          type: 'guess',
          time: getMsgTime()
        };

        addChatMessage(wrongEntry, true);

        if (!isSolo && Net.getStatus() === 'connected') {
          Net.send('GUESS_FEED', wrongEntry);
        }

        // Close guess detection for encouragement
        var dist = levenshteinDistance(cleanGuess, cleanTarget);
        var isClose = (cleanTarget.length >= 4 && dist === 1) || (cleanTarget.length >= 7 && dist <= 2);
        if (isClose) {
          if (Audio) Audio.playTick(true);
          if (app.toast) app.toast('🔥 Bohot paas ho! Sirf thoda sa farak hai! 🤏');
        } else {
          if (Audio) Audio.playTick(false);
        }

        if (isSolo) {
          setTimeout(function () {
            if (!app.state.game || app.state.game.solved) return;
            var aiText = isClose 
              ? '🔥 Arre bohot paas ho! Socho thoda sa aur!' 
              : (dist <= 3 ? 'Thoda sa aur socho! Hint button bhi check karo 💡' : 'Nahi nahi, drawing ko dhyan se dekho 🎨');
            var aiEntry = {
              by: 'AI Partner',
              text: aiText,
              correct: null,
              isDrawer: true,
              type: 'chat',
              time: getMsgTime()
            };
            addChatMessage(aiEntry, false);
          }, 900);
        }
      }
    };

    // Bind Quick Reaction Chips
    var chips = document.querySelectorAll('.wa-chip');
    chips.forEach(function (chip) {
      chip.onclick = function (e) {
        e.preventDefault();
        var val = chip.getAttribute('data-val') || chip.textContent;
        var app = getCtx();
        var Net = global.JodiNet;
        var Audio = global.JodiAudio;
        if (!app.state || !app.state.game) return;

        var isSolo = app.state.game.isSolo;
        var isHost = Net.isHostUser();
        var turn = app.state.game.turnIndex % 2;
        var isDrawer = isSolo
          ? (app.state.game.soloRole !== 'guesser')
          : ((turn === 0 && isHost) || (turn === 1 && !isHost));

        var entry = {
          by: app.profile.name,
          text: val,
          correct: null,
          isDrawer: isDrawer,
          type: 'reaction',
          time: getMsgTime()
        };

        addChatMessage(entry, true);
        if (Audio) Audio.playPop();

        if (!isSolo && Net.getStatus() === 'connected') {
          Net.send('GUESS_FEED', entry);
        }
      };
    });

    // Bind Popup events
    var popupClose = $('[data-action="closeChatPopup"]');
    if (popupClose) {
      popupClose.onclick = function (e) {
        e.stopPropagation();
        dismissChatPopup();
      };
    }

    var popupEl = $('#scribbleChatPopup');
    if (popupEl) {
      popupEl.onclick = function () {
        var feed = $('#chatFeed');
        if (feed) {
          feed.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          feed.classList.add('feed-highlight');
          setTimeout(function () { feed.classList.remove('feed-highlight'); }, 700);
        }
        dismissChatPopup();
      };
    }
  }

  /* Solo Scribble Practice Mode Launcher */
  function launchSolo() {
    var app = getCtx();
    var Audio = global.JodiAudio;
    var Words = global.JodiWords;

    if (Audio) Audio.playTap();
    app.state.modal = null;
    if (app.renderModal) app.renderModal();

    var sDeck = Words ? Words.getDeck(10, 'mix') : [];
    var endAt = Date.now() + 60000;
    app.state.game = {
      deck: sDeck,
      turnIndex: 0,
      totalTurns: sDeck.length,
      dur: 60,
      endAt: endAt,
      scores: [0, 0],
      chat: [{ text: '🎨 Solo Scribble: Drawing aur Guessing dono test karein!', type: 'system' }],
      solved: false,
      isSolo: true,
      soloRole: 'guesser',
      revealedIndices: [],
      hintRevealed: false,
      hintUnlockedNotified: false
    };
    app.state.strokes = [];
    app.state.screen = 'game';
    if (app.toast) app.toast('Solo Scribble Shuru! Category, Diff & Hint active hai ✨');
    if (app.render) app.render();
  }

  global.JodiScribble = {
    init: init,
    getCategoryMeta: getCategoryMeta,
    getDifficultyMeta: getDifficultyMeta,
    renderBlanksHtml: renderBlanksHtml,
    updateBlanksDOM: updateBlanksDOM,
    updateGuesserHintDOM: updateGuesserHintDOM,
    handleGuesserHintClick: handleGuesserHintClick,
    levenshteinDistance: levenshteinDistance,
    getCanvasDPR: getCanvasDPR,
    resizeCanvas: resizeCanvas,
    redrawAllStrokes: redrawAllStrokes,
    drawStrokeOnCanvas: drawStrokeOnCanvas,
    bindCanvasEvents: bindCanvasEvents,
    getCurrentWord: getCurrentWord,
    startMatchTimer: startMatchTimer,
    stopMatchTimer: stopMatchTimer,
    scheduleNextTurn: scheduleNextTurn,
    advanceTurnAuthoritative: advanceTurnAuthoritative,
    applyTurnTransition: applyTurnTransition,
    applyGameOver: applyGameOver,
    vGame: vGame,
    vResults: vResults,
    bindGuessForm: bindGuessForm,
    launchSolo: launchSolo,
    addChatMessage: addChatMessage,
    showChatPopup: showChatPopup,
    dismissChatPopup: dismissChatPopup,
    updateChatFeedDOM: updateChatFeedDOM,
    handleIncomingGuessFeed: handleIncomingGuessFeed,
    handleIncomingMatch: handleIncomingMatch,
    renderMessageBubbleHtml: renderMessageBubbleHtml
  };
})(window);
