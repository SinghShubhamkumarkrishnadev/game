/* Jodi Scribble - Fully Responsive Controller with Word Count & Language Select */
(function () {
  'use strict';

  var Words = window.JodiWords;
  var TwoMinds = window.TwoMindsGame;
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
    screen: profile.name ? 'lobby' : 'welcome', // 'welcome' | 'lobby' | 'room_ready' | 'game' | 'results' | 'race' | 'twominds' | 'twominds_results'
    modal: (function () {
      try { return localStorage.getItem('jodi_guide_seen') ? null : 'guide'; } catch (e) { return null; }
    })(), // Show interactive user guide on first visit!
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
    // Exchange bike themes immediately upon connection
    Net.send('PARTNER_BIKE_CHOICE', { bike: state.selectedBikeTheme });
    render();
  });

  Net.on('partnerDisconnected', function () {
    if (state.screen === 'race') {
      toast('Partner connection lost ⚠️ AI autopilot chal raha hai! Race continue karein.');
      if (window.JodiRace && typeof window.JodiRace.setSoloAI === 'function') {
        window.JodiRace.setSoloAI(true);
      }
      return; // DO NOT EXIT ACTIVE RACE!
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
      // Guest informs host of guest's bike choice
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
    if (TwoMinds) TwoMinds.cleanup();
    state.twoMinds = null;
    state.screen = 'room_ready';
    toast('Room Lobby mein wapas aa gaye 🏠');
    render();
  });

  /* ==========================================================================
     TWO MINDS, ONE WORD (DO DIL, EK SHABD) - CONTROLLER & NETWORKING
     ========================================================================== */

  function stopTwoMindsTimer() {
    if (state.twoMindsTimerInterval) {
      clearInterval(state.twoMindsTimerInterval);
      state.twoMindsTimerInterval = null;
    }
  }

  function startTwoMindsTimer() {
    stopTwoMindsTimer();
    state.twoMindsTimerInterval = setInterval(function () {
      if (!state.twoMinds || state.screen !== 'twominds') {
        stopTwoMindsTimer();
        return;
      }
      var now = Date.now();
      var leftSec = Math.max(0, Math.ceil((state.twoMinds.roundEndAt - now) / 1000));
      var timerEl = $('#tmTimerDisplay');
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

      // Time expired check
      if (leftSec <= 0 && !state.twoMinds.isSolved && !state.twoMinds.isTransitioning) {
        stopTwoMindsTimer();
        if (Net.isHostUser() || state.twoMinds.isSolo) {
          handleTwoMindsTimeoutAuthoritative();
        }
      }
    }, 250);
  }

  function handleTwoMindsTimeoutAuthoritative() {
    if (!state.twoMinds || state.twoMinds.isTransitioning) return;
    state.twoMinds.isTransitioning = true;
    var curPuzzle = state.twoMinds.deck ? state.twoMinds.deck[state.twoMinds.roundIndex] : null;
    var ans = curPuzzle ? curPuzzle.answer : 'WORD';
    Audio.playMiss();
    toast('⌛ Time Up! Sahi shabd tha: ' + ans);

    var timeoutPayload = {
      word: ans,
      roundIndex: state.twoMinds.roundIndex
    };
    if (Net.getStatus() === 'connected') {
      Net.send('TM_TIMEOUT', timeoutPayload);
    }

    setTimeout(function () {
      advanceTwoMindsRoundAuthoritative();
    }, 2600);
  }

  function advanceTwoMindsRoundAuthoritative() {
    if (!state.twoMinds) return;
    var nextIdx = state.twoMinds.roundIndex + 1;
    if (nextIdx < state.twoMinds.totalRounds) {
      if (TwoMinds) {
        TwoMinds.initRound(nextIdx);
      }
      var nextPuzzle = state.twoMinds.deck[nextIdx];
      state.twoMinds.roundIndex = nextIdx;
      state.twoMinds.roundStartTime = Date.now();
      state.twoMinds.roundEndAt = Date.now() + state.twoMinds.roundDuration * 1000;
      state.twoMinds.isSolved = false;
      state.twoMinds.isTransitioning = false;
      state.twoMinds.roundWinnerBanner = null;

      // Reset slots
      var cleanLen = nextPuzzle.answer.replace(/\s/g, '').length;
      var slotsArr = [];
      for (var s = 0; s < cleanLen; s++) slotsArr.push(null);
      state.twoMinds.slots = slotsArr;

      // Setup Host rack
      state.twoMinds.myRack = nextPuzzle.playerA.map(function (ltr, idx) {
        return { id: 'A_' + idx + '_' + Date.now(), letter: ltr, placed: false };
      });
      state.twoMinds.myClue = nextPuzzle.clueA;
      state.twoMinds.myCategory = nextPuzzle.category;
      state.twoMinds.wordLength = nextPuzzle.length;
      state.twoMinds.prompt = nextPuzzle.prompt;

      var roundPayload = {
        roundIndex: nextIdx,
        roundDuration: state.twoMinds.roundDuration,
        roundEndAt: state.twoMinds.roundEndAt,
        wordLength: nextPuzzle.length,
        category: nextPuzzle.category,
        guestLetters: nextPuzzle.playerB,
        guestClue: nextPuzzle.clueB,
        prompt: nextPuzzle.prompt,
        teamScore: state.twoMinds.teamScore,
        combo: state.twoMinds.comboStreak,
        wordsSolved: state.twoMinds.wordsSolved
      };

      if (Net.getStatus() === 'connected') {
        Net.send('TM_ROUND_ADVANCE', roundPayload);
      }

      if (state.twoMinds.isSolo && TwoMinds) {
        TwoMinds.startSoloAILoop(function () {
          render();
        });
      }

      toast('Round ' + (nextIdx + 1) + '/' + state.twoMinds.totalRounds + ' Shuru! 🧩');
      render();
    } else {
      // Match Over!
      var resultsPayload = {
        teamScore: state.twoMinds.teamScore,
        wordsSolved: state.twoMinds.wordsSolved,
        totalRounds: state.twoMinds.totalRounds,
        perfectRounds: state.twoMinds.perfectRounds,
        hintsUsed: state.twoMinds.hintsUsed,
        maxCombo: state.twoMinds.maxCombo,
        solveTimes: state.twoMinds.solveTimes
      };
      if (Net.getStatus() === 'connected') {
        Net.send('TM_MATCH_OVER', resultsPayload);
      }
      applyTwoMindsGameOver(resultsPayload);
    }
  }

  function applyTwoMindsGameOver(res) {
    stopTwoMindsTimer();
    if (TwoMinds) TwoMinds.cleanup();
    state.twoMindsResults = res;
    state.screen = 'twominds_results';
    Audio.playUnlock();
    burstCenter(42);
    render();
  }

  function showPartnerSpeechBubble(text, sender) {
    state.partnerBubble = { text: text, sender: sender || 'Partner' };
    clearTimeout(state.bubbleTimer);
    state.bubbleTimer = setTimeout(function () {
      state.partnerBubble = null;
      render();
    }, 3600);
    render();
  }

  /* Two Minds Network Event Handlers */
  Net.on('TM_START_MATCH', function (payload) {
    state.twoMindsChat = [
      { text: '🧩 Two Minds Match Shuru! Ek doosre se coordinate karein.', type: 'system' }
    ];
    state.partnerBubble = null;

    // Guest Match Setup
    state.twoMinds = {
      roundIndex: payload.roundIndex || 0,
      totalRounds: payload.totalRounds || 10,
      roundDuration: payload.roundDuration || 45,
      roundEndAt: payload.roundEndAt || (Date.now() + 45000),
      teamScore: payload.teamScore || 0,
      comboStreak: payload.combo || 0,
      maxCombo: payload.combo || 0,
      wordsSolved: payload.wordsSolved || 0,
      hintsUsed: 0,
      perfectRounds: 0,
      askTokensRemaining: 3,
      solveTimes: [],
      isSolved: false,
      isTransitioning: false,
      isSolo: false,
      wordLength: payload.wordLength,
      myCategory: payload.category,
      myClue: payload.guestClue,
      prompt: payload.prompt,
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
    toast('🧩 Two Minds Shuru! Dono ke paas alag information hai.');
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
    showPartnerSpeechBubble(payload.text, payload.sender || Net.getPartnerName() || 'Partner');
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
    showPartnerSpeechBubble('I have letter: ' + payload.sharedLetter, payload.helper || 'Partner');
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
        advanceTwoMindsRoundAuthoritative();
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
    state.twoMinds.roundIndex = payload.roundIndex;
    state.twoMinds.roundDuration = payload.roundDuration;
    state.twoMinds.roundEndAt = payload.roundEndAt;
    state.twoMinds.wordLength = payload.wordLength;
    state.twoMinds.myCategory = payload.category;
    state.twoMinds.myClue = payload.guestClue;
    state.twoMinds.prompt = payload.prompt;
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
    applyTwoMindsGameOver(payload);
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
    return '<div class="garland"></div>' +
      '<header class="app-header">' +
      '<div class="brand-title">Jodi Sync <span class="brand-tag">Online</span></div>' +
      '<div class="header-actions">' +
      '<button class="icon-btn header-menu-btn" data-action="openSidebar" aria-label="Menu" title="Menu &amp; Practice">☰</button>' +
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
      '<div style="font-size:48px">💞</div>' +
      '<h1 style="font-family:var(--font-display);font-size:clamp(28px, 7vw, 34px);color:var(--plum)">Aapka Naam Kya Hai?</h1>' +
      '<p style="color:var(--soft);font-weight:600;font-size:15px">Partner ke saath Two Minds, Scribble aur 3D Bike Race khelne ke liye naam likhein:</p>' +
      '<form id="welcomeForm" style="margin:0" onsubmit="event.preventDefault();">' +
      '<div class="card elevated">' +
      '<label style="display:block;text-align:left;font-size:12.5px;font-weight:800;color:var(--soft);margin-bottom:6px">AAPKA AVATAR CHUNEIN</label>' +
      '<div class="avatar-row">' + avHtml + '</div>' +
      '<input class="input-field" id="nameInput" placeholder="Aapka pyara naam..." value="' + esc(profile.name) + '" maxlength="14" autocomplete="off">' +
      '<div style="margin-top:14px">' +
      '<button class="btn primary" type="submit" data-action="saveName">Aage Badhein →</button>' +
      '</div></div></form></div></section>';
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
        '<div style="display:flex;flex-direction:column;gap:8px">' +
        '<div style="display:flex;gap:8px">' +
        '<button class="btn gold sm" style="flex:1" data-action="copyCode" data-code="' + code + '">📋 Code Copy</button>' +
        '<button class="btn teal sm" style="flex:1" data-action="shareWhatsApp" data-code="' + code + '">📲 WhatsApp</button>' +
        '</div>' +
        '<button class="btn ghost sm" data-action="cancelRoom">Cancel Room</button>' +
        '</div></div>';
    }

    return '<section class="screen">' +
      renderHeader() +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
      '<div class="lobby-profile-pill" data-action="openSidebar" title="Menu &amp; Profile kholein">' +
      '<span style="font-size:22px">' + profile.avatar + '</span>' +
      '<b>' + esc(profile.name) + '</b>' +
      '<span style="font-size:12px;color:var(--soft)">⚙️</span>' +
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
      '</section>';
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
      '<div class="game-mode-tile ' + (mode === 'twominds' ? 'active' : '') + '" data-action="setMode" data-mode="twominds">' +
      '<span class="gm-icon">🧩</span>' +
      '<div class="gm-title">Two Minds</div>' +
      '<div class="gm-desc">Co-op Puzzle</div>' +
      '</div>' +
      '<div class="game-mode-tile ' + (mode === 'scribble' ? 'active' : '') + '" data-action="setMode" data-mode="scribble">' +
      '<span class="gm-icon">🎨</span>' +
      '<div class="gm-title">Scribble</div>' +
      '<div class="gm-desc">Draw &amp; Guess</div>' +
      '</div>' +
      '<div class="game-mode-tile ' + (mode === 'race' ? 'active' : '') + '" data-action="setMode" data-mode="race">' +
      '<span class="gm-icon">🏍️</span>' +
      '<div class="gm-title">3D Race</div>' +
      '<div class="gm-desc">Curvy Track</div>' +
      '</div>' +
      '</div>' +

      // Mode-specific configuration
      (mode === 'twominds'
        ? '<div class="settings-section">' +
          '<div class="settings-label"><span>🧩 Puzzle Mode</span><small>' + (state.twoMindsSettings.mode || 'classic').toUpperCase() + '</small></div>' +
          '<div class="segment-group" style="flex-wrap:wrap">' +
          '<button class="segment-btn ' + (state.twoMindsSettings.mode === 'classic' ? 'active' : '') + '" data-action="setTmMode" data-val="classic">Classic (10 Words)</button>' +
          '<button class="segment-btn ' + (state.twoMindsSettings.mode === 'speed' ? 'active' : '') + '" data-action="setTmMode" data-val="speed">Speed (30s)</button>' +
          '<button class="segment-btn ' + (state.twoMindsSettings.mode === 'sync' ? 'active' : '') + '" data-action="setTmMode" data-val="sync">Perfect Sync</button>' +
          '<button class="segment-btn ' + (state.twoMindsSettings.mode === 'hard' ? 'active' : '') + '" data-action="setTmMode" data-val="hard">Hard (Decoys)</button>' +
          '<button class="segment-btn ' + (state.twoMindsSettings.mode === 'daily' ? 'active' : '') + '" data-action="setTmMode" data-val="daily">Daily 📅</button>' +
          '</div>' +
          '<div class="settings-label"><span>⏱️ Timer Speed</span><small>' + state.twoMindsSettings.duration + 's per word</small></div>' +
          '<div class="segment-group">' +
          '<button class="segment-btn teal ' + (state.twoMindsSettings.duration === 60 ? 'active' : '') + '" data-action="setTmDuration" data-val="60">60s (Aaram Se)</button>' +
          '<button class="segment-btn teal ' + (state.twoMindsSettings.duration === 45 ? 'active' : '') + '" data-action="setTmDuration" data-val="45">45s (Normal)</button>' +
          '<button class="segment-btn teal ' + (state.twoMindsSettings.duration === 30 ? 'active' : '') + '" data-action="setTmDuration" data-val="30">30s (Rapid ⚡)</button>' +
          '</div></div>' +
          (isHost
            ? '<button class="btn primary" data-action="startTwoMindsMatch">Puzzles Shuru Karein 🧩💞</button>'
            : '<div class="card" style="text-align:center;padding:10px;background:#FFF9EB;border-color:var(--genda)"><b>Host match shuru karenge ⏳</b><div style="font-size:12px;color:var(--soft)">Aapke partner start karenge...</div></div>'
          )
        : (mode === 'scribble'
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
            (isHost
              ? '<button class="btn primary" data-action="startMatch">Khelna Shuru Karein 🎨</button>'
              : '<div class="card" style="text-align:center;padding:10px;background:#FFF9EB;border-color:var(--genda)"><b>Host match shuru karenge ⏳</b><div style="font-size:12px;color:var(--soft)">Aapke partner start karenge...</div></div>'
            )
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
            (isHost
              ? '<button class="btn gold" data-action="startRace">Race Shuru Karein 🏍️💨</button>'
              : '<div class="card" style="text-align:center;padding:10px;background:#FFF9EB;border-color:var(--genda)"><b>Host race shuru karenge ⏳</b><div style="font-size:12px;color:var(--soft)">Aapke partner start karenge...</div></div>'
            )
          )
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
      // Distance Lead Indicator Pill & Tilt Active Badge
      '<div class="race-status-row">' +
      '<div class="race-lead-pill" id="raceLeadPill">🔥 Barabar</div>' +
      '<div class="race-tilt-badge active" id="raceTiltBadge" title="Phone tilt karke bike turn karein">📱 Tilt Steer: Active</div>' +
      '</div>' +
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

  // 8. Two Minds, One Word Arena
  function vTwoMinds() {
    var tm = state.twoMinds;
    if (!tm) return vRoomReady();

    var isHost = Net.isHostUser();
    var isSolo = tm.isSolo;
    var myName = profile.name;
    var partnerName = isSolo ? 'AI Partner (Solo)' : (Net.getPartnerName() || 'Partner');
    var myAvatar = profile.avatar;
    var partnerAvatar = isSolo ? '🤖' : (Net.getPartnerAvatar() || '✨');

    var roundIdx = tm.roundIndex || 0;
    var totalRounds = tm.totalRounds || 10;
    var teamScore = tm.teamScore || 0;
    var combo = tm.comboStreak || 0;
    var askTokens = tm.askTokensRemaining != null ? tm.askTokensRemaining : 3;

    // Round Win Celebration Overlay Banner
    var winOverlayHtml = '';
    if (tm.roundWinnerBanner) {
      winOverlayHtml = '<div class="card elevated tm-round-win-card" style="background:linear-gradient(135deg, #FFF9FC, #FFF0F6);border-color:var(--rani);margin-bottom:10px">' +
        '<div style="font-size:32px">🎉</div>' +
        '<div style="font-size:14px;font-weight:900;color:var(--plum);text-transform:uppercase">WORD COMPLETE!</div>' +
        '<div class="tm-solved-word">' + esc(tm.roundWinnerBanner.word) + '</div>' +
        '<div style="font-size:16px;font-weight:800;color:var(--rani)">+' + tm.roundWinnerBanner.scoreAdded + ' pts</div>' +
        (tm.roundWinnerBanner.combo > 1 ? '<div class="tm-combo-pill" style="margin-top:6px">🔥 ' + tm.roundWinnerBanner.combo + 'X TEAM SYNC</div>' : '') +
        '<p style="font-size:12px;color:var(--soft);margin-top:6px">Agla word taiyar ho raha hai...</p>' +
        '<button class="btn gold sm" style="margin-top:8px" data-action="tmAdvanceNow">Agla Word Khelein ➔</button>' +
        '</div>';
    }

    // Top Bar
    var topBarHtml = '<div class="tm-topbar">' +
      '<div style="display:flex;align-items:center;gap:6px">' +
      '<button class="tm-exit-pill" data-action="twoMindsLeave" title="Exit Game">✕ Exit</button>' +
      '<div class="tm-role-badge ' + (isHost ? 'host' : 'guest') + '" style="margin-bottom:0">' +
      (isHost ? '👑 ' + esc(myName) : '✨ ' + esc(myName)) +
      '</div></div>' +
      '<span class="timer-pill" id="tmTimerDisplay">⏱️ 45s</span>' +
      '<span class="live-pill" style="padding:3px 8px">Word ' + (roundIdx + 1) + '/' + totalRounds + '</span>' +
      '<div style="font-size:13px;font-weight:900;color:var(--rani)">❤️ ' + teamScore + '</div>' +
      (combo > 1 ? '<div class="tm-combo-pill">🔥 ' + combo + 'X</div>' : '') +
      '</div>';

    // Partner Floating Speech Bubble
    var bubbleHtml = '';
    if (state.partnerBubble) {
      bubbleHtml = '<div class="tm-partner-bubble">' +
        '<span style="font-size:20px">' + partnerAvatar + '</span>' +
        '<div><b>' + esc(state.partnerBubble.sender) + ':</b> ' + esc(state.partnerBubble.text) + '</div>' +
        '</div>';
    }

    // Share Letter Prompt (if partner requested help)
    var sharePromptHtml = '';
    if (state.sharePartnerPrompt) {
      sharePromptHtml = '<div class="card elevated" style="background:#FFF9EB;border-color:var(--genda);padding:10px 12px;display:flex;align-items:center;justify-content:space-between">' +
        '<div><b>🤝 Partner needs help!</b><div style="font-size:12px;color:var(--soft)">Apne rack se ek letter share karein</div></div>' +
        '<button class="btn gold sm" data-action="tmSharePartnerLetter">Share Letter ✨</button>' +
        '</div>';
    }

    // Clue Split Information Card
    var clueCardHtml = '<div class="tm-split-card">' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
      (isHost
        ? '<span class="live-pill" style="background:#FFF0F6;color:var(--rani);border-color:var(--rani)">🏷️ ' + esc(tm.myCategory || 'Category') + '</span>'
        : '<span class="live-pill" style="background:#EBFBFA;color:var(--mor);border-color:var(--mor)">📏 ' + (tm.wordLength || 5) + ' Akshar</span>'
      ) +
      '<span style="font-size:12px;color:var(--soft);font-weight:700">Aapki Private Information</span>' +
      '</div>' +
      '<div class="tm-clue-title" style="margin-top:8px">' + (isHost ? 'Clue A:' : 'Clue B:') + '</div>' +
      '<div class="tm-clue-body">' + esc(tm.myClue || 'Coordinate with partner') + '</div>' +
      (tm.prompt ? '<div style="font-size:12px;color:var(--soft);font-style:italic;margin-top:4px">"' + esc(tm.prompt) + '"</div>' : '') +
      '<div class="tm-partner-sync-hint">' +
      '<span>💞</span>' +
      '<span>' + (isHost
        ? esc(partnerName) + ' ke paas word length aur doosra aadh hint hai!'
        : esc(partnerName) + ' ke paas category aur doosra aadh hint hai!'
      ) + '</span>' +
      '</div>' +
      '</div>';

    // Shared Word Board Slots
    var slots = tm.slots || [];
    var slotsHtml = slots.map(function (s, idx) {
      if (!s) {
        return '<div class="tm-slot" data-action="tmSlotTap" data-idx="' + idx + '" title="Slot ' + (idx + 1) + '">' +
          '<span style="opacity:0.35;font-size:13px">' + (idx + 1) + '</span>' +
          '</div>';
      }
      var ownerClass = s.owner === 'host' ? 'owner-host' : (s.owner === 'guest' ? 'owner-guest' : 'locked-hint');
      var badge = s.owner === 'host' ? (isHost ? 'Aap' : 'Partner') : (s.owner === 'guest' ? (isHost ? 'Partner' : 'Aap') : 'Hint');
      return '<div class="tm-slot filled ' + ownerClass + '" data-action="tmSlotTap" data-idx="' + idx + '" title="Tap to return letter">' +
        '<span>' + esc(s.letter) + '</span>' +
        '<span class="tm-slot-badge">' + badge + '</span>' +
        '</div>';
    }).join('');

    var boardHtml = '<div class="tm-board-wrap">' +
      '<div class="tm-board-label">' +
      '<span>🧩 Shared Board</span>' +
      '<small style="font-size:11px;color:var(--soft);font-weight:600">(Dono ke letters yahan aayenge)</small>' +
      '</div>' +
      '<div class="tm-board-slots">' + slotsHtml + '</div>' +
      '</div>';

    // Private Letters Rack
    var rack = tm.myRack || [];
    var rackHtml = '<div class="tm-rack-card">' +
      '<div class="tm-rack-header">' +
      '<span class="tm-rack-title">AAPKE AKSHAR (Tap to place)</span>' +
      '<button class="btn ghost sm" style="padding:2px 8px;font-size:11px" data-action="tmRecall">↩️ Recall</button>' +
      '</div>' +
      '<div class="tm-rack-tiles">' +
      rack.map(function (tile) {
        return '<button class="tm-tile ' + (isHost ? 'is-host' : 'is-guest') + ' ' + (tile.placed ? 'placed' : '') + '" data-action="tmTileTap" data-id="' + tile.id + '" data-ltr="' + tile.letter + '">' +
          tile.letter +
          '</button>';
      }).join('') +
      '</div>' +
      '</div>';

    // Actions Row: Check Word + Ask Partner + Hint
    var actionsHtml = '<div class="tm-actions-row">' +
      '<button class="btn primary tm-check-btn" data-action="tmCheckWord">Word Check Karein ✨</button>' +
      '<button class="btn alt tm-assist-btn" data-action="tmAskHelp" title="Partner se letter maangein">' +
      '<span class="tm-btn-main">🤝 Ask</span>' +
      '<span class="tm-btn-sub">' + askTokens + ' Baaki</span>' +
      '</button>' +
      '<button class="btn gold tm-assist-btn" data-action="tmUseHint" title="Hint lein (-20 pts)">' +
      '<span class="tm-btn-main">💡 Hint</span>' +
      '<span class="tm-btn-sub">-20 pts</span>' +
      '</button>' +
      '</div>';

    // 1-Tap Quick Messages Ribbon
    var quickList = TwoMinds ? TwoMinds.QUICK_MESSAGES : [];
    var quickHtml = '<div class="tm-quick-ribbon">' +
      quickList.map(function (qm) {
        return '<button class="tm-quick-chip" data-action="tmQuickChip" data-text="' + esc(qm.text) + '">' + esc(qm.text) + '</button>';
      }).join('') +
      '</div>';

    // In-game Activity & Chat Feed
    var chatHtml = '<div class="tm-activity-feed" id="tmChatFeed">' +
      (state.twoMindsChat || []).slice(-6).map(function (msg) {
        return '<div class="tm-chat-item ' + (msg.type || 'system') + '">' +
          (msg.sender ? '<b>' + esc(msg.sender) + ': </b>' : '') +
          esc(msg.text) +
          '</div>';
      }).join('') +
      '</div>' +
      '<form class="guess-box" id="tmChatForm" style="margin-top:4px">' +
      '<input id="tmChatInput" placeholder="Partner ko message likhein..." autocomplete="off">' +
      '<button class="btn alt sm" type="submit">Bhejo 💬</button>' +
      '</form>';

    return '<section class="screen tm-arena">' +
      winOverlayHtml +
      topBarHtml +
      bubbleHtml +
      sharePromptHtml +
      clueCardHtml +
      boardHtml +
      rackHtml +
      actionsHtml +
      quickHtml +
      chatHtml +
      '</section>';
  }

  // 9. Two Minds Match Results Screen
  function vTwoMindsResults() {
    var res = state.twoMindsResults || {
      teamScore: 1280,
      wordsSolved: 9,
      totalRounds: 10,
      perfectRounds: 6,
      hintsUsed: 2,
      maxCombo: 4,
      solveTimes: [15, 18, 22]
    };

    var score = res.teamScore || 0;
    var verdict = score >= 1200
      ? ['Soulmate Sync ❤️', 'Aap dono ka telepathic bond kamaal ka hai! Perfect cooperation!']
      : score >= 800
        ? ['Two Minds, One Heart ✨', 'Superb teamwork! Ek doosre ko behtareen tareeqe se samjha.']
        : ['Partners in Crime 🎯', 'Pehle match ke hisaab se shandar koshish! Ek round aur banta hai.'];

    var avgTime = 0;
    if (res.solveTimes && res.solveTimes.length) {
      var sum = res.solveTimes.reduce(function (a, b) { return a + b; }, 0);
      avgTime = Math.round(sum / res.solveTimes.length);
    } else {
      avgTime = 20;
    }

    return '<section class="screen">' +
      renderHeader() +
      '<div style="text-align:center;padding:10px 0">' +
      '<div style="font-size:50px;margin-bottom:2px">💞</div>' +
      '<h1 style="font-family:var(--font-display);font-size:clamp(26px, 7vw, 32px);color:var(--plum)">' + verdict[0] + '</h1>' +
      '<p style="color:var(--soft);font-size:14px;max-width:320px;margin:0 auto 12px">' + verdict[1] + '</p>' +
      '<div class="card elevated" style="margin-bottom:14px">' +
      '<div style="font-size:12px;font-weight:800;color:var(--soft);text-transform:uppercase">Combined Team Score</div>' +
      '<div style="font-family:var(--font-display);font-size:44px;color:var(--rani);line-height:1.1">' + score + ' <span style="font-size:18px">pts</span></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;text-align:left">' +
      '<div class="card" style="padding:8px 10px;border-width:1.5px">' +
      '<div style="font-size:11px;color:var(--soft);font-weight:700">Words Solved</div>' +
      '<div style="font-size:18px;font-weight:900;color:var(--plum)">' + (res.wordsSolved || 0) + '/' + (res.totalRounds || 10) + '</div>' +
      '</div>' +
      '<div class="card" style="padding:8px 10px;border-width:1.5px">' +
      '<div style="font-size:11px;color:var(--soft);font-weight:700">Longest Streak</div>' +
      '<div style="font-size:18px;font-weight:900;color:var(--kesar)">🔥 ' + (res.maxCombo || 1) + 'X</div>' +
      '</div>' +
      '<div class="card" style="padding:8px 10px;border-width:1.5px">' +
      '<div style="font-size:11px;color:var(--soft);font-weight:700">Perfect Rounds</div>' +
      '<div style="font-size:18px;font-weight:900;color:var(--mor)">' + (res.perfectRounds || 0) + '</div>' +
      '</div>' +
      '<div class="card" style="padding:8px 10px;border-width:1.5px">' +
      '<div style="font-size:11px;color:var(--soft);font-weight:700">Avg Solve Time</div>' +
      '<div style="font-size:18px;font-weight:900;color:var(--plum)">' + avgTime + 's</div>' +
      '</div>' +
      '</div></div>' +
      '<div style="display:flex;flex-direction:column;gap:8px">' +
      '<button class="btn primary" data-action="twoMindsPlayAgain">Dobara Khelo 🔁</button>' +
      '<button class="btn alt" data-action="twoMindsLeave">Room Lobby Mein Jao 🏠</button>' +
      '<button class="btn ghost sm" data-action="leaveRoom">Room Se Niklo</button>' +
      '</div></div></section>';
  }

  function bindTwoMindsChatForm() {
    var form = $('#tmChatForm');
    if (!form) return;
    form.onsubmit = function (e) {
      e.preventDefault();
      var inp = $('#tmChatInput');
      if (!inp) return;
      var text = inp.value.trim();
      if (!text) return;
      inp.value = '';
      state.twoMindsChat.push({
        text: text,
        sender: profile.name,
        type: 'me'
      });
      if (Net.getStatus() === 'connected') {
        Net.send('TM_CHAT_MSG', { text: text, sender: profile.name });
      } else if (state.twoMinds && state.twoMinds.isSolo) {
        setTimeout(function () {
          var aiReplies = ['Haan suno ji! 💖', 'Sahi lag raha hai! ✨', 'Yeh wala letter try karein? 💡', 'Aage badhein! 🚀'];
          var rep = aiReplies[Math.floor(Math.random() * aiReplies.length)];
          if (state.twoMinds) {
            state.twoMindsChat.push({ text: rep, sender: 'AI Partner', type: 'partner' });
            showPartnerSpeechBubble(rep, 'AI Partner');
            render();
          }
        }, 1000);
      }
      render();
      var feed = $('#tmChatFeed');
      if (feed) feed.scrollTop = feed.scrollHeight;
    };
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
      var tab = state.guideTab || 'twominds';
      var contentHtml = '';
      if (tab === 'twominds') {
        contentHtml = '<div class="guide-step-card">' +
          '<span class="guide-num">1</span>' +
          '<div><div class="guide-step-title">Do Dil, Alag Jankari (USP)</div>' +
          '<div class="guide-step-desc">Player A ko category aur pehli aadhi clues milti hain. Player B ko word length aur doosri aadhi clues milti hain! Akele koi solve nahi kar sakta.</div></div>' +
          '</div>' +
          '<div class="guide-step-card">' +
          '<span class="guide-num">2</span>' +
          '<div><div class="guide-step-title">Chat &amp; 1-Tap Quick Messages</div>' +
          '<div class="guide-step-desc">"I have this letter", "Try my letter", ya in-game chat se apne clues ek doosre ko batayein aur word milkar guess karein.</div></div>' +
          '</div>' +
          '<div class="guide-step-card">' +
          '<span class="guide-num">3</span>' +
          '<div><div class="guide-step-title">Shared Board Par Letters Rakhein</div>' +
          '<div class="guide-step-desc">Apne rack ke letters par tap karke shared slots me rakhein. Player A ke letters pink aur Player B ke teal me aate hain!</div></div>' +
          '</div>' +
          '<div class="guide-step-card">' +
          '<span class="guide-num">4</span>' +
          '<div><div class="guide-step-title">Ask Partner &amp; Hints</div>' +
          '<div class="guide-step-desc">Agar phans jao to 3 <b>"Ask Partner"</b> tokens se partner se letter maangein ya <b>"Hint"</b> se pehla akshar unlock karein.</div></div>' +
          '</div>' +
          '<div class="guide-step-card" style="border-color:var(--genda);background:#FFF9EB">' +
          '<span class="guide-num" style="background:var(--genda);color:#000">🔥</span>' +
          '<div><div class="guide-step-title" style="color:#000">Team Score &amp; SYNC Combos</div>' +
          '<div class="guide-step-desc" style="color:#2A1240">Lagaatar sahi solve karne par <b class="guide-highlight">🔥 2X, 3X TEAM SYNC</b> multiplier milta hai! Koi single winner nahi — Jodi hi ek team hai!</div></div>' +
          '</div>';
      } else if (tab === 'scribble') {
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
        '<button class="guide-tab-btn ' + (tab === 'twominds' ? 'active' : '') + '" data-action="setGuideTab" data-tab="twominds">🧩 Two Minds</button>' +
        '<button class="guide-tab-btn ' + (tab === 'scribble' ? 'active' : '') + '" data-action="setGuideTab" data-tab="scribble">🎨 Scribble</button>' +
        '<button class="guide-tab-btn ' + (tab === 'race' ? 'active' : '') + '" data-action="setGuideTab" data-tab="race">🏍️ 3D Race</button>' +
        '<button class="guide-tab-btn ' + (tab === 'install' ? 'active' : '') + '" data-action="setGuideTab" data-tab="install">📲 Install</button>' +
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
        '<div class="guide-title"><span>📲</span> Jodi Sync Install Karein</div>' +
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
            '<span>💡 <b>Pehle se Install hai?</b> Agar aapne pehle install kar rakha hai, to aapke phone ki home screen par <b>"Jodi Sync"</b> icon pehle se maujood hai — wahan se kholein!</span>' +
            '</div>'
        ) +
        '<div style="display:flex;gap:8px;margin-top:14px">' +
        '<button class="btn gold" style="flex:1" data-action="retryNativeInstall">Dubara Try Karein 🚀</button>' +
        '<button class="btn ghost" style="flex:1" data-action="closeModal">Theek Hai 👍</button>' +
        '</div></div></div>';
      m.className = 'on';
    } else if (state.modal === 'settings' || state.modal === 'sidebar') {
      var isMuted = Audio.isMuted();
      var avs = ['💖', '🪔', '🦁', '👑', '🌸', '⚡', '🏍️', '🦋', '🌹', '🐯', '🍫', '🧸'];
      var avHtml = '';
      for (var a = 0; a < avs.length; a++) {
        var isCur = (profile.avatar === avs[a]);
        avHtml += '<button class="settings-av-btn ' + (isCur ? 'active' : '') + '" data-action="settingsPickAvatar" data-av="' + avs[a] + '">' + avs[a] + '</button>';
      }

      var currentBike = state.selectedBikeTheme || 'sport';
      var bikes = [
        { key: 'sport', name: 'Rani Neon Sport', icon: '🚀', desc: '1000cc Superbike' },
        { key: 'bullet', name: 'Royal Bullet 350', icon: '🏍️', desc: 'Classic Cruiser' },
        { key: 'turbo', name: 'Mor Teal Turbo', icon: '⚡', desc: 'Cyber Streetfighter' },
        { key: 'cafe', name: 'Kesar Cafe Racer', icon: '☕', desc: 'Retro Vintage Racer' }
      ];
      var bikeHtml = '';
      for (var b = 0; b < bikes.length; b++) {
        var isB = (currentBike === bikes[b].key);
        bikeHtml += '<div class="settings-bike-tile ' + (isB ? 'active' : '') + '" data-action="settingsPickBike" data-bike="' + bikes[b].key + '">' +
          '<span class="sb-icon">' + bikes[b].icon + '</span>' +
          '<div class="sb-text"><div class="sb-name">' + bikes[b].name + '</div><div class="sb-desc">' + bikes[b].desc + '</div></div>' +
          (isB ? '<span class="sb-check">✓</span>' : '') +
          '</div>';
      }

      m.innerHTML = '<aside class="settings-drawer" role="dialog" aria-label="Jodi Menu and Practice">' +
        // Drawer Header
        '<div class="settings-drawer-header">' +
        '<div class="settings-drawer-title"><span>☰</span> Jodi Menu</div>' +
        '<button class="drawer-close-btn" data-action="closeModal" aria-label="Close Menu">✕</button>' +
        '</div>' +

        // Drawer Content Scroll
        '<div class="settings-drawer-scroll">' +

        // Section 1: Solo Practice & Demos (Moved from home page to sidebar)
        '<div class="settings-card" style="background:linear-gradient(135deg, #FFF9FC, #FFFDF9);border-color:var(--rani)">' +
        '<div class="settings-card-header" style="margin-bottom:8px">' +
        '<span class="sch-icon">🎮</span>' +
        '<div><div class="sch-title" style="color:var(--plum)">Solo Practice &amp; Demos</div><div class="sch-desc">Akele test ya practice karein</div></div>' +
        '</div>' +

        // Demo 1: Two Minds
        '<div class="sidebar-demo-card" style="background:#FFF0F6;border-color:var(--rani)">' +
        '<div class="sidebar-demo-info">' +
        '<span style="font-size:26px">🧩</span>' +
        '<div>' +
        '<div class="sidebar-demo-title">Two Minds, One Word</div>' +
        '<div class="sidebar-demo-sub">AI Partner ke saath word puzzle</div>' +
        '</div></div>' +
        '<button class="btn primary sm" style="width:auto;padding:6px 14px" data-action="soloPracticeTwoMinds">Practice 🚀</button>' +
        '</div>' +

        // Demo 2: Scribble
        '<div class="sidebar-demo-card" style="background:#EBFBFA;border-color:var(--mor)">' +
        '<div class="sidebar-demo-info">' +
        '<span style="font-size:26px">🎨</span>' +
        '<div>' +
        '<div class="sidebar-demo-title">Scribble Draw &amp; Guess</div>' +
        '<div class="sidebar-demo-sub">Free canvas drawing test</div>' +
        '</div></div>' +
        '<button class="btn teal sm" style="width:auto;padding:6px 14px" data-action="soloPracticeScribble">Draw 🎨</button>' +
        '</div>' +

        // Demo 3: 3D Bike Race
        '<div class="sidebar-demo-card" style="background:#FFF9EB;border-color:var(--genda)">' +
        '<div class="sidebar-demo-info">' +
        '<span style="font-size:26px">🏍️</span>' +
        '<div>' +
        '<div class="sidebar-demo-title">3D Superbike Race</div>' +
        '<div class="sidebar-demo-sub">Solo physics track test drive</div>' +
        '</div></div>' +
        '<button class="btn gold sm" style="width:auto;padding:6px 14px" data-action="settingsSoloPractice">Drive 🚀</button>' +
        '</div>' +
        '</div>' +

        // Section 2: User Guide
        '<div class="settings-card">' +
        '<div class="settings-card-header">' +
        '<span class="sch-icon">📖</span>' +
        '<div><div class="sch-title">Khelne Ka Tareeka</div><div class="sch-desc">Rules &amp; tips sabhi 3 games ke liye</div></div>' +
        '</div>' +
        '<button class="btn alt sm" style="width:100%" data-action="openGuideFromSettings">📖 User Guide Kholein</button>' +
        '</div>' +

        // Section 3: Profile & Name Change
        '<div class="settings-card">' +
        '<div class="settings-card-header">' +
        '<span class="sch-icon">👤</span>' +
        '<div><div class="sch-title">Aapka Naam &amp; Avatar</div><div class="sch-desc">Partner ko ye naam dikhega</div></div>' +
        '</div>' +
        '<div class="settings-profile-row">' +
        '<span class="settings-profile-badge">' + profile.avatar + '</span>' +
        '<input class="input-field" id="settingsNameInput" maxlength="20" placeholder="Apna naam daalein" value="' + esc(profile.name) + '">' +
        '</div>' +
        '<div class="settings-av-grid">' + avHtml + '</div>' +
        '<button class="btn primary sm" style="width:100%;margin-top:10px" data-action="saveSettingsProfile">💾 Naam Save Karein</button>' +
        '</div>' +

        // Section 4: Sound & Audio Toggle
        '<div class="settings-card">' +
        '<div class="settings-card-header">' +
        '<span class="sch-icon">' + (isMuted ? '🔇' : '🔊') + '</span>' +
        '<div><div class="sch-title">Awaaz (Sound Effects)</div><div class="sch-desc">Tap, unlock aur race sounds</div></div>' +
        '</div>' +
        '<div class="settings-toggle-row">' +
        '<span>Sound: <b>' + (isMuted ? 'Muted 🔇' : 'On 🔊') + '</b></span>' +
        '<button class="btn ' + (isMuted ? 'gold' : 'alt') + ' sm" data-action="settingsToggleSound">' +
        (isMuted ? 'Unmute 🔊' : 'Mute 🔇') +
        '</button>' +
        '</div>' +
        '</div>' +

        // Section 5: 3D Superbike Model
        '<div class="settings-card">' +
        '<div class="settings-card-header">' +
        '<span class="sch-icon">🏍️</span>' +
        '<div><div class="sch-title">Aapki 3D Superbike</div><div class="sch-desc">Apni manpasand bike chunein</div></div>' +
        '</div>' +
        '<div class="settings-bike-list">' + bikeHtml + '</div>' +
        '</div>' +

        // Section 6: App Install (PWA)
        '<div class="settings-card" style="background:#FFF9FC;border-color:var(--rani)">' +
        '<div class="settings-card-header">' +
        '<span class="sch-icon">📲</span>' +
        '<div><div class="sch-title">Direct App Install</div><div class="sch-desc">Bina App Store phone par icon banayein</div></div>' +
        '</div>' +
        '<button class="btn gold sm" style="width:100%" data-action="installPwa">📲 Jodi Sync Install Karein</button>' +
        '</div>' +

        '<div class="settings-version-tag">Jodi Sync v2.5 • Handcrafted with ❤️ for Couples</div>' +
        '</div>' +
        '</aside>';

      m.className = 'drawer-mode on';
    } else {
      m.className = '';
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
    else if (state.screen === 'twominds') html = vTwoMinds();
    else if (state.screen === 'twominds_results') html = vTwoMindsResults();

    view.innerHTML = html;
    renderModal();
    updatePwaBannerVisibility();

    if (state.screen === 'game') {
      bindCanvasEvents();
      startMatchTimer();
      bindGuessForm();
    } else if (state.screen === 'twominds') {
      startTwoMindsTimer();
      bindTwoMindsChatForm();
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
    if (e.target && e.target.id === 'modal') {
      state.modal = null;
      renderModal();
      return;
    }
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
    } else if (action === 'openSettings') {
      Audio.playTap();
      state.modal = 'settings';
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
    } else if (action === 'settingsPickBike') {
      Audio.playTap();
      var bVal = target.dataset.bike;
      state.selectedBikeTheme = bVal;
      if (Net.getStatus() === 'connected') {
        Net.send('PARTNER_BIKE_CHOICE', { bike: bVal });
      }
      toast('Bike selected: ' + bVal);
      renderModal();
    } else if (action === 'settingsSoloPractice') {
      Audio.playTap();
      state.modal = null;
      renderModal();
      state.raceTrackSeed = Math.floor(Math.random() * 9000) + 1000;
      state.screen = 'race';
      render();
    } else if (action === 'openGuideFromSettings') {
      Audio.playTap();
      state.modal = 'guide';
      state.guideTab = 'scribble';
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
      if (!window.confirm('Kya aap race chhod kar bahar jaana chahte hain?')) return;
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
            toast('Shukriya! Jodi Sync install ho raha hai... 📲');
            isPwaDismissed = true;
            updatePwaBannerVisibility();
          }
          window.deferredInstallPrompt = null;
          deferredInstallPrompt = null;
        });
      } else {
        toast('Chrome ke upar 3 dots (⋮) dabakar "Install app" chunein! 📲');
      }
    } else if (action === 'setTmMode') {
      Audio.playTap();
      state.twoMindsSettings.mode = target.dataset.val;
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
      var tms = state.twoMindsSettings;
      var deck = TwoMinds.getDeck(tms.wordCount, tms.mode);
      var match = TwoMinds.createMatch(deck, { duration: tms.duration, mode: tms.mode, isSolo: false });

      var cleanLen = deck[0].answer.replace(/\s/g, '').length;
      var initialSlots = [];
      for (var sIdx = 0; sIdx < cleanLen; sIdx++) initialSlots.push(null);

      state.twoMinds = {
        roundIndex: 0,
        totalRounds: deck.length,
        roundDuration: tms.duration,
        roundEndAt: match.roundEndAt,
        teamScore: 0,
        comboStreak: 0,
        maxCombo: 0,
        wordsSolved: 0,
        hintsUsed: 0,
        perfectRounds: 0,
        askTokensRemaining: 3,
        solveTimes: [],
        isSolved: false,
        isTransitioning: false,
        isSolo: false,
        wordLength: deck[0].length,
        myCategory: deck[0].category,
        myClue: deck[0].clueA,
        prompt: deck[0].prompt,
        slots: initialSlots,
        myRack: deck[0].playerA.map(function (ltr, idx) {
          return { id: 'A_' + idx + '_' + Date.now(), letter: ltr, placed: false };
        }),
        deck: deck
      };

      state.twoMindsChat = [
        { text: '🧩 Two Minds Match Shuru! Dono ek doosre se coordinate karein.', type: 'system' }
      ];
      state.partnerBubble = null;
      state.screen = 'twominds';

      Net.send('TM_START_MATCH', {
        roundIndex: 0,
        totalRounds: deck.length,
        roundDuration: tms.duration,
        roundEndAt: match.roundEndAt,
        wordLength: deck[0].length,
        category: deck[0].category,
        guestLetters: deck[0].playerB,
        guestClue: deck[0].clueB,
        prompt: deck[0].prompt,
        mode: tms.mode
      });
      render();
  function launchTwoMindsSolo() {
    Audio.playTap();
    state.modal = null;
    renderModal();
    var sDeck = TwoMinds.getDeck(5, 'classic');
    var sMatch = TwoMinds.createMatch(sDeck, { duration: 45, mode: 'classic', isSolo: true });

    var sCleanLen = sDeck[0].answer.replace(/\s/g, '').length;
    var sInitialSlots = [];
    for (var ssIdx = 0; ssIdx < sCleanLen; ssIdx++) sInitialSlots.push(null);

    state.twoMinds = {
      roundIndex: 0,
      totalRounds: sDeck.length,
      roundDuration: 45,
      roundEndAt: sMatch.roundEndAt,
      teamScore: 0,
      comboStreak: 0,
      maxCombo: 0,
      wordsSolved: 0,
      hintsUsed: 0,
      perfectRounds: 0,
      askTokensRemaining: 3,
      solveTimes: [],
      isSolved: false,
      isTransitioning: false,
      isSolo: true,
      wordLength: sDeck[0].length,
      myCategory: sDeck[0].category,
      myClue: sDeck[0].clueA,
      prompt: sDeck[0].prompt,
      slots: sInitialSlots,
      myRack: sDeck[0].playerA.map(function (ltr, idx) {
        return { id: 'A_' + idx + '_' + Date.now(), letter: ltr, placed: false };
      }),
      deck: sDeck
    };

    if (TwoMinds) TwoMinds.setSlots(sInitialSlots);

    state.twoMindsChat = [
      { text: '🤖 Solo Practice Mode: AI Partner ke saath khele!', type: 'system' }
    ];
    state.partnerBubble = null;
    state.screen = 'twominds';

    TwoMinds.startSoloAILoop(function (aiEvt) {
      if (aiEvt && aiEvt.type === 'ai_letter_placed' && state.twoMinds) {
        state.twoMinds.slots = aiEvt.slots;
        Audio.playTap();
        state.twoMindsChat.push({
          text: '🤖 AI Partner ne akshar "' + aiEvt.letter + '" slot me rakha! ✨',
          type: 'partner'
        });
        showPartnerSpeechBubble('Maine "' + aiEvt.letter + '" rakh diya! 💖', 'AI Partner');
        render();
      }
    });
    render();
  }

  function launchScribbleSolo() {
    Audio.playTap();
    state.modal = null;
    renderModal();
    var sDeck = Words.getDeck(5, 'hi');
    var endAt = Date.now() + 60000;
    state.game = {
      deck: sDeck,
      turnIndex: 0,
      totalTurns: sDeck.length,
      dur: 60,
      endAt: endAt,
      scores: [0, 0],
      chat: [{ text: '🎨 Solo Drawing Canvas: Yahan aap free drawing test kar sakte hain!', type: 'system' }],
      solved: false,
      isSolo: true
    };
    state.strokes = [];
    state.screen = 'game';
    toast('Solo Drawing Canvas Shuru! 🎨');
    render();
  }

    } else if (action === 'openSidebar') {
      Audio.playTap();
      state.modal = 'sidebar';
      renderModal();
    } else if (action === 'shareWhatsApp') {
      Audio.playTap();
      var wCode = target.dataset.code || Net.getRoomCode();
      var msg = 'Aao Jodi Sync khele! Mere room ka code hai: ' + wCode + ' 💖 Khelte hain: ' + window.location.href;
      window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(msg), '_blank');
    } else if (action === 'soloPracticeTwoMinds') {
      launchTwoMindsSolo();
    } else if (action === 'soloPracticeScribble') {
      launchScribbleSolo();
    } else if (action === 'tmAdvanceNow') {
      Audio.playTap();
      advanceTwoMindsRoundAuthoritative();
    } else if (action === 'tmTileTap') {
      var tileId = target.dataset.id;
      var tileLtr = target.dataset.ltr;
      if (!state.twoMinds || state.twoMinds.isSolved || state.twoMinds.isTransitioning) return;
      var rackTile = state.twoMinds.myRack.find(function (t) { return t.id === tileId; });
      if (!rackTile || rackTile.placed) return;

      var emptyIdx = state.twoMinds.slots.indexOf(null);
      if (emptyIdx === -1) {
        toast('Saare slots bhare hain! Letter hatane ke liye slot par tap karein.');
        return;
      }

      var isHost = Net.isHostUser();
      state.twoMinds.slots[emptyIdx] = {
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
      if (!currentSlot) return;

      var isHost = Net.isHostUser();
      var isMyLetter = (currentSlot.owner === 'host' && isHost) ||
                       (currentSlot.owner === 'guest' && !isHost) ||
                       state.twoMinds.isSolo;

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
    } else if (action === 'tmRecall') {
      Audio.playTap();
      if (!state.twoMinds) return;
      var isHost = Net.isHostUser();
      var myOwner = isHost ? 'host' : 'guest';
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
        toast('Pehle saare akshar bharein!');
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
          advanceTwoMindsRoundAuthoritative();
        }, 2600);
      } else {
        Audio.playMiss();
        toast('Not quite! Keep working together.');
        var boardEl = document.querySelector('.tm-board-slots');
        if (boardEl) {
          boardEl.classList.add('shake');
          setTimeout(function () { boardEl.classList.remove('shake'); }, 500);
        }
        if (Net.getStatus() === 'connected') {
          Net.send('TM_ROUND_FAIL', {
            message: res.message,
            teamScore: state.twoMinds.teamScore
          });
        }
        render();
      }
    } else if (action === 'tmAskHelp') {
      Audio.playTap();
      if (!state.twoMinds) return;
      if (state.twoMinds.askTokensRemaining <= 0) {
        toast('Saare Ask Partner tokens use ho chuke hain!');
        return;
      }
      state.twoMinds.askTokensRemaining--;
      if (state.twoMinds.isSolo) {
        var curPuzzle = state.twoMinds.deck[state.twoMinds.roundIndex];
        var guestLtrs = curPuzzle.playerB || [];
        var cleanAns = curPuzzle.answer.replace(/\s/g, '');
        var unshared = null;
        var unsharedIdx = -1;
        for (var gl = 0; gl < guestLtrs.length; gl++) {
          var char = guestLtrs[gl];
          for (var ca = 0; ca < cleanAns.length; ca++) {
            if (cleanAns[ca] === char && !state.twoMinds.slots[ca]) {
              unshared = char;
              unsharedIdx = ca;
              break;
            }
          }
          if (unshared) break;
        }

        if (unshared && unsharedIdx !== -1) {
          state.twoMinds.slots[unsharedIdx] = {
            letter: unshared,
            owner: 'guest',
            id: 'guest_help_' + Date.now()
          };
          if (TwoMinds) TwoMinds.setSlots(state.twoMinds.slots);
          state.twoMindsChat.push({
            text: '🤖 AI Partner: Maine akshar "' + unshared + '" slot ' + (unsharedIdx + 1) + ' me rakh diya! 💖',
            type: 'partner'
          });
          showPartnerSpeechBubble('Maine "' + unshared + '" rakh diya! 💖', 'AI Partner');
          Audio.playUnlock();
          toast('🤝 AI Partner ne akshar "' + unshared + '" rakh diya!');
        } else {
          toast('AI Partner ke paas aur letter nahi hain!');
        }
      } else {
        Net.send('TM_ASK_HELP', { requester: profile.name });
        toast('Partner se help maangi! 🤝');
      }
      render();
    } else if (action === 'tmSharePartnerLetter') {
      Audio.playTap();
      state.sharePartnerPrompt = false;
      var unplaced = (state.twoMinds.myRack || []).find(function (t) { return !t.placed; }) || state.twoMinds.myRack[0];
      if (unplaced) {
        Net.send('TM_GIVE_HELP', { sharedLetter: unplaced.letter, helper: profile.name });
        toast('Partner ke saath letter "' + unplaced.letter + '" share kiya! ✨');
      }
      render();
    } else if (action === 'tmUseHint') {
      Audio.playTap();
      if (!state.twoMinds || state.twoMinds.isSolved || state.twoMinds.isTransitioning) return;
      state.twoMinds.hintsUsed = (state.twoMinds.hintsUsed || 0) + 1;
      state.twoMinds.teamScore = Math.max(0, (state.twoMinds.teamScore || 0) - 20);

      var curPuzzle = state.twoMinds.deck ? state.twoMinds.deck[state.twoMinds.roundIndex] : null;
      if (curPuzzle) {
        var firstChar = curPuzzle.answer.charAt(0);
        state.twoMinds.slots[0] = { letter: firstChar, owner: 'system', locked: true, id: 'hint_0' };
        if (TwoMinds) TwoMinds.setSlots(state.twoMinds.slots);
        var hintPayload = {
          hintType: 'first_letter',
          letter: firstChar,
          hintDesc: 'Pehla akshar "' + firstChar + '" lock ho gaya! (-20 pts)'
        };
        state.twoMindsChat.push({ text: '💡 ' + hintPayload.hintDesc, type: 'system' });
        if (Net.getStatus() === 'connected') {
          Net.send('TM_USE_HINT', hintPayload);
        }
      }
      Audio.playUnlock();
      render();
    } else if (action === 'tmQuickChip') {
      Audio.playChime();
      var chipText = target.dataset.text;
      state.twoMindsChat.push({
        text: chipText,
        sender: profile.name,
        type: 'me'
      });
      showPartnerSpeechBubble(chipText, profile.name);
      if (Net.getStatus() === 'connected') {
        Net.send('TM_QUICK_MSG', { text: chipText, sender: profile.name });
      } else if (state.twoMinds && state.twoMinds.isSolo) {
        setTimeout(function () {
          var aiReplies = ['Haan main soch raha hoon! 🤔', 'Mere paas bhi acche letters hain! 🔤', 'Sahi jaa rahe hain hum! 💖', 'Chalo saath me try karte hain! ✨'];
          var reply = aiReplies[Math.floor(Math.random() * aiReplies.length)];
          if (state.twoMinds) {
            state.twoMindsChat.push({ text: reply, sender: 'AI Partner', type: 'partner' });
            showPartnerSpeechBubble(reply, 'AI Partner');
            Audio.playChime();
            render();
          }
        }, 900);
      }
      render();
    } else if (action === 'twoMindsPlayAgain') {
      Audio.playTap();
      if (state.twoMindsResults && state.twoMindsResults.isSolo) {
        launchTwoMindsSolo();
      } else {
        state.screen = 'room_ready';
        render();
      }
    } else if (action === 'twoMindsLeave') {
      Audio.playTap();
      if (TwoMinds) TwoMinds.cleanup();
      state.twoMinds = null;
      if (Net.getStatus() === 'connected') {
        state.screen = 'room_ready';
        Net.send('RETURN_LOBBY', {});
      } else {
        state.screen = 'lobby';
      }
      render();
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
    var isHomeScreen = (state.screen === 'lobby' || state.screen === 'welcome');
    if (isRunningStandalone() || isPwaDismissed || !isHomeScreen) {
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
          toast('Shukriya! Jodi Sync install ho raha hai... 📲');
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
    toast('🎉 Jodi Sync successfully install ho gaya!');
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
