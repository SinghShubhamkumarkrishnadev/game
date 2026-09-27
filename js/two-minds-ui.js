/* Jodi Sync — Two Minds One Word UI, Timer & Round Controller
 * SOLID Architecture:
 * - Single Responsibility: Presentation, interactive board slots, clue display, and round lifecycle.
 * - Clean UI: Removed distracting chat feed, quick chips, and complex token popups.
 * - Turn & Slot Clarity: Each slot clearly displays [Aap] or [Partner] ownership.
 * - Shared Dual Clues: Both players see Category, Length, Prompt, and both complementary hints.
 * Exposes: window.JodiTwoMindsUI
 */
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

  /* ═══════════════════════════════════════════════════════════════
   * 1. Round Timer Lifecycle
   * ═══════════════════════════════════════════════════════════════ */
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
    }, 2400);
  }

  function advanceRoundAuthoritative() {
    var c = getCtx();
    var state = c.state;
    var Net = c.Net || global.JodiNet;
    var TwoMinds = c.TwoMinds || global.TwoMindsGame;

    if (!state || !state.twoMinds) return;
    var nextIdx = state.twoMinds.roundIndex + 1;
    state.selectedSlotIdx = null; // Clear slot selection

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

      // Clean slots
      var cleanLen = nextPuzzle.answer.replace(/\s/g, '').length;
      var slotsArr = [];
      for (var s = 0; s < cleanLen; s++) slotsArr.push(null);
      state.twoMinds.slots = slotsArr;

      // Setup Host state
      state.twoMinds.myRack = nextPuzzle.playerA.map(function (ltr, idx) {
        return { id: 'A_' + idx + '_' + Date.now(), letter: ltr, placed: false };
      });
      state.twoMinds.category = nextPuzzle.category;
      state.twoMinds.clueA = nextPuzzle.clueA;
      state.twoMinds.clueB = nextPuzzle.clueB;
      state.twoMinds.wordLength = nextPuzzle.length;
      state.twoMinds.prompt = nextPuzzle.prompt;
      state.twoMinds.slotOwners = nextPuzzle.slotOwners || [];

      var roundPayload = {
        roundIndex: nextIdx,
        roundDuration: state.twoMinds.roundDuration,
        roundEndAt: state.twoMinds.roundEndAt,
        wordLength: nextPuzzle.length,
        category: nextPuzzle.category,
        guestLetters: nextPuzzle.playerB,
        clueA: nextPuzzle.clueA,
        clueB: nextPuzzle.clueB,
        prompt: nextPuzzle.prompt,
        slotOwners: nextPuzzle.slotOwners || [],
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
      state.selectedSlotIdx = null;
    }
    if (Audio) Audio.playUnlock();
    if (c.burstCenter) c.burstCenter(42);
    if (c.render) c.render();
  }

  /* ═══════════════════════════════════════════════════════════════
   * 2. Main Two Minds Screen View (Clean & Couple-Centered)
   * ═══════════════════════════════════════════════════════════════ */
  function vTwoMindsGame() {
    var c = getCtx();
    var state = c.state;
    var profile = c.profile || {};
    var Net = c.Net || global.JodiNet;

    var tm = state ? state.twoMinds : null;
    if (!tm) {
      if (global.JodiLobby) return global.JodiLobby.vRoomReady();
      return '';
    }

    var isHost = Net ? Net.isHostUser() : true;
    var isSolo = tm.isSolo;
    var myRole = isHost ? 'host' : 'guest';
    var partnerName = isSolo ? 'AI Partner' : ((Net && Net.getPartnerName()) || 'Partner');
    var partnerAvatar = isSolo ? '🤖' : ((Net && Net.getPartnerAvatar()) || '✨');

    var roundIdx = tm.roundIndex || 0;
    var totalRounds = tm.totalRounds || 10;
    var teamScore = tm.teamScore || 0;
    var combo = tm.comboStreak || 0;

    // 1. Win Celebration Overlay Banner
    var winOverlayHtml = '';
    if (tm.roundWinnerBanner) {
      winOverlayHtml = '<div class="tm-round-win-modal">' +
        '<div class="tm-round-win-card">' +
          '<div class="tm-win-icon">🎉</div>' +
          '<div class="tm-win-subhead">WORD SOLVED!</div>' +
          '<div class="tm-solved-word">' + esc(tm.roundWinnerBanner.word) + '</div>' +
          '<div class="tm-win-pts">+' + tm.roundWinnerBanner.scoreAdded + ' pts</div>' +
          (tm.roundWinnerBanner.combo > 1 ? '<div class="tm-combo-tag">🔥 ' + tm.roundWinnerBanner.combo + 'X TEAM SYNC</div>' : '') +
          '<div class="tm-win-next-hint">Agla word taiyar ho raha hai...</div>' +
          '<button class="btn gold sm" data-action="tmAdvanceNow">Agla Word Khelein ➔</button>' +
        '</div>' +
      '</div>';
    }

    // 2. Top Bar HUD
    var topBarHtml = '<div class="tm-topbar">' +
      '<button class="tm-exit-pill" data-action="twoMindsLeave" title="Exit Game">✕ Exit</button>' +
      '<span class="timer-pill" id="tmTimerDisplay">⏱️ 45s</span>' +
      '<span class="live-pill">Word ' + (roundIdx + 1) + '/' + totalRounds + '</span>' +
      '<div class="tm-score-badge">❤️ ' + teamScore + '</div>' +
      (combo > 1 ? '<div class="tm-combo-pill">🔥 ' + combo + 'X</div>' : '') +
    '</div>';

    // 3. Dual Clues Card (Both players see Category, Length, Prompt & Both Clues)
    var category = tm.category || tm.myCategory || 'Special';
    var clueA = tm.clueA || tm.myClue || 'Hint 1';
    var clueB = tm.clueB || 'Hint 2';
    var prompt = tm.prompt || '';
    var wordLength = tm.wordLength || (tm.slots ? tm.slots.length : 5);

    var clueCardHtml = '<div class="tm-clue-card">' +
      '<div class="tm-clue-header">' +
        '<span class="tm-cat-tag">🏷️ ' + esc(category) + '</span>' +
        '<span class="tm-len-tag">📏 ' + wordLength + ' Akshar</span>' +
      '</div>' +
      (prompt ? '<div class="tm-prompt-text">"' + esc(prompt) + '"</div>' : '') +
      '<div class="tm-clue-grid">' +
        '<div class="tm-clue-box clue-a">' +
          '<div class="tm-clue-label">💡 Hint 1:</div>' +
          '<div class="tm-clue-val">' + esc(clueA) + '</div>' +
        '</div>' +
        '<div class="tm-clue-box clue-b">' +
          '<div class="tm-clue-label">💡 Hint 2:</div>' +
          '<div class="tm-clue-val">' + esc(clueB) + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

    // 4. Shared Word Board Slots (Assigned ownership: Aap vs Partner)
    var slots = tm.slots || [];
    var slotOwners = tm.slotOwners || [];
    var selectedIdx = state.selectedSlotIdx;

    var slotsHtml = slots.map(function (s, idx) {
      var designatedOwner = slotOwners[idx] || (idx % 2 === 0 ? 'host' : 'guest');
      var isMySlot = (designatedOwner === myRole);
      var isSelected = (selectedIdx === idx);

      if (!s) {
        // Empty slot
        var slotClass = 'tm-slot ' + (isMySlot ? 'my-slot' : 'partner-slot') + (isSelected ? ' selected-slot' : '');
        var ownerTag = isMySlot
          ? '<span class="tm-owner-tag my-tag">Aap</span>'
          : '<span class="tm-owner-tag partner-tag">Partner</span>';

        return '<div class="' + slotClass + '" data-action="tmSlotTap" data-idx="' + idx + '" title="Slot ' + (idx + 1) + '">' +
          '<span class="tm-slot-num">' + (idx + 1) + '</span>' +
          ownerTag +
        '</div>';
      }

      // Filled slot
      var placedOwner = s.owner || designatedOwner;
      var placedByMe = (placedOwner === myRole) || isSolo;
      var fillClass = 'tm-slot filled ' + (placedByMe ? 'placed-by-me' : 'placed-by-partner') + (s.locked ? ' locked-hint' : '');
      var placedBadge = s.locked ? 'Hint' : (placedByMe ? 'Aap' : 'Partner');

      return '<div class="' + fillClass + '" data-action="tmSlotTap" data-idx="' + idx + '" title="' + (placedByMe && !s.locked ? 'Tap karke wapas rack me lein' : 'Placed by ' + placedBadge) + '">' +
        '<span class="tm-slot-letter">' + esc(s.letter) + '</span>' +
        '<span class="tm-slot-badge">' + placedBadge + '</span>' +
      '</div>';
    }).join('');

    var boardHtml = '<div class="tm-board-wrap">' +
      '<div class="tm-board-title">' +
        '<span>🧩 Shared Word Board</span>' +
        '<span class="tm-board-sub">(Dono ke akshar yahan milenge)</span>' +
      '</div>' +
      '<div class="tm-board-slots">' + slotsHtml + '</div>' +
      (selectedIdx !== null && selectedIdx !== undefined
        ? '<div class="tm-slot-selected-hint">Slot ' + (selectedIdx + 1) + ' chuna hua hai! Neeche se apna letter tap karein.</div>'
        : '') +
    '</div>';

    // 5. Player Rack (Clean & Tactile)
    var rack = tm.myRack || [];
    var unplacedCount = rack.filter(function (t) { return !t.placed; }).length;

    var rackHtml = '<div class="tm-rack-card">' +
      '<div class="tm-rack-header">' +
        '<span class="tm-rack-title">AAPKE AKSHAR (' + unplacedCount + ' Baaki)</span>' +
        '<button class="btn ghost sm tm-recall-btn" data-action="tmRecall" title="Apne sabhi placed letters wapas rack me lein">↩️ Clear</button>' +
      '</div>' +
      '<div class="tm-rack-tiles">' +
        rack.map(function (tile) {
          return '<button class="tm-tile ' + (isHost ? 'is-host' : 'is-guest') + ' ' + (tile.placed ? 'placed' : '') + '" data-action="tmTileTap" data-id="' + tile.id + '" data-ltr="' + tile.letter + '">' +
            esc(tile.letter) +
          '</button>';
        }).join('') +
      '</div>' +
    '</div>';

    // 6. Partner Status Strip
    var partnerPlacedCount = 0;
    var partnerTotalCount = 0;
    for (var p = 0; p < slots.length; p++) {
      var dOwn = slotOwners[p] || (p % 2 === 0 ? 'host' : 'guest');
      if (dOwn !== myRole) {
        partnerTotalCount++;
        if (slots[p]) partnerPlacedCount++;
      }
    }

    var partnerStripHtml = '';
    if (isSolo) {
      partnerStripHtml = '<div class="tm-partner-strip">' +
        '<div class="tm-pstrip-left">' +
          '<span class="tm-pstrip-avatar">🤖</span>' +
          '<div>' +
            '<div class="tm-pstrip-name">AI Partner</div>' +
            '<div class="tm-pstrip-sub">' + (partnerPlacedCount >= partnerTotalCount ? 'AI ne apne akshar rakh diye! ✅' : 'AI soch raha hai... ⏳') + '</div>' +
          '</div>' +
        '</div>' +
        (partnerPlacedCount < partnerTotalCount
          ? '<button class="btn gold sm" data-action="tmAiPlaceNow">🤖 AI Akshar Rakho</button>'
          : '<span class="tm-pstrip-done">Ready ✨</span>') +
      '</div>';
    } else {
      partnerStripHtml = '<div class="tm-partner-strip">' +
        '<div class="tm-pstrip-left">' +
          '<span class="tm-pstrip-avatar">' + partnerAvatar + '</span>' +
          '<div>' +
            '<div class="tm-pstrip-name">' + esc(partnerName) + '</div>' +
            '<div class="tm-pstrip-sub">' +
              (partnerPlacedCount >= partnerTotalCount
                ? 'Sabhi ' + partnerTotalCount + ' akshar rakh diye! ✅'
                : partnerPlacedCount + '/' + partnerTotalCount + ' akshar rakhe ⏳') +
            '</div>' +
          '</div>' +
        '</div>' +
        (partnerPlacedCount >= partnerTotalCount
          ? '<span class="tm-pstrip-done">Ready ✨</span>'
          : '<span class="tm-pstrip-wait">Typing... 💭</span>') +
      '</div>';
    }

    // 7. Actions Row: Check Word + Reveal Hint
    var actionsHtml = '<div class="tm-actions-row">' +
      '<button class="btn gold tm-check-btn" data-action="tmCheckWord">Word Check Karein ✨</button>' +
      '<button class="btn ghost tm-hint-btn" data-action="tmUseHint" title="Pehla akshar reveal karein">💡 Hint</button>' +
    '</div>';

    return '<section class="screen tm-arena">' +
      winOverlayHtml +
      topBarHtml +
      clueCardHtml +
      boardHtml +
      rackHtml +
      partnerStripHtml +
      actionsHtml +
    '</section>';
  }

  /* ═══════════════════════════════════════════════════════════════
   * 3. Match Results View
   * ═══════════════════════════════════════════════════════════════ */
  function vResults() {
    var c = getCtx();
    var state = c.state;

    var res = (state && state.twoMindsResults) || {
      teamScore: 1200,
      wordsSolved: 8,
      totalRounds: 10,
      perfectRounds: 5,
      hintsUsed: 1,
      maxCombo: 3,
      solveTimes: [14, 18, 20]
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
      avgTime = 18;
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
          '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' +
          '<button class="btn primary" data-action="twoMindsPlayAgain">Dobara Khelo 🔁</button>' +
          '<button class="btn alt" data-action="twoMindsLeave">Room Lobby Mein Jao 🏠</button>' +
          '<button class="btn ghost sm" data-action="leaveRoom">Room Se Niklo</button>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  /* ═══════════════════════════════════════════════════════════════
   * 4. Solo Mode Launcher
   * ═══════════════════════════════════════════════════════════════ */
  function launchSolo() {
    var c = getCtx();
    var state = c.state;
    var Audio = c.Audio || global.JodiAudio;
    var TwoMinds = c.TwoMinds || global.TwoMindsGame;

    if (Audio) Audio.playTap();
    state.modal = null;
    state.selectedSlotIdx = null;

    var sDeck = TwoMinds ? TwoMinds.getDeck(5, 'classic') : [];
    var sMatch = TwoMinds ? TwoMinds.createMatch(sDeck, { duration: 45, mode: 'classic', isSolo: true }) : { roundEndAt: Date.now() + 45000 };

    var sFirst = sDeck[0];
    var sCleanLen = sFirst ? sFirst.answer.replace(/\s/g, '').length : 4;
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
      solveTimes: [],
      isSolved: false,
      isTransitioning: false,
      isSolo: true,
      wordLength: sFirst ? sFirst.length : 4,
      category: sFirst ? sFirst.category : 'Food & Drinks',
      clueA: sFirst ? sFirst.clueA : '',
      clueB: sFirst ? sFirst.clueB : '',
      prompt: sFirst ? sFirst.prompt : '',
      slotOwners: sFirst ? sFirst.slotOwners : ['host', 'guest', 'host', 'guest'],
      slots: sInitialSlots,
      myRack: (sFirst ? sFirst.playerA : []).map(function (ltr, idx) {
        return { id: 'A_' + idx + '_' + Date.now(), letter: ltr, placed: false };
      }),
      deck: sDeck
    };

    if (TwoMinds) TwoMinds.setSlots(sInitialSlots);

    state.screen = 'twominds';

    if (TwoMinds) {
      TwoMinds.startSoloAILoop(function (aiEvt) {
        if (aiEvt && state.twoMinds) {
          state.twoMinds.slots = aiEvt.slots;
          if (Audio) Audio.playTap();
          if (c.render) c.render();
        }
      });
    }
    if (c.render) c.render();
  }

  /* Compatibility stubs */
  function showPartnerSpeechBubble() {}
  function bindChatForm() {}

  global.JodiTwoMindsUI = {
    init: init,
    startTimer: startTimer,
    stopTimer: stopTimer,
    handleTimeoutAuthoritative: handleTimeoutAuthoritative,
    advanceRoundAuthoritative: advanceRoundAuthoritative,
    applyGameOver: applyGameOver,
    showPartnerSpeechBubble: showPartnerSpeechBubble,
    vGame: vTwoMindsGame,
    vResults: vResults,
    bindChatForm: bindChatForm,
    launchSolo: launchSolo
  };

})(window);
