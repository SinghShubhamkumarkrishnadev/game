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
    screen: profile.name ? 'lobby' : 'welcome', // 'welcome' | 'lobby' | 'room_ready' | 'game' | 'results'
    modal: null, // null | 'join'
    joinCodeInput: '',
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
    if (!state.game) return;
    state.game.solved = true;
    state.game.scores[payload.guesserIndex] += 25;
    state.game.scores[1 - payload.guesserIndex] += 15;
    state.game.chat.push({ by: payload.by, text: payload.word, correct: true });
    updateChatFeedDOM();
    Audio.playMatch();
    burstCenter(30);
    toast('🎉 ' + payload.by + ' ne sahi pehchana! +25 pts');

    setTimeout(function () {
      handleTurnTransition();
    }, 2400);
  });

  Net.on('TIME_EXPIRED', function (payload) {
    if (!state.game) return;
    state.game.solved = false;
    Audio.playMiss();
    toast('⌛ Time Up! Sahi shabd tha: ' + payload.word);
    setTimeout(function () {
      handleTurnTransition();
    }, 2800);
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
    var turn = state.game.turnIndex % 2;
    var isDrawer = state.game && ((turn === 0 && Net.isHostUser()) || (turn === 1 && !Net.isHostUser()));
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

      // Time up
      if (leftSec <= 0 && !state.game.solved) {
        stopMatchTimer();
        var curWord = getCurrentWord().word;
        if (Net.isHostUser()) {
          Net.send('TIME_EXPIRED', { word: curWord });
        }
        Audio.playMiss();
        toast('⌛ Time Up! Sahi shabd tha: ' + curWord);
        setTimeout(function () {
          handleTurnTransition();
        }, 2800);
      }
    }, 200);
  }

  function stopMatchTimer() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }

  function getCurrentWord() {
    if (!state.game || !state.game.deck || !state.game.deck.length) {
      return { word: 'SAMOSA', hint: 'Triangle snack', cat: 'Khaana', lang: 'hi' };
    }
    return state.game.deck[state.game.turnIndex % state.game.deck.length];
  }

  function handleTurnTransition() {
    stopMatchTimer();
    if (!state.game) return;

    var nextTurn = state.game.turnIndex + 1;
    if (nextTurn < state.game.totalTurns) {
      // Advance to next word / turn
      state.game.turnIndex = nextTurn;
      state.game.endAt = Date.now() + 60000;
      state.game.solved = false;
      state.strokes = [];

      var nextDrawerIsHost = (nextTurn % 2) === 0;
      var nextDrawerName = nextDrawerIsHost
        ? (Net.isHostUser() ? profile.name : Net.getPartnerName())
        : (Net.isHostUser() ? Net.getPartnerName() : profile.name);

      toast('Turn ' + (nextTurn + 1) + '/' + state.game.totalTurns + '! Ab ' + nextDrawerName + ' draw karenge 🎨');
      render();
    } else {
      // All rounds complete -> Scorecard
      state.screen = 'results';
      Audio.playUnlock();
      burstCenter(35);
      render();
    }
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
      '<div class="brand-title">Jodi Scribble <span class="brand-tag">Online</span></div>' +
      '<div class="header-actions">' +
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
      '<div style="margin-top:auto;padding-top:16px;text-align:center">' +
      '<button class="btn ghost sm" data-action="editProfile">Naam Badlein</button>' +
      '</div></section>';
  }

  // 3. Connected Room Lobby (With Word Count & Language Selectors)
  function vRoomReady() {
    var myName = profile.name;
    var partnerName = Net.getPartnerName() || 'Partner';
    var myAvatar = profile.avatar;
    var partnerAvatar = Net.getPartnerAvatar() || '✨';
    var isHost = Net.isHostUser();
    var code = Net.getRoomCode();
    var latency = Net.getLatency();
    var ms = state.matchSettings;

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

      // Match Settings Controls
      '<div class="settings-section">' +
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

      '<button class="btn primary" data-action="startMatch">Khelna Shuru Karein 🎨</button>' +
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

  // Bottom Sheet Modal for Join Code
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

    view.innerHTML = html;
    renderModal();

    if (state.screen === 'game') {
      bindCanvasEvents();
      startMatchTimer();
      bindGuessForm();
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
      if (!val || !state.game || state.game.solved) return;
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
          guesserIndex: myIndex
        });

        setTimeout(function () {
          handleTurnTransition();
        }, 2400);
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
    }
  });

  // Initial Boot
  window.addEventListener('DOMContentLoaded', function () {
    render();
  });
})();
