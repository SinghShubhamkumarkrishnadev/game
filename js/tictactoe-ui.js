/* Jodi Sync — Tic-Tac-Toe Presentation & Interaction Orchestrator
 * SOLID Architecture:
 * - Single Responsibility: Manages TTT UI components, celebration modal, drag-and-drop, and AI scheduling.
 * - Open/Closed: Celebration effects and AI strategies are modular and consumed via clean public interfaces.
 * - Liskov Substitution: All move interactions (tap or drag) delegate to the same verified move handler.
 * - Interface Segregation: Distinct, decoupled rendering functions for Scoreboard, Board, Tray, and Win Modal.
 * - Dependency Inversion: Interacts with JodiTTT (domain) and JodiTTTFx (visual effects) abstractions.
 * Exposes: window.JodiTTTUI
 */
(function (global) {
  'use strict';

  var esc = function (s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var ctx = null;

  /* ─── Drag State (cleaned up on every render/bind) ─── */
  var _ghost = null;
  var _isDragging = false;
  var _docTouchMove = null;
  var _docTouchEnd = null;
  var _docMouseMove = null;
  var _docMouseUp = null;

  function init(appContext) {
    ctx = appContext;
  }

  function getCtx() {
    return ctx || global.JodiContext || {};
  }

  /* ═══════════════════════════════════════════════════════════════
   * 1. Solo Match Launcher
   * ═══════════════════════════════════════════════════════════════ */
  function launchSolo() {
    var c = getCtx();
    var TTT = global.JodiTTT;
    var game = TTT.createGame({
      isSolo: true,
      mySymbol: 'X',
      aiSymbol: 'O',
      hostName: (c.profile && c.profile.name) ? c.profile.name : 'Aap',
      guestName: 'AI Opponent'
    });
    game.mySymbol = 'X';
    game.aiSymbol = 'O';
    game.scores = { X: 0, O: 0, draws: 0 };
    game.roundCount = 1;

    c.state.ttt = game;
    c.state.screen = 'ttt';
    if (c.Audio && c.Audio.playTap) c.Audio.playTap();
    if (c.render) c.render();
  }

  /* ═══════════════════════════════════════════════════════════════
   * 2. UI Sub-Renderers (ISP & SRP: Focused Component Renderers)
   * ═══════════════════════════════════════════════════════════════ */

  /**
   * Renders the couple scoreboard with scores, round count, and turn indicator.
   */
  function _renderScoreboard(ttt, mySymbol) {
    var isTurnX = (ttt.currentPlayer === 'X' && !ttt.winner && !ttt.isDraw);
    var isTurnO = (ttt.currentPlayer === 'O' && !ttt.winner && !ttt.isDraw);

    var xName = ttt.isSolo
      ? (mySymbol === 'X' ? esc(ttt.hostName) : 'AI')
      : esc(ttt.hostName);
    var oName = ttt.isSolo
      ? (mySymbol === 'O' ? esc(ttt.hostName) : 'AI')
      : esc(ttt.guestName);

    return '<div class="ttt-scoreboard">' +
      '<div class="ttt-score-cell ' + (isTurnX ? 'active-turn' : '') + '">' +
        '<div class="ttt-score-sym x-sym">✕</div>' +
        '<div class="ttt-score-name">' + xName + '</div>' +
        '<div class="ttt-score-pts">' + ttt.scores.X + '</div>' +
      '</div>' +
      '<div class="ttt-score-divider">' +
        '<div class="ttt-round-label">Round ' + ttt.roundCount + '</div>' +
        '<div class="ttt-draws-label">🤝 ' + ttt.scores.draws + ' Barabar</div>' +
      '</div>' +
      '<div class="ttt-score-cell ' + (isTurnO ? 'active-turn' : '') + '">' +
        '<div class="ttt-score-sym o-sym">◯</div>' +
        '<div class="ttt-score-name">' + oName + '</div>' +
        '<div class="ttt-score-pts">' + ttt.scores.O + '</div>' +
      '</div>' +
    '</div>';
  }

  /**
   * Renders in-game turn and status banner.
   */
  function _renderStatusBanner(ttt, isMyTurn) {
    if (ttt.winner || ttt.isDraw) return ''; // Replaced by celebration modal

    return '<div class="ttt-status-banner ' + (isMyTurn ? 'ttt-your-turn' : 'ttt-wait') + '">' +
      (isMyTurn
        ? '<span class="ttt-turn-pulse"></span> Aapki baari — piece rakho'
        : '⏳ ' + (ttt.isSolo ? 'AI soch raha hai...' : 'Partner ki baari...')) +
    '</div>';
  }

  /**
   * Precise 300x300 viewBox coordinate mapping for all 8 winning paths.
   * Path draws from the first winning cell through the second to the third winning cell.
   */
  var WIN_LINE_COORDS = {
    '0,1,2': { x1: 18, y1: 50, x2: 282, y2: 50 },    // Top row
    '3,4,5': { x1: 18, y1: 150, x2: 282, y2: 150 },  // Middle row
    '6,7,8': { x1: 18, y1: 250, x2: 282, y2: 250 },  // Bottom row
    '0,3,6': { x1: 50, y1: 18, x2: 50, y2: 282 },    // Left column
    '1,4,7': { x1: 150, y1: 18, x2: 150, y2: 282 },  // Middle column
    '2,5,8': { x1: 250, y1: 18, x2: 250, y2: 282 },  // Right column
    '0,4,8': { x1: 22, y1: 22, x2: 278, y2: 278 },    // Diagonal top-left to bottom-right
    '2,4,6': { x1: 278, y1: 22, x2: 22, y2: 278 }     // Diagonal top-right to bottom-left
  };

  /**
   * Renders the animated cut-through SVG line connecting winning cells.
   */
  function _renderWinLineSvg(winLine, winner) {
    if (!winLine || winLine.length < 3) return '';
    var key = winLine.slice().sort(function (a, b) { return a - b; }).join(',');
    var c = WIN_LINE_COORDS[key];
    if (!c) return '';

    var colorClass = (winner === 'O') ? 'line-o' : 'line-x';

    return '<svg class="ttt-win-line-svg ' + colorClass + '" viewBox="0 0 300 300" aria-hidden="true">' +
      '<line class="ttt-win-line-glow" x1="' + c.x1 + '" y1="' + c.y1 + '" x2="' + c.x2 + '" y2="' + c.y2 + '" pathLength="100" />' +
      '<line class="ttt-win-line-core" x1="' + c.x1 + '" y1="' + c.y1 + '" x2="' + c.x2 + '" y2="' + c.y2 + '" pathLength="100" />' +
    '</svg>';
  }

  /**
   * Renders the 3×3 mahogany wooden board and cells with winning cut-through line.
   */
  function _renderBoard(ttt, isMyTurn) {
    var boardHtml = '<div class="ttt-board" id="tttBoard">';
    for (var i = 0; i < 9; i++) {
      var cell = ttt.board[i];
      var isWinCell = ttt.winLine && ttt.winLine.indexOf(i) !== -1;
      var cellClass = 'ttt-cell' +
        (isWinCell ? ' ttt-win-cell' : '') +
        (!cell && isMyTurn ? ' ttt-droppable' : '') +
        (cell ? ' ttt-cell-filled' : '');

      boardHtml += '<div class="' + cellClass + '"' +
        ' data-action="tttCellTap" data-idx="' + i + '"' +
        ' data-droptarget="true">';
      if (cell) {
        boardHtml += '<span class="ttt-piece ' + (cell === 'X' ? 'ttt-x' : 'ttt-o') + '">' +
          (cell === 'X' ? '✕' : '◯') +
        '</span>';
      } else if (isMyTurn) {
        boardHtml += '<span class="ttt-cell-ghost"></span>';
      }
      boardHtml += '</div>';
    }

    /* Immediately draw the smooth cut-through winning line when win is detected */
    if (ttt.winner && ttt.winLine) {
      boardHtml += _renderWinLineSvg(ttt.winLine, ttt.winner);
    }

    boardHtml += '</div>';
    return boardHtml;
  }

  /**
   * Renders the draggable piece token in the tray.
   * Requirement: "button se grag text nikal do bas X rkho" — only piece symbol rendered, zero drag text!
   */
  function _renderPieceTray(ttt, mySymbol, isMyTurn) {
    if (ttt.winner || ttt.isDraw) return '';

    var pieceSymbol = (mySymbol === 'X') ? '✕' : '◯';
    var pieceClass = (mySymbol === 'X') ? 'ttt-x' : 'ttt-o';

    return '<div class="ttt-tray">' +
      '<div class="ttt-tray-instruction">' +
        (isMyTurn
          ? 'Apna piece kisi bhi khali jagah par rakho'
          : (ttt.isSolo ? 'AI khel raha hai...' : 'Partner ka intezar karein...')) +
      '</div>' +
      '<div class="ttt-tray-tokens">' +
        '<div class="ttt-tray-token ' + (isMyTurn ? 'ttt-token-draggable' : 'ttt-token-inactive') + '" id="tttDragToken" title="Tap ya drag karke board par rakhein">' +
          '<span class="ttt-piece ' + pieceClass + ' ttt-piece-lg">' + pieceSymbol + '</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /**
   * Renders celebratory win/draw popup modal with sprinkler canvas,
   * detailed winner/loser breakdown, and Retry/Exit buttons.
   */
  function _renderCelebrationModal(ttt, mySymbol, canReset) {
    if (!ttt.winner && !ttt.isDraw) return '';

    var TTT = global.JodiTTT;
    var res = TTT.getGameResult(ttt);
    if (!res) return '';

    var isDraw = res.isDraw;
    var winnerSym = res.winner;
    var loserSym = res.loser;

    /* Winner & Loser details */
    var detailsHtml = '';
    if (isDraw) {
      detailsHtml = '<div class="ttt-duo-result">' +
        '<div class="ttt-result-card draw-card">' +
          '<div class="ttt-card-badge">🤝 Barabar</div>' +
          '<div class="ttt-card-player-name">Dono Barabar Takkar!</div>' +
          '<div class="ttt-card-note">' + esc(res.loserNote) + '</div>' +
        '</div>' +
      '</div>';
    } else {
      var winnerSymBadge = winnerSym === 'X' ? '<span class="badge-sym x">✕</span>' : '<span class="badge-sym o">◯</span>';
      var loserSymBadge = loserSym === 'X' ? '<span class="badge-sym x">✕</span>' : '<span class="badge-sym o">◯</span>';

      detailsHtml = '<div class="ttt-duo-result">' +
        /* Winner card */
        '<div class="ttt-result-card winner-card">' +
          '<div class="ttt-card-badge">🥇 Winner</div>' +
          '<div class="ttt-card-player-row">' +
            winnerSymBadge +
            '<span class="ttt-card-player-name">' + esc(res.winnerName) + '</span>' +
          '</div>' +
          '<div class="ttt-card-score-tag">Jeet Gaye 🎉</div>' +
        '</div>' +
        /* Loser card */
        '<div class="ttt-result-card loser-card">' +
          '<div class="ttt-card-badge">🥈 Runner-up</div>' +
          '<div class="ttt-card-player-row">' +
            loserSymBadge +
            '<span class="ttt-card-player-name">' + esc(res.loserName) + '</span>' +
          '</div>' +
          '<div class="ttt-card-note">' + esc(res.loserNote) + '</div>' +
        '</div>' +
      '</div>';
    }

    /* Overall score summary pill */
    var scoreSummaryHtml = '<div class="ttt-popup-score-pill">' +
      '<span>Round ' + ttt.roundCount + '</span>' +
      '<span class="dot">•</span>' +
      '<span>✕: <b>' + ttt.scores.X + '</b></span>' +
      '<span class="dot">•</span>' +
      '<span>◯: <b>' + ttt.scores.O + '</b></span>' +
      '<span class="dot">•</span>' +
      '<span>🤝: <b>' + ttt.scores.draws + '</b></span>' +
    '</div>';

    /* Action buttons: Retry & Exit */
    var actionsHtml = '<div class="ttt-popup-actions">' +
      (canReset
        ? '<button class="btn gold ttt-popup-btn ttt-retry-btn" data-action="tttPlayAgain">Dobara Khelo 🔄</button>'
        : '<div class="ttt-wait-host-pill">Host agla round shuru karega ⏳</div>') +
      '<button class="btn ghost ttt-popup-btn ttt-exit-btn" data-action="tttLeave">Exit 🏠</button>' +
    '</div>';

    return '<div class="ttt-celebration-backdrop" id="tttCelebrationModal">' +
      '<canvas class="ttt-sprinkler-canvas" id="tttSprinklerCanvas"></canvas>' +
      '<div class="ttt-win-popup-sheet">' +
        '<div class="ttt-win-badge">' + res.icon + '</div>' +
        '<h2 class="ttt-win-title">' + esc(res.headline) + '</h2>' +
        '<p class="ttt-win-subtitle">' + esc(res.subtext) + '</p>' +
        detailsHtml +
        scoreSummaryHtml +
        actionsHtml +
      '</div>' +
    '</div>';
  }

  /* ═══════════════════════════════════════════════════════════════
   * 3. Main Screen View (DIP: Coordinates Components)
   * ═══════════════════════════════════════════════════════════════ */
  function vGame() {
    var c = getCtx();
    var ttt = c.state.ttt;
    if (!ttt) return '<section class="screen"></section>';

    var Net = c.Net || global.JodiNet;
    var isConnected = Net && Net.getStatus() === 'connected';
    var mySymbol = ttt.mySymbol || 'X';
    var isMyTurn = (ttt.currentPlayer === mySymbol && !ttt.winner && !ttt.isDraw);
    var canReset = ttt.isSolo || (isConnected && Net.isHostUser());

    var Lobby = global.JodiLobby;
    var headerHtml = Lobby ? Lobby.renderHeader() : '';

    var scoreboardHtml = _renderScoreboard(ttt, mySymbol);
    var statusHtml = _renderStatusBanner(ttt, isMyTurn);
    var boardHtml = _renderBoard(ttt, isMyTurn);
    var trayHtml = _renderPieceTray(ttt, mySymbol, isMyTurn);
    var modalHtml = _renderCelebrationModal(ttt, mySymbol, canReset);

    return '<section class="screen ttt-screen">' +
      headerHtml +
      '<div class="ttt-container">' +
        scoreboardHtml +
        statusHtml +
        '<div class="ttt-board-wrap">' +
          '<div class="ttt-wood-frame">' +
            boardHtml +
          '</div>' +
        '</div>' +
        trayHtml +
      '</div>' +
      modalHtml +
    '</section>';
  }

  /* ═══════════════════════════════════════════════════════════════
   * 4. Drag & Drop Controller (SRP: Isolated Drag Lifecycle)
   * ═══════════════════════════════════════════════════════════════ */
  function bindBoardEvents() {
    _cleanupDragListeners();

    var c = getCtx();
    var ttt = c.state && c.state.ttt;

    // Trigger celebratory upward sprinkler fountain when win popup enters
    if (ttt && ttt.winner) {
      var canvas = document.getElementById('tttSprinklerCanvas');
      if (canvas && global.JodiTTTFx && global.JodiTTTFx.startSprinkler) {
        setTimeout(function () {
          var curTTT = c.state && c.state.ttt;
          if (curTTT && curTTT.winner) {
            global.JodiTTTFx.startSprinkler(canvas, 3600);
          }
        }, 500);
      }
    } else {
      if (global.JodiTTTFx && global.JodiTTTFx.stopSprinkler) {
        global.JodiTTTFx.stopSprinkler();
      }
    }

    var token = document.getElementById('tttDragToken');
    if (!token || !token.classList.contains('ttt-token-draggable')) return;

    /* Touch drag */
    token.addEventListener('touchstart', _onTokenTouchStart, { passive: false });

    _docTouchMove = function (e) {
      if (!_isDragging || !_ghost) return;
      e.preventDefault();
      var t = e.touches[0];
      _positionGhost(t.clientX, t.clientY);
    };
    _docTouchEnd = function (e) {
      if (!_isDragging) return;
      var t = e.changedTouches[0];
      _finishDrag(t.clientX, t.clientY);
    };
    document.addEventListener('touchmove', _docTouchMove, { passive: false });
    document.addEventListener('touchend', _docTouchEnd, { passive: false });

    /* Mouse drag */
    token.addEventListener('mousedown', _onTokenMouseDown);
  }

  function _onTokenTouchStart(e) {
    e.preventDefault();
    var t = e.touches[0];
    _startDrag(t.clientX, t.clientY, this);
  }

  function _onTokenMouseDown(e) {
    e.preventDefault();
    _startDrag(e.clientX, e.clientY, this);

    _docMouseMove = function (e2) {
      if (!_isDragging || !_ghost) return;
      _positionGhost(e2.clientX, e2.clientY);
    };
    _docMouseUp = function (e2) {
      if (!_isDragging) return;
      _finishDrag(e2.clientX, e2.clientY);
      document.removeEventListener('mousemove', _docMouseMove);
      document.removeEventListener('mouseup', _docMouseUp);
    };
    document.addEventListener('mousemove', _docMouseMove);
    document.addEventListener('mouseup', _docMouseUp);
  }

  function _startDrag(x, y, sourceEl) {
    _isDragging = true;
    _ghost = document.createElement('div');
    _ghost.className = 'ttt-drag-ghost';
    _ghost.innerHTML = sourceEl.innerHTML;
    document.body.appendChild(_ghost);
    _positionGhost(x, y);
    var c = getCtx();
    if (c.Audio && c.Audio.playTap) c.Audio.playTap();
  }

  function _positionGhost(x, y) {
    if (!_ghost) return;
    _ghost.style.left = (x - 36) + 'px';
    _ghost.style.top = (y - 36) + 'px';
  }

  function _finishDrag(x, y) {
    _isDragging = false;
    if (_ghost) { _ghost.remove(); _ghost = null; }

    var el = document.elementFromPoint(x, y);
    if (el) {
      var cell = el.closest('[data-droptarget]');
      if (cell && cell.dataset.idx !== undefined) {
        _placeMove(+cell.dataset.idx);
      }
    }
  }

  function _cleanupDragListeners() {
    _isDragging = false;
    if (_ghost) { _ghost.remove(); _ghost = null; }
    if (_docTouchMove) document.removeEventListener('touchmove', _docTouchMove);
    if (_docTouchEnd) document.removeEventListener('touchend', _docTouchEnd);
    if (_docMouseMove) document.removeEventListener('mousemove', _docMouseMove);
    if (_docMouseUp) document.removeEventListener('mouseup', _docMouseUp);
    _docTouchMove = _docTouchEnd = _docMouseMove = _docMouseUp = null;
  }

  /* ═══════════════════════════════════════════════════════════════
   * 5. Move Execution & Orchestration (SRP: Turn Lifecycle)
   * ═══════════════════════════════════════════════════════════════ */
  function _placeMove(idx) {
    var c = getCtx();
    var state = c.state;
    var ttt = state && state.ttt;
    if (!ttt) return;

    var TTT = global.JodiTTT;
    var Net = c.Net || global.JodiNet;
    var isConnected = Net && Net.getStatus() === 'connected';
    var mySymbol = ttt.mySymbol || 'X';

    // Guard: Turn validation
    if (ttt.currentPlayer !== mySymbol || ttt.winner || ttt.isDraw) return;
    if (ttt.board[idx] !== null) return;

    var newGame = TTT.makeMove(ttt, idx);
    if (!newGame) return;

    // Update cumulative scores
    if (newGame.winner) {
      newGame.scores = {
        X: ttt.scores.X + (newGame.winner === 'X' ? 1 : 0),
        O: ttt.scores.O + (newGame.winner === 'O' ? 1 : 0),
        draws: ttt.scores.draws
      };
    } else if (newGame.isDraw) {
      newGame.scores = {
        X: ttt.scores.X,
        O: ttt.scores.O,
        draws: ttt.scores.draws + 1
      };
    }

    state.ttt = newGame;

    if (c.Audio) {
      if (newGame.winner) {
        c.Audio.playMatch();
      } else if (newGame.isDraw) {
        if (c.Audio.playChime) c.Audio.playChime();
        else c.Audio.playTap();
      } else {
        c.Audio.playTap();
      }
    }

    // Sync across network for multiplayer
    if (isConnected) {
      Net.send('TTT_MOVE', { idx: idx, player: mySymbol, scores: newGame.scores });
    }

    if (c.render) c.render();

    // Schedule AI response move in solo mode
    if (newGame.isSolo && !newGame.winner && !newGame.isDraw) {
      _scheduleAIMove();
    }
  }

  function _scheduleAIMove() {
    var delay = 460 + Math.floor(Math.random() * 320);
    setTimeout(function () {
      var c = getCtx();
      var state = c.state;
      var ttt = state && state.ttt;
      if (!ttt || !ttt.isSolo || ttt.winner || ttt.isDraw) return;
      if (ttt.currentPlayer !== ttt.aiSymbol) return;

      var TTT = global.JodiTTT;
      var aiIdx = TTT.getAIMove(ttt.board.slice(), ttt.aiSymbol);
      var afterAI = TTT.makeMove(ttt, aiIdx);
      if (!afterAI) return;

      if (afterAI.winner) {
        afterAI.scores = {
          X: ttt.scores.X + (afterAI.winner === 'X' ? 1 : 0),
          O: ttt.scores.O + (afterAI.winner === 'O' ? 1 : 0),
          draws: ttt.scores.draws
        };
      } else if (afterAI.isDraw) {
        afterAI.scores = {
          X: ttt.scores.X,
          O: ttt.scores.O,
          draws: ttt.scores.draws + 1
        };
      }

      state.ttt = afterAI;

      if (c.Audio) {
        if (afterAI.winner) {
          c.Audio.playMiss();
        } else if (afterAI.isDraw) {
          if (c.Audio.playChime) c.Audio.playChime();
          else c.Audio.playTap();
        } else {
          c.Audio.playTap();
        }
      }

      if (c.render) c.render();
    }, delay);
  }

  /* ═══════════════════════════════════════════════════════════════
   * 6. Reset & Round Transitions
   * ═══════════════════════════════════════════════════════════════ */
  function resetRound(preserveScores) {
    var c = getCtx();
    var state = c.state;
    var ttt = state && state.ttt;
    if (!ttt) return;

    if (global.JodiTTTFx && global.JodiTTTFx.stopSprinkler) {
      global.JodiTTTFx.stopSprinkler();
    }

    var prevScores = preserveScores ? ttt.scores : { X: 0, O: 0, draws: 0 };
    var roundCount = preserveScores ? ttt.roundCount + 1 : 1;

    var TTT = global.JodiTTT;
    var nextFirst = (ttt.currentPlayer === 'X') ? 'O' : 'X'; // Alternating starter

    var newGame = TTT.createGame({
      firstPlayer: nextFirst,
      hostSymbol: ttt.hostSymbol,
      guestSymbol: ttt.guestSymbol,
      isSolo: ttt.isSolo,
      mySymbol: ttt.mySymbol,
      aiSymbol: ttt.aiSymbol,
      hostName: ttt.hostName,
      guestName: ttt.guestName,
      scores: prevScores,
      roundCount: roundCount
    });

    state.ttt = newGame;
    if (c.Audio && c.Audio.playTap) c.Audio.playTap();
    if (c.render) c.render();

    // If AI starts the round in solo mode
    if (newGame.isSolo && newGame.currentPlayer === newGame.aiSymbol) {
      _scheduleAIMove();
    }
  }

  function cleanup() {
    _cleanupDragListeners();
    if (global.JodiTTTFx && global.JodiTTTFx.stopSprinkler) {
      global.JodiTTTFx.stopSprinkler();
    }
  }

  /* ═══════════════════════════════════════════════════════════════
   * 7. Public API Contract
   * ═══════════════════════════════════════════════════════════════ */
  global.JodiTTTUI = {
    init: init,
    vGame: vGame,
    bindBoardEvents: bindBoardEvents,
    launchSolo: launchSolo,
    resetRound: resetRound,
    handleCellTap: _placeMove,
    cleanup: cleanup
  };

})(window);
