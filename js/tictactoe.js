/* Jodi Sync — Tic-Tac-Toe Domain Engine & AI
 * SOLID Architecture:
 * - Single Responsibility: Board state machine, win evaluation, outcome computation, and Minimax strategy.
 * - Open/Closed: AI strategy is decoupled and pluggable.
 * - Liskov Substitution: All move producers interact through the immutable makeMove contract.
 * - Interface Segregation: Focused, clean API for state creation, transitions, and result evaluation.
 * - Zero DOM / Zero Side Effects: Pure business logic.
 * Exposes: window.JodiTTT, window.JodiTTTEngine, window.JodiTTTAI
 */
(function (global) {
  'use strict';

  /** 8 standard winning line permutations (3 rows, 3 cols, 2 diagonals) */
  var WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],   // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8],   // columns
    [0, 4, 8], [2, 4, 6]               // diagonals
  ];

  /* ═══════════════════════════════════════════════════════════════
   * 1. Pure Game Engine (SRP: State Transitions & Rules)
   * ═══════════════════════════════════════════════════════════════ */
  var Engine = {
    /**
     * Create a fresh, immutable-friendly game state.
     * @param {object} [opts]
     */
    createGame: function (opts) {
      opts = opts || {};
      return {
        board: [null, null, null, null, null, null, null, null, null],
        currentPlayer: opts.firstPlayer || 'X',
        hostSymbol: opts.hostSymbol || 'X',
        guestSymbol: opts.guestSymbol || 'O',
        winner: null,
        winLine: null,
        isDraw: false,
        moveCount: 0,
        isSolo: !!opts.isSolo,
        mySymbol: opts.mySymbol || 'X',
        aiSymbol: opts.aiSymbol || (opts.isSolo ? 'O' : null),
        scores: opts.scores || { X: 0, O: 0, draws: 0 },
        roundCount: opts.roundCount || 1,
        hostName: opts.hostName || 'Player 1',
        guestName: opts.guestName || (opts.isSolo ? 'AI Opponent' : 'Player 2')
      };
    },

    /**
     * Apply move at idx. Returns a new immutable game state object,
     * or null if the move is invalid / game already ended.
     */
    makeMove: function (game, idx) {
      if (!game || game.board[idx] !== null || game.winner || game.isDraw) {
        return null;
      }

      var newBoard = game.board.slice();
      newBoard[idx] = game.currentPlayer;

      var winResult = this.checkWinner(newBoard);
      var draw = !winResult && newBoard.every(function (c) { return c !== null; });

      return {
        board: newBoard,
        currentPlayer: game.currentPlayer === 'X' ? 'O' : 'X',
        hostSymbol: game.hostSymbol,
        guestSymbol: game.guestSymbol,
        winner: winResult ? winResult.winner : null,
        winLine: winResult ? winResult.line : null,
        isDraw: draw,
        moveCount: game.moveCount + 1,
        isSolo: game.isSolo,
        mySymbol: game.mySymbol,
        aiSymbol: game.aiSymbol,
        scores: game.scores,
        roundCount: game.roundCount,
        hostName: game.hostName,
        guestName: game.guestName
      };
    },

    /**
     * Check for a 3-in-a-row winning line on the board.
     * @param {Array} board - 9-element array of 'X', 'O', or null
     * @returns {{ winner: string, line: number[] } | null}
     */
    checkWinner: function (board) {
      for (var i = 0; i < WIN_LINES.length; i++) {
        var l = WIN_LINES[i];
        var a = board[l[0]], b = board[l[1]], c = board[l[2]];
        if (a && a === b && b === c) {
          return { winner: a, line: l };
        }
      }
      return null;
    },

    /**
     * Determine if board has reached a draw state.
     */
    isDraw: function (board) {
      return !this.checkWinner(board) && board.every(function (c) { return c !== null; });
    },

    /**
     * Calculate rich game result metadata (Who won, who lost, celebratory titles).
     * Decouples the presentation layer from business logic formatting.
     * @param {object} game
     * @returns {object|null}
     */
    getGameResult: function (game) {
      if (!game || (!game.winner && !game.isDraw)) return null;

      var mySymbol = game.mySymbol || 'X';
      var isSolo = !!game.isSolo;

      if (game.isDraw) {
        return {
          isDraw: true,
          winner: null,
          loser: null,
          winnerName: null,
          loserName: null,
          wonByMe: false,
          headline: 'Barabar! 🤝',
          subtext: 'Dono ne kamaal ka khela! Kadi takkar thi.',
          loserNote: 'Agla round faisla karega ki kaun champion hai!',
          icon: '🤝'
        };
      }

      var winnerSym = game.winner;
      var loserSym = winnerSym === 'X' ? 'O' : 'X';
      var wonByMe = (winnerSym === mySymbol);

      var hostName = game.hostName || 'Aap';
      var guestName = isSolo ? 'AI Opponent' : (game.guestName || 'Partner');

      var winnerName = '';
      var loserName = '';

      if (isSolo) {
        if (wonByMe) {
          winnerName = hostName;
          loserName = 'AI Opponent';
        } else {
          winnerName = 'AI Opponent';
          loserName = hostName;
        }
      } else {
        // Multiplayer: Host is X, Guest is O
        winnerName = (winnerSym === game.hostSymbol) ? hostName : guestName;
        loserName = (winnerSym === game.hostSymbol) ? guestName : hostName;
      }

      var headline = '';
      var subtext = '';
      var loserNote = '';

      if (isSolo) {
        if (wonByMe) {
          headline = 'Badhaai Ho! Aap Jeet Gaye! 🏆';
          subtext = winnerName + ' ne AI ko maat de di!';
          loserNote = 'AI is round me haar gaya. Shandaar chaal!';
        } else {
          headline = 'AI Jeet Gaya! 🤖';
          subtext = 'AI ne 3-in-a-row bana liya!';
          loserNote = 'Koyi baat nahi! Dobara khel kar badla lo 💪';
        }
      } else {
        if (wonByMe) {
          headline = 'Badhaai Ho! Aap Jeet Gaye! 🏆';
          subtext = winnerName + ' ne round apne naam kiya!';
          loserNote = loserName + ' is round me haare, par agle round me takkar hogi!';
        } else {
          headline = winnerName + ' Jeet Gaye! 🏆';
          subtext = winnerName + ' ne shaandar baazi maari!';
          loserNote = 'Aap is round me haare, lekin haar mat maano — badla lo! 🔥';
        }
      }

      return {
        isDraw: false,
        winner: winnerSym,
        loser: loserSym,
        winnerName: winnerName,
        loserName: loserName,
        wonByMe: wonByMe,
        headline: headline,
        subtext: subtext,
        loserNote: loserNote,
        icon: wonByMe ? '🏆' : (isSolo ? '🤖' : '🎉')
      };
    }
  };

  /* ═══════════════════════════════════════════════════════════════
   * 2. AI Strategy Engine (SRP: Heuristic & Minimax Decision Making)
   * ═══════════════════════════════════════════════════════════════ */
  var AI = {
    _minimax: function (board, depth, isMaximizing, aiSym, humanSym) {
      var result = Engine.checkWinner(board);
      if (result) {
        return result.winner === aiSym ? (10 - depth) : (depth - 10);
      }
      if (Engine.isDraw(board)) return 0;

      var best = isMaximizing ? -Infinity : Infinity;
      for (var i = 0; i < 9; i++) {
        if (!board[i]) {
          board[i] = isMaximizing ? aiSym : humanSym;
          var score = this._minimax(board, depth + 1, !isMaximizing, aiSym, humanSym);
          board[i] = null;
          best = isMaximizing ? Math.max(best, score) : Math.min(best, score);
        }
      }
      return best;
    },

    /**
     * Compute best cell index for AI move.
     * Incorporates opening variety to feel organic and non-robotic.
     * @param {Array} board
     * @param {string} aiSym
     * @returns {number}
     */
    getBestMove: function (board, aiSym) {
      var humanSym = aiSym === 'X' ? 'O' : 'X';
      var empty = [];
      for (var i = 0; i < 9; i++) {
        if (!board[i]) empty.push(i);
      }

      if (empty.length === 0) return 0;

      // Opening variety: center or random corner
      if (empty.length === 9) return 4;
      if (empty.length === 8 && board[4] !== null) {
        var corners = [0, 2, 6, 8];
        return corners[Math.floor(Math.random() * corners.length)];
      }

      var bestScore = -Infinity;
      var bestMove = empty[0];

      for (var j = 0; j < empty.length; j++) {
        var idx = empty[j];
        board[idx] = aiSym;
        var s = this._minimax(board, 0, false, aiSym, humanSym);
        board[idx] = null;
        if (s > bestScore) {
          bestScore = s;
          bestMove = idx;
        }
      }
      return bestMove;
    }
  };

  /* ═══════════════════════════════════════════════════════════════
   * 3. Public API Facade (Backward Compatible)
   * ═══════════════════════════════════════════════════════════════ */
  global.JodiTTTEngine = Engine;
  global.JodiTTTAI = AI;

  global.JodiTTT = {
    createGame: function (opts) { return Engine.createGame(opts); },
    makeMove: function (game, idx) { return Engine.makeMove(game, idx); },
    checkWinner: function (board) { return Engine.checkWinner(board); },
    isDraw: function (board) { return Engine.isDraw(board); },
    getGameResult: function (game) { return Engine.getGameResult(game); },
    getAIMove: function (board, aiSym) { return AI.getBestMove(board, aiSym); }
  };

})(window);
