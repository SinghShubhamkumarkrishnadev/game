/* Jodi Sync — Core Application Controller & Router */
(function () {
  'use strict';

  var Words = window.JodiWords;
  var TwoMinds = window.TwoMindsGame;
  var Audio = window.JodiAudio;
  var Net = window.JodiNet;
  var Scribble = window.JodiScribble;
  var Modals = window.JodiModals;
  var Lobby = window.JodiLobby;
  var TwoMindsUI = window.JodiTwoMindsUI;
  var Race = window.JodiRace;
  var SoloArcade = window.JodiSoloArcade;
  var TTTUI = window.JodiTTTUI;

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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p || profile));
    } catch (e) {}
  }

  var profile = loadProfile();

  /* App State */
  var state = {
    screen: profile.name ? 'lobby' : 'welcome', // 'welcome' | 'lobby' | 'room_ready' | 'game' | 'results' | 'race' | 'twominds' | 'twominds_results'
    modal: (function () {
      try { return localStorage.getItem('jodi_guide_seen') ? null : 'guide'; } catch (e) { return null; }
    })(),
    guideTab: 'twominds', // 'twominds' | 'scribble' | 'race' | 'install'
    joinCodeInput: '',
    selectedGameMode: 'twominds', // 'twominds' | 'scribble' | 'race'
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
    },
    twoMindsSettings: {
      wordCount: 10,
      duration: 45, // 60 | 45 | 30
      mode: 'classic' // 'classic' | 'speed' | 'sync' | 'hard' | 'daily'
    },
    twoMinds: null,
    twoMindsChat: [],
    partnerBubble: null,
    bubbleTimer: null,
    twoMindsTimerInterval: null,
    twoMindsResults: null,
    sharePartnerPrompt: false
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
          setTimeout(function () { el.remove(); }, 1200);
        }
      })(el, dx, dy);
    }
  }

  function burstCenter(count) {
    burst(window.innerWidth / 2, window.innerHeight / 2, count || 30);
  }

  /* Universal Toast Notification */
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

  /* App Context for Modules */
  var appContext = {
    state: state,
    profile: profile,
    Audio: Audio,
    Net: Net,
    Words: Words,
    TwoMinds: TwoMinds,
    toast: toast,
    burst: burst,
    burstCenter: burstCenter,
    render: function () { render(); },
    saveProfile: saveProfile
  };
  window.JodiContext = appContext;

  // Initialize modular controllers
  if (Scribble && Scribble.init) Scribble.init(appContext);
  if (Lobby && Lobby.init) Lobby.init(appContext);
  if (TwoMindsUI && TwoMindsUI.init) TwoMindsUI.init(appContext);
  if (SoloArcade && SoloArcade.init) SoloArcade.init(appContext);
  if (TTTUI && TTTUI.init) TTTUI.init(appContext);

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
    Net.send('PARTNER_BIKE_CHOICE', { bike: state.selectedBikeTheme });
    render();
  });

  Net.on('PARTNER_LEFT_GAME', function (payload) {
    var pName = (payload && payload.by) || Net.getPartnerName() || 'Partner';
    if (state.screen === 'game') {
      if (Scribble && Scribble.stopMatchTimer) Scribble.stopMatchTimer();
      Audio.playMiss();
      if (state.game) state.game.partnerOffline = true;
      state.partnerLeftName = pName;
      state.modal = 'partner_left_scribble';
      render();
    } else if (state.screen === 'twominds') {
      if (TwoMindsUI && TwoMindsUI.stopTimer) TwoMindsUI.stopTimer();
      Audio.playMiss();
      state.partnerLeftName = pName;
      state.modal = 'partner_left_scribble';
      render();
    } else if (state.screen === 'race') {
      Audio.playMiss();
      toast('⚠️ ' + pName + ' race se chale gaye. AI racer ne takeover kiya!');
      if (window.JodiRace && typeof window.JodiRace.setSoloAI === 'function') {
        window.JodiRace.setSoloAI(true);
      }
    } else {
      toast('⚠️ ' + pName + ' ne game chhod diya');
    }
  });

  Net.on('partnerDisconnected', function () {
    if (state.screen === 'race') {
      toast('Partner connection lost ⚠️ AI autopilot chal raha hai! Race continue karein.');
      if (window.JodiRace && typeof window.JodiRace.setSoloAI === 'function') {
        window.JodiRace.setSoloAI(true);
      }
      return;
    }
    if (state.screen === 'game' || state.screen === 'twominds') {
      if (state.screen === 'game' && Scribble && Scribble.stopMatchTimer) {
        Scribble.stopMatchTimer();
      }
      if (state.screen === 'twominds' && TwoMindsUI && TwoMindsUI.stopTimer) {
        TwoMindsUI.stopTimer();
      }
      Audio.playMiss();
      if (state.game) state.game.partnerOffline = true;
      state.partnerLeftName = Net.getPartnerName() || 'Partner';
      state.modal = 'partner_left_scribble';
      render();
      return;
    }
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
    var modeName = payload.mode === 'twominds' ? '🧩 Two Minds, One Word' :
                   payload.mode === 'race' ? '🏍️ Jodi Race (3D)' : '🎨 Jodi Scribble';
    toast('Game Mode: ' + modeName);
    render();
  });

  Net.on('UPDATE_TWOMINDS_SETTINGS', function (settings) {
    state.twoMindsSettings = settings;
    toast('Two Minds settings updated ⚙️');
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
      Net.send('PARTNER_BIKE_CHOICE', { bike: state.selectedBikeTheme });
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
    if (state.screen !== 'race') return;
    if (window.JodiRace) window.JodiRace.cleanup();
    state.raceResults = {
      winner: payload.winner,
      isMeWinner: payload.winner === profile.name,
      myScore: payload.partnerScore,
      partnerScore: payload.myScore
    };
    state.screen = 'race_results';
    Audio.playUnlock();
    burstCenter(40);
    render();
  });

  Net.on('UPDATE_SETTINGS', function (settings) {
    state.matchSettings = settings;
    toast('Game settings update: ' + settings.wordCount + ' Words ⚙️');
    render();
  });

  /* Scribble Network Events */
  Net.on('START_MATCH', function (payload) {
    state.game = {
      deck: payload.deck,
      turnIndex: payload.turnIndex || 0,
      totalTurns: payload.totalTurns || payload.deck.length,
      dur: 60,
      endAt: payload.endAt,
      scores: payload.scores || [0, 0],
      chat: [],
      solved: false,
      revealedIndices: [],
      hintRevealed: false,
      hintUnlockedNotified: false
    };
    state.strokes = [];
    state.screen = 'game';
    Audio.playTap();
    render();
  });

  Net.on('LETTER_HINT_REVEAL', function (payload) {
    if (!state.game) return;
    if (payload.turnIndex === state.game.turnIndex && payload.revealedIndices) {
      state.game.revealedIndices = payload.revealedIndices;
      if (Scribble && Scribble.updateBlanksDOM) Scribble.updateBlanksDOM();
      Audio.playPop();
    }
  });

  Net.on('DRAW_STROKE', function (stk) {
    if (state.screen !== 'game') return;
    state.strokes.push(stk);
    if (Scribble && Scribble.drawStrokeOnCanvas) Scribble.drawStrokeOnCanvas(stk);
  });

  Net.on('CLEAR_CANVAS', function () {
    state.strokes = [];
    var canvas = $('#drawCanvas');
    if (canvas) {
      var c = canvas.getContext('2d');
      c.clearRect(0, 0, canvas.width, canvas.height);
    }
  });

  Net.on('GUESS_FEED', function (entry) {
    if (!state.game) return;
    if (state.screen === 'game' && Scribble && Scribble.handleIncomingGuessFeed) {
      Scribble.handleIncomingGuessFeed(entry);
    } else {
      state.game.chat.push(entry);
      if (Scribble && Scribble.updateChatFeedDOM) Scribble.updateChatFeedDOM();
      if (!entry.correct) {
        Audio.playTick(false);
      }
    }
  });

  Net.on('GUESS_MATCHED', function (payload) {
    if (!state.game || state.game.solved || state.game.isTransitioning) return;
    if (state.screen === 'game' && Scribble && Scribble.handleIncomingMatch) {
      Scribble.handleIncomingMatch(payload);
    } else {
      state.game.solved = true;
      if (payload.scores) {
        state.game.scores = payload.scores;
      } else {
        state.game.scores[payload.guesserIndex] += 25;
        state.game.scores[1 - payload.guesserIndex] += 15;
      }
      state.game.chat.push({ by: payload.by, text: payload.word, correct: true });
      if (Scribble && Scribble.updateChatFeedDOM) Scribble.updateChatFeedDOM();
      Audio.playMatch();
      burstCenter(30);
      toast('🎉 ' + payload.by + ' ne sahi pehchana! +25 pts');

      var blanksRow = $('#blanksRow');
      if (blanksRow) {
        blanksRow.innerHTML = '<span style="color:var(--good);font-weight:900;font-size:20px">🎉 ' + esc(payload.word) + '</span>';
      }

      if (Net.isHostUser() && Scribble && Scribble.scheduleNextTurn) {
        Scribble.scheduleNextTurn(2400);
      }
    }
  });

  Net.on('TIME_EXPIRED', function (payload) {
    if (!state.game) return;
    state.game.solved = false;
    state.game.isTransitioning = true;
    if (Scribble && Scribble.stopMatchTimer) Scribble.stopMatchTimer();
    Audio.playMiss();
    toast('⌛ Time Up! Sahi shabd tha: ' + payload.word);
    var blanksRow = $('#blanksRow');
    if (blanksRow) {
      blanksRow.innerHTML = '<span style="color:var(--bad);font-weight:900;font-size:20px">⌛ ' + esc(payload.word) + '</span>';
    }
  });

  Net.on('ADVANCE_TURN', function (payload) {
    if (Scribble && Scribble.applyTurnTransition) Scribble.applyTurnTransition(payload);
  });

  Net.on('GAME_OVER', function (payload) {
    if (Scribble && Scribble.applyGameOver) Scribble.applyGameOver(payload);
  });

  Net.on('RETURN_LOBBY', function () {
    state.game = null;
    if (TwoMinds) TwoMinds.cleanup();
    state.twoMinds = null;
    if (TTTUI && TTTUI.cleanup) TTTUI.cleanup();
    state.ttt = null;
    state.screen = 'room_ready';
    toast('Room Lobby mein wapas aa gaye 🏠');
    render();
  });

  /* Two Minds Network Event Handlers */
  Net.on('TM_START_MATCH', function (payload) {
    state.selectedSlotIdx = null;
    state.twoMinds = {
      roundIndex: payload.roundIndex || 0,
      totalRounds: payload.totalRounds || 10,
      roundDuration: payload.roundDuration || 45,
      roundEndAt: payload.roundEndAt || (Date.now() + 45000),
      teamScore: payload.teamScore || 0,
      comboStreak: payload.combo || 0,
      maxCombo: payload.combo || 0,
      wordsSolved: payload.wordsSolved || 0,
      isSolved: false,
      isTransitioning: false,
      isSolo: false,
      wordLength: payload.wordLength,
      category: payload.category,
      clueA: payload.clueA,
      clueB: payload.clueB,
      prompt: payload.prompt,
      slotOwners: payload.slotOwners || [],
      slots: (function () {
        var arr = [];
        for (var i = 0; i < payload.wordLength; i++) arr.push(null);
        return arr;
      })(),
      myRack: (payload.guestLetters || []).map(function (ltr, idx) {
        return { id: 'B_' + idx + '_' + Date.now(), letter: ltr, placed: false };
      })
    };

    state.screen = 'twominds';
    Audio.playTap();
    toast('🧩 Two Minds Shuru! Milkar shabd poora karein.');
    render();
  });

  Net.on('TM_BOARD_UPDATE', function (payload) {
    if (!state.twoMinds) return;
    state.twoMinds.slots = payload.slots || [];
    var placedIds = {};
    state.twoMinds.slots.forEach(function (s) {
      if (s && s.id) placedIds[s.id] = true;
    });
    (state.twoMinds.myRack || []).forEach(function (tile) {
      tile.placed = !!placedIds[tile.id];
    });
    Audio.playTap();
    render();
  });

  Net.on('TM_QUICK_MSG', function (payload) {
    if (!state.twoMinds) return;
    state.twoMindsChat.push({
      text: payload.text,
      sender: payload.sender || Net.getPartnerName() || 'Partner',
      type: 'partner'
    });
    if (TwoMindsUI && TwoMindsUI.showPartnerSpeechBubble) {
      TwoMindsUI.showPartnerSpeechBubble(payload.text, payload.sender || Net.getPartnerName() || 'Partner');
    }
    Audio.playChime();
    render();
  });

  Net.on('TM_CHAT_MSG', function (payload) {
    if (!state.twoMinds) return;
    state.twoMindsChat.push({
      text: payload.text,
      sender: payload.sender || Net.getPartnerName() || 'Partner',
      type: 'partner'
    });
    Audio.playTick(false);
    render();
  });

  Net.on('TM_ASK_HELP', function (payload) {
    state.sharePartnerPrompt = true;
    Audio.playChime();
    toast('🤝 ' + (payload.requester || 'Partner') + ' ko letter me madad chahiye! "Share a Letter" dabayein.');
    render();
  });

  Net.on('TM_GIVE_HELP', function (payload) {
    state.twoMindsChat.push({
      text: '💡 Partner ne reveal kiya: Partner ke paas akshar "' + payload.sharedLetter + '" hai!',
      type: 'system'
    });
    if (TwoMindsUI && TwoMindsUI.showPartnerSpeechBubble) {
      TwoMindsUI.showPartnerSpeechBubble('I have letter: ' + payload.sharedLetter, payload.helper || 'Partner');
    }
    Audio.playUnlock();
    toast('💡 Partner ne bataya: Unke paas "' + payload.sharedLetter + '" hai!');
    render();
  });

  Net.on('TM_USE_HINT', function (payload) {
    if (!state.twoMinds) return;
    state.twoMinds.hintsUsed = (state.twoMinds.hintsUsed || 0) + 1;
    state.twoMinds.teamScore = Math.max(0, (state.twoMinds.teamScore || 0) - 20);

    if (payload.hintType === 'first_letter' && payload.letter) {
      state.twoMinds.slots[0] = { letter: payload.letter, owner: 'system', locked: true, id: 'hint_0' };
    }
    state.twoMindsChat.push({
      text: '💡 Hint Use Hua: ' + payload.hintDesc,
      type: 'system'
    });
    Audio.playUnlock();
    toast('💡 Hint: ' + payload.hintDesc);
    render();
  });

  Net.on('TM_SUBMIT_CHECK', function () {
    if (!Net.isHostUser() || !state.twoMinds) return;
    if (TwoMinds) TwoMinds.setSlots(state.twoMinds.slots);
    var checkRes = TwoMinds ? TwoMinds.verifyWord(state.twoMinds.slots) : { isCorrect: false };
    if (checkRes.isIncomplete) {
      toast('Pehle saare akshar bharein!');
      return;
    }
    if (checkRes.isCorrect) {
      state.twoMinds.teamScore = TwoMinds.getMatch().teamScore;
      state.twoMinds.comboStreak = checkRes.combo;
      state.twoMinds.wordsSolved = TwoMinds.getMatch().wordsSolved;
      state.twoMinds.isSolved = true;
      state.twoMinds.roundWinnerBanner = {
        word: checkRes.word,
        scoreAdded: checkRes.scoreAdded,
        combo: checkRes.combo
      };

      Audio.playMatch();
      burstCenter(36);

      Net.send('TM_ROUND_WIN', {
        word: checkRes.word,
        scoreAdded: checkRes.scoreAdded,
        combo: checkRes.combo,
        teamScore: state.twoMinds.teamScore,
        wordsSolved: state.twoMinds.wordsSolved
      });
      render();

      setTimeout(function () {
        if (TwoMindsUI && TwoMindsUI.advanceRoundAuthoritative) {
          TwoMindsUI.advanceRoundAuthoritative();
        }
      }, 2600);
    } else {
      Audio.playMiss();
      toast('Not quite! Keep working together.');
      var boardEl = document.querySelector('.tm-board-slots');
      if (boardEl) {
        boardEl.classList.add('shake');
        setTimeout(function () { boardEl.classList.remove('shake'); }, 500);
      }
      Net.send('TM_ROUND_FAIL', {
        message: checkRes.message,
        teamScore: state.twoMinds.teamScore
      });
      render();
    }
  });

  Net.on('TM_ROUND_WIN', function (payload) {
    if (!state.twoMinds) return;
    state.twoMinds.isSolved = true;
    state.twoMinds.teamScore = payload.teamScore;
    state.twoMinds.comboStreak = payload.combo;
    state.twoMinds.wordsSolved = payload.wordsSolved;
    state.twoMinds.roundWinnerBanner = {
      word: payload.word,
      scoreAdded: payload.scoreAdded,
      combo: payload.combo
    };
    Audio.playMatch();
    burstCenter(36);
    render();
  });

  Net.on('TM_ROUND_FAIL', function (payload) {
    if (!state.twoMinds) return;
    state.twoMinds.comboStreak = 0;
    state.twoMinds.teamScore = payload.teamScore;
    Audio.playMiss();
    toast('Not quite! Keep working together.');
    var boardEl = document.querySelector('.tm-board-slots');
    if (boardEl) {
      boardEl.classList.add('shake');
      setTimeout(function () { boardEl.classList.remove('shake'); }, 500);
    }
    render();
  });

  Net.on('TM_ROUND_ADVANCE', function (payload) {
    if (!state.twoMinds) return;
    state.selectedSlotIdx = null;
    state.twoMinds.roundIndex = payload.roundIndex;
    state.twoMinds.roundDuration = payload.roundDuration;
    state.twoMinds.roundEndAt = payload.roundEndAt;
    state.twoMinds.wordLength = payload.wordLength;
    state.twoMinds.category = payload.category;
    state.twoMinds.clueA = payload.clueA;
    state.twoMinds.clueB = payload.clueB;
    state.twoMinds.prompt = payload.prompt;
    state.twoMinds.slotOwners = payload.slotOwners || [];
    state.twoMinds.teamScore = payload.teamScore;
    state.twoMinds.comboStreak = payload.combo;
    state.twoMinds.wordsSolved = payload.wordsSolved;
    state.twoMinds.isSolved = false;
    state.twoMinds.isTransitioning = false;
    state.twoMinds.roundWinnerBanner = null;

    var arr = [];
    for (var i = 0; i < payload.wordLength; i++) arr.push(null);
    state.twoMinds.slots = arr;

    state.twoMinds.myRack = (payload.guestLetters || []).map(function (ltr, idx) {
      return { id: 'B_' + idx + '_' + Date.now(), letter: ltr, placed: false };
    });

    toast('Round ' + (payload.roundIndex + 1) + ' Shuru! 🧩');
    render();
  });

  Net.on('TM_TIMEOUT', function (payload) {
    if (!state.twoMinds) return;
    state.twoMinds.isSolved = false;
    state.twoMinds.isTransitioning = true;
    Audio.playMiss();
    toast('⌛ Time Up! Sahi shabd tha: ' + payload.word);
    render();
  });

  Net.on('TM_MATCH_OVER', function (payload) {
    if (TwoMindsUI && TwoMindsUI.applyGameOver) {
      TwoMindsUI.applyGameOver(payload);
    }
  });

  /* 3D Race Views */
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
      '<div class="nitro-header"><span>⚡ Nitro</span></div>' +
      '<div class="nitro-track"><div class="nitro-fill" id="raceNitroBar"></div></div>' +
      '</div>' +
      '<button class="race-hud-exit" data-action="exitRace">✕ Exit</button>' +
      '</div>' +
      '<div class="race-minimap-card">' +
      '<canvas id="raceMinimap" width="80" height="80"></canvas>' +
      '<div class="race-lap-badge" id="raceLapBadge">Lap 1/3</div>' +
      '</div>' +
      '<div class="race-status-row">' +
      '<div class="race-lead-pill" id="raceLeadPill">🔥 Barabar</div>' +
      '<div class="race-tilt-badge active" id="raceTiltBadge" title="Phone tilt karke bike turn karein">📱 Tilt Steer: Active</div>' +
      '</div>' +
      '<div class="race-turn-indicator" id="raceTurnIndicator"></div>' +
      '<div class="race-takedown-banner" id="raceTakedownBanner"></div>' +
      '<div class="race-controls-bottom">' +
      '<div class="steer-group">' +
      '<button class="touch-btn steer" id="btnSteerL" aria-label="Steer Left">◀</button>' +
      '<button class="touch-btn steer" id="btnSteerR" aria-label="Steer Right">▶</button>' +
      '</div>' +
      '<div class="pedal-group">' +
      '<button class="touch-btn brake" id="btnBrake">Brake</button>' +
      '<button class="touch-btn nitro" id="btnNitro">⚡</button>' +
      '<button class="touch-btn gas" id="btnGas">Gas</button>' +
      '</div>' +
      '</div>' +
      '</div>';
  }

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
    var headerHtml = Lobby ? Lobby.renderHeader() : '';

    return '<section class="screen">' +
      headerHtml +
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

  function renderModal() {
    if (Modals && Modals.render) {
      Modals.render(appContext);
    }
  }

  function updatePwaBannerVisibility() {
    if (Modals && Modals.updatePwaBannerVisibility) {
      Modals.updatePwaBannerVisibility();
    }
  }

  /* Main Router */
  function render() {
    var view = $('#view');
    if (!view) return;

    var html = '';
    if (state.screen === 'welcome') html = Lobby ? Lobby.vWelcome() : '';
    else if (state.screen === 'lobby') html = Lobby ? Lobby.vLobby() : '';
    else if (state.screen === 'room_ready') html = Lobby ? Lobby.vRoomReady() : '';
    else if (state.screen === 'game') html = Scribble ? Scribble.vGame() : '';
    else if (state.screen === 'results') html = Scribble ? Scribble.vResults() : '';
    else if (state.screen === 'race') html = vRace();
    else if (state.screen === 'race_results') html = vRaceResults();
    else if (state.screen === 'twominds') html = TwoMindsUI ? TwoMindsUI.vGame() : '';
    else if (state.screen === 'twominds_results') html = TwoMindsUI ? TwoMindsUI.vResults() : '';
    else if (state.screen === 'solo_arcade') html = SoloArcade ? SoloArcade.vArcade() : '';
    else if (state.screen === 'ttt') html = TTTUI ? TTTUI.vGame() : '';

    view.innerHTML = html;
    renderModal();
    updatePwaBannerVisibility();

    if (state.screen === 'game' && Scribble) {
      if (Scribble.bindCanvasEvents) Scribble.bindCanvasEvents();
      if (Scribble.startMatchTimer) Scribble.startMatchTimer();
      if (Scribble.bindGuessForm) Scribble.bindGuessForm();
    } else if (state.screen === 'twominds' && TwoMindsUI) {
      if (TwoMindsUI.startTimer) TwoMindsUI.startTimer();
      if (TwoMindsUI.bindChatForm) TwoMindsUI.bindChatForm();
    } else if (state.screen === 'race') {
      var mount = $('#raceCanvasMount');
      if (mount && window.JodiRace) {
        var isConnected = Net.getStatus() === 'connected';
        var isHost = isConnected ? Net.isHostUser() : true;
        var partnerOpts = {
          name: isConnected ? (Net.getPartnerName() || 'Partner') : 'AI Racer (Solo)',
          avatar: isConnected ? (Net.getPartnerAvatar() || '✨') : '🤖',
          theme: state.partnerBikeTheme || 'bullet',
          isSoloAI: !isConnected,
          isHost: isHost
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
    } else if (state.screen === 'ttt' && TTTUI) {
      if (TTTUI.bindBoardEvents) TTTUI.bindBoardEvents();
    }
  }

  /* ─── TTT Network Event Handlers ─── */
  Net.on('TTT_START', function (payload) {
    var TTT = window.JodiTTT;
    if (!TTT) return;
    var game = TTT.createGame({
      firstPlayer: 'X',
      hostSymbol: 'X',
      guestSymbol: 'O',
      isSolo: false,
      hostName: payload.hostName || Net.getPartnerName() || 'Host',
      guestName: profile.name
    });
    game.mySymbol = 'O';
    game.scores = { X: 0, O: 0, draws: 0 };
    game.roundCount = 1;
    state.ttt = game;
    state.screen = 'ttt';
    Audio.playTap();
    toast('X aur O shuru! Aap O hain. Host pehle chalenge. ⭕');
    render();
  });

  Net.on('TTT_MOVE', function (payload) {
    var TTT = window.JodiTTT;
    if (!state.ttt || !TTT) return;
    var newGame = TTT.makeMove(state.ttt, payload.idx);
    if (!newGame) return;
    if (newGame.winner) {
      newGame.scores = {
        X: state.ttt.scores.X + (newGame.winner === 'X' ? 1 : 0),
        O: state.ttt.scores.O + (newGame.winner === 'O' ? 1 : 0),
        draws: state.ttt.scores.draws
      };
      Audio.playMatch();
      burstCenter(30);
    } else if (newGame.isDraw) {
      newGame.scores = { X: state.ttt.scores.X, O: state.ttt.scores.O, draws: state.ttt.scores.draws + 1 };
      Audio.playTap();
    } else {
      Audio.playTap();
    }
    state.ttt = newGame;
    render();
  });

  Net.on('TTT_RESET', function (payload) {
    var TTT = window.JodiTTT;
    if (!state.ttt || !TTT) return;
    var prevScores = payload.scores || state.ttt.scores;
    var nextFirst = payload.firstPlayer || 'X';
    var newGame = TTT.createGame({
      firstPlayer: nextFirst,
      hostSymbol: state.ttt.hostSymbol,
      guestSymbol: state.ttt.guestSymbol,
      isSolo: false,
      hostName: state.ttt.hostName,
      guestName: state.ttt.guestName
    });
    newGame.mySymbol = state.ttt.mySymbol;
    newGame.scores = prevScores;
    newGame.roundCount = (state.ttt.roundCount || 1) + 1;
    state.ttt = newGame;
    Audio.playTap();
    toast('Naya round! ⭕✕ Shuru!');
    render();
  });

  /* User Actions Dispatcher */
  document.addEventListener('click', function (e) {
    var target = e.target.closest('[data-action]');
    if (!target) return;
    var action = target.dataset.action;

    if (action === 'saveName') {
      var inp = $('#nameInput');
      var val = inp ? inp.value.trim() : '';
      if (!val) {
        toast('Kripya apna pyara naam daalein!');
        return;
      }
      profile.name = val;
      saveProfile();
      state.screen = 'lobby';
      Audio.playTap();
      burstCenter(20);
      toast('Swagat hai, ' + profile.name + '! 🌸');
      render();
    } else if (action === 'pickAvatar') {
      profile.avatar = target.dataset.av;
      saveProfile();
      Audio.playTap();
      render();
    } else if (action === 'createRoom') {
      Audio.playTap();
      Net.createRoom(profile.name, profile.avatar);
      render();
    } else if (action === 'openJoinModal') {
      Audio.playTap();
      state.modal = 'join';
      renderModal();
    } else if (action === 'openGuide') {
      Audio.playTap();
      state.modal = 'guide';
      renderModal();
    } else if (action === 'closeGuide') {
      Audio.playTap();
      state.modal = null;
      try { localStorage.setItem('jodi_guide_seen', 'true'); } catch (err) {}
      renderModal();
    } else if (action === 'setGuideTab') {
      Audio.playTap();
      state.guideTab = target.dataset.tab;
      renderModal();
    } else if (action === 'openSidebar') {
      Audio.playTap();
      state.modal = 'sidebar';
      renderModal();
    } else if (action === 'saveSettingsProfile') {
      Audio.playTap();
      var sInp = $('#settingsNameInput');
      var newName = sInp ? sInp.value.trim() : '';
      if (!newName) {
        toast('Kripya naam likhein!');
        return;
      }
      profile.name = newName;
      saveProfile();
      toast('Profile update ho gayi: ' + newName + ' ✨');
      render();
    } else if (action === 'settingsPickAvatar') {
      Audio.playTap();
      profile.avatar = target.dataset.av;
      saveProfile();
      renderModal();
    } else if (action === 'settingsToggleSound') {
      var muted = Audio.toggleMuted();
      toast(muted ? 'Sound Mute kiya gaya 🔇' : 'Sound On hai 🔊');
      renderModal();
    } else if (action === 'openGuideFromSettings') {
      Audio.playTap();
      state.modal = 'guide';
      state.guideTab = 'twominds';
      renderModal();
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
      state.modal = null;
      renderModal();
      Net.joinRoom(codeVal, profile.name, profile.avatar);
      toast('Room ' + codeVal + ' se jud rahe hain... ⏳');
    } else if (action === 'copyCode') {
      Audio.playTap();
      var codeToCopy = target.dataset.code || Net.getRoomCode();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(codeToCopy).then(function () {
          toast('Code clipboard mein copy ho gaya! 📋');
        }).catch(function () {
          toast('Code: ' + codeToCopy);
        });
      } else {
        toast('Code: ' + codeToCopy);
      }
    } else if (action === 'shareWhatsApp') {
      Audio.playTap();
      var wCode = target.dataset.code || Net.getRoomCode();
      var msg = 'Aao Jodi Sync khele! Mere room ka code hai: ' + wCode + ' 💖 Khelte hain: ' + window.location.href;
      window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(msg), '_blank');
    } else if (action === 'cancelRoom') {
      if (Audio) Audio.playTap();
      if (Net) {
        if (typeof Net.cancelRoom === 'function') {
          Net.cancelRoom();
        } else if (typeof Net.leaveRoom === 'function') {
          Net.leaveRoom();
        }
      }
      state.screen = 'lobby';
      toast('Room cancel kar diya gaya 👍');
      render();
    } else if (action === 'leaveRoom') {
      Audio.playTap();
      if (state.screen === 'race' && window.JodiRace) window.JodiRace.cleanup();
      Net.leaveRoom();
      state.screen = 'lobby';
      state.game = null;
      if (TwoMinds) TwoMinds.cleanup();
      state.twoMinds = null;
      render();
    } else if (action === 'setMode') {
      Audio.playTap();
      var mVal = target.dataset.mode;
      state.selectedGameMode = mVal;
      if (Net.getStatus() === 'connected') {
        Net.send('SET_GAME_MODE', { mode: mVal });
      }
      render();
    } else if (action === 'setCount') {
      Audio.playTap();
      state.matchSettings.wordCount = +target.dataset.val;
      if (Net.getStatus() === 'connected') {
        Net.send('UPDATE_SETTINGS', state.matchSettings);
      }
      render();
    } else if (action === 'setLang') {
      Audio.playTap();
      state.matchSettings.language = target.dataset.val;
      if (Net.getStatus() === 'connected') {
        Net.send('UPDATE_SETTINGS', state.matchSettings);
      }
      render();
    } else if (action === 'setTmMode') {
      Audio.playTap();
      state.twoMindsSettings.mode = target.dataset.val;
      if (target.dataset.val === 'speed') state.twoMindsSettings.duration = 30;
      if (Net.getStatus() === 'connected') {
        Net.send('UPDATE_TWOMINDS_SETTINGS', state.twoMindsSettings);
      }
      render();
    } else if (action === 'setTmDuration') {
      Audio.playTap();
      state.twoMindsSettings.duration = +target.dataset.val;
      if (Net.getStatus() === 'connected') {
        Net.send('UPDATE_TWOMINDS_SETTINGS', state.twoMindsSettings);
      }
      render();
    } else if (action === 'startTwoMindsMatch') {
      Audio.playTap();
      if (!Net.isHostUser()) return;
      var tmSettings = state.twoMindsSettings;
      var tmDeck = TwoMinds ? TwoMinds.getDeck(tmSettings.wordCount || 10, tmSettings.mode || 'classic') : [];
      var tmMatch = TwoMinds ? TwoMinds.createMatch(tmDeck, tmSettings) : {};

      var firstP = tmDeck[0];
      state.selectedSlotIdx = null;
      state.twoMinds = {
        roundIndex: 0,
        totalRounds: tmDeck.length,
        roundDuration: tmSettings.duration || 45,
        roundEndAt: tmMatch.roundEndAt || (Date.now() + 45000),
        teamScore: 0,
        comboStreak: 0,
        maxCombo: 0,
        wordsSolved: 0,
        isSolved: false,
        isTransitioning: false,
        isSolo: false,
        wordLength: firstP ? firstP.length : 5,
        category: firstP ? firstP.category : 'General',
        clueA: firstP ? firstP.clueA : '',
        clueB: firstP ? firstP.clueB : '',
        prompt: firstP ? firstP.prompt : '',
        slotOwners: firstP ? firstP.slotOwners : [],
        slots: (function () {
          var arr = [];
          for (var i = 0; i < (firstP ? firstP.length : 5); i++) arr.push(null);
          return arr;
        })(),
        myRack: (firstP ? firstP.playerA : []).map(function (ltr, idx) {
          return { id: 'A_' + idx + '_' + Date.now(), letter: ltr, placed: false };
        }),
        deck: tmDeck
      };

      state.screen = 'twominds';

      Net.send('TM_START_MATCH', {
        roundIndex: 0,
        totalRounds: tmDeck.length,
        roundDuration: tmSettings.duration || 45,
        roundEndAt: tmMatch.roundEndAt,
        wordLength: firstP ? firstP.length : 5,
        category: firstP ? firstP.category : 'General',
        guestLetters: firstP ? firstP.playerB : [],
        clueA: firstP ? firstP.clueA : '',
        clueB: firstP ? firstP.clueB : '',
        prompt: firstP ? firstP.prompt : '',
        slotOwners: firstP ? firstP.slotOwners : [],
        teamScore: 0,
        combo: 0,
        wordsSolved: 0
      });
      render();
    } else if (action === 'startMatch') {
      Audio.playTap();
      if (!Net.isHostUser()) return;
      var deck = Words ? Words.getDeck(state.matchSettings.wordCount, state.matchSettings.language) : [];
      var endAt = Date.now() + 60000;
      state.game = {
        deck: deck,
        turnIndex: 0,
        totalTurns: deck.length,
        dur: 60,
        endAt: endAt,
        scores: [0, 0],
        chat: [],
        solved: false,
        revealedIndices: [],
        hintRevealed: false,
        hintUnlockedNotified: false
      };
      state.strokes = [];
      state.screen = 'game';

      Net.send('START_MATCH', {
        deck: deck,
        turnIndex: 0,
        totalTurns: deck.length,
        endAt: endAt,
        scores: [0, 0]
      });
      render();
    } else if (action === 'startRace') {
      Audio.playTap();
      if (!Net.isHostUser()) return;
      var seed = Math.floor(Math.random() * 9000) + 1000;
      state.raceTrackSeed = seed;
      state.screen = 'race';
      Net.send('START_RACE', {
        seed: seed,
        bike: state.selectedBikeTheme
      });
      render();
    } else if (action === 'pickBike') {
      Audio.playTap();
      var bTheme = target.dataset.bike;
      state.selectedBikeTheme = bTheme;
      if (Net.getStatus() === 'connected') {
        Net.send('PARTNER_BIKE_CHOICE', { bike: bTheme });
      }
      render();
    } else if (action === 'exitRace') {
      Audio.playTap();
      state.modal = 'confirm_exit_race';
      renderModal();
    } else if (action === 'confirmExitRace') {
      Audio.playTap();
      state.modal = null;
      if (window.JodiRace) window.JodiRace.cleanup();
      if (Net.getStatus() === 'connected') {
        Net.send('PARTNER_LEFT_GAME', { by: profile.name, mode: 'race' });
        Net.send('EXIT_RACE', {});
      }
      state.screen = (Net.getStatus() === 'connected') ? 'room_ready' : 'lobby';
      render();
    } else if (action === 'raceAgain') {
      Audio.playTap();
      var newSeed = Math.floor(Math.random() * 9000) + 1000;
      state.raceTrackSeed = newSeed;
      state.screen = 'race';
      if (Net.getStatus() === 'connected' && Net.isHostUser()) {
        Net.send('START_RACE', { seed: newSeed, bike: state.selectedBikeTheme });
      }
      render();
    } else if (action === 'playAgain') {
      Audio.playTap();
      if (Net.isHostUser()) {
        var newDeck = Words ? Words.getDeck(state.matchSettings.wordCount, state.matchSettings.language) : [];
        var newEndAt = Date.now() + 60000;
        state.game = {
          deck: newDeck,
          turnIndex: 0,
          totalTurns: newDeck.length,
          dur: 60,
          endAt: newEndAt,
          scores: [0, 0],
          chat: [],
          solved: false,
          revealedIndices: [],
          hintRevealed: false,
          hintUnlockedNotified: false
        };
        state.strokes = [];
        state.screen = 'game';
        Net.send('START_MATCH', {
          deck: newDeck,
          turnIndex: 0,
          totalTurns: newDeck.length,
          endAt: newEndAt,
          scores: [0, 0]
        });
        render();
      } else {
        toast('Host se agla round shuru karne ko kahein!');
      }
    } else if (action === 'backToLobby') {
      Audio.playTap();
      state.screen = 'room_ready';
      state.game = null;
      if (Net.getStatus() === 'connected') {
        Net.send('RETURN_LOBBY', {});
      }
      render();
    } else if (action === 'openSoloArcade') {
      Audio.playTap();
      state.screen = 'solo_arcade';
      render();
    } else if (action === 'closeArcade') {
      Audio.playTap();
      state.screen = 'lobby';
      render();
    } else if (action === 'soloPlayTTT') {
      Audio.playTap();
      if (TTTUI && TTTUI.launchSolo) TTTUI.launchSolo();
    } else if (action === 'soloPlayTwoMinds') {
      Audio.playTap();
      state.modal = null;
      if (TwoMindsUI && TwoMindsUI.launchSolo) TwoMindsUI.launchSolo();
    } else if (action === 'soloPlayScribble') {
      Audio.playTap();
      state.modal = null;
      if (Scribble && Scribble.launchSolo) Scribble.launchSolo();
    } else if (action === 'soloPlayRace') {
      Audio.playTap();
      state.modal = null;
      var sSeed = Math.floor(Math.random() * 9000) + 1000;
      state.raceTrackSeed = sSeed;
      state.screen = 'race';
      render();
    } else if (action === 'startTTT') {
      Audio.playTap();
      if (!Net.isHostUser()) return;
      var TTT = window.JodiTTT;
      if (!TTT) return;
      var tttGame = TTT.createGame({
        firstPlayer: 'X',
        hostSymbol: 'X',
        guestSymbol: 'O',
        isSolo: false,
        hostName: profile.name,
        guestName: Net.getPartnerName() || 'Partner'
      });
      tttGame.mySymbol = 'X';
      tttGame.scores = { X: 0, O: 0, draws: 0 };
      tttGame.roundCount = 1;
      state.ttt = tttGame;
      state.screen = 'ttt';
      Net.send('TTT_START', { hostName: profile.name });
      toast('X aur O shuru! Aap X hain. Pehli chaal aapki hai. ✕');
      render();
    } else if (action === 'tttCellTap') {
      var cellIdx = +target.dataset.idx;
      if (TTTUI && TTTUI.handleCellTap) TTTUI.handleCellTap(cellIdx);
    } else if (action === 'tttPlayAgain') {
      Audio.playTap();
      var ttt = state.ttt;
      if (!ttt) return;
      if (ttt.isSolo) {
        if (TTTUI && TTTUI.resetRound) TTTUI.resetRound(true);
      } else if (Net.isHostUser()) {
        var TTT2 = window.JodiTTT;
        if (!TTT2) return;
        var nextFirst = ttt.currentPlayer === 'X' ? 'O' : 'X';
        var rGame = TTT2.createGame({
          firstPlayer: nextFirst,
          hostSymbol: ttt.hostSymbol,
          guestSymbol: ttt.guestSymbol,
          isSolo: false,
          hostName: ttt.hostName,
          guestName: ttt.guestName
        });
        rGame.mySymbol = ttt.mySymbol;
        rGame.scores = ttt.scores;
        rGame.roundCount = (ttt.roundCount || 1) + 1;
        state.ttt = rGame;
        Net.send('TTT_RESET', { firstPlayer: nextFirst, scores: ttt.scores });
        toast('Naya round! ⭕✕ Shuru!');
        render();
      } else {
        toast('Host naya round shuru karega!');
      }
    } else if (action === 'tttLeave') {
      Audio.playTap();
      if (TTTUI && TTTUI.cleanup) TTTUI.cleanup();
      state.ttt = null;
      if (Net.getStatus() === 'connected') {
        state.screen = 'room_ready';
        Net.send('RETURN_LOBBY', {});
        toast('Room Lobby mein wapas aa gaye 🏠');
      } else {
        state.screen = 'lobby';
        toast('Lobby mein wapas aa gaye 🏠');
      }
      render();
    } else if (action === 'soloPracticeTwoMinds') {
      if (TwoMindsUI && TwoMindsUI.launchSolo) TwoMindsUI.launchSolo();
    } else if (action === 'soloPracticeScribble') {
      if (Scribble && Scribble.launchSolo) Scribble.launchSolo();
    } else if (action === 'soloPracticeRace') {
      Audio.playTap();
      state.modal = null;
      renderModal();
      var sSeed2 = Math.floor(Math.random() * 9000) + 1000;
      state.raceTrackSeed = sSeed2;
      state.screen = 'race';
      render();
    } else if (action === 'twoMindsPlayAgain') {
      Audio.playTap();
      if (state.twoMinds && state.twoMinds.isSolo) {
        if (TwoMindsUI && TwoMindsUI.launchSolo) TwoMindsUI.launchSolo();
      } else if (Net.isHostUser()) {
        var startBtn = document.querySelector('[data-action="startTwoMindsMatch"]');
        if (startBtn) startBtn.click();
      } else {
        toast('Host se agla match shuru karne ko kahein!');
      }
    } else if (action === 'twoMindsLeave') {
      Audio.playTap();
      if (TwoMindsUI && TwoMindsUI.stopTimer) TwoMindsUI.stopTimer();
      if (TwoMinds) TwoMinds.cleanup();
      state.twoMinds = null;
      state.screen = (Net.getStatus() === 'connected') ? 'room_ready' : 'lobby';
      if (Net.getStatus() === 'connected') {
        Net.send('RETURN_LOBBY', {});
      }
      render();
    } else if (action === 'tmAdvanceNow') {
      Audio.playTap();
      if (TwoMindsUI && TwoMindsUI.advanceRoundAuthoritative) {
        TwoMindsUI.advanceRoundAuthoritative();
      }
    } else if (action === 'tmTileTap') {
      var tileId = target.dataset.id;
      var tileLtr = target.dataset.ltr;
      if (!state.twoMinds || state.twoMinds.isSolved || state.twoMinds.isTransitioning) return;
      var rackTile = state.twoMinds.myRack.find(function (t) { return t.id === tileId; });
      if (!rackTile || rackTile.placed) return;

      var isHost = Net.isHostUser();
      var myRole = isHost ? 'host' : 'guest';
      var slotOwners = state.twoMinds.slotOwners || [];
      var slots = state.twoMinds.slots;

      // 1. If user tapped a specific empty slot, place there
      var targetIdx = -1;
      if (state.selectedSlotIdx !== null && state.selectedSlotIdx !== undefined) {
        var sIndex = state.selectedSlotIdx;
        if (!slots[sIndex]) {
          targetIdx = sIndex;
        }
      }

      // 2. Otherwise find player's first empty assigned slot
      if (targetIdx === -1) {
        for (var i = 0; i < slots.length; i++) {
          if (!slots[i] && (slotOwners[i] === myRole || state.twoMinds.isSolo)) {
            targetIdx = i;
            break;
          }
        }
      }

      // 3. Fallback: any empty slot
      if (targetIdx === -1) {
        targetIdx = slots.indexOf(null);
      }

      if (targetIdx === -1) {
        toast('Saare slots bhare hain! Letter hatane ke liye slot par tap karein.');
        return;
      }

      state.selectedSlotIdx = null; // Clear selection after placement
      state.twoMinds.slots[targetIdx] = {
        letter: tileLtr,
        owner: isHost ? 'host' : 'guest',
        id: tileId
      };
      rackTile.placed = true;
      if (TwoMinds) TwoMinds.setSlots(state.twoMinds.slots);
      Audio.playTap();

      if (Net.getStatus() === 'connected') {
        Net.send('TM_BOARD_UPDATE', { slots: state.twoMinds.slots });
      }
      render();
    } else if (action === 'tmSlotTap') {
      var sIdx = +target.dataset.idx;
      if (!state.twoMinds || state.twoMinds.isSolved || state.twoMinds.isTransitioning) return;
      var currentSlot = state.twoMinds.slots[sIdx];
      var isHost = Net.isHostUser();
      var myRole = isHost ? 'host' : 'guest';

      if (currentSlot) {
        // Filled slot — remove if it's placed by this player
        var isMyLetter = (currentSlot.owner === myRole) || state.twoMinds.isSolo;
        if (currentSlot.locked) {
          toast('Ye hint se unlock hua letter hai!');
          return;
        }
        if (!isMyLetter) {
          toast('Ye letter partner ne rakha hai!');
          return;
        }

        state.twoMinds.slots[sIdx] = null;
        var myRackTile = state.twoMinds.myRack.find(function (t) { return t.id === currentSlot.id; });
        if (myRackTile) myRackTile.placed = false;

        if (TwoMinds) TwoMinds.setSlots(state.twoMinds.slots);
        Audio.playTap();
        if (Net.getStatus() === 'connected') {
          Net.send('TM_BOARD_UPDATE', { slots: state.twoMinds.slots });
        }
        render();
      } else {
        // Empty slot — toggle selection highlight!
        Audio.playTap();
        state.selectedSlotIdx = (state.selectedSlotIdx === sIdx ? null : sIdx);
        render();
      }
    } else if (action === 'tmRecall') {
      Audio.playTap();
      if (!state.twoMinds) return;
      var isH = Net.isHostUser();
      var myOwner = isH ? 'host' : 'guest';
      state.selectedSlotIdx = null;
      state.twoMinds.slots = state.twoMinds.slots.map(function (s) {
        if (s && (s.owner === myOwner || state.twoMinds.isSolo) && !s.locked) {
          return null;
        }
        return s;
      });
      state.twoMinds.myRack.forEach(function (t) { t.placed = false; });
      if (TwoMinds) TwoMinds.setSlots(state.twoMinds.slots);
      if (Net.getStatus() === 'connected') {
        Net.send('TM_BOARD_UPDATE', { slots: state.twoMinds.slots });
      }
      render();
    } else if (action === 'tmCheckWord') {
      Audio.playTap();
      if (!state.twoMinds || state.twoMinds.isSolved || state.twoMinds.isTransitioning) return;

      if (!Net.isHostUser() && !state.twoMinds.isSolo) {
        Net.send('TM_SUBMIT_CHECK', {});
        toast('Word check ho raha hai...');
        return;
      }

      if (TwoMinds) TwoMinds.setSlots(state.twoMinds.slots);
      var res = TwoMinds ? TwoMinds.verifyWord(state.twoMinds.slots) : { isCorrect: false };
      if (res.isIncomplete) {
        toast('Pehle saare akshar bharein! (' + (res.missingCount || 'kuch') + ' baaki hain)');
        var bElIncomplete = document.querySelector('.tm-board-slots');
        if (bElIncomplete) {
          bElIncomplete.classList.add('shake');
          setTimeout(function () { bElIncomplete.classList.remove('shake'); }, 400);
        }
        return;
      }

      if (res.isCorrect) {
        state.twoMinds.teamScore = TwoMinds.getMatch().teamScore;
        state.twoMinds.comboStreak = res.combo;
        state.twoMinds.wordsSolved = TwoMinds.getMatch().wordsSolved;
        state.twoMinds.isSolved = true;
        state.twoMinds.roundWinnerBanner = {
          word: res.word,
          scoreAdded: res.scoreAdded,
          combo: res.combo
        };

        Audio.playMatch();
        burstCenter(36);

        if (Net.getStatus() === 'connected') {
          Net.send('TM_ROUND_WIN', {
            word: res.word,
            scoreAdded: res.scoreAdded,
            combo: res.combo,
            teamScore: state.twoMinds.teamScore,
            wordsSolved: state.twoMinds.wordsSolved
          });
        }
        render();

        setTimeout(function () {
          if (TwoMindsUI && TwoMindsUI.advanceRoundAuthoritative) {
            TwoMindsUI.advanceRoundAuthoritative();
          }
        }, 2200);
      } else {
        Audio.playMiss();
        toast('Sahi nahi hai! Akshar dobara check karein.');
        var bEl = document.querySelector('.tm-board-slots');
        if (bEl) {
          bEl.classList.add('shake');
          setTimeout(function () { bEl.classList.remove('shake'); }, 500);
        }
        if (Net.getStatus() === 'connected') {
          Net.send('TM_ROUND_FAIL', {
            message: res.message,
            teamScore: state.twoMinds.teamScore
          });
        }
        render();
      }
    } else if (action === 'tmAiPlaceNow') {
      Audio.playTap();
      if (!state.twoMinds || !state.twoMinds.isSolo) return;
      if (TwoMinds && TwoMinds.placeAIPartnerNow) {
        TwoMinds.placeAIPartnerNow(function (evt) {
          state.twoMinds.slots = evt.slots;
          toast('🤖 AI Partner ne apne akshar rakh diye!');
          render();
        });
      }
    } else if (action === 'tmUseHint') {
      Audio.playTap();
      if (!state.twoMinds || state.twoMinds.isSolved) return;
      if (TwoMinds && TwoMinds.revealFirstLetter) {
        var hRes = TwoMinds.revealFirstLetter();
        if (hRes) {
          state.twoMinds.slots = hRes.slots;
          var myMatchTile = state.twoMinds.myRack.find(function (t) {
            return t.letter === hRes.letter && !t.placed;
          });
          if (myMatchTile) myMatchTile.placed = true;
          toast('💡 Pehla akshar "' + hRes.letter + '" unlock ho gaya!');
          if (Net.getStatus() === 'connected') {
            Net.send('TM_BOARD_UPDATE', { slots: state.twoMinds.slots });
          }
          render();
        }
      }
    } else if (action === 'pickColor') {
      state.currentColor = target.dataset.color;
      Audio.playTap();
      render();
    } else if (action === 'pickSize') {
      state.currentSize = +target.dataset.sz;
      Audio.playTap();
      render();
    } else if (action === 'clearBoard') {
      state.strokes = [];
      var can = $('#drawCanvas');
      if (can) {
        var ct = can.getContext('2d');
        ct.clearRect(0, 0, can.width, can.height);
      }
      if (Net.getStatus() === 'connected') {
        Net.send('CLEAR_CANVAS', {});
      }
      Audio.playTap();
    } else if (action === 'setSoloRole') {
      var sRole = target.dataset.role;
      if (state.game) {
        state.game.soloRole = sRole;
        toast(sRole === 'drawer' ? 'Ab aap Draw kar rahe hain! 🖌️' : 'Ab aap Guess kar rahe hain! 👀');
        render();
      }
    } else if (action === 'soloNextWord') {
      if (state.game && state.game.isSolo) {
        var sDeck = Words ? Words.getDeck(10, 'mix') : [];
        state.game.deck = sDeck;
        state.game.turnIndex = (state.game.turnIndex + 1) % sDeck.length;
        state.game.endAt = Date.now() + 60000;
        state.strokes = [];
        state.game.hintRevealed = false;
        state.game.hintUnlockedNotified = false;
        toast('Agla shabd taiyar hai! 🎨');
        render();
      }
    } else if (action === 'toggleGuesserHint') {
      if (Scribble && Scribble.handleGuesserHintClick) {
        Scribble.handleGuesserHintClick();
      }
    } else if (action === 'exitScribbleGame') {
      Audio.playTap();
      if (state.game && state.game.isSolo) {
        if (Scribble && Scribble.stopMatchTimer) Scribble.stopMatchTimer();
        state.game = null;
        state.screen = 'lobby';
        render();
      } else {
        state.modal = 'confirm_exit_scribble';
        renderModal();
      }
    } else if (action === 'confirmExitScribble') {
      Audio.playTap();
      state.modal = null;
      if (Scribble && Scribble.stopMatchTimer) Scribble.stopMatchTimer();
      if (Net.getStatus() === 'connected') {
        Net.send('PARTNER_LEFT_GAME', { by: profile.name, mode: 'scribble' });
      }
      state.game = null;
      state.screen = (Net.getStatus() === 'connected') ? 'room_ready' : 'lobby';
      render();
    } else if (action === 'continueSoloAfterPartnerLeft') {
      Audio.playTap();
      state.modal = null;
      if (Scribble && Scribble.launchSolo) {
        Scribble.launchSolo();
      }
    } else if (action === 'exitToLobbyAfterPartnerLeft') {
      Audio.playTap();
      state.modal = null;
      if (Scribble && Scribble.stopMatchTimer) Scribble.stopMatchTimer();
      state.game = null;
      state.screen = (Net.getStatus() === 'connected') ? 'room_ready' : 'lobby';
      render();
    } else if (action === 'createNewRoomAfterPartnerLeft') {
      Audio.playTap();
      state.modal = null;
      if (Scribble && Scribble.stopMatchTimer) Scribble.stopMatchTimer();
      state.game = null;
      state.screen = 'lobby';
      render();
      var crtBtn = document.querySelector('[data-action="createRoom"]');
      if (crtBtn) crtBtn.click();
    } else if (action === 'closeChatPopup') {
      if (Scribble && Scribble.dismissChatPopup) {
        Scribble.dismissChatPopup();
      }
    } else if (action === 'installPwa') {
      if (window.deferredInstallPrompt) {
        window.deferredInstallPrompt.prompt();
        window.deferredInstallPrompt.userChoice.then(function (res) {
          if (res.outcome === 'accepted') {
            toast('Jodi Sync Install ho raha hai! 🚀');
          }
          window.deferredInstallPrompt = null;
        });
      } else {
        state.modal = 'install_help';
        renderModal();
      }
    } else if (action === 'dismissPwaBanner') {
      var pBan = $('#pwaInstallBanner');
      if (pBan) pBan.style.display = 'none';
      try { localStorage.setItem('jodi_pwa_dismissed', 'true'); } catch (e) {}
    } else if (action === 'retryNativeInstall') {
      if (window.deferredInstallPrompt) {
        window.deferredInstallPrompt.prompt();
      } else {
        toast('Browser menu (3 dots / share) se "Add to Home Screen" chunein.');
      }
    }
  });

  /* Service Worker Registration for PWA (Production only, bypass on localhost) */
  if ('serviceWorker' in navigator) {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      navigator.serviceWorker.getRegistrations().then(function (registrations) {
        for (var i = 0; i < registrations.length; i++) {
          registrations[i].unregister();
        }
      });
      if ('caches' in window) {
        caches.keys().then(function (names) {
          names.forEach(function (name) { caches.delete(name); });
        });
      }
    } else {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('./sw.js').catch(function () {});
      });
    }
  }

  // Handle unexpected tab close or reload to immediately alert partner
  window.addEventListener('beforeunload', function () {
    if (Net.getStatus() === 'connected' && (state.screen === 'game' || state.screen === 'twominds' || state.screen === 'race')) {
      try {
        Net.send('PARTNER_LEFT_GAME', { by: profile.name, accidental: true });
      } catch (e) {}
    }
  });

  // Initial App Mount
  render();
})();
