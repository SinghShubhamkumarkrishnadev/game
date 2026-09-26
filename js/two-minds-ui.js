/* Jodi Sync — Two Minds One Word UI, Timer & Round Controller */
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
  }

  function getCtx() {
    return ctx || global.JodiContext || {};
  }

  function stopTimer() {
    var c = getCtx();
    if (c.state && c.state.twoMindsTimerInterval) {
      clearInterval(c.state.twoMindsTimerInterval);
      c.state.twoMindsTimerInterval = null;
    }
  }

  function startTimer() {
    stopTimer();
    var c = getCtx();
    var state = c.state;
    var Audio = c.Audio || global.JodiAudio;
    var Net = c.Net || global.JodiNet;

    if (!state) return;

    state.twoMindsTimerInterval = setInterval(function () {
      if (!state.twoMinds || state.screen !== 'twominds') {
        stopTimer();
        return;
      }
      var now = Date.now();
      var leftSec = Math.max(0, Math.ceil((state.twoMinds.roundEndAt - now) / 1000));
      var timerEl = $('#tmTimerDisplay');
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

      // Time expired check
      if (leftSec <= 0 && !state.twoMinds.isSolved && !state.twoMinds.isTransitioning) {
        stopTimer();
        if ((Net && Net.isHostUser()) || state.twoMinds.isSolo) {
          handleTimeoutAuthoritative();
        }
      }
    }, 250);
  }

  function handleTimeoutAuthoritative() {
    var c = getCtx();
    var state = c.state;
    var Audio = c.Audio || global.JodiAudio;
    var Net = c.Net || global.JodiNet;

    if (!state || !state.twoMinds || state.twoMinds.isTransitioning) return;
    state.twoMinds.isTransitioning = true;
    var curPuzzle = state.twoMinds.deck ? state.twoMinds.deck[state.twoMinds.roundIndex] : null;
    var ans = curPuzzle ? curPuzzle.answer : 'WORD';
    if (Audio) Audio.playMiss();
    if (c.toast) c.toast('⌛ Time Up! Sahi shabd tha: ' + ans);

    var timeoutPayload = {
      word: ans,
      roundIndex: state.twoMinds.roundIndex
    };
    if (Net && Net.getStatus() === 'connected') {
      Net.send('TM_TIMEOUT', timeoutPayload);
    }

    setTimeout(function () {
      advanceRoundAuthoritative();
    }, 2600);
  }

  function advanceRoundAuthoritative() {
    var c = getCtx();
    var state = c.state;
    var Net = c.Net || global.JodiNet;
    var TwoMinds = c.TwoMinds || global.TwoMindsGame;

    if (!state || !state.twoMinds) return;
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

      if (Net && Net.getStatus() === 'connected') {
        Net.send('TM_ROUND_ADVANCE', roundPayload);
      }

      if (state.twoMinds.isSolo && TwoMinds) {
        TwoMinds.startSoloAILoop(function () {
          if (c.render) c.render();
        });
      }

      if (c.toast) c.toast('Round ' + (nextIdx + 1) + '/' + state.twoMinds.totalRounds + ' Shuru! 🧩');
      if (c.render) c.render();
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
      if (Net && Net.getStatus() === 'connected') {
        Net.send('TM_MATCH_OVER', resultsPayload);
      }
      applyGameOver(resultsPayload);
    }
  }

  function applyGameOver(res) {
    var c = getCtx();
    var state = c.state;
    var Audio = c.Audio || global.JodiAudio;
    var TwoMinds = c.TwoMinds || global.TwoMindsGame;

    stopTimer();
    if (TwoMinds) TwoMinds.cleanup();
    if (state) {
      state.twoMindsResults = res;
      state.screen = 'twominds_results';
    }
    if (Audio) Audio.playUnlock();
    if (c.burstCenter) c.burstCenter(42);
    if (c.render) c.render();
  }

  function showPartnerSpeechBubble(text, sender) {
    var c = getCtx();
    var state = c.state;
    if (!state) return;
    state.partnerBubble = { text: text, sender: sender || 'Partner' };
    clearTimeout(state.bubbleTimer);
    state.bubbleTimer = setTimeout(function () {
      state.partnerBubble = null;
      if (c.render) c.render();
    }, 3600);
    if (c.render) c.render();
  }

  function vGame() {
    var c = getCtx();
    var state = c.state;
    var profile = c.profile;
    var Net = c.Net || global.JodiNet;
    var TwoMinds = c.TwoMinds || global.TwoMindsGame;

    var tm = state ? state.twoMinds : null;
    if (!tm) {
      if (global.JodiLobby) return global.JodiLobby.vRoomReady();
      return '';
    }

    var isHost = Net ? Net.isHostUser() : true;
    var isSolo = tm.isSolo;
    var myName = profile.name;
    var partnerName = isSolo ? 'AI Partner (Solo)' : ((Net && Net.getPartnerName()) || 'Partner');
    var partnerAvatar = isSolo ? '🤖' : ((Net && Net.getPartnerAvatar()) || '✨');

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

  function vResults() {
    var c = getCtx();
    var state = c.state;

    var res = (state && state.twoMindsResults) || {
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

    var headerHtml = global.JodiLobby ? global.JodiLobby.renderHeader() : '';

    return '<section class="screen">' +
      headerHtml +
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

  function bindChatForm() {
    var form = $('#tmChatForm');
    if (!form) return;
    var c = getCtx();
    var state = c.state;
    var profile = c.profile;
    var Net = c.Net || global.JodiNet;

    form.onsubmit = function (e) {
      e.preventDefault();
      var inp = $('#tmChatInput');
      if (!inp) return;
      var text = inp.value.trim();
      if (!text) return;
      inp.value = '';
      if (!state.twoMindsChat) state.twoMindsChat = [];
      state.twoMindsChat.push({
        text: text,
        sender: profile.name,
        type: 'me'
      });
      if (Net && Net.getStatus() === 'connected') {
        Net.send('TM_CHAT_MSG', { text: text, sender: profile.name });
      } else if (state.twoMinds && state.twoMinds.isSolo) {
        setTimeout(function () {
          var aiReplies = ['Haan suno ji! 💖', 'Sahi lag raha hai! ✨', 'Yeh wala letter try karein? 💡', 'Aage badhein! 🚀'];
          var rep = aiReplies[Math.floor(Math.random() * aiReplies.length)];
          if (state.twoMinds) {
            state.twoMindsChat.push({ text: rep, sender: 'AI Partner', type: 'partner' });
            showPartnerSpeechBubble(rep, 'AI Partner');
            if (c.render) c.render();
          }
        }, 1000);
      }
      if (c.render) c.render();
      var feed = $('#tmChatFeed');
      if (feed) feed.scrollTop = feed.scrollHeight;
    };
  }

  function launchSolo() {
    var c = getCtx();
    var state = c.state;
    var Audio = c.Audio || global.JodiAudio;
    var TwoMinds = c.TwoMinds || global.TwoMindsGame;

    if (Audio) Audio.playTap();
    state.modal = null;
    if (global.JodiModals) global.JodiModals.render(c);

    var sDeck = TwoMinds ? TwoMinds.getDeck(5, 'classic') : [];
    var sMatch = TwoMinds ? TwoMinds.createMatch(sDeck, { duration: 45, mode: 'classic', isSolo: true }) : { roundEndAt: Date.now() + 45000 };

    var sCleanLen = sDeck[0] ? sDeck[0].answer.replace(/\s/g, '').length : 4;
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
      wordLength: sDeck[0] ? sDeck[0].length : 4,
      myCategory: sDeck[0] ? sDeck[0].category : 'Food',
      myClue: sDeck[0] ? sDeck[0].clueA : '',
      prompt: sDeck[0] ? sDeck[0].prompt : '',
      slots: sInitialSlots,
      myRack: (sDeck[0] ? sDeck[0].playerA : []).map(function (ltr, idx) {
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

    if (TwoMinds) {
      TwoMinds.startSoloAILoop(function (aiEvt) {
        if (aiEvt && aiEvt.type === 'ai_letter_placed' && state.twoMinds) {
          state.twoMinds.slots = aiEvt.slots;
          if (Audio) Audio.playTap();
          state.twoMindsChat.push({
            text: '🤖 AI Partner ne akshar "' + aiEvt.letter + '" slot me rakha! ✨',
            type: 'partner'
          });
          showPartnerSpeechBubble('Maine "' + aiEvt.letter + '" rakh diya! 💖', 'AI Partner');
          if (c.render) c.render();
        }
      });
    }
    if (c.render) c.render();
  }

  global.JodiTwoMindsUI = {
    init: init,
    startTimer: startTimer,
    stopTimer: stopTimer,
    handleTimeoutAuthoritative: handleTimeoutAuthoritative,
    advanceRoundAuthoritative: advanceRoundAuthoritative,
    applyGameOver: applyGameOver,
    showPartnerSpeechBubble: showPartnerSpeechBubble,
    vGame: vGame,
    vResults: vResults,
    bindChatForm: bindChatForm,
    launchSolo: launchSolo
  };
})(window);
