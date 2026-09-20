/* Jodi Scribble - Fully Responsive Controller with Word Count & Language Select */
(function () {
  'use strict';

  var Words = window.JodiWords;
  var Audio = window.JodiAudio;
  var Net = window.JodiNet;

  /* Helper utilities */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var esc = function (s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var rnd = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };

  /* Local Profile Persistence */
  var STORAGE_KEY = 'jodiscribble_profile';
  function loadProfile() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { name: '', avatar: '💖' };
  }

  function saveProfile(p) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch (e) {}
  }

  var profile = loadProfile();

  /* App State */
  var state = {
    screen: profile.name ? 'lobby' : 'welcome', // 'welcome' | 'lobby' | 'room_ready' | 'game' | 'results' | 'race'
    modal: (function () {
      try { return localStorage.getItem('jodi_guide_seen') ? null : 'guide'; } catch (e) { return null; }
    })(), // Show interactive user guide on first visit!
    guideTab: 'scribble', // 'scribble' | 'race' | 'install'
    joinCodeInput: '',
    selectedGameMode: 'scribble', // 'scribble' | 'race'
    selectedBikeTheme: 'sport',   // 'sport' | 'bullet' | 'turbo' | 'cafe'
    partnerBikeTheme: 'bullet',
    raceTrackSeed: null,
    strokes: [],
    currentColor: '#2A1240',
    currentSize: 4,
    isDrawing: false,
    timerInterval: null,
    toastTimer: null,
    game: null,
    matchSettings: {
      wordCount: 5,   // 5 | 10 | 15
      language: 'mix' // 'hi' | 'en' | 'mix'
    }
  };

  /* Confetti Engine */
  function burst(x, y, count) {
    var fx = $('#fx');
    if (!fx) return;
    var glyphs = ['🌼', '✨', '💖', '🎉', '🎨', '🪔', '⭐'];
    for (var i = 0; i < (count || 22); i++) {
      var el = document.createElement('span');
      el.className = 'conf';
      el.textContent = rnd(glyphs);
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.fontSize = (16 + Math.random() * 20) + 'px';
      fx.appendChild(el);

      var ang = Math.random() * Math.PI * 2;
      var dist = 60 + Math.random() * 150;
      var dx = Math.cos(ang) * dist;
      var dy = Math.sin(ang) * dist - 80;

      (function (el, dx, dy) {
        if (typeof el.animate === 'function') {
          var anim = el.animate([
            { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 1 },
            { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + (dy + 160) + 'px)) rotate(' + Math.round(Math.random() * 360) + 'deg) scale(1)', opacity: 0 }
          ], { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' });
          anim.onfinish = function () { el.remove(); };
        } else {
          setTimeout(function () { el.remove(); }, 1000);
        }
      })(el, dx, dy);
    }
  }

  function burstCenter(count) {
    burst(window.innerWidth / 2, window.innerHeight / 2, count || 28);
  }

  function toast(msg) {
    var t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () {
      t.classList.remove('on');
    }, 2800);
  }

  /* Network Event Handlers */
  Net.on('statusChange', function (status) {
    if (status === 'connected') {
      state.screen = 'room_ready';
      Audio.playUnlock();
      burstCenter(24);
      toast('Partner jud gaye! 🟢 Dono sync hain');
    } else if (status === 'disconnected') {
      if (state.screen !== 'welcome') {
        state.screen = 'lobby';
      }
    }
    render();
  });

  Net.on('connected', function () {
    state.screen = 'room_ready';
    Audio.playUnlock();
    burstCenter(24);
    toast('Partner jud gaye! 🟢 Dono sync hain');
    render();
  });

  Net.on('partnerDisconnected', function () {
    toast('Partner disconnect ho gaye 🔴');
    Audio.playMiss();
    if (window.JodiRace) window.JodiRace.cleanup();
    state.game = null;
    state.screen = 'lobby';
    render();
  });

  Net.on('latencyUpdate', function (info) {
    var el = $('#livePing');
    if (el) {
      el.textContent = info.ms + 'ms';
    }
  });

  Net.on('SET_GAME_MODE', function (payload) {
    state.selectedGameMode = payload.mode;
    toast('Game Mode: ' + (payload.mode === 'race' ? '🏍️ Jodi Race (3D)' : '🎨 Jodi Scribble'));
    render();
  });

  Net.on('PARTNER_BIKE_CHOICE', function (payload) {
    state.partnerBikeTheme = payload.bike;
    render();
  });

  Net.on('START_RACE', function (payload) {
    state.raceTrackSeed = payload.seed;
    if (payload.bike && !Net.isHostUser()) {
      state.partnerBikeTheme = payload.bike;
    }
    state.screen = 'race';
    Audio.playTap();
    toast('🏁 3, 2, 1... GO! Race Shuru!');
    render();
  });

  Net.on('EXIT_RACE', function () {
    if (window.JodiRace) window.JodiRace.cleanup();
    state.screen = 'room_ready';
    toast('Partner ne race exit ki 🏠');
    render();
  });

  Net.on('RACE_SYNC', function (payload) {
    if (window.JodiRace) {
      window.JodiRace.onPartnerSync(payload);
    }
  });

  Net.on('TAKEDOWN_EVENT', function (payload) {
    if (window.JodiRace) {
      window.JodiRace.onExternalTakedown(payload);
    }
  });

  Net.on('RACE_FINISH', function (payload) {
    if (window.JodiRace) window.JodiRace.cleanup();
    state.raceResults = {
      winner: payload.winner,
      isMeWinner: payload.winner === profile.name,
      myScore: payload.partnerScore, // from partner's perspective, my score was their partnerScore
      partnerScore: payload.myScore
    };
    state.screen = 'race_results';
    Audio.playUnlock();
    burstCenter(40);
    render();
  });

  Net.on('UPDATE_SETTINGS', function (settings) {
    state.matchSettings = settings;
    toast('Game settings update: ' + settings.wordCount + ' Words, ' + (settings.language === 'hi' ? 'Hindi' : settings.language === 'en' ? 'English' : 'Mix') + ' ⚙️');
    render();
  });

  Net.on('START_MATCH', function (payload) {
    state.game = {
      deck: payload.deck,
      turnIndex: payload.turnIndex || 0, // Current word index
      totalTurns: payload.totalTurns || payload.deck.length,
      dur: 60,
      endAt: payload.endAt,
      scores: payload.scores || [0, 0],
      chat: [],
      solved: false
    };
    state.strokes = [];
    state.screen = 'game';
    Audio.playTap();
    render();
  });

  Net.on('DRAW_STROKE', function (stk) {
    if (state.screen !== 'game') return;
    state.strokes.push(stk);
    drawStrokeOnCanvas(stk);
  });

  Net.on('CLEAR_CANVAS', function () {
    state.strokes = [];
    var canvas = $('#drawCanvas');
    if (canvas) {
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  });

  Net.on('GUESS_FEED', function (entry) {
    if (!state.game) return;
    state.game.chat.push(entry);
    updateChatFeedDOM();
    if (!entry.correct) {
      Audio.playTick(false);
    }
  });

  Net.on('GUESS_MATCHED', function (payload) {
    if (!state.game || state.game.solved || state.game.isTransitioning) return;
    state.game.solved = true;
    if (payload.scores) {
      state.game.scores = payload.scores;
    } else {
      state.game.scores[payload.guesserIndex] += 25;
      state.game.scores[1 - payload.guesserIndex] += 15;
    }
    state.game.chat.push({ by: payload.by, text: payload.word, correct: true });
    updateChatFeedDOM();
    Audio.playMatch();
    burstCenter(30);
    toast('🎉 ' + payload.by + ' ne sahi pehchana! +25 pts');

    if (Net.isHostUser()) {
      scheduleNextTurn(2400);
    }
  });

  Net.on('TIME_EXPIRED', function (payload) {
    if (!state.game) return;
    state.game.solved = false;
    state.game.isTransitioning = true;
    stopMatchTimer();
    Audio.playMiss();
    toast('⌛ Time Up! Sahi shabd tha: ' + payload.word);
    // Guest waits for ADVANCE_TURN or GAME_OVER from Host
  });

  Net.on('ADVANCE_TURN', function (payload) {
    applyTurnTransition(payload);
  });

  Net.on('GAME_OVER', function (payload) {
    applyGameOver(payload);
  });

  Net.on('RETURN_LOBBY', function () {
    state.game = null;
    state.screen = 'room_ready';
    toast('Room Lobby mein wapas aa gaye 🏠');
    render();
  });

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

    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    redrawAllStrokes();
  }

  function redrawAllStrokes() {
    var canvas = $('#drawCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    for (var i = 0; i < state.strokes.length; i++) {
      drawStrokeOnCanvas(state.strokes[i], ctx, rect.width, rect.height);
    }
  }

  function drawStrokeOnCanvas(stk, context, w, h) {
    var canvas = $('#drawCanvas');
    if (!canvas) return;
    var ctx = context || canvas.getContext('2d');
    var cw = w || canvas.getBoundingClientRect().width;
    var ch = h || canvas.getBoundingClientRect().height;

    ctx.beginPath();
    ctx.strokeStyle = stk.color;
    ctx.lineWidth = stk.size;

    if (stk.type === 'dot') {
      ctx.arc(stk.x * cw, stk.y * ch, stk.size / 2, 0, Math.PI * 2);
      ctx.fillStyle = stk.color;
      ctx.fill();
    } else {
      ctx.moveTo(stk.x1 * cw, stk.y1 * ch);
      ctx.lineTo(stk.x2 * cw, stk.y2 * ch);
      ctx.stroke();
    }
  }

  function bindCanvasEvents() {
    var canvas = $('#drawCanvas');
    var wrap = $('#canvasWrap');
    if (!canvas || !wrap) return;

    resizeCanvas();
    window.removeEventListener('resize', resizeCanvas);
    window.addEventListener('resize', resizeCanvas);

    // Turn 0, 2, 4... = Host draws; Turn 1, 3, 5... = Guest draws
    var turn = state.game ? (state.game.turnIndex % 2) : 0;
    var isDrawer = state.game && !state.game.isTransitioning && !state.game.solved &&
      ((turn === 0 && Net.isHostUser()) || (turn === 1 && !Net.isHostUser()));
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
      if (!state.game || state.game.isTransitioning || state.game.solved) return;
      drawing = true;
      var pos = getCoords(e);
      lastX = pos.nx;
      lastY = pos.ny;

      var dotStk = {
        type: 'dot',
        x: pos.nx,
        y: pos.ny,
        color: state.currentColor,
        size: state.currentSize
      };
      state.strokes.push(dotStk);
      drawStrokeOnCanvas(dotStk);
      Net.send('DRAW_STROKE', dotStk);

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
        color: state.currentColor,
        size: state.currentSize
      };

      state.strokes.push(lineStk);
      drawStrokeOnCanvas(lineStk);
      Net.send('DRAW_STROKE', lineStk);

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

  /* Timer Engine */
  function startMatchTimer() {
    stopMatchTimer();
    state.timerInterval = setInterval(function () {
      if (!state.game || state.screen !== 'game') {
        stopMatchTimer();
        return;
      }

      var now = Date.now();
      var leftSec = Math.max(0, Math.ceil((state.game.endAt - now) / 1000));
      var timerEl = $('#timerDisplay');

      if (timerEl) {
        timerEl.textContent = '⏱️ ' + leftSec + 's';
        if (leftSec <= 10) {
          timerEl.classList.add('urgent');
          if (leftSec > 0) {
            Audio.playTick(leftSec <= 4);
          }
        } else {
          timerEl.classList.remove('urgent');
        }
      }

      // Letter hint reveal after 30 seconds
      var hintEl = $('#letterHint');
      if (hintEl && leftSec <= 35 && leftSec > 0) {
        var word = getCurrentWord().word;
        hintEl.textContent = 'Hint: Pehla akshar "' + word.charAt(0) + '" hai!';
      }

      // Time up check (Only Host schedules authoritative turn advance)
      if (leftSec <= 0 && !state.game.solved && !state.game.isTransitioning) {
        stopMatchTimer();
        var curWord = getCurrentWord().word;
        if (Net.isHostUser()) {
          state.game.isTransitioning = true;
          Net.send('TIME_EXPIRED', { word: curWord });
          Audio.playMiss();
          toast('⌛ Time Up! Sahi shabd tha: ' + curWord);
          scheduleNextTurn(2800);
        }
      }
    }, 200);
  }

  function stopMatchTimer() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    if (state.game && state.game.transitionTimer) {
      clearTimeout(state.game.transitionTimer);
      state.game.transitionTimer = null;
    }
  }

  function getCurrentWord() {
    if (!state.game || !state.game.deck || !state.game.deck.length) {
      return { word: 'SAMOSA', hint: 'Triangle snack', cat: 'Khaana', lang: 'hi' };
    }
    return state.game.deck[state.game.turnIndex % state.game.deck.length];
  }

  function scheduleNextTurn(delayMs) {
    if (!state.game) return;
    state.game.isTransitioning = true;
    if (state.game.transitionTimer) {
      clearTimeout(state.game.transitionTimer);
    }
    state.game.transitionTimer = setTimeout(function () {
      advanceTurnAuthoritative();
    }, delayMs || 2200);
  }

  function advanceTurnAuthoritative() {
    stopMatchTimer();
    if (!state.game) return;

    var nextTurn = state.game.turnIndex + 1;
    if (nextTurn < state.game.totalTurns) {
      var newEndAt = Date.now() + 60000;
      var turnPayload = {
        turnIndex: nextTurn,
        endAt: newEndAt,
        scores: state.game.scores
      };

      // 1. Authoritative broadcast to partner
      Net.send('ADVANCE_TURN', turnPayload);

      // 2. Apply locally on Host
      applyTurnTransition(turnPayload);
    } else {
      var resultsPayload = {
        scores: state.game.scores
      };
      Net.send('GAME_OVER', resultsPayload);
      applyGameOver(resultsPayload);
    }
  }

  function applyTurnTransition(payload) {
    if (!state.game) return;
    stopMatchTimer();

    state.game.turnIndex = payload.turnIndex;
    state.game.endAt = payload.endAt;
    state.game.scores = payload.scores;
    state.game.solved = false;
    state.game.isTransitioning = false;
    state.game.transitionTimer = null;
    state.strokes = [];

    var canvas = $('#drawCanvas');
    if (canvas) {
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    var nextDrawerIsHost = (payload.turnIndex % 2) === 0;
    var nextDrawerName = nextDrawerIsHost
      ? (Net.isHostUser() ? profile.name : Net.getPartnerName())
      : (Net.isHostUser() ? Net.getPartnerName() : profile.name);

    toast('Turn ' + (payload.turnIndex + 1) + '/' + state.game.totalTurns + '! Ab ' + nextDrawerName + ' draw karenge 🎨');
    render();
  }

  function applyGameOver(payload) {
    if (state.game) {
      state.game.scores = payload.scores;
      state.game.isTransitioning = false;
      state.game.transitionTimer = null;
    }
    stopMatchTimer();
    state.screen = 'results';
    Audio.playUnlock();
    burstCenter(35);
    render();
  }

  function updateChatFeedDOM() {
    var feed = $('#chatFeed');
    if (!feed || !state.game) return;
    feed.innerHTML = state.game.chat.slice(-6).map(function (c) {
      return '<div class="chat-msg ' + (c.correct ? 'correct' : 'wrong') + '">' +
        '<span><b>' + esc(c.by) + ':</b> ' + esc(c.text) + '</span>' +
        '<span>' + (c.correct ? '✅ +25' : '❌') + '</span>' +
        '</div>';
    }).join('');
    feed.scrollTop = feed.scrollHeight;
  }

  /* Views Rendering */
  function renderHeader() {
    var soundIcon = Audio.isMuted() ? '🔇' : '🔊';
    return '<div class="garland"></div>' +
      '<header class="app-header">' +
      '<div class="brand-title">Jodi Games <span class="brand-tag">Online</span></div>' +
      '<div class="header-actions">' +
      '<button class="icon-btn" data-action="openGuide" title="Khelne Ka Tareeka (User Guide)">📖</button>' +
      '<button class="icon-btn" data-action="toggleSound" title="Sound Toggle">' + soundIcon + '</button>' +
      '</div></header>';
  }

  // 1. Welcome / Name Setup Screen
  function vWelcome() {
    var avatars = ['💖', '✨', '🌹', '☕', '🎨', '🧿'];
    var avHtml = avatars.map(function (av) {
      return '<button class="avatar-opt ' + (profile.avatar === av ? 'active' : '') + '" data-action="pickAvatar" data-av="' + av + '">' + av + '</button>';
    }).join('');

    return '<section class="screen">' +
      renderHeader() +
      '<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:14px;text-align:center">' +
      '<div style="font-size:48px">🎨</div>' +
      '<h1 style="font-family:var(--font-display);font-size:clamp(28px, 7vw, 34px);color:var(--plum)">Aapka Naam Kya Hai?</h1>' +
      '<p style="color:var(--soft);font-weight:600;font-size:15px">Long distance partner ke saath live draw &amp; guess khelne ke liye apna naam likhein:</p>' +
      '<div class="card elevated">' +
      '<label style="display:block;text-align:left;font-size:12.5px;font-weight:800;color:var(--soft);margin-bottom:6px">AAPKA AVATAR CHUNEIN</label>' +
      '<div class="avatar-row">' + avHtml + '</div>' +
      '<input class="input-field" id="nameInput" placeholder="Aapka pyara naam..." value="' + esc(profile.name) + '" maxlength="14" autocomplete="off">' +
      '<div style="margin-top:14px">' +
      '<button class="btn primary" data-action="saveName">Aage Badhein →</button>' +
      '</div></div></div></section>';
  }

  // 2. Room Lobby Screen (Create or Join Room)
  function vLobby() {
    var netStatus = Net.getStatus();
    var statusBadge = netStatus === 'waiting'
      ? '<span class="live-pill" style="background:#FFF9EB;color:var(--plum);border-color:var(--genda)"><span class="dot-pulse" style="background:var(--genda)"></span> Room Taiyar Hai</span>'
      : '<span class="live-pill"><span class="dot-pulse"></span> Network Ready</span>';

    var waitingCardHtml = '';
    if (netStatus === 'waiting') {
      var code = Net.getRoomCode();
      waitingCardHtml = '<div class="room-code-card">' +
        '<div style="font-size:12.5px;font-weight:800;color:var(--soft);text-transform:uppercase">Partner ko ye Code Bhejo</div>' +
        '<div class="room-code-val">' + code + '</div>' +
        '<p style="font-size:13.5px;color:var(--soft);margin-bottom:10px">Partner phone par "Room Join Karo" mein ye code daalenge.</p>' +
        '<div style="display:flex;gap:8px">' +
        '<button class="btn gold sm" style="flex:1" data-action="copyCode" data-code="' + code + '">📋 Code Copy Karo</button>' +
        '<button class="btn ghost sm" data-action="cancelRoom">Cancel</button>' +
        '</div></div>';
    }

    return '<section class="screen">' +
      renderHeader() +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
      '<div style="display:flex;align-items:center;gap:8px">' +
      '<span style="font-size:24px">' + profile.avatar + '</span>' +
      '<b>' + esc(profile.name) + '</b>' +
      '</div>' +
      statusBadge +
      '</div>' +
      waitingCardHtml +
      (netStatus !== 'waiting'
        ? '<div style="display:flex;flex-direction:column;gap:12px;margin-top:6px">' +
          '<div class="card elevated" style="background:linear-gradient(135deg, #FFF9FC, #FFFFFF)">' +
          '<div style="font-size:34px;margin-bottom:4px">🏠</div>' +
          '<h2 style="font-family:var(--font-display);font-size:24px;color:var(--plum)">Naya Room Banao</h2>' +
          '<p style="color:var(--soft);font-size:14px;margin-bottom:12px">Aap host banenge. Code banega jo aap partner ko WhatsApp ya call par share karenge.</p>' +
          '<button class="btn primary" data-action="createRoom">Room Banao 🚀</button>' +
          '</div>' +
          '<div class="card elevated">' +
          '<div style="font-size:34px;margin-bottom:4px">🔑</div>' +
          '<h2 style="font-family:var(--font-display);font-size:24px;color:var(--plum)">Room Join Karo</h2>' +
          '<p style="color:var(--soft);font-size:14px;margin-bottom:12px">Partner ne code share kiya hai? Code daal kar unke room mein jud jao.</p>' +
          '<button class="btn alt" data-action="openJoinModal">Code Daalo 📲</button>' +
          '</div></div>'
        : '') +
      '<div style="margin-top:auto;padding-top:16px;text-align:center;display:flex;flex-direction:column;gap:8px">' +
      '<button class="btn gold sm" data-action="soloPracticeRace">🏍️ 3D Bike Test Drive (Solo)</button>' +
      '<button class="btn alt sm" data-action="openGuide">📖 Khelne Ka Tareeka (User Guide)</button>' +
      '<button class="btn ghost sm" data-action="editProfile">Naam Badlein</button>' +
      '</div></section>';
  }

  // 3. Connected Room Lobby (With Game Mode & Bike Selector)
  function vRoomReady() {
    var myName = profile.name;
    var partnerName = Net.getPartnerName() || 'Partner';
    var myAvatar = profile.avatar;
    var partnerAvatar = Net.getPartnerAvatar() || '✨';
    var isHost = Net.isHostUser();
    var code = Net.getRoomCode();
    var latency = Net.getLatency();
    var ms = state.matchSettings;
    var mode = state.selectedGameMode;

    return '<section class="screen">' +
      renderHeader() +
      '<div style="text-align:center;margin-bottom:10px">' +
      '<span class="live-pill"><span class="dot-pulse"></span> Partner Connected • <span id="livePing">' + latency + 'ms</span></span>' +
      '</div>' +
      '<div class="card elevated" style="text-align:center;padding:16px 14px">' +
      '<h2 style="font-family:var(--font-display);font-size:24px;color:var(--plum);margin-bottom:2px">Dono Sync Ho Gaye! 💞</h2>' +
      '<p style="color:var(--soft);font-size:13.5px">Room Code: <b>' + code + '</b></p>' +
      '<div class="duo-row">' +
      '<div class="player-card is-me">' +
      '<span class="p-avatar">' + myAvatar + '</span>' +
      '<div class="p-name">' + esc(myName) + '</div>' +
      '<div class="p-role">' + (isHost ? 'Host' : 'Guest') + ' (Aap)</div>' +
      '</div>' +
      '<div class="player-card">' +
      '<span class="p-avatar">' + partnerAvatar + '</span>' +
      '<div class="p-name">' + esc(partnerName) + '</div>' +
      '<div class="p-role">Partner 🟢</div>' +
      '</div></div>' +

      // Game Mode Selection
      '<div class="settings-label" style="margin-top:10px"><span>🎮 Game Mode Chuno</span></div>' +
      '<div class="game-mode-grid">' +
      '<div class="game-mode-tile ' + (mode === 'scribble' ? 'active' : '') + '" data-action="setMode" data-mode="scribble">' +
      '<span class="gm-icon">🎨</span>' +
      '<div class="gm-title">Jodi Scribble</div>' +
      '<div class="gm-desc">Draw &amp; Guess Words</div>' +
      '</div>' +
      '<div class="game-mode-tile ' + (mode === 'race' ? 'active' : '') + '" data-action="setMode" data-mode="race">' +
      '<span class="gm-icon">🏍️</span>' +
      '<div class="gm-title">Jodi Race (3D)</div>' +
      '<div class="gm-desc">Curvy Track &amp; Nitro</div>' +
      '</div>' +
      '</div>' +

      // Mode-specific configuration
      (mode === 'scribble'
        ? '<div class="settings-section">' +
          '<div class="settings-label"><span>🎯 Kitne Words Chahiye?</span><small>' + ms.wordCount + ' Words</small></div>' +
          '<div class="segment-group">' +
          '<button class="segment-btn ' + (ms.wordCount === 5 ? 'active' : '') + '" data-action="setCount" data-val="5">5 Words</button>' +
          '<button class="segment-btn ' + (ms.wordCount === 10 ? 'active' : '') + '" data-action="setCount" data-val="10">10 Words</button>' +
          '<button class="segment-btn ' + (ms.wordCount === 15 ? 'active' : '') + '" data-action="setCount" data-val="15">15 Words</button>' +
          '</div>' +
          '<div class="settings-label"><span>🌐 Bhasha (Language)</span><small>' + (ms.language === 'hi' ? 'Hindi' : ms.language === 'en' ? 'English' : 'Mix') + '</small></div>' +
          '<div class="segment-group">' +
          '<button class="segment-btn teal ' + (ms.language === 'hi' ? 'active' : '') + '" data-action="setLang" data-val="hi">🇮🇳 Desi Hindi</button>' +
          '<button class="segment-btn teal ' + (ms.language === 'en' ? 'active' : '') + '" data-action="setLang" data-val="en">🇬🇧 English</button>' +
          '<button class="segment-btn teal ' + (ms.language === 'mix' ? 'active' : '') + '" data-action="setLang" data-val="mix">✨ Mix Dono</button>' +
          '</div></div>' +
          '<button class="btn primary" data-action="startMatch">Khelna Shuru Karein 🎨</button>'
        : '<div class="settings-section">' +
          '<div class="settings-label"><span>🏍️ Apni Superbike Chuno</span><small>' + state.selectedBikeTheme.toUpperCase() + '</small></div>' +
          '<div class="bike-select-grid">' +
          '<div class="bike-card ' + (state.selectedBikeTheme === 'sport' ? 'active' : '') + '" data-action="pickBike" data-bike="sport">' +
          '<span class="bike-icon">🏍️</span>' +
          '<div class="bike-name">Rani Neon Sport</div>' +
          '<div class="bike-tag">Speed &amp; Agility</div>' +
          '<div class="bike-color-bar" style="background:linear-gradient(90deg, #D6246E, #FFB000)"></div>' +
          '</div>' +
          '<div class="bike-card ' + (state.selectedBikeTheme === 'bullet' ? 'active' : '') + '" data-action="pickBike" data-bike="bullet">' +
          '<span class="bike-icon">🏍️</span>' +
          '<div class="bike-name">Royal Bullet 350</div>' +
          '<div class="bike-tag">Heavy Metal Cruiser</div>' +
          '<div class="bike-color-bar" style="background:linear-gradient(90deg, #1A1A1A, #E6C280)"></div>' +
          '</div>' +
          '<div class="bike-card ' + (state.selectedBikeTheme === 'turbo' ? 'active' : '') + '" data-action="pickBike" data-bike="turbo">' +
          '<span class="bike-icon">🏍️</span>' +
          '<div class="bike-name">Mor Teal Turbo</div>' +
          '<div class="bike-tag">Nitrous Speed Monster</div>' +
          '<div class="bike-color-bar" style="background:linear-gradient(90deg, #0B7A7C, #38E1E4)"></div>' +
          '</div>' +
          '<div class="bike-card ' + (state.selectedBikeTheme === 'cafe' ? 'active' : '') + '" data-action="pickBike" data-bike="cafe">' +
          '<span class="bike-icon">🏍️</span>' +
          '<div class="bike-name">Kesar Cafe Racer</div>' +
          '<div class="bike-tag">Desi Retro Beast</div>' +
          '<div class="bike-color-bar" style="background:linear-gradient(90deg, #E65100, #FFD54F)"></div>' +
          '</div></div>' +
          '<p style="font-size:12px;color:var(--soft);margin-bottom:8px;font-weight:700">3D Real Physics • Procedural Curvy Track • Nitro Booster</p>' +
          '</div>' +
          '<button class="btn gold" data-action="startRace">Race Shuru Karein 🏍️💨</button>'
      ) +
      '<div style="margin-top:8px">' +
      '<button class="btn ghost sm" data-action="leaveRoom">Room Se Niklo</button>' +
      '</div></div></section>';
  }

  // 4. Live Game Arena (Compact & Responsive on All Screens)
  function vGame() {
    var curWord = getCurrentWord();
    var isHost = Net.isHostUser();
    var turn = state.game.turnIndex % 2; // 0 = host draws, 1 = guest draws
    var isDrawer = (turn === 0 && isHost) || (turn === 1 && !isHost);
    var drawerName = turn === 0
      ? (isHost ? profile.name : Net.getPartnerName())
      : (isHost ? Net.getPartnerName() : profile.name);
    var turnNumber = (state.game.turnIndex + 1);
    var totalTurns = state.game.totalTurns;

    // Top Bar
    var topBarHtml = '<div class="arena-topbar">' +
      '<span class="role-badge">' + (isDrawer ? '🖌️ Aap Draw Kar Rahe Ho' : '👀 ' + esc(drawerName) + ' Draw Kar Rahe Hain') + '</span>' +
      '<span class="timer-pill" id="timerDisplay">⏱️ 60s</span>' +
      '<span class="live-pill" style="padding:3px 8px">Word ' + turnNumber + '/' + totalTurns + '</span>' +
      '</div>';

    // Banner
    var bannerHtml = '';
    if (isDrawer) {
      bannerHtml = '<div class="drawer-word-banner">' +
        '<div class="target-meta">Aapko banana hai (' + esc(curWord.cat) + '):</div>' +
        '<div class="target-word">' + esc(curWord.word) + '</div>' +
        '<div class="target-meta">' + esc(curWord.hint) + '</div>' +
        '</div>';
    } else {
      var blanks = curWord.word.split('').map(function (c) {
        return c === ' ' ? '&nbsp;&nbsp;' : '_ ';
      }).join(' ');

      bannerHtml = '<div class="guesser-blanks-banner">' +
        '<div class="blanks-row">' + blanks + '</div>' +
        '<div class="blanks-meta">Category: ' + esc(curWord.cat) + ' (' + curWord.word.replace(/\s/g, '').length + ' akshar)</div>' +
        '<div id="letterHint" style="font-size:12px;color:var(--rani);font-weight:800;margin-top:2px"></div>' +
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
        return '<button class="color-swatch ' + (state.currentColor === c ? 'active' : '') + '" style="background:' + c + '" data-action="pickColor" data-color="' + c + '"></button>';
      }).join('');

      toolsHtml = '<div class="drawer-tools">' +
        '<div class="palette-group">' + swatchesHtml + '</div>' +
        '<div class="brush-sizes">' +
        '<button class="brush-btn ' + (state.currentSize === 3 ? 'active' : '') + '" data-action="pickSize" data-sz="3">S</button>' +
        '<button class="brush-btn ' + (state.currentSize === 6 ? 'active' : '') + '" data-action="pickSize" data-sz="6">M</button>' +
        '<button class="brush-btn ' + (state.currentSize === 12 ? 'active' : '') + '" data-action="pickSize" data-sz="12">L</button>' +
        '</div>' +
        '<button class="clear-btn" data-action="clearBoard">🗑️ Saaf</button>' +
        '</div>';
    }

    // Guesser Input
    var guessInputHtml = '';
    if (!isDrawer) {
      guessInputHtml = '<form class="guess-box" id="guessForm">' +
        '<input id="guessInput" placeholder="Shabd guess karo yahan..." autocomplete="off" autofocus>' +
        '<button class="btn gold" type="submit">Bhejo 🚀</button>' +
        '</form>';
    }

    // Chat Feed
    var chatHtml = '<div class="chat-feed" id="chatFeed">' +
      state.game.chat.slice(-6).map(function (c) {
        return '<div class="chat-msg ' + (c.correct ? 'correct' : 'wrong') + '">' +
          '<span><b>' + esc(c.by) + ':</b> ' + esc(c.text) + '</span>' +
          '<span>' + (c.correct ? '✅ +25' : '❌') + '</span>' +
          '</div>';
      }).join('') +
      '</div>';

    return '<section class="screen" style="padding-bottom:10px">' +
      topBarHtml +
      bannerHtml +
      canvasHtml +
      toolsHtml +
      guessInputHtml +
      chatHtml +
      '</section>';
  }

  // 5. Match Results / Scorecard
  function vResults() {
    var tot = state.game ? (state.game.scores[0] + state.game.scores[1]) : 0;
    var isHost = Net.isHostUser();
    var myScore = isHost ? state.game.scores[0] : state.game.scores[1];
    var partnerScore = isHost ? state.game.scores[1] : state.game.scores[0];

    var verdict = tot >= 100
      ? ['Picasso Jodi 🎨', 'Aap dono ka telepathic connection hai! Kamaal sync!']
      : tot >= 50
        ? ['Artist Material ✨', 'Bohot achha khele! Thodi aur speed se aur maza aayega.']
        : ['Fun Drawing Lovers 😅', 'Drawing thodi tedhi thi lekin pyaar aur masti poori thi!'];

    return '<section class="screen">' +
      renderHeader() +
      '<div style="text-align:center;padding:12px 0">' +
      '<div style="font-size:48px;margin-bottom:4px">🏆</div>' +
      '<h1 style="font-family:var(--font-display);font-size:clamp(26px, 7vw, 32px);color:var(--plum)">' + verdict[0] + '</h1>' +
      '<p style="color:var(--soft);font-size:14.5px;max-width:320px;margin:0 auto 14px">' + verdict[1] + '</p>' +
      '<div class="card elevated" style="margin-bottom:14px">' +
      '<div style="font-size:12.5px;font-weight:800;color:var(--soft);text-transform:uppercase">Combined Jodi Score</div>' +
      '<div style="font-family:var(--font-display);font-size:42px;color:var(--rani);line-height:1.1">' + tot + ' <span style="font-size:18px">pts</span></div>' +
      '<div class="duo-row" style="margin-top:10px">' +
      '<div class="player-card is-me">' +
      '<b>' + esc(profile.name) + '</b>' +
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

  // 6. 3D Bike Racing Arena
  function vRace() {
    return '<div class="race-container">' +
      '<div id="raceCanvasMount"></div>' +
      '<div class="race-hud-top">' +
      '<div class="speedo-card">' +
      '<span class="speedo-num" id="raceSpeedNum">0</span>' +
      '<span class="speedo-unit">km/h</span>' +
      '</div>' +
      '<div class="speedo-card" style="border-color:#38E1E4">' +
      '<span class="speedo-num" id="raceScoreBadge" style="color:#38E1E4;font-size:22px">0</span>' +
      '<span class="speedo-unit">pts</span>' +
      '</div>' +
      '<div class="nitro-card">' +
      '<div class="nitro-header">' +
      '<span>⚡ Nitro</span>' +
      '</div>' +
      '<div class="nitro-track">' +
      '<div class="nitro-fill" id="raceNitroBar"></div>' +
      '</div>' +
      '</div>' +
      '<button class="race-hud-exit" data-action="exitRace">✕ Exit</button>' +
      '</div>' +
      // Minimap Overlay (Phase 2)
      '<div class="race-minimap-card">' +
      '<canvas id="raceMinimap" width="80" height="80"></canvas>' +
      '<div class="race-lap-badge" id="raceLapBadge">Lap 1/3</div>' +
      '</div>' +
      // Distance Lead Indicator Pill
      '<div class="race-lead-pill" id="raceLeadPill">🔥 Barabar</div>' +
      // Takedown & Wipeout Notification Banner (Phase 3)
      '<div class="race-takedown-banner" id="raceTakedownBanner"></div>' +
      // Touch Driving Controls
      '<div class="race-controls-bottom">' +
      '<div class="steer-group">' +
      '<button class="touch-btn steer" id="btnSteerL" aria-label="Steer Left">◀</button>' +
      '<button class="touch-btn steer" id="btnSteerR" aria-label="Steer Right">▶</button>' +
      '</div>' +
      '<div class="pedal-group">' +
      '<button class="touch-btn brake" id="btnBrake">Break</button>' +
      '<button class="touch-btn nitro" id="btnNitro">⚡</button>' +
      '<button class="touch-btn gas" id="btnGas">Gas</button>' +
      '</div>' +
      '</div>' +
      '</div>';
  }

  // 7. Race Results / Podium Screen (Phase 3)
  function vRaceResults() {
    var res = state.raceResults || {
      winner: profile.name,
      isMeWinner: true,
      myScore: 100,
      partnerScore: 50
    };
    var isMe = res.isMeWinner;
    var partnerName = Net.getPartnerName() || 'Partner';
    var myName = profile.name;

    return '<section class="screen">' +
      renderHeader() +
      '<div style="text-align:center;padding:12px 0">' +
      '<div style="font-size:52px;margin-bottom:4px">' + (isMe ? '🏆' : '🥈') + '</div>' +
      '<h1 style="font-family:var(--font-display);font-size:clamp(26px, 7vw, 34px);color:var(--plum)">' +
      (isMe ? 'Aap Jeet Gaye! 🏁' : esc(partnerName) + ' Jeet Gaye! 🏁') +
      '</h1>' +
      '<p style="color:var(--soft);font-size:14px;max-width:320px;margin:0 auto 12px">' +
      (isMe ? 'Kamaal ki driving aur takedowns! 1st Place Podium Finish! 🚀' : 'Bohot tight race thi! Dobara race karke badla lo! 💨') +
      '</p>' +
      '<div class="card elevated" style="margin-bottom:14px">' +
      '<div style="font-size:12.5px;font-weight:800;color:var(--soft);text-transform:uppercase">Final Race Score</div>' +
      '<div class="duo-row" style="margin-top:10px">' +
      '<div class="player-card ' + (isMe ? 'is-me' : '') + '">' +
      '<span class="p-avatar">' + profile.avatar + '</span>' +
      '<b>' + esc(myName) + '</b>' +
      '<div style="font-size:22px;font-weight:900;color:var(--rani);margin-top:2px">' + res.myScore + ' pts</div>' +
      '<div style="font-size:11px;color:var(--soft)">' + (isMe ? '🥇 1st Place (+100)' : 'Racer') + '</div>' +
      '</div>' +
      '<div class="player-card ' + (!isMe ? 'is-me' : '') + '">' +
      '<span class="p-avatar">' + (Net.getPartnerAvatar() || '✨') + '</span>' +
      '<b>' + esc(partnerName) + '</b>' +
      '<div style="font-size:22px;font-weight:900;color:var(--mor);margin-top:2px">' + res.partnerScore + ' pts</div>' +
      '<div style="font-size:11px;color:var(--soft)">' + (!isMe ? '🥇 1st Place (+100)' : 'Racer') + '</div>' +
      '</div></div>' +
      '<p style="font-size:12px;color:var(--soft);margin-top:8px">Finish Line Bonus: +100 pts • Har Takedown: +50 pts</p>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px">' +
      '<button class="btn gold" data-action="raceAgain">Dobara Race Khelo 🏍️💨</button>' +
      '<button class="btn alt" data-action="backToLobby">Room Lobby Mein Jao 🏠</button>' +
      '<button class="btn ghost sm" data-action="leaveRoom">Room Se Niklo</button>' +
      '</div></div></section>';
  }

  // Bottom Sheet Modal for Join Code & User Manual Guide
  function renderModal() {
    var m = $('#modal');
    if (!m) return;
    if (state.modal === 'join') {
      m.innerHTML = '<div class="modal-sheet">' +
        '<h2 style="font-family:var(--font-display);font-size:22px;color:var(--plum);margin-bottom:4px">Room Code Daalo</h2>' +
        '<p style="color:var(--soft);font-size:13.5px;margin-bottom:12px">Partner ne jo 4-digit code bheja hai wo yahan likho:</p>' +
        '<input class="input-field" id="joinInput" maxlength="10" placeholder="e.g. JODI-4821" value="' + esc(state.joinCodeInput) + '" style="font-size:20px;text-align:center;letter-spacing:0.08em;font-weight:800;text-transform:uppercase" autofocus>' +
        '<div style="display:flex;gap:10px;margin-top:12px">' +
        '<button class="btn ghost" style="flex:1" data-action="closeModal">Cancel</button>' +
        '<button class="btn primary" style="flex:1" data-action="submitJoin">Connect 🚀</button>' +
        '</div></div>';
      m.classList.add('on');
    } else if (state.modal === 'guide') {
      var tab = state.guideTab || 'scribble';
      var contentHtml = '';
      if (tab === 'scribble') {
        contentHtml = '<div class="guide-step-card">' +
          '<span class="guide-num">1</span>' +
          '<div><div class="guide-step-title">Room Banao ya Join Karo</div>' +
          '<div class="guide-step-desc">Ek partner <b>Room Banao</b> dabayega aur code share karega. Doosra <b>Room Join Karo</b> me code daal kar connect hoga.</div></div>' +
          '</div>' +
          '<div class="guide-step-card">' +
          '<span class="guide-num">2</span>' +
          '<div><div class="guide-step-title">Bari-Bari Draw &amp; Guess</div>' +
          '<div class="guide-step-desc">Turn 1 me pehla partner draw karega aur doosra guess karega. Agle turn me automatically roles swap ho jayengi!</div></div>' +
          '</div>' +
          '<div class="guide-step-card">' +
          '<span class="guide-num">3</span>' +
          '<div><div class="guide-step-title">30s me Automatic Hint</div>' +
          '<div class="guide-step-desc">Agar word pehchanne me mushkil ho, to aadha time beetne par pehla akshar <span class="guide-highlight">Hint</span> me dikh jata hai.</div></div>' +
          '</div>' +
          '<div class="guide-step-card">' +
          '<span class="guide-num">4</span>' +
          '<div><div class="guide-step-title">Scoring System</div>' +
          '<div class="guide-step-desc">Sahi guess karne par Guesser ko <b class="guide-highlight">+25 Points</b> aur Drawer ko <b style="color:var(--mor)">+15 Points</b> milte hain!</div></div>' +
          '</div>';
      } else if (tab === 'race') {
        contentHtml = '<div class="guide-step-card">' +
          '<span class="guide-num">1</span>' +
          '<div><div class="guide-step-title">Apni 3D Superbike Chuno</div>' +
          '<div class="guide-step-desc">Royal Bullet, Neon Sport, Teal Turbo, ya Cafe Racer — dono partner apni-apni manpasand 3D bike select karein.</div></div>' +
          '</div>' +
          '<div class="guide-step-card">' +
          '<span class="guide-num">2</span>' +
          '<div><div class="guide-step-title">Steering, Gas &amp; Nitro Boost</div>' +
          '<div class="guide-step-desc">Left/Right steer buttons, Gas dabakar speed pakdein aur <b>⚡ Nitro</b> se super thrust lein!</div></div>' +
          '</div>' +
          '<div class="guide-step-card" style="border-color:var(--genda);background:#FFF9EB">' +
          '<span class="guide-num" style="background:var(--genda);color:#000">💥</span>' +
          '<div><div class="guide-step-title" style="color:#000">Thokne Ka Feature (Takedown +50 PTS)</div>' +
          '<div class="guide-step-desc" style="color:#2A1240">Agar aap speed me partner ki bike ko thokte hain, to aapko <b class="guide-highlight">+50 PTS</b> aur instant Nitro fuel milta hai! Partner crash ho jayega aur 1.8s me auto-respawn hoga.</div></div>' +
          '</div>' +
          '<div class="guide-step-card">' +
          '<span class="guide-num">3</span>' +
          '<div><div class="guide-step-title">3 Laps &amp; Podium Finish</div>' +
          '<div class="guide-step-desc">3 Laps complete karke sabse pehle finish arch cross karne wale ko <b class="guide-highlight">+100 PTS Finish Bonus</b> aur 🥇 Trophy milti hai!</div></div>' +
          '</div>';
      } else if (tab === 'install') {
        contentHtml = '<div class="guide-badge-box">📲 <span>Ye game ek <b>Progressive Web App (PWA)</b> hai — bina App Store ke direct install hota hai!</span></div>' +
          '<div class="guide-step-card">' +
          '<span class="guide-num">1</span>' +
          '<div><div class="guide-step-title">Android / Chrome Me Install</div>' +
          '<div class="guide-step-desc">Screen ke upar <b>"Install 🚀"</b> banner par click karein. Direct phone ki home screen par app icon ban jayega.</div></div>' +
          '</div>' +
          '<div class="guide-step-card">' +
          '<span class="guide-num">2</span>' +
          '<div><div class="guide-step-title">iPhone / Safari Me Install</div>' +
          '<div class="guide-step-desc">Safari ke bottom bar par <b>Share button (⎋)</b> dabayein, scroll karke <b>"Add to Home Screen (➕)"</b> par click karein.</div></div>' +
          '</div>' +
          '<div class="guide-step-card">' +
          '<span class="guide-num">3</span>' +
          '<div><div class="guide-step-title">Automatic Updates</div>' +
          '<div class="guide-step-desc">Jab bhi game update hota hai, app background me automatically update ho jati hai aur refresh ho jati hai.</div></div>' +
          '</div>';
      }

      m.innerHTML = '<div class="modal-sheet guide-sheet">' +
        '<div class="guide-header">' +
        '<div class="guide-title"><span>📖</span> Khelne Ka Tareeka</div>' +
        '<button class="pwa-dismiss-btn" data-action="closeGuide" style="color:var(--plum);font-size:20px">✕</button>' +
        '</div>' +
        '<div class="guide-tabs">' +
        '<button class="guide-tab-btn ' + (tab === 'scribble' ? 'active' : '') + '" data-action="setGuideTab" data-tab="scribble">🎨 Scribble</button>' +
        '<button class="guide-tab-btn ' + (tab === 'race' ? 'active' : '') + '" data-action="setGuideTab" data-tab="race">🏍️ 3D Race</button>' +
        '<button class="guide-tab-btn ' + (tab === 'install' ? 'active' : '') + '" data-action="setGuideTab" data-tab="install">📲 Install Info</button>' +
        '</div>' +
        '<div class="guide-content-scroll">' + contentHtml + '</div>' +
        '<div style="margin-top:14px">' +
        '<button class="btn primary" data-action="closeGuide">Samajh Gaya, Chalo Khele! 🚀</button>' +
        '</div>' +
        '</div>';
      m.classList.add('on');
    } else if (state.modal === 'install_help') {
      var isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      m.innerHTML = '<div class="modal-sheet install-modal-sheet">' +
        '<div class="guide-header">' +
        '<div class="guide-title"><span>📲</span> Jodi App Install Karein</div>' +
        '<button class="pwa-dismiss-btn" data-action="closeModal" style="color:var(--plum);font-size:20px">✕</button>' +
        '</div>' +
        '<div class="install-prompt-body">' +
        (isIos
          ? '<div class="install-device-card">' +
            '<div class="inst-platform-badge" style="background:#0B7A7C">🍎 iPhone / Safari</div>' +
            '<div class="inst-lead">iPhone me direct install karne ke aasan steps:</div>' +
            '<div class="inst-step-list">' +
            '<div class="inst-step-item"><span class="inst-step-num">1</span><div>Safari screen ke bottom me <b>Share button (⎋)</b> par tap karein.</div></div>' +
            '<div class="inst-step-item"><span class="inst-step-num">2</span><div>Options ko scroll karein aur <b>"Add to Home Screen (➕)"</b> chunein.</div></div>' +
            '<div class="inst-step-item"><span class="inst-step-num">3</span><div>Upar right me <b>"Add"</b> dabayein — app home screen par aa jayegi!</div></div>' +
            '</div></div>'
          : '<div class="install-device-card">' +
            '<div class="inst-platform-badge">🤖 Android / Chrome Phone</div>' +
            '<div class="inst-lead">Chrome browser me direct install karne ke liye:</div>' +
            '<div class="inst-step-list">' +
            '<div class="inst-step-item"><span class="inst-step-num">1</span><div>Chrome browser ke upar right side me <b>3 Dots (⋮)</b> menu dabayein.</div></div>' +
            '<div class="inst-step-item"><span class="inst-step-num">2</span><div>Menu me <b>"Install app"</b> ya <b>"Add to Home screen"</b> par tap karein.</div></div>' +
            '<div class="inst-step-item"><span class="inst-step-num">3</span><div>Popup me <b>"Install"</b> confirm karein — app seedhe download ho jayegi!</div></div>' +
            '</div></div>' +
            '<div class="guide-badge-box">' +
            '<span>💡 <b>Pehle se Install hai?</b> Agar aapne pehle install kar rakha hai, to aapke phone ki home screen par <b>"Jodi Games"</b> icon pehle se maujood hai — wahan se kholein!</span>' +
            '</div>'
        ) +
        '<div style="display:flex;gap:8px;margin-top:14px">' +
        '<button class="btn gold" style="flex:1" data-action="retryNativeInstall">Dubara Try Karein 🚀</button>' +
        '<button class="btn ghost" style="flex:1" data-action="closeModal">Theek Hai 👍</button>' +
        '</div></div></div>';
      m.classList.add('on');
    } else {
      m.classList.remove('on');
      m.innerHTML = '';
    }
  }

  /* Main Render Routine */
  function render() {
    var view = $('#view');
    if (!view) return;

    var html = '';
    if (state.screen === 'welcome') html = vWelcome();
    else if (state.screen === 'lobby') html = vLobby();
    else if (state.screen === 'room_ready') html = vRoomReady();
    else if (state.screen === 'game') html = vGame();
    else if (state.screen === 'results') html = vResults();
    else if (state.screen === 'race') html = vRace();
    else if (state.screen === 'race_results') html = vRaceResults();

    view.innerHTML = html;
    renderModal();

    if (state.screen === 'game') {
      bindCanvasEvents();
      startMatchTimer();
      bindGuessForm();
    } else if (state.screen === 'race') {
      var mount = $('#raceCanvasMount');
      if (mount && window.JodiRace) {
        var isConnected = Net.getStatus() === 'connected';
        var partnerOpts = {
          name: isConnected ? (Net.getPartnerName() || 'Partner') : 'AI Racer (Solo)',
          avatar: isConnected ? (Net.getPartnerAvatar() || '✨') : '🤖',
          theme: state.partnerBikeTheme || 'bullet',
          isSoloAI: !isConnected
        };
        window.JodiRace.init(mount, state.selectedBikeTheme, state.raceTrackSeed, partnerOpts);

        if (isConnected) {
          window.JodiRace.setOnLocalSync(function (data) {
            Net.send('RACE_SYNC', data);
          });
          window.JodiRace.setOnTakedown(function (data) {
            Net.send('TAKEDOWN_EVENT', data);
          });
        }

        window.JodiRace.setOnFinish(function (finishData) {
          if (window.JodiRace) window.JodiRace.cleanup();
          var results = {
            winner: finishData.winner === 'player' ? profile.name : (isConnected ? Net.getPartnerName() : 'AI Racer'),
            isMeWinner: finishData.winner === 'player',
            myScore: finishData.playerScore,
            partnerScore: finishData.partnerScore
          };
          state.raceResults = results;
          state.screen = 'race_results';
          if (isConnected) {
            Net.send('RACE_FINISH', results);
          }
          Audio.playUnlock();
          burstCenter(40);
          render();
        });
      }
    }
  }

  function bindGuessForm() {
    var form = $('#guessForm');
    if (!form) return;
    form.onsubmit = function (e) {
      e.preventDefault();
      var input = $('#guessInput');
      if (!input) return;
      var val = input.value.trim();
      if (!val || !state.game || state.game.solved || state.game.isTransitioning) return;
      input.value = '';

      var curWord = getCurrentWord().word;
      var cleanGuess = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
      var cleanTarget = curWord.toUpperCase().replace(/[^A-Z0-9]/g, '');
      var isMatch = cleanGuess === cleanTarget;

      var isHost = Net.isHostUser();
      var myIndex = isHost ? 0 : 1;

      if (isMatch) {
        state.game.solved = true;
        state.game.scores[myIndex] += 25;
        state.game.scores[1 - myIndex] += 15;
        state.game.chat.push({ by: profile.name, text: curWord, correct: true });
        updateChatFeedDOM();
        Audio.playMatch();
        burstCenter(30);
        toast('🎉 Sahi pehchana! ' + curWord + ' (+25 pts)');

        Net.send('GUESS_MATCHED', {
          word: curWord,
          by: profile.name,
          guesserIndex: myIndex,
          scores: state.game.scores
        });

        // Only Host schedules authoritative turn advancement! Guest waits for ADVANCE_TURN or GAME_OVER
        if (isHost) {
          scheduleNextTurn(2400);
        }
      } else {
        var entry = { by: profile.name, text: val, correct: false };
        state.game.chat.push(entry);
        updateChatFeedDOM();
        Net.send('GUESS_FEED', entry);
      }
    };
  }

  /* User Actions Dispatcher */
  document.addEventListener('click', function (e) {
    var target = e.target.closest('[data-action]');
    if (!target) return;
    var action = target.dataset.action;

    if (action === 'toggleSound') {
      var muted = Audio.toggleMuted();
      toast(muted ? 'Sound Mute kiya gaya 🔇' : 'Sound On hai 🔊');
      render();
    } else if (action === 'pickAvatar') {
      profile.avatar = target.dataset.av;
      render();
    } else if (action === 'saveName') {
      var inp = $('#nameInput');
      var name = inp ? inp.value.trim() : '';
      if (!name) {
        toast('Kripya apna naam likhein! ✍️');
        return;
      }
      profile.name = name;
      saveProfile(profile);
      Audio.playTap();
      state.screen = 'lobby';
      render();
    } else if (action === 'editProfile') {
      Audio.playTap();
      state.screen = 'welcome';
      render();
    } else if (action === 'createRoom') {
      Audio.playTap();
      Net.createRoom(profile.name, profile.avatar, function (err, code) {
        if (err) {
          toast('Room banane mein dikkat aayi: ' + (err.message || 'Error'));
        } else {
          toast('Room ban gaya! Code: ' + code + ' 📋');
          render();
        }
      });
      render();
    } else if (action === 'cancelRoom') {
      Audio.playTap();
      Net.leaveRoom();
      render();
    } else if (action === 'copyCode') {
      Audio.playTap();
      var code = target.dataset.code;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(function () {
          toast('Code copy ho gaya: ' + code + ' 📋');
        }).catch(function () {
          toast('Code: ' + code);
        });
      } else {
        toast('Code: ' + code);
      }
    } else if (action === 'openJoinModal') {
      Audio.playTap();
      state.modal = 'join';
      renderModal();
      setTimeout(function () {
        var jInp = $('#joinInput');
        if (jInp) jInp.focus();
      }, 100);
    } else if (action === 'closeModal') {
      Audio.playTap();
      state.modal = null;
      renderModal();
    } else if (action === 'submitJoin') {
      Audio.playTap();
      var jInp = $('#joinInput');
      var codeVal = jInp ? jInp.value.trim() : '';
      if (!codeVal) {
        toast('Kripya Room Code daalein!');
        return;
      }
      if (!codeVal.toUpperCase().startsWith('JODI-')) {
        codeVal = 'JODI-' + codeVal;
      }
      state.modal = null;
      renderModal();
      toast('Connecting to ' + codeVal + '...');

      Net.joinRoom(codeVal, profile.name, profile.avatar, function (err) {
        if (err) {
          toast('Room connect nahi ho saka. Code check karein!');
        }
      });
    } else if (action === 'setCount') {
      Audio.playTap();
      var val = +target.dataset.val;
      state.matchSettings.wordCount = val;
      Net.send('UPDATE_SETTINGS', state.matchSettings);
      render();
    } else if (action === 'setLang') {
      Audio.playTap();
      var lang = target.dataset.val;
      state.matchSettings.language = lang;
      Net.send('UPDATE_SETTINGS', state.matchSettings);
      render();
    } else if (action === 'startMatch') {
      Audio.playTap();
      var ms = state.matchSettings;
      var deck = Words.getDeck(ms.wordCount, ms.language);
      var endAt = Date.now() + 60000;
      var matchPayload = {
        deck: deck,
        turnIndex: 0,
        totalTurns: deck.length,
        endAt: endAt,
        scores: [0, 0]
      };
      state.game = {
        deck: deck,
        turnIndex: 0,
        totalTurns: deck.length,
        dur: 60,
        endAt: endAt,
        scores: [0, 0],
        chat: [],
        solved: false
      };
      state.strokes = [];
      state.screen = 'game';
      Net.send('START_MATCH', matchPayload);
      render();
    } else if (action === 'pickColor') {
      Audio.playTap();
      state.currentColor = target.dataset.color;
      var all = document.querySelectorAll('.color-swatch');
      all.forEach(function (el) { el.classList.remove('active'); });
      target.classList.add('active');
    } else if (action === 'pickSize') {
      Audio.playTap();
      state.currentSize = +target.dataset.sz;
      var allSz = document.querySelectorAll('.brush-btn');
      allSz.forEach(function (el) { el.classList.remove('active'); });
      target.classList.add('active');
    } else if (action === 'clearBoard') {
      Audio.playTap();
      state.strokes = [];
      var canvas = $('#drawCanvas');
      if (canvas) {
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      Net.send('CLEAR_CANVAS', {});
    } else if (action === 'playAgain') {
      Audio.playTap();
      var ms2 = state.matchSettings;
      var freshDeck = Words.getDeck(ms2.wordCount, ms2.language);
      var newEndAt = Date.now() + 60000;
      var payload = {
        deck: freshDeck,
        turnIndex: 0,
        totalTurns: freshDeck.length,
        endAt: newEndAt,
        scores: [0, 0]
      };
      state.game = {
        deck: freshDeck,
        turnIndex: 0,
        totalTurns: freshDeck.length,
        dur: 60,
        endAt: newEndAt,
        scores: [0, 0],
        chat: [],
        solved: false
      };
      state.strokes = [];
      state.screen = 'game';
      Net.send('START_MATCH', payload);
      render();
    } else if (action === 'backToLobby') {
      Audio.playTap();
      state.game = null;
      state.screen = 'room_ready';
      Net.send('RETURN_LOBBY', {});
      render();
    } else if (action === 'leaveRoom') {
      Audio.playTap();
      Net.leaveRoom();
      state.game = null;
      state.screen = 'lobby';
      toast('Room se nikal gaye 👋');
      render();
    } else if (action === 'setMode') {
      Audio.playTap();
      var modeVal = target.dataset.mode;
      state.selectedGameMode = modeVal;
      Net.send('SET_GAME_MODE', { mode: modeVal });
      render();
    } else if (action === 'pickBike') {
      Audio.playTap();
      var bikeVal = target.dataset.bike;
      state.selectedBikeTheme = bikeVal;
      Net.send('PARTNER_BIKE_CHOICE', { bike: bikeVal });
      render();
    } else if (action === 'startRace') {
      Audio.playTap();
      var seed = Math.floor(Math.random() * 9000) + 1000;
      state.raceTrackSeed = seed;
      state.screen = 'race';
      Net.send('START_RACE', {
        seed: seed,
        bike: state.selectedBikeTheme
      });
      render();
    } else if (action === 'soloPracticeRace') {
      Audio.playTap();
      state.raceTrackSeed = Math.floor(Math.random() * 9000) + 1000;
      state.screen = 'race';
      render();
    } else if (action === 'exitRace') {
      Audio.playTap();
      if (window.JodiRace) window.JodiRace.cleanup();
      if (Net.getStatus() === 'connected') {
        state.screen = 'room_ready';
        Net.send('EXIT_RACE', {});
      } else {
        state.screen = 'lobby';
      }
      render();
    } else if (action === 'raceAgain') {
      Audio.playTap();
      var seed2 = Math.floor(Math.random() * 9000) + 1000;
      state.raceTrackSeed = seed2;
      state.screen = 'race';
      if (Net.getStatus() === 'connected') {
        Net.send('START_RACE', {
          seed: seed2,
          bike: state.selectedBikeTheme
        });
      }
      render();
    } else if (action === 'openGuide') {
      Audio.playTap();
      state.modal = 'guide';
      state.guideTab = 'scribble';
      renderModal();
    } else if (action === 'setGuideTab') {
      Audio.playTap();
      state.guideTab = target.dataset.tab;
      renderModal();
    } else if (action === 'closeGuide') {
      Audio.playTap();
      state.modal = null;
      try { localStorage.setItem('jodi_guide_seen', 'true'); } catch (e) {}
      renderModal();
    } else if (action === 'installPwa') {
      Audio.playTap();
      handlePwaInstallClick();
    } else if (action === 'dismissPwaBanner') {
      isPwaDismissed = true;
      updatePwaBannerVisibility();
    } else if (action === 'retryNativeInstall') {
      Audio.playTap();
      var pEvent = window.deferredInstallPrompt || deferredInstallPrompt;
      if (pEvent) {
        state.modal = null;
        renderModal();
        pEvent.prompt();
        pEvent.userChoice.then(function (choice) {
          if (choice.outcome === 'accepted') {
            toast('Shukriya! Jodi App install ho raha hai... 📲');
            isPwaDismissed = true;
            updatePwaBannerVisibility();
          }
          window.deferredInstallPrompt = null;
          deferredInstallPrompt = null;
        });
      } else {
        toast('Chrome ke upar 3 dots (⋮) dabakar "Install app" chunein! 📲');
      }
    }
  });

  /* ================= PWA INSTALLATION & AUTO-UPDATE ENGINE ================= */
  var deferredInstallPrompt = window.deferredInstallPrompt || null;
  var isPwaDismissed = false;

  window.onDeferredPromptReady = function (e) {
    deferredInstallPrompt = e;
    updatePwaBannerVisibility();
  };

  function isRunningStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
  }

  function updatePwaBannerVisibility() {
    var banner = document.getElementById('pwaInstallBanner');
    if (!banner) return;
    if (isRunningStandalone() || isPwaDismissed) {
      banner.style.display = 'none';
    } else {
      banner.style.display = 'flex';
    }
  }

  function handlePwaInstallClick() {
    var promptEvent = window.deferredInstallPrompt || deferredInstallPrompt;
    if (promptEvent) {
      promptEvent.prompt();
      promptEvent.userChoice.then(function (choice) {
        if (choice.outcome === 'accepted') {
          toast('Shukriya! Jodi App install ho raha hai... 📲');
          isPwaDismissed = true;
          updatePwaBannerVisibility();
        }
        window.deferredInstallPrompt = null;
        deferredInstallPrompt = null;
      });
    } else {
      // Show dedicated mobile install sheet with clear Chrome / Safari steps
      state.modal = 'install_help';
      renderModal();
    }
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredInstallPrompt = e;
    window.deferredInstallPrompt = e;
    updatePwaBannerVisibility();
  });

  window.addEventListener('appinstalled', function () {
    deferredInstallPrompt = null;
    window.deferredInstallPrompt = null;
    isPwaDismissed = true;
    updatePwaBannerVisibility();
    toast('🎉 Jodi App successfully install ho gaya!');
  });

  // Service Worker Registration with Instant Auto-Update Check
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./sw.js').then(function (reg) {
      // Query for SW updates every time site opens
      reg.update();

      reg.addEventListener('updatefound', function () {
        var newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', function () {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            toast('🚀 Naya version update ho gaya! Refresh ho raha hai...');
            setTimeout(function () {
              window.location.reload();
            }, 1200);
          }
        });
      });
    }).catch(function (err) {
      console.warn('[PWA] Service Worker registration:', err);
    });
  }

  if (document.readyState === 'complete') {
    registerServiceWorker();
  } else {
    window.addEventListener('load', registerServiceWorker);
  }

  // Initial Boot
  window.addEventListener('DOMContentLoaded', function () {
    render();
    setTimeout(updatePwaBannerVisibility, 400);
  });
})();
