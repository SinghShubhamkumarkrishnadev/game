/* Two Minds, One Word (Do Dil, Ek Shabd) - Cooperative Word Puzzle Engine */
(function (global) {
  'use strict';

  /* Curated Rich Database for Indian Couples & Universal Themes */
  var PUZZLE_DICTIONARY = [
    // Food & Drinks
    { answer: 'CHAI', category: 'Food & Drinks', length: 4, clueA: 'Steaming hot, often poured into earthen kulhads', clueB: 'Morning wake-up ritual infused with adrak & elaichi', prompt: 'Your favorite rainy afternoon companion' },
    { answer: 'SAMOSA', category: 'Food & Drinks', length: 6, clueA: 'Crispy golden triangle pastry with savory filling', clueB: 'Best enjoyed with tangy green mint & imli chutney', prompt: 'The classic evening snack debate' },
    { answer: 'JALEBI', category: 'Food & Drinks', length: 6, clueA: 'Orange spiral sweet soaked in aromatic sugar syrup', clueB: 'Pairs heavenly with cold creamy rabri on cold nights', prompt: 'Sunday morning indulgence together' },
    { answer: 'DOSA', category: 'Food & Drinks', length: 4, clueA: 'Crispy paper-thin fermented crepe cooked on a tawa', clueB: 'Served sizzling hot with coconut chutney and sambar', prompt: 'Late weekend breakfast favorite' },
    { answer: 'BIRYANI', category: 'Food & Drinks', length: 7, clueA: 'Fragrant layered rice cooked in dum with saffron', clueB: 'Garnished with caramelized onions, served with raita', prompt: 'The ultimate royal feast dinner' },
    { answer: 'KULFI', category: 'Food & Drinks', length: 5, clueA: 'Dense frozen traditional dessert on a wooden stick', clueB: 'Flavored with kesar, pista, and rich reduced milk', prompt: 'Post-dinner sweet walk delight' },
    { answer: 'PANI PURI', category: 'Food & Drinks', length: 8, clueA: 'Hollow crisp puris filled with spiced potatoes', clueB: 'Dunked in fiery chilled mint & tangy sweet tamarind water', prompt: 'Who can eat more in one round?' },
    { answer: 'ROTI', category: 'Food & Drinks', length: 4, clueA: 'Round flatbread made with whole wheat flour', clueB: 'Puffs up on the flame, finished with golden desi ghee', prompt: 'Deciding who makes the perfectly round ones' },
    { answer: 'LADDU', category: 'Food & Drinks', length: 5, clueA: 'Traditional spherical sweet offered during celebrations', clueB: 'Golden yellow boondi or besan bound with warm ghee', prompt: 'Festive sweetness in every bite' },
    { answer: 'PIZZA', category: 'Food & Drinks', length: 5, clueA: 'Cheesy Italian classic baked with savory crust', clueB: 'Loaded with melted mozzarella and sliced toppings', prompt: 'Late-night Friday movie night binge' },
    { answer: 'HALWA', category: 'Food & Drinks', length: 5, clueA: 'Warm dessert prepared with gajar, suji, or moong dal', clueB: 'Cooked slowly with milk, sugar, and toasted cashews', prompt: 'Winter warmth in a bowl' },
    { answer: 'COFFEE', category: 'Food & Drinks', length: 6, clueA: 'Dark aromatic roasted beans brewed into rich comfort', clueB: 'Frothy filter kaapi or velvety latte with cocoa art', prompt: 'Cozy cafe date conversation' },
    { answer: 'MANGO', category: 'Food & Drinks', length: 5, clueA: 'King of fruits with vibrant golden pulp', clueB: 'Sweet Alphonso or Dasheri summer obsession', prompt: 'Waiting all year for this fruit season' },

    // Couples, Romance & Intimacy
    { answer: 'TRUST', category: 'Couples & Love', length: 5, clueA: 'The bedrock of any deep and lasting bond', clueB: 'Takes years to build, makes you feel completely safe', prompt: 'The quiet anchor of your relationship' },
    { answer: 'SMILE', category: 'Couples & Love', length: 5, clueA: 'The curved expression that brightens another person\'s day', clueB: 'What happens naturally whenever your partner walks in', prompt: 'The sweetest thing about your favorite person' },
    { answer: 'SECRET', category: 'Couples & Love', length: 6, clueA: 'Something only the two of you whisper and know', clueB: 'Shared under the blanket, kept safe from the world', prompt: 'Your sacred private code' },
    { answer: 'HUGS', category: 'Couples & Love', length: 4, clueA: 'Warm tight embrace that melts away a long tired day', clueB: 'Arms wrapped around each other with no words needed', prompt: 'Instant remedy for any bad mood' },
    { answer: 'HEART', category: 'Couples & Love', length: 5, clueA: 'The rhythm inside that beats a little faster for you', clueB: 'Universal symbol of deep affection and love', prompt: 'Where all the love is kept safe' },
    { answer: 'DREAMS', category: 'Couples & Love', length: 6, clueA: 'Visions of the future built side by side', clueB: 'Late night talks about where you both want to be', prompt: 'Building a shared tomorrow' },
    { answer: 'PROMISE', category: 'Couples & Love', length: 7, clueA: 'A heartfelt commitment kept through thick and thin', clueB: 'A gentle vow spoken from one soul to another', prompt: 'Always standing by each other\'s side' },
    { answer: 'WARMTH', category: 'Couples & Love', length: 6, clueA: 'Gentle cozy comfort on a chilly windy evening', clueB: 'The feeling of holding hands under the table', prompt: 'Cozy contentment in each other\'s arms' },
    { answer: 'LAUGH', category: 'Couples & Love', length: 5, clueA: 'Spontaneous joyful sound after an inside joke', clueB: 'Uncontrollable giggles over silly everyday mistakes', prompt: 'The sound that makes home feel like home' },
    { answer: 'DINNER', category: 'Couples & Love', length: 6, clueA: 'Evening meal under candle lights and soft music', clueB: 'Table set for two, clinking glasses and talking for hours', prompt: 'The classic romantic date night' },
    { answer: 'CANDLE', category: 'Couples & Love', length: 6, clueA: 'Flickering warm flame that casts soft romantic shadows', clueB: 'Wax cylinder with a wick, creates an intimate vibe', prompt: 'Mood lighting for special moments' },

    // Travel & Outing
    { answer: 'TRAIN', category: 'Travel & Outing', length: 5, clueA: 'Long metallic carrier gliding on parallel railway tracks', clueB: 'Window seat, chai vendors calling, scenic countryside', prompt: 'Nostalgic journeys across the country' },
    { answer: 'BEACH', category: 'Travel & Outing', length: 5, clueA: 'Sandy shore where foamy ocean waves crash gently', clueB: 'Walking barefoot at sunset, collecting seashells', prompt: 'A relaxing coastal escape together' },
    { answer: 'SUNSET', category: 'Travel & Outing', length: 6, clueA: 'The magical golden hour when day turns into evening', clueB: 'Sky painted in shades of orange, purple, and crimson', prompt: 'Pausing together to watch the sun go down' },
    { answer: 'PICNIC', category: 'Travel & Outing', length: 6, clueA: 'Outdoor meal packed in a basket on lush green grass', clueB: 'Under shady trees, sharing sandwiches and laughter', prompt: 'A sunny afternoon date in the park' },
    { answer: 'DRIVE', category: 'Travel & Outing', length: 5, clueA: 'Cruising down open highways with your favorite playlist', clueB: 'Hands out the car window, catching cool breeze', prompt: 'Late night spontaneous highway drive' },
    { answer: 'RESORT', category: 'Travel & Outing', length: 6, clueA: 'Luxurious getaway stay with pools, gardens, and spa', clueB: 'Peaceful weekend vacation far away from office hustle', prompt: 'A much-needed couples holiday' },
    { answer: 'ISLAND', category: 'Travel & Outing', length: 6, clueA: 'Land surrounded entirely by clear turquoise water', clueB: 'Tropical retreat like Havelock, Bali, or Maldives', prompt: 'Dream honeymoon destination' },
    { answer: 'MOUNTAIN', category: 'Travel & Outing', length: 8, clueA: 'Majestic snowy peaks rising high into misty clouds', clueB: 'Pine trees, winding roads, and chilly mountain breeze', prompt: 'Escaping the summer heat together' },
    { answer: 'STATION', category: 'Travel & Outing', length: 7, clueA: 'Bustling arrival and departure hub filled with travelers', clueB: 'Platforms, ticket counters, and emotional reunions', prompt: 'Meeting your partner after long distance days' },

    // Daily Life & Cozy Rituals
    { answer: 'BALCONY', category: 'Daily Life', length: 7, clueA: 'Elevated outdoor terrace attached to the apartment', clueB: 'Where potted plants grow and evening chai is enjoyed', prompt: 'Your quiet sunset corner at home' },
    { answer: 'BLANKET', category: 'Daily Life', length: 7, clueA: 'Cozy woolen or fleece covering for chilly nights', clueB: 'Playfully fighting over who stole more of the sheets', prompt: 'Tucking in together when winter arrives' },
    { answer: 'COUCH', category: 'Daily Life', length: 5, clueA: 'Comfortable living room sofa with soft plush cushions', clueB: 'Where you both crash after work to binge watch series', prompt: 'The epicenter of weekend laziness' },
    { answer: 'MOVIES', category: 'Daily Life', length: 6, clueA: 'Cinematic stories projected with buttered popcorn', clueB: 'Debating for 45 minutes just to pick what to watch', prompt: 'Friday night movie marathon' },
    { answer: 'PILLOW', category: 'Daily Life', length: 6, clueA: 'Soft padded headrest on your bed for restful sleep', clueB: 'Occasionally used in friendly playful bedroom fights', prompt: 'Resting your head after a long conversation' },
    { answer: 'SUNDAY', category: 'Daily Life', length: 6, clueA: 'The most relaxed and carefree day of the week', clueB: 'Late alarms, slow brunch, zero work deadlines', prompt: 'Unwinding with no hurry in the world' },
    { answer: 'MORNING', category: 'Daily Life', length: 7, clueA: 'Early sunrise hours when birds chirp outside', clueB: 'Sleepy eyes, gentle stretching, and first sips of water', prompt: 'Starting the brand new day side by side' },

    // Nature & Animals
    { answer: 'TIGER', category: 'Nature & Animals', length: 5, clueA: 'Apex predator with striped orange and black fur', clueB: 'National animal known for fierce power and mighty roar', prompt: 'The magnificent pride of the forest' },
    { answer: 'PEACOCK', category: 'Nature & Animals', length: 7, clueA: 'Vibrant iridescent bird that dances when rain falls', clueB: 'Feathers shimmer in emerald green and royal blue', prompt: 'Graceful national bird of India' },
    { answer: 'MONSOON', category: 'Nature & Animals', length: 7, clueA: 'Seasonal rainy season bringing petrichor and thunder', clueB: 'Rain splashing on windows, calling for hot pakoras', prompt: 'The most romantic season of the year' },
    { answer: 'BREEZE', category: 'Nature & Animals', length: 6, clueA: 'Gentle soothing wind that rustles the tree leaves', clueB: 'Cools your face pleasantly on warm summer evenings', prompt: 'A breath of fresh evening air' },
    { answer: 'LOTUS', category: 'Nature & Animals', length: 5, clueA: 'Sacred aquatic flower blooming pristine above mud', clueB: 'Symbol of purity with soft pink and white petals', prompt: 'Serene beauty floating on water' },
    { answer: 'RIVER', category: 'Nature & Animals', length: 5, clueA: 'Natural freshwater stream flowing towards the sea', clueB: 'Ganga, Yamuna, or Kaveri winding past ancient ghats', prompt: 'Sitting peacefully by the flowing currents' },
    { answer: 'FOREST', category: 'Nature & Animals', length: 6, clueA: 'Dense green wilderness filled with towering trees', clueB: 'Home to chirping birds, deer, and natural canopies', prompt: 'Exploring peaceful jungle trails' },

    // Culture, Celebrations & Entertainment
    { answer: 'DIWALI', category: 'Celebrations', length: 6, clueA: 'Festival of lights celebrated with earthen diyas', clueB: 'Rangoli decorations, family sweets, and sparkling lights', prompt: 'Lighting lamps and dressing up together' },
    { answer: 'CINEMA', category: 'Celebrations', length: 6, clueA: 'Grand silver screen hall with surround sound speakers', clueB: 'Watching Bollywood blockbusters on premiere nights', prompt: 'Sharing giant tubs of caramel popcorn' },
    { answer: 'DANCE', category: 'Celebrations', length: 5, clueA: 'Rhythmic movement of the body to energetic music', clueB: 'Garba during Navratri or sangeet night choreography', prompt: 'Grooving together without caring who is watching' },
    { answer: 'MUSIC', category: 'Celebrations', length: 5, clueA: 'Harmonious melodies and acoustic tunes for the soul', clueB: 'Old romantic Kishore Kumar songs on car speakers', prompt: 'The soundtrack of your love story' },
    { answer: 'MEHNDI', category: 'Celebrations', length: 6, clueA: 'Traditional herbal henna paste applied on palms', clueB: 'Leaves dark red intricate designs for weddings', prompt: 'Hiding partner\'s initials in the pattern' },
    { answer: 'SWEETS', category: 'Celebrations', length: 6, clueA: 'Mithai box passed around during every happy news', clueB: 'Kaju katli, rasgulla, and motichoor delicacies', prompt: 'Celebrating every small win together' }
  ];

  /* Tutorial / First-Time Demo Puzzle */
  var TUTORIAL_PUZZLE = {
    answer: 'CAT',
    category: 'Animal Companion',
    length: 3,
    clueA: 'Meows softly and loves curling up on your lap',
    clueB: 'Curious feline with whiskers that chases toy mice',
    playerA: ['C', 'T'],
    playerB: ['A'],
    isTutorial: true
  };

  /* Pseudo-Random Seeded Generator for Daily Puzzles */
  function getDailySeed() {
    var d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  function seededRandom(seed) {
    var x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }

  /* Strict Letter Partition Algorithm
   * Rule:
   * 1. Player A must have at least 1 required letter.
   * 2. Player B must have at least 1 required letter.
   * 3. Neither player has all letters needed to solve alone.
   * 4. Letters are balanced roughly 50/50.
   */
  function partitionWord(answer, isHard) {
    var clean = answer.toUpperCase().replace(/[^A-Z]/g, '');
    var letters = clean.split('');
    var n = letters.length;

    // Shuffle indices
    var indices = [];
    for (var i = 0; i < n; i++) indices.push(i);
    for (var j = indices.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var temp = indices[j];
      indices[j] = indices[k];
      indices[k] = temp;
    }

    // Split roughly half
    var half = Math.floor(n / 2);
    if (half < 1) half = 1;
    if (half >= n) half = n - 1;

    var aLetters = [];
    var bLetters = [];

    for (var idx = 0; idx < n; idx++) {
      if (idx < half) {
        aLetters.push(letters[indices[idx]]);
      } else {
        bLetters.push(letters[indices[idx]]);
      }
    }

    // Validation: Guarantee both have letters and neither has complete word
    if (aLetters.length === 0) {
      aLetters.push(bLetters.pop());
    } else if (bLetters.length === 0) {
      bLetters.push(aLetters.pop());
    }

    // Shuffle each rack for display
    aLetters.sort(function () { return 0.5 - Math.random(); });
    bLetters.sort(function () { return 0.5 - Math.random(); });

    // Optional decoy letters in Hard Mode
    if (isHard) {
      var DECOY_POOL = ['X', 'J', 'Q', 'Z', 'K', 'V', 'B', 'P', 'Y'];
      var decoyA = DECOY_POOL[Math.floor(Math.random() * DECOY_POOL.length)];
      var decoyB = DECOY_POOL[Math.floor(Math.random() * DECOY_POOL.length)];
      if (aLetters.indexOf(decoyA) === -1) aLetters.push(decoyA);
      if (bLetters.indexOf(decoyB) === -1) bLetters.push(decoyB);
      aLetters.sort(function () { return 0.5 - Math.random(); });
      bLetters.sort(function () { return 0.5 - Math.random(); });
    }

    return {
      playerA: aLetters,
      playerB: bLetters
    };
  }

  /* Puzzle Deck Builder */
  function getDeck(count, mode) {
    var isDaily = (mode === 'daily');
    var isHard = (mode === 'hard');
    var list = PUZZLE_DICTIONARY.slice(0);

    if (isDaily) {
      var seed = getDailySeed();
      // Select 1 special deterministic daily puzzle
      var idx = Math.floor(seededRandom(seed) * list.length);
      var item = list[idx];
      var part = partitionWord(item.answer, isHard);
      return [{
        answer: item.answer,
        category: item.category,
        length: item.length,
        clueA: item.clueA,
        clueB: item.clueB,
        prompt: item.prompt,
        playerA: part.playerA,
        playerB: part.playerB,
        isDaily: true
      }];
    }

    // Shuffle dictionary
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = list[i];
      list[i] = list[j];
      list[j] = t;
    }

    var selected = list.slice(0, Math.min(count || 10, list.length));
    return selected.map(function (item) {
      var part = partitionWord(item.answer, isHard);
      return {
        answer: item.answer,
        category: item.category,
        length: item.length,
        clueA: item.clueA,
        clueB: item.clueB,
        prompt: item.prompt,
        playerA: part.playerA,
        playerB: part.playerB
      };
    });
  }

  /* Quick Messages Catalog */
  var QUICK_MESSAGES = [
    { text: 'I have this letter! 🔤', type: 'info' },
    { text: 'What letters do you have? 🤔', type: 'ask' },
    { text: 'Try placing your letter! 💡', type: 'hint' },
    { text: 'I think I know the word! ✨', type: 'eureka' },
    { text: 'Need a hint here 🆘', type: 'help' },
    { text: 'Wait, let me think! ✋', type: 'wait' },
    { text: 'Got it! 🎉', type: 'win' },
    { text: 'Arre waah! 💖', type: 'desi' },
    { text: 'Socho socho! 💭', type: 'desi' }
  ];

  /* Active Match Engine */
  var currentMatch = null;

  function createMatch(deck, options) {
    options = options || {};
    var duration = options.duration || 60; // 60s, 45s, 30s
    var mode = options.mode || 'classic'; // 'classic' | 'speed' | 'sync' | 'hard' | 'daily'

    currentMatch = {
      deck: deck,
      mode: mode,
      roundIndex: 0,
      totalRounds: deck.length,
      roundDuration: duration,
      roundEndAt: Date.now() + duration * 1000,
      teamScore: 0,
      comboStreak: 0,
      maxCombo: 0,
      wordsSolved: 0,
      hintsUsed: 0,
      perfectRounds: 0,
      askTokensRemaining: 3,
      solveTimes: [],
      roundStartTime: Date.now(),
      attemptCount: 0,
      hintsActive: {
        firstLetter: false,
        categoryShared: false,
        partnerLetter: false
      },
      // Shared Board Slots: array of { letter, owner: 'host'|'guest', id }
      slots: [],
      // Local player letter items with unique ids
      localRack: [],
      // Status flags
      isSolved: false,
      isTransitioning: false,
      isSolo: !!options.isSolo,
      soloAIInterval: null
    };

    initRound(currentMatch.roundIndex);
    return currentMatch;
  }

  function initRound(roundIdx) {
    if (!currentMatch) return;
    var puzzle = currentMatch.deck[roundIdx];
    if (!puzzle) return;

    currentMatch.roundIndex = roundIdx;
    currentMatch.roundStartTime = Date.now();
    currentMatch.roundEndAt = Date.now() + currentMatch.roundDuration * 1000;
    currentMatch.attemptCount = 0;
    currentMatch.isSolved = false;
    currentMatch.isTransitioning = false;
    currentMatch.hintsActive = {
      firstLetter: false,
      categoryShared: false,
      partnerLetter: false
    };

    // Clean empty slots matching answer length
    var cleanWord = puzzle.answer.replace(/\s/g, '');
    var slots = [];
    for (var i = 0; i < cleanWord.length; i++) {
      slots.push(null);
    }
    currentMatch.slots = slots;
  }

  /* Solo Mode AI Partner Simulator:
   * When playing alone / practicing, the AI partner can chat back,
   * place their letters upon request, or celebrate!
   */
  function setSlots(slots) {
    if (currentMatch) {
      currentMatch.slots = slots || [];
    }
  }

  /* Solo Mode AI Partner Simulator:
   * When playing alone / practicing, the AI partner places their complementary
   * letters periodically (every 4-5s) or upon request, so solo games are fully playable!
   */
  function startSoloAILoop(onUpdate) {
    if (!currentMatch || !currentMatch.isSolo) return;
    stopSoloAILoop();

    currentMatch.soloAIInterval = setInterval(function () {
      if (!currentMatch || currentMatch.isSolved || currentMatch.isTransitioning) return;
      var curPuzzle = currentMatch.deck[currentMatch.roundIndex];
      if (!curPuzzle) return;

      var guestLetters = curPuzzle.playerB || [];
      var cleanAnswer = curPuzzle.answer.replace(/\s/g, '');

      // Find an unplaced guest letter
      for (var i = 0; i < guestLetters.length; i++) {
        var ltr = guestLetters[i];
        var placedCount = currentMatch.slots.filter(function (s) {
          return s && s.letter === ltr && s.owner === 'guest';
        }).length;
        var totalInGuest = guestLetters.filter(function (l) { return l === ltr; }).length;

        if (placedCount < totalInGuest) {
          // Find the matching slot in cleanAnswer
          for (var sIdx = 0; sIdx < cleanAnswer.length; sIdx++) {
            if (cleanAnswer[sIdx] === ltr && !currentMatch.slots[sIdx]) {
              currentMatch.slots[sIdx] = {
                letter: ltr,
                owner: 'guest',
                id: 'guest_' + i + '_' + Date.now()
              };
              if (onUpdate) {
                onUpdate({
                  type: 'ai_letter_placed',
                  letter: ltr,
                  slotIndex: sIdx,
                  slots: currentMatch.slots
                });
              }
              return;
            }
          }
        }
      }
    }, 4500);
  }

  function stopSoloAILoop() {
    if (currentMatch && currentMatch.soloAIInterval) {
      clearInterval(currentMatch.soloAIInterval);
      clearTimeout(currentMatch.soloAIInterval);
      currentMatch.soloAIInterval = null;
    }
  }

  /* Check Solution Logic */
  function verifyWord(overrideSlots) {
    if (!currentMatch) return { isCorrect: false, message: 'No match' };
    var puzzle = currentMatch.deck[currentMatch.roundIndex];
    if (!puzzle) return { isCorrect: false, message: 'No puzzle' };

    var slotsToUse = overrideSlots || currentMatch.slots || [];
    currentMatch.slots = slotsToUse;

    var target = puzzle.answer.toUpperCase().replace(/\s/g, '');
    var assembled = slotsToUse.map(function (s) { return s ? s.letter : ''; }).join('');

    if (assembled.length < target.length) {
      return { isCorrect: false, isIncomplete: true, message: 'Pehle saare akshar bharein!' };
    }

    currentMatch.attemptCount++;

    if (assembled === target) {
      // Calculate Round Score
      var baseScore = 100;
      if (currentMatch.attemptCount === 2) baseScore = 75;
      else if (currentMatch.attemptCount >= 3) baseScore = 50;

      // Speed bonus
      var elapsedSec = Math.floor((Date.now() - currentMatch.roundStartTime) / 1000);
      var timeLeft = Math.max(0, currentMatch.roundDuration - elapsedSec);
      var speedBonus = Math.min(50, Math.floor(timeLeft * 1.2));

      // No-hint bonus
      var hintsCount = 0;
      if (currentMatch.hintsActive.firstLetter) hintsCount++;
      if (currentMatch.hintsActive.categoryShared) hintsCount++;
      if (currentMatch.hintsActive.partnerLetter) hintsCount++;
      var noHintBonus = (hintsCount === 0) ? 25 : 0;

      // Collaboration bonus: Did both players contribute letters?
      var hasHost = slotsToUse.some(function (s) { return s && s.owner === 'host'; });
      var hasGuest = slotsToUse.some(function (s) { return s && s.owner === 'guest'; });
      var collabBonus = (hasHost && hasGuest) ? 25 : (currentMatch.isSolo ? 25 : 10);

      // Combo Streak Multiplier
      currentMatch.comboStreak++;
      if (currentMatch.comboStreak > currentMatch.maxCombo) {
        currentMatch.maxCombo = currentMatch.comboStreak;
      }
      var multiplier = currentMatch.comboStreak >= 3 ? 1.5 : (currentMatch.comboStreak === 2 ? 1.25 : 1.0);

      var roundTotal = Math.round((baseScore + speedBonus + noHintBonus + collabBonus) * multiplier);
      currentMatch.teamScore += roundTotal;
      currentMatch.wordsSolved++;
      currentMatch.solveTimes.push(elapsedSec);
      if (hintsCount === 0 && currentMatch.attemptCount === 1) {
        currentMatch.perfectRounds++;
      }
      currentMatch.isSolved = true;
      currentMatch.isTransitioning = true;

      return {
        isCorrect: true,
        word: puzzle.answer,
        scoreAdded: roundTotal,
        combo: currentMatch.comboStreak,
        elapsedSec: elapsedSec
      };
    } else {
      // Wrong Attempt Penalty
      currentMatch.comboStreak = 0; // Reset streak
      currentMatch.teamScore = Math.max(0, currentMatch.teamScore - 10);
      return {
        isCorrect: false,
        isIncomplete: false,
        message: 'Not quite! Keep working together.',
        attempt: currentMatch.attemptCount
      };
    }
  }

  /* Public Namespace */
  global.TwoMindsGame = {
    DICTIONARY: PUZZLE_DICTIONARY,
    TUTORIAL_PUZZLE: TUTORIAL_PUZZLE,
    QUICK_MESSAGES: QUICK_MESSAGES,
    partitionWord: partitionWord,
    getDeck: getDeck,
    createMatch: createMatch,
    getMatch: function () { return currentMatch; },
    initRound: initRound,
    setSlots: setSlots,
    verifyWord: verifyWord,
    startSoloAILoop: startSoloAILoop,
    stopSoloAILoop: stopSoloAILoop,
    cleanup: function () {
      stopSoloAILoop();
      currentMatch = null;
    }
  };
})(window);
