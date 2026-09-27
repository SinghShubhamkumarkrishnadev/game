/* Jodi Scribble - Massive 415+ Anti-Repeat Dictionary with Smart Randomization */
(function (global) {
  'use strict';

  var MEMORY_KEY = 'jodiscribble_played_history';

  // Load recently played words from localStorage to prevent repeats
  function getPlayedHistory() {
    try {
      var raw = localStorage.getItem(MEMORY_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [];
  }

  function recordPlayedWords(words) {
    try {
      var hist = getPlayedHistory();
      words.forEach(function (w) {
        var wordKey = w.word.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (hist.indexOf(wordKey) === -1) {
          hist.push(wordKey);
        }
      });
      // Keep max 200 recent words in memory
      if (hist.length > 200) {
        hist = hist.slice(-200);
      }
      localStorage.setItem(MEMORY_KEY, JSON.stringify(hist));
    } catch (e) {}
  }

  // ================= 180+ AUTHENTIC HINDI / HINGLISH WORDS =================
  var HINDI_WORDS = [
    // Chaat, Street Food & Desi Sweets
    { word: 'SAMOSA', hint: 'Aloo bhara triangle snack', cat: 'Khaana', diff: 'easy' },
    { word: 'CHAI', hint: 'Subah ki kadak adrak wali pyali', cat: 'Khaana', diff: 'easy' },
    { word: 'MAGGI', hint: 'Raat ke 2 baje wali craving', cat: 'Khaana', diff: 'easy' },
    { word: 'JALEBI', hint: 'Gol gol meethi rasili mithai', cat: 'Khaana', diff: 'easy' },
    { word: 'PANI PURI', hint: 'Teekha pani aur crispy poori', cat: 'Khaana', diff: 'easy' },
    { word: 'DOSA', hint: 'Crispy South Indian roll with chutney', cat: 'Khaana', diff: 'easy' },
    { word: 'GULAB JAMUN', hint: 'Garam chaashni wala kaala jaamun', cat: 'Khaana', diff: 'easy' },
    { word: 'BIRYANI', hint: 'Aroma se bharpur dum rice', cat: 'Khaana', diff: 'medium' },
    { word: 'PAKODE', hint: 'Baarish aur chai ka best friend', cat: 'Khaana', diff: 'easy' },
    { word: 'BHUTTA', hint: 'Nimbu masala laga garam bhutta', cat: 'Khaana', diff: 'medium' },
    { word: 'MOMOS', hint: 'Teekhi laal chutney ke saath steamed dumplings', cat: 'Khaana', diff: 'easy' },
    { word: 'VADA PAV', hint: 'Mumbai ka iconic spicy burger', cat: 'Khaana', diff: 'easy' },
    { word: 'KACHORI', hint: 'Khasta dal ya pyaaz ki crispy kachori', cat: 'Khaana', diff: 'medium' },
    { word: 'RASGULLA', hint: 'Bengal ka spongy safeed rasgulla', cat: 'Khaana', diff: 'easy' },
    { word: 'LASSI', hint: 'Kulhad wali meethi malai maar ke', cat: 'Khaana', diff: 'easy' },
    { word: 'PARATHA', hint: 'Garam makhan wala aloo paratha', cat: 'Khaana', diff: 'easy' },
    { word: 'KULFI', hint: 'Matka wali thandi malai kulfi', cat: 'Khaana', diff: 'medium' },
    { word: 'POORI', hint: 'Sunday morning aloo poori', cat: 'Khaana', diff: 'easy' },
    { word: 'PAV BHAJI', hint: 'Makhan se bhari spicy bhaji aur pav', cat: 'Khaana', diff: 'medium' },
    { word: 'CHOLE BHATURE', hint: 'Dilli ke fluffy bhature aur spicy chole', cat: 'Khaana', diff: 'medium' },
    { word: 'DHOKLA', hint: 'Gujarat ka peela spongy snack', cat: 'Khaana', diff: 'medium' },
    { word: 'IDLI', hint: 'Sambhar aur nariyal chutney ke saath white cakes', cat: 'Khaana', diff: 'easy' },
    { word: 'HALWA', hint: 'Gajar ka laal meetha dessert', cat: 'Khaana', diff: 'medium' },
    { word: 'LADDU', hint: 'Motichoor ya besan ka gol meetha', cat: 'Khaana', diff: 'easy' },
    { word: 'KAJU KATLI', hint: 'Silver vark wali diamond shaped mithai', cat: 'Khaana', diff: 'hard' },
    { word: 'SOAN PAPDI', hint: 'Diwali par har rishtedaar jo gift karta hai', cat: 'Khaana', diff: 'hard' },
    { word: 'PEDA', hint: 'Mathura ka prasiddh meetha', cat: 'Khaana', diff: 'medium' },
    { word: 'RABDI', hint: 'Malai wali gaadhi sweet rabdi', cat: 'Khaana', diff: 'hard' },

    // Romance, Shaadi, Shringar & Gehne
    { word: 'JHUMKA', hint: 'Kaan mein latakne wale romantic earrings', cat: 'Romance', diff: 'easy' },
    { word: 'MEHENDI', hint: 'Haathon par rachne wala gehra rang', cat: 'Shaadi', diff: 'easy' },
    { word: 'MANGALSUTRA', hint: 'Kaale motiyon aur sone ka pavitra bandhan', cat: 'Shaadi', diff: 'medium' },
    { word: 'SAREE', hint: '6 gaj ki sundar traditional poshak', cat: 'Shaadi', diff: 'easy' },
    { word: 'TAJ MAHAL', hint: 'Agra ka amar prem prateek', cat: 'Romance', diff: 'medium' },
    { word: 'DIL', hint: 'Pyaar aur mohabbat ka laal symbol', cat: 'Romance', diff: 'easy' },
    { word: 'CHOODIYAN', hint: 'Chhan chhan karti kaanch ki bangles', cat: 'Shaadi', diff: 'easy' },
    { word: 'GAJRA', hint: 'Baalon mein khushboo bikherte chameli phool', cat: 'Romance', diff: 'medium' },
    { word: 'PAYAL', hint: 'Pairon mein chhan-chhan karti ghungroo', cat: 'Shaadi', diff: 'easy' },
    { word: 'SINDOOR', hint: 'Maang mein bhara laal suhaag rang', cat: 'Shaadi', diff: 'medium' },
    { word: 'SHERWANI', hint: 'Dulhe raja ki shaandar dress', cat: 'Shaadi', diff: 'medium' },
    { word: 'LEHENGA', hint: 'Shaadi mein ghoomnewala bhari lehenga', cat: 'Shaadi', diff: 'medium' },
    { word: 'PHERA', hint: 'Agni ke saath 7 vachan', cat: 'Shaadi', diff: 'hard' },
    { word: 'SEHRA', hint: 'Dulhe ke maathe par baandhne wala haar', cat: 'Shaadi', diff: 'medium' },
    { word: 'BARAAT', hint: 'Bhangra aur dance karti hui procession', cat: 'Shaadi', diff: 'hard' },
    { word: 'DULHAN', hint: 'Laal jode mein sharmati hui bride', cat: 'Shaadi', diff: 'medium' },
    { word: 'HALDI', hint: 'Peela rang jo chehre par lagaya jata hai', cat: 'Shaadi', diff: 'medium' },
    { word: 'VAR MALA', hint: 'Gulaab ke phoolon ki jaimala', cat: 'Shaadi', diff: 'medium' },
    { word: 'PAGDI', hint: 'Shaadi mein sar par baandhi jaane wali turban', cat: 'Shaadi', diff: 'medium' },
    { word: 'KANGAN', hint: 'Sone ka bhari bangles', cat: 'Shaadi', diff: 'medium' },
    { word: 'NAATH', hint: 'Naak mein pehenne wali shaadi ring', cat: 'Shaadi', diff: 'hard' },
    { word: 'DOLI', hint: 'Dulhan ki bidaai wali palki', cat: 'Shaadi', diff: 'hard' },

    // Ghar Sansar, Kitchen & Daily Couple Quirks
    { word: 'BELAN', hint: 'Gol roti banane wala wooden roller', cat: 'Kitchen', diff: 'easy' },
    { word: 'COOKER', hint: 'Daal chawal ki seeti maarne wala bartan', cat: 'Kitchen', diff: 'easy' },
    { word: 'CHAPPAL', hint: 'Ghar par Mummy ka legendary aim', cat: 'Ghar', diff: 'easy' },
    { word: 'TAWA', hint: 'Roti aur paratha sekne wala lohe ka bartan', cat: 'Kitchen', diff: 'easy' },
    { word: 'CHIMTA', hint: 'Garam roti ulatne wala tool', cat: 'Kitchen', diff: 'easy' },
    { word: 'KADHAI', hint: 'Sabzi aur pakode talne wali deep pan', cat: 'Kitchen', diff: 'easy' },
    { word: 'BLANKET', hint: 'Raat ko partner jo saara kheench leta hai', cat: 'Ghar', diff: 'easy' },
    { word: 'JHADU', hint: 'Subah subah ki safai ka danda', cat: 'Ghar', diff: 'easy' },
    { word: 'FAN', hint: 'Bijli bill bachane wala ceiling fan', cat: 'Ghar', diff: 'easy' },
    { word: 'AC REMOTE', hint: 'Temperature 24 ya 18 par ladai', cat: 'Ghar', diff: 'medium' },
    { word: 'TOWEL', hint: 'Bed par geela chhod diya gaya tauliya', cat: 'Ghar', diff: 'easy' },
    { word: 'ALARM', hint: 'Subah 5 baar snooze karne wali ghanti', cat: 'Ghar', diff: 'easy' },
    { word: 'LOCK', hint: 'Ghar se nikalte waqt 3 baar check kiya taala', cat: 'Ghar', diff: 'easy' },
    { word: 'MATKA', hint: 'Thande paani ka mitti ka bartan', cat: 'Kitchen', diff: 'medium' },
    { word: 'CHHANI', hint: 'Chai chhanne wali strainer', cat: 'Kitchen', diff: 'easy' },
    { word: 'TIFFIN', hint: 'Office le jaane wala steel dabba', cat: 'Kitchen', diff: 'easy' },
    { word: 'KATORI', hint: 'Daal aur raita daalne wali small bowl', cat: 'Kitchen', diff: 'medium' },
    { word: 'THALI', hint: 'Steel ki badi plate jisme saara khana hota hai', cat: 'Kitchen', diff: 'easy' },
    { word: 'CHAMMACH', hint: 'Kheer khane wali spoon', cat: 'Kitchen', diff: 'easy' },
    { word: 'PYAZ', hint: 'Kaatne par jisse aankh se aasu nikle', cat: 'Kitchen', diff: 'easy' },
    { word: 'MIRCHI', hint: 'Teekhi hari chilly jo khane ko jala de', cat: 'Kitchen', diff: 'easy' },
    { word: 'NIMBU', hint: 'Khatta peela lemon jisse shikanji banti hai', cat: 'Kitchen', diff: 'easy' },
    { word: 'ACHAR', hint: 'Maa ke haath ka aam ka masala pickle', cat: 'Kitchen', diff: 'medium' },
    { word: 'BAALTI', hint: 'Bathroom mein nahane wali plastic bucket', cat: 'Ghar', diff: 'easy' },
    { word: 'LOTAA', hint: 'Gol peetal ya steel ka round pot', cat: 'Ghar', diff: 'medium' },
    { word: 'TAKIYA', hint: 'Pillow fight mein fek ke mara gaya cushion', cat: 'Ghar', diff: 'easy' },
    { word: 'CHARPAI', hint: 'Gaon ke aangan mein bichhi khatiya', cat: 'Ghar', diff: 'hard' },

    // Safar, Street, Masti & Desi Life
    { word: 'AUTO', hint: 'Teen pahiye wala meter down rickshaw', cat: 'Safar', diff: 'easy' },
    { word: 'SCOOTER', hint: 'Shaam ko aalu-tamatar lane wali gaadi', cat: 'Safar', diff: 'easy' },
    { word: 'TRAIN', hint: 'Chhuk-chhuk wali window seat journey', cat: 'Safar', diff: 'easy' },
    { word: 'CYCLE', hint: 'Bachpan ki do pahiye wali sawari', cat: 'Safar', diff: 'easy' },
    { word: 'METRO', hint: 'Bheed wali AC train jisme card tap hota hai', cat: 'Safar', diff: 'medium' },
    { word: 'PATANG', hint: 'Aasman mein udne wali dor wali kite', cat: 'Masti', diff: 'easy' },
    { word: 'DIYA', hint: 'Diwali par tel se jalne wala mitti ka deepak', cat: 'Tyohar', diff: 'easy' },
    { word: 'PICHKARI', hint: 'Holi par rang phenkne wali gun', cat: 'Tyohar', diff: 'medium' },
    { word: 'CRICKET', hint: 'Sunday gully match ball aur bat', cat: 'Masti', diff: 'easy' },
    { word: 'NARIYAL', hint: 'Straw laga ke peene wala hara coconut', cat: 'Safar', diff: 'easy' },
    { word: 'CHHATRI', hint: 'Baarish mein ek hi umbrella mein dono', cat: 'Romance', diff: 'easy' },
    { word: 'SUNGLASSES', hint: 'Goa beach par lagane wale stylish shades', cat: 'Safar', diff: 'easy' },
    { word: 'DHOLAK', hint: 'Shaadi sangeet par bajne wala drum', cat: 'Music', diff: 'medium' },
    { word: 'BANSURI', hint: 'Krishna ji ki meethi murli', cat: 'Music', diff: 'medium' },
    { word: 'TABLA', hint: 'Classical sangeet ki do jodi drums', cat: 'Music', diff: 'hard' },
    { word: 'PATAKHA', hint: 'Diwali par aag laga kar phodne wala rocket', cat: 'Tyohar', diff: 'medium' },
    { word: 'LATHI', hint: 'Police inspector ki lambi stick', cat: 'Drama', diff: 'medium' },
    { word: 'GULLAK', hint: 'Coins bachane wala clay piggy bank', cat: 'Ghar', diff: 'medium' },

    // Drama, Fears & Quirky Memories
    { word: 'CHIPKALI', hint: 'Deewar par chipki darr paida karne wali lizard', cat: 'Drama', diff: 'easy' },
    { word: 'COCKROACH', hint: 'Uadne wala keeda jisko dekh kar cheekh nikle', cat: 'Drama', diff: 'easy' },
    { word: 'GHOST', hint: 'Raat ko aahat sun ke kambal mein chupna', cat: 'Drama', diff: 'easy' },
    { word: 'MUMMY', hint: 'Phone par "Beta kab aaoge?" puchne wali', cat: 'Ghar', diff: 'medium' },
    { word: 'SELFIE', hint: 'Pout bana ke Instagram ke liye click', cat: 'Masti', diff: 'easy' },
    { word: 'MOBILE', hint: 'Jiski battery 3% par emergency hoti hai', cat: 'Ghar', diff: 'easy' },
    { word: 'SHOLAY', hint: 'Gabbar Singh aur pani ki tanki wala cinema', cat: 'Drama', diff: 'hard' },
    { word: 'NAAGIN DANCE', hint: 'Baraat mein zameen par let ke dance', cat: 'Drama', diff: 'hard' },
    { word: 'NAZAR BATTU', hint: 'Buri nazar se bachane wala kaala face', cat: 'Drama', diff: 'hard' },
    { word: 'KUNDALI', hint: '36 gun milane wali patrika', cat: 'Shaadi', diff: 'hard' },
    { word: 'RISHTA PHOTO', hint: 'Studio mein formal pose wali tasveer', cat: 'Shaadi', diff: 'hard' },
    { word: 'KUMBH MELA', hint: 'Bheed jahan judwa bhai kho jaate hain', cat: 'Drama', diff: 'hard' },
    { word: 'GULLY', hint: 'Patli gali jahan auto phas jata hai', cat: 'Safar', diff: 'medium' },
    { word: 'TAPRI', hint: 'Cutting chai aur bun-maska ka adda', cat: 'Khaana', diff: 'medium' },
    { word: 'JUGAD', hint: 'Kharab cheez ko fix karne ka desi tarika', cat: 'Drama', diff: 'hard' },

    // Naye Easily Drawable Words – Ghar, Khaana, Safar
    { word: 'ALOO', hint: 'Sabse common sabzi jo har dish mein jaati hai', cat: 'Khaana', diff: 'easy' },
    { word: 'TAMATAR', hint: 'Laal gol vegetable jisse chutney banti hai', cat: 'Khaana', diff: 'easy' },
    { word: 'KELA', hint: 'Peela lambu fruit jo bander bhi khate hain', cat: 'Khaana', diff: 'easy' },
    { word: 'MANGO', hint: 'Peelay rang ka India ka raaja fruit', cat: 'Khaana', diff: 'easy' },
    { word: 'DABBA', hint: 'Steel ka rectangle container for lunch', cat: 'Kitchen', diff: 'easy' },
    { word: 'GLASS', hint: 'Paani ya juice peene wala cylinder', cat: 'Kitchen', diff: 'easy' },
    { word: 'PAANI', hint: 'Paardarshi liquid jo bhar ke laate hain', cat: 'Kitchen', diff: 'easy' },
    { word: 'ROTI', hint: 'Gol chapatti jo tawa par sekti hai', cat: 'Khaana', diff: 'easy' },
    { word: 'BALL', hint: 'Gol cheez jo cricket ya football mein jaati hai', cat: 'Masti', diff: 'easy' },
    { word: 'GAAY', hint: 'Dudh dene wali safed badi animal', cat: 'Ghar', diff: 'easy' },
    { word: 'HAATHI', hint: 'Badi sund wali grey jungle animal', cat: 'Safar', diff: 'easy' },
    { word: 'SHER', hint: 'Dahaadne wala jungle ka raja lion', cat: 'Safar', diff: 'easy' },
    { word: 'MACHHLI', hint: 'Paani mein tairne wali finwali creature', cat: 'Nature', diff: 'easy' },
    { word: 'TITLI', hint: 'Rangeen paankh wali nafees butterfly', cat: 'Nature', diff: 'easy' },
    { word: 'MURGA', hint: 'Subah kukdu ku karne wala bird', cat: 'Ghar', diff: 'easy' },
    { word: 'DARWAZA', hint: 'Andar aane ke liye kholne wala door', cat: 'Ghar', diff: 'easy' },
    { word: 'KHIDKI', hint: 'Kamre mein roshni aane wali window', cat: 'Ghar', diff: 'easy' },
    { word: 'KURSI', hint: 'Baithe rehne wali four legged chair', cat: 'Ghar', diff: 'easy' },
    { word: 'MEJA', hint: 'Khana ya padhai ka flat surface table', cat: 'Ghar', diff: 'easy' },
    { word: 'PANKHA', hint: 'Garmi mein ghoomta ceiling fan', cat: 'Ghar', diff: 'easy' },
    { word: 'BULB', hint: 'Bijli se jalkar roshni dene wala round thing', cat: 'Ghar', diff: 'easy' },
    { word: 'CHASHMAH', hint: 'Aankhon par lagane wale do gole frames', cat: 'Daily', diff: 'easy' },
    { word: 'JOOTE', hint: 'Pairon mein pehne jaane wale shoes', cat: 'Daily', diff: 'easy' },
    { word: 'PURSE', hint: 'Paise aur card rakhne wala handbag', cat: 'Daily', diff: 'easy' },
    { word: 'TAARA', hint: 'Raat ko aasman mein chamakne wala star', cat: 'Nature', diff: 'easy' },
    { word: 'CHAND', hint: 'Raat ko chamakne wala gol moon', cat: 'Nature', diff: 'easy' },
    { word: 'SURAJ', hint: 'Subah ugne wala gola peela sun', cat: 'Nature', diff: 'easy' },
    { word: 'BAARISH', hint: 'Upar se girta paani aur bheegi mitti ki khushboo', cat: 'Nature', diff: 'medium' },
    { word: 'BAADAL', hint: 'Aasman mein udte grey-white puffs', cat: 'Nature', diff: 'easy' },
    { word: 'NADI', hint: 'Pahaad se bah ke aaata hua river stream', cat: 'Nature', diff: 'easy' },
    { word: 'JHARANA', hint: 'Pahaad se girti paani ki powerful waterfall', cat: 'Nature', diff: 'easy' },
    { word: 'NETA', hint: 'Haath jodte aur vaade karte politician', cat: 'Drama', diff: 'medium' },
    { word: 'DOCTOR', hint: 'Stetho pahne aur injection dene wala', cat: 'Daily', diff: 'easy' },
    { word: 'POLICE', hint: 'Wardi aur lathi wala kanoon ka rakshak', cat: 'Daily', diff: 'easy' },
    { word: 'TEACHER', hint: 'Board par likha ke sikhane wale', cat: 'Daily', diff: 'easy' },
    { word: 'GHAR', hint: 'Chhat aur char deewar wala house', cat: 'Ghar', diff: 'easy' },
    { word: 'PAHAAD', hint: 'Ucha trikone wala mountain', cat: 'Nature', diff: 'easy' },
    { word: 'JHEEL', hint: 'Charo taraf zameen se ghira paani ka lake', cat: 'Nature', diff: 'medium' },
    { word: 'KHETI', hint: 'Kisan jo beej bota aur fasal ugaata hai', cat: 'Daily', diff: 'medium' },
    { word: 'KISAN', hint: 'Khet mein kaam karne wala farmer', cat: 'Daily', diff: 'medium' },

    // Super Easy & Relatable Desi Drawable Words
    { word: 'BINDI', hint: 'Maathe par lagane wala gol laal tika', cat: 'Shringar', diff: 'easy' },
    { word: 'KANGHI', hint: 'Baal sawarne wali plastic comb', cat: 'Ghar', diff: 'easy' },
    { word: 'SABUN', hint: 'Nahane wala jhag aur khushboo ka bar', cat: 'Ghar', diff: 'easy' },
    { word: 'MUG', hint: 'Baalti ke saath nahane wala chota mug', cat: 'Ghar', diff: 'easy' },
    { word: 'NAL', hint: 'Tapakne wala paani ka water tap', cat: 'Ghar', diff: 'easy' },
    { word: 'MOMBATTI', hint: 'Pighalti hui wax candle aur lau', cat: 'Ghar', diff: 'easy' },
    { word: 'KATORA', hint: 'Kheer ya daal peene ka round bowl', cat: 'Kitchen', diff: 'easy' },
    { word: 'TAALA', hint: 'Ghar band karne wala lohe ka lock', cat: 'Ghar', diff: 'easy' },
    { word: 'CHAABI', hint: 'Taala kholne wali choti metal key', cat: 'Ghar', diff: 'easy' },
    { word: 'CHHADI', hint: 'Dadaji ki chalne wali walking stick', cat: 'Ghar', diff: 'easy' },
    { word: 'TOPI', hint: 'Dhoop se bachne ke liye sar par cap', cat: 'Daily', diff: 'easy' },
    { word: 'ANGOOTHI', hint: 'Ungli mein pehni jaane wali ring', cat: 'Shringar', diff: 'easy' },
    { word: 'PAAN', hint: 'Meetha gulkand bhara triangle green leaf', cat: 'Khaana', diff: 'easy' },
    { word: 'MATAR', hint: 'Chilke ke andar gol hare daane', cat: 'Khaana', diff: 'easy' },
    { word: 'GAJAR', hint: 'Orange conical halwa wali carrot', cat: 'Khaana', diff: 'easy' },
    { word: 'SEB', hint: 'Laal meetha gol fruit with a leaf', cat: 'Khaana', diff: 'easy' },
    { word: 'TARBOOJ', hint: 'Laal meetha slice jisme kaale beej ho', cat: 'Khaana', diff: 'easy' },
    { word: 'BOTAL', hint: 'Fridge mein thande paani ki bottle', cat: 'Ghar', diff: 'easy' },
    { word: 'GAMLA', hint: 'Mitti ka pot jisme phool aur paudhe lagte hain', cat: 'Ghar', diff: 'easy' },
    { word: 'GHANTI', hint: 'Mandir ya puja mein bajne wali bell', cat: 'Ghar', diff: 'easy' },
    { word: 'DUDH', hint: 'Safed glass bhara taaza milk', cat: 'Khaana', diff: 'easy' },
    { word: 'ANDAA', hint: 'Subah breakfast ka safed oval egg', cat: 'Khaana', diff: 'easy' },
    { word: 'JHOOLA', hint: 'Bageeche mein rassi se bandha swing', cat: 'Masti', diff: 'easy' },
    { word: 'KAGAZ KA JAHAZ', hint: 'Bachpan mein banaya paper airplane', cat: 'Masti', diff: 'easy' },
    { word: 'SUI DHAGA', hint: 'Button tankne wali needle aur thread', cat: 'Ghar', diff: 'easy' },
    { word: 'SEETI', hint: 'Moo se zor se bajane wali whistle', cat: 'Masti', diff: 'easy' },
    { word: 'BAT', hint: 'Cricket match ka lakdi ka bat', cat: 'Masti', diff: 'easy' },
    { word: 'RANGOLI', hint: 'Diwali par aangan mein sajaya design', cat: 'Tyohar', diff: 'medium' },
    { word: 'KANTA', hint: 'Maggi aur noodles khane wala fork', cat: 'Kitchen', diff: 'easy' },
    { word: 'TORCH', hint: 'Andhere mein roshni fekne wali flashlight', cat: 'Ghar', diff: 'easy' },
    { word: 'KASHTI', hint: 'Paani par tairti kagaz ki choti boat', cat: 'Masti', diff: 'easy' },
    { word: 'CHAKU', hint: 'Seb aur tamatar kaatne wali sharp knife', cat: 'Kitchen', diff: 'easy' },
    { word: 'KITAAB', hint: 'Kholi hui do panno wali open book', cat: 'Daily', diff: 'easy' },
    { word: 'DANDA', hint: 'Seedhi gol lakdi ka lamba danda', cat: 'Daily', diff: 'easy' },
    { word: 'MAKHAN', hint: 'Garam aloo parathe par pighalta butter', cat: 'Khaana', diff: 'easy' },
    { word: 'KULHAD', hint: 'Mitti ka banna garam kadak chai cup', cat: 'Khaana', diff: 'easy' },
    { word: 'BHINDI', hint: 'Lambi hari crispy ladyfinger sabzi', cat: 'Khaana', diff: 'easy' },
    { word: 'BAINGAN', hint: 'Gol baingani vegetable with green topi', cat: 'Khaana', diff: 'easy' },
    { word: 'MOOCH', hint: 'Desi uncle ki robdaar curved moustache', cat: 'Daily', diff: 'easy' },
    { word: 'DAADI', hint: 'Chehre par stylish ghani beard', cat: 'Daily', diff: 'easy' },
    { word: 'DAANT', hint: 'Toothbrush se saaf kiya safed ek tooth', cat: 'Daily', diff: 'easy' },
    { word: 'AANKH', hint: 'Palkon aur putli wali sundar eye', cat: 'Daily', diff: 'easy' },
    { word: 'HAATH', hint: 'Paanch ungliyon wala khula hand palm', cat: 'Daily', diff: 'easy' },
    { word: 'PAIR', hint: 'Zameen par rakha hua foot', cat: 'Daily', diff: 'easy' },
    { word: 'KAAN', hint: 'Aawaz sunne wala ear', cat: 'Daily', diff: 'easy' },
    { word: 'NAAK', hint: 'Chehre ke beech ki khushboo lene wali nose', cat: 'Daily', diff: 'easy' },
    { word: 'HOTH', hint: 'Muskuraahat bikherne wale do lips', cat: 'Daily', diff: 'easy' },
    { word: 'PAUDA', hint: 'Gamle mein naya do patton wala plant', cat: 'Nature', diff: 'easy' },
    { word: 'PATTA', hint: 'Ped ka hara sundar single leaf', cat: 'Nature', diff: 'easy' },
    { word: 'GUBBARA', hint: 'Hawa se phoola rassi se bandha balloon', cat: 'Masti', diff: 'easy' },
    { word: 'MOR PANKH', hint: 'Krishna ji ka neela hara feather', cat: 'Daily', diff: 'medium' },
    { word: 'TRISHUL', hint: 'Teen nok wala shiv ji ka astra', cat: 'Daily', diff: 'medium' },
    { word: 'GULDASTA', hint: 'Phoolon se bhara sundar flower vase', cat: 'Ghar', diff: 'easy' },
    { word: 'PHOTO FRAME', hint: 'Deewar par lagi tasveer ka frame', cat: 'Ghar', diff: 'easy' },
    { word: 'LOTUS', hint: 'Paani mein khila kamal ka phool', cat: 'Nature', diff: 'easy' },
    { word: 'BATUA', hint: 'Paise aur sikka rakhne wala wallet', cat: 'Daily', diff: 'easy' },
    { word: 'ISTRI', hint: 'Kapde seedhe karne wali electric iron', cat: 'Ghar', diff: 'easy' },
    { word: 'KHILONA', hint: 'Bachhe ka teddy bear ya choti car', cat: 'Masti', diff: 'easy' },
    { word: 'DUCK', hint: 'Paani mein tairti peeli quack-quack battakh', cat: 'Nature', diff: 'easy' },
    { word: 'GHADI', hint: 'Kalaai par baandhne wali round wristwatch', cat: 'Daily', diff: 'easy' }
  ];

  // ================= 200+ EXPANSIVE ENGLISH WORDS =================
  var ENGLISH_WORDS = [
    // Food, Drinks & Sweet Treats
    { word: 'PIZZA', hint: 'Cheesy crust with spicy toppings', cat: 'Food', diff: 'easy' },
    { word: 'BURGER', hint: 'Buns loaded with patties and sauce', cat: 'Food', diff: 'easy' },
    { word: 'CHOCOLATE', hint: 'Sweet brown bar given on Valentine day', cat: 'Treats', diff: 'easy' },
    { word: 'ICE CREAM', hint: 'Chilled scoops in a waffle cone', cat: 'Treats', diff: 'easy' },
    { word: 'CUPCAKE', hint: 'Mini sweet cake with colorful frosting', cat: 'Treats', diff: 'easy' },
    { word: 'POPCORN', hint: 'Crunchy movie theater snack bucket', cat: 'Food', diff: 'easy' },
    { word: 'COFFEE', hint: 'Steamy cup that wakes you up in the morning', cat: 'Drinks', diff: 'easy' },
    { word: 'STRAWBERRY', hint: 'Juicy red heart-shaped berry fruit', cat: 'Food', diff: 'easy' },
    { word: 'DONUT', hint: 'Round pastry with a hole in the middle', cat: 'Treats', diff: 'easy' },
    { word: 'PANCAKES', hint: 'Fluffy breakfast stack dripping with maple syrup', cat: 'Food', diff: 'medium' },
    { word: 'NOODLES', hint: 'Long curly strings eaten with chopsticks', cat: 'Food', diff: 'easy' },
    { word: 'SANDWICH', hint: 'Layers of cheese and veggies between two bread slices', cat: 'Food', diff: 'easy' },
    { word: 'LEMONADE', hint: 'Chilled sweet and sour summer citrus drink', cat: 'Drinks', diff: 'medium' },
    { word: 'HOT DOG', hint: 'Long sausage stuffed inside a sliced bun', cat: 'Food', diff: 'medium' },
    { word: 'WAFFLE', hint: 'Crispy grid patterned dessert with whipped cream', cat: 'Treats', diff: 'medium' },
    { word: 'COOKIE', hint: 'Round baked biscuit packed with chocolate chips', cat: 'Treats', diff: 'easy' },
    { word: 'WATERMELON', hint: 'Green striped giant fruit with red juicy slices', cat: 'Food', diff: 'easy' },
    { word: 'FRENCH FRIES', hint: 'Crispy golden potato fingers in red box', cat: 'Food', diff: 'medium' },
    { word: 'LOLLIPOP', hint: 'Hard candy spiral on a plastic stick', cat: 'Treats', diff: 'easy' },
    { word: 'SUSHI', hint: 'Rice rolls wrapped in dark green seaweed', cat: 'Food', diff: 'hard' },

    // Romance, Gifts & Date Nights
    { word: 'LOVE LETTER', hint: 'Handwritten romantic notes folded with love', cat: 'Romance', diff: 'medium' },
    { word: 'ROSE', hint: 'Romantic red flower with thorns and petals', cat: 'Romance', diff: 'easy' },
    { word: 'DIAMOND RING', hint: 'Sparkling engagement rock on finger', cat: 'Romance', diff: 'easy' },
    { word: 'TEDDY BEAR', hint: 'Fluffy stuffed animal to hug at night', cat: 'Gifts', diff: 'easy' },
    { word: 'BALLOON', hint: 'Floating party sphere tied to a string', cat: 'Gifts', diff: 'easy' },
    { word: 'CANDLE', hint: 'Wax flame for romantic dinner date', cat: 'Romance', diff: 'easy' },
    { word: 'PERFUME', hint: 'Fragrant spray bottle with sweet scent', cat: 'Gifts', diff: 'medium' },
    { word: 'SUNSET', hint: 'Golden evening horizon at the beach', cat: 'Romance', diff: 'easy' },
    { word: 'GUITAR', hint: 'Six strings played for late night singing', cat: 'Music', diff: 'easy' },
    { word: 'HEART', hint: 'Universal symbol of love and affection', cat: 'Romance', diff: 'easy' },
    { word: 'KISS', hint: 'Gentle touch of lips on the cheek', cat: 'Romance', diff: 'easy' },
    { word: 'CHAMPAGNE', hint: 'Bubbly celebration drink popped from tall bottle', cat: 'Drinks', diff: 'medium' },
    { word: 'FIREWORKS', hint: 'Explosions of colorful sparkles in the night sky', cat: 'Romance', diff: 'medium' },
    { word: 'LIPSTICK', hint: 'Red cosmetic tube that stains glasses', cat: 'Style', diff: 'easy' },
    { word: 'HIGH HEELS', hint: 'Tall stylish footwear worn for formal parties', cat: 'Style', diff: 'medium' },
    { word: 'NECKLACE', hint: 'Sparkling chain draped around the neck', cat: 'Gifts', diff: 'easy' },
    { word: 'BOUQUET', hint: 'Bundle of fresh colorful blossoms wrapped in paper', cat: 'Gifts', diff: 'medium' },
    { word: 'FERRIS WHEEL', hint: 'Giant spinning carnival wheel with couple gondolas', cat: 'Fun', diff: 'hard' },
    { word: 'FORTUNE COOKIE', hint: 'Crispy folded biscuit hiding a secret message', cat: 'Treats', diff: 'hard' },
    { word: 'SHOOTING STAR', hint: 'Streaking bright meteor you make a secret wish on', cat: 'Nature', diff: 'medium' },

    // Travel, Adventures & Outdoor Fun
    { word: 'SUNGLASSES', hint: 'Stylish dark shades for sunny days', cat: 'Style', diff: 'easy' },
    { word: 'CAMERA', hint: 'Clicks couple photos and vacation memories', cat: 'Travel', diff: 'easy' },
    { word: 'AIRPLANE', hint: 'Flying high in the clouds for holidays', cat: 'Travel', diff: 'easy' },
    { word: 'UMBRELLA', hint: 'Keeps you dry when walking together in rain', cat: 'Daily', diff: 'easy' },
    { word: 'BICYCLE', hint: 'Two-wheeled pedal ride in the park', cat: 'Travel', diff: 'easy' },
    { word: 'BUTTERFLY', hint: 'Colorful insect fluttering its wings', cat: 'Nature', diff: 'easy' },
    { word: 'RAINBOW', hint: 'Seven colorful arches after rainy clouds', cat: 'Nature', diff: 'easy' },
    { word: 'HEADPHONES', hint: 'Listening to shared romantic playlist', cat: 'Music', diff: 'easy' },
    { word: 'WATCH', hint: 'Worn on wrist to count hours till we meet', cat: 'Style', diff: 'easy' },
    { word: 'SUITCASE', hint: 'Packed luggage for a weekend getaway', cat: 'Travel', diff: 'easy' },
    { word: 'CAMPFIRE', hint: 'Cozy outdoor fire under the night stars', cat: 'Travel', diff: 'medium' },
    { word: 'LOCK AND KEY', hint: 'Heart shaped padlock of love', cat: 'Romance', diff: 'medium' },
    { word: 'TENT', hint: 'Fabric shelter pitched in the mountain woods', cat: 'Travel', diff: 'medium' },
    { word: 'BACKPACK', hint: 'Shoulder bag carried on adventurous hikes', cat: 'Travel', diff: 'easy' },
    { word: 'BEACH', hint: 'Golden sand waves and seashell shores', cat: 'Travel', diff: 'easy' },
    { word: 'PALM TREE', hint: 'Tall tropical tree swaying in warm breezes', cat: 'Nature', diff: 'easy' },
    { word: 'LIGHTHOUSE', hint: 'Tall beacon tower guiding ships past rocky shores', cat: 'Travel', diff: 'hard' },
    { word: 'SAILBOAT', hint: 'Drifting on open blue waters with tall white sail', cat: 'Travel', diff: 'medium' },
    { word: 'COMPASS', hint: 'Magnetic needle pointing true North', cat: 'Travel', diff: 'medium' },
    { word: 'PASSPORT', hint: 'Little navy booklet stamped at foreign airports', cat: 'Travel', diff: 'medium' },
    { word: 'HOT AIR BALLOON', hint: 'Giant basket floating peacefully over scenic valleys', cat: 'Travel', diff: 'hard' },
    { word: 'WATERFALL', hint: 'Rushing stream cascading off steep cliff rocks', cat: 'Nature', diff: 'medium' },
    { word: 'SNOWMAN', hint: 'Three stacked snow spheres wearing carrot and scarf', cat: 'Winter', diff: 'easy' },
    { word: 'CAMPING', hint: 'Roasting marshmallows around outdoor fire', cat: 'Travel', diff: 'medium' },

    // Animals, Cute Pets & Creativity
    { word: 'CAT', hint: 'Furry feline that purrs and naps on pillows', cat: 'Animals', diff: 'easy' },
    { word: 'PUPPY', hint: 'Cute little dog that wags tail when excited', cat: 'Animals', diff: 'easy' },
    { word: 'PENGUIN', hint: 'Tuxedo waddling bird sliding on antarctic ice', cat: 'Animals', diff: 'medium' },
    { word: 'DOLPHIN', hint: 'Playful marine mammal leaping above ocean waves', cat: 'Animals', diff: 'medium' },
    { word: 'PANDA', hint: 'Black and white chubby bear munching green bamboo', cat: 'Animals', diff: 'easy' },
    { word: 'RABBIT', hint: 'Long eared bunny hopping for crunchy carrots', cat: 'Animals', diff: 'easy' },
    { word: 'OWL', hint: 'Big eyed nocturnal bird hooting on tree branch', cat: 'Animals', diff: 'medium' },
    { word: 'UNICORN', hint: 'Magical mythical horse sporting a rainbow spiral horn', cat: 'Fantasy', diff: 'medium' },
    { word: 'DRAGON', hint: 'Giant mythical reptile breathing fiery smoke', cat: 'Fantasy', diff: 'hard' },

    // Everyday Life & Hard Surprises
    { word: 'SUNFLOWER', hint: 'Tall yellow blossom turning to face the morning sun', cat: 'Nature', diff: 'easy' },
    { word: 'PILLOW FIGHT', hint: 'Playful midnight bed battle scattering feathers', cat: 'Fun', diff: 'hard' },
    { word: 'PAPER BOAT', hint: 'Little origami vessel floating in monsoon puddles', cat: 'Fun', diff: 'medium' },
    { word: 'CLOCK', hint: 'Wall dial ticking seconds away', cat: 'Daily', diff: 'easy' },
    { word: 'MIRROR', hint: 'Reflecting glass surface on the dresser', cat: 'Daily', diff: 'easy' },
    { word: 'TELESCOPE', hint: 'Long brass tube for gazing at starry craters', cat: 'Science', diff: 'hard' },
    { word: 'MAGIC WAND', hint: 'Star topped stick casting wizard spells', cat: 'Fantasy', diff: 'medium' },
    { word: 'TREASURE CHEST', hint: 'Wooden trunk stuffed with gold coins and pearls', cat: 'Fantasy', diff: 'hard' },

    // New Easily Drawable Words – Everyday, Nature & Fun
    { word: 'STAR', hint: 'Five pointed shape glowing in the night sky', cat: 'Nature', diff: 'easy' },
    { word: 'MOON', hint: 'Crescent white shape glowing at night', cat: 'Nature', diff: 'easy' },
    { word: 'SUN', hint: 'Bright circle with rays drawn by every child', cat: 'Nature', diff: 'easy' },
    { word: 'CLOUD', hint: 'Fluffy white puff drifting across the sky', cat: 'Nature', diff: 'easy' },
    { word: 'RAIN', hint: 'Blue drops falling from grey clouds', cat: 'Nature', diff: 'easy' },
    { word: 'TREE', hint: 'Brown trunk with green leafy top', cat: 'Nature', diff: 'easy' },
    { word: 'FLOWER', hint: 'Petals around a round center with a stem', cat: 'Nature', diff: 'easy' },
    { word: 'HOUSE', hint: 'Triangle roof on a square with a door', cat: 'Daily', diff: 'easy' },
    { word: 'CAR', hint: 'Four wheels and two doors vehicle on the road', cat: 'Travel', diff: 'easy' },
    { word: 'BUS', hint: 'Long vehicle with many seats and windows', cat: 'Travel', diff: 'easy' },
    { word: 'BOAT', hint: 'Wooden vessel floating on river waves', cat: 'Travel', diff: 'easy' },
    { word: 'FISH', hint: 'Scaly creature with fins swimming underwater', cat: 'Animals', diff: 'easy' },
    { word: 'BIRD', hint: 'Two wings and a beak flying through the sky', cat: 'Animals', diff: 'easy' },
    { word: 'DOG', hint: 'Four legged loyal pet that wags its tail', cat: 'Animals', diff: 'easy' },
    { word: 'TIGER', hint: 'Orange big cat with black stripes and sharp claws', cat: 'Animals', diff: 'easy' },
    { word: 'ELEPHANT', hint: 'Giant grey animal with a long trunk and big ears', cat: 'Animals', diff: 'easy' },
    { word: 'LION', hint: 'Mane crowned king of the jungle roaring', cat: 'Animals', diff: 'easy' },
    { word: 'MONKEY', hint: 'Swinging from branches with a curved tail', cat: 'Animals', diff: 'easy' },
    { word: 'COW', hint: 'Black and white spotted animal giving milk', cat: 'Animals', diff: 'easy' },
    { word: 'FROG', hint: 'Green jumpy creature sitting on a lily pad', cat: 'Animals', diff: 'easy' },
    { word: 'SNAKE', hint: 'Long slithering reptile with a flickering tongue', cat: 'Animals', diff: 'easy' },
    { word: 'TURTLE', hint: 'Slow creature with a dome shaped shell on its back', cat: 'Animals', diff: 'easy' },
    { word: 'PARROT', hint: 'Colorful talking bird perched on a branch', cat: 'Animals', diff: 'easy' },
    { word: 'APPLE', hint: 'Round red fruit with a single stalk and leaf', cat: 'Food', diff: 'easy' },
    { word: 'BANANA', hint: 'Yellow curved fruit in a bunch', cat: 'Food', diff: 'easy' },
    { word: 'MANGO', hint: 'Yellow-orange tropical fruit with a big seed', cat: 'Food', diff: 'easy' },
    { word: 'GRAPES', hint: 'Cluster of tiny round berries on a vine', cat: 'Food', diff: 'easy' },
    { word: 'PINEAPPLE', hint: 'Spiky crown on a yellow textured oval fruit', cat: 'Food', diff: 'easy' },
    { word: 'MUSHROOM', hint: 'Round cap on a short stem growing in forest', cat: 'Food', diff: 'easy' },
    { word: 'CARROT', hint: 'Orange pointed vegetable with green leafy top', cat: 'Food', diff: 'easy' },
    { word: 'BIRTHDAY CAKE', hint: 'Layered cake with candles on top', cat: 'Fun', diff: 'easy' },
    { word: 'GIFT BOX', hint: 'Wrapped box tied with a bow ribbon', cat: 'Gifts', diff: 'easy' },
    { word: 'PENCIL', hint: 'Long yellow pointed stick used for writing', cat: 'Daily', diff: 'easy' },
    { word: 'BOOK', hint: 'Pages between two covers stacked flat', cat: 'Daily', diff: 'easy' },
    { word: 'CUP', hint: 'Round handle ceramic vessel for hot drinks', cat: 'Daily', diff: 'easy' },
    { word: 'CHAIR', hint: 'Four legs with a back support for sitting', cat: 'Daily', diff: 'easy' },
    { word: 'TABLE', hint: 'Flat surface on four legs for eating and working', cat: 'Daily', diff: 'easy' },
    { word: 'DOOR', hint: 'Rectangle panel that opens and closes a room', cat: 'Daily', diff: 'easy' },
    { word: 'WINDOW', hint: 'Glass panel on a wall that lets sunlight in', cat: 'Daily', diff: 'easy' },
    { word: 'KEY', hint: 'Small metal shape that opens a lock', cat: 'Daily', diff: 'easy' },
    { word: 'LAMP', hint: 'Shade on a stand casting warm light in a corner', cat: 'Daily', diff: 'easy' },
    { word: 'FAN', hint: 'Spinning blades on ceiling pushing cool air down', cat: 'Daily', diff: 'easy' },
    { word: 'PHONE', hint: 'Rectangle screen we stare at all day', cat: 'Daily', diff: 'easy' },
    { word: 'GLASSES', hint: 'Two round lenses on a frame resting on nose', cat: 'Daily', diff: 'easy' },
    { word: 'SHOES', hint: 'Pair of foot coverings with laces on top', cat: 'Daily', diff: 'easy' },
    { word: 'HAT', hint: 'Brim and dome shaped head cover', cat: 'Style', diff: 'easy' },
    { word: 'KITE', hint: 'Diamond shaped flyer on a long string', cat: 'Fun', diff: 'easy' },
    { word: 'LADDER', hint: 'Two rails with rungs used to climb higher', cat: 'Daily', diff: 'easy' },
    { word: 'BRIDGE', hint: 'Arch connecting two riverbanks for crossing', cat: 'Travel', diff: 'easy' },
    { word: 'MOUNTAIN', hint: 'Triangular peak covered with white snow', cat: 'Nature', diff: 'easy' },
    { word: 'VOLCANO', hint: 'Conical hill erupting with hot red lava', cat: 'Nature', diff: 'medium' },
    { word: 'ISLAND', hint: 'Small patch of land surrounded by ocean water', cat: 'Travel', diff: 'easy' },
    { word: 'TROPHY', hint: 'Gold cup with handles awarded for winning', cat: 'Fun', diff: 'easy' },
    { word: 'CROWN', hint: 'King and queen wear this on their heads', cat: 'Fantasy', diff: 'easy' },
    { word: 'SWORD', hint: 'Long sharp metal blade carried by warriors', cat: 'Fantasy', diff: 'easy' },
    { word: 'SHIELD', hint: 'Round or oval protector held in battle', cat: 'Fantasy', diff: 'easy' },
    { word: 'ROCKET', hint: 'Pointed cylinder blasting fire into outer space', cat: 'Science', diff: 'easy' },
    { word: 'PLANET', hint: 'Round sphere orbiting around the sun', cat: 'Science', diff: 'easy' },
    { word: 'SKATEBOARD', hint: 'Four small wheels under a flat deck for rolling', cat: 'Fun', diff: 'easy' },
    { word: 'WATERING CAN', hint: 'Garden spout can for sprinkling water on plants', cat: 'Daily', diff: 'easy' },
    { word: 'TENNIS RACKET', hint: 'Net strung paddle used to hit green tennis balls', cat: 'Fun', diff: 'easy' },

    // Super Easy & Relatable Everyday Drawable English Words
    { word: 'ENVELOPE', hint: 'Rectangular paper mail with a triangle flap', cat: 'Daily', diff: 'easy' },
    { word: 'SCISSORS', hint: 'Two crossing blades with round finger loops', cat: 'Daily', diff: 'easy' },
    { word: 'BATTERY', hint: 'Cylinder with plus and minus poles', cat: 'Daily', diff: 'easy' },
    { word: 'BREAD', hint: 'Sliced loaf with brown crust for sandwiches', cat: 'Food', diff: 'easy' },
    { word: 'CHEESE', hint: 'Yellow triangle wedge with round holes', cat: 'Food', diff: 'easy' },
    { word: 'EGG', hint: 'White oval shell cracked for breakfast', cat: 'Food', diff: 'easy' },
    { word: 'CHERRY', hint: 'Two small red berries joined at the green stem', cat: 'Food', diff: 'easy' },
    { word: 'LEMON', hint: 'Yellow sour citrus fruit cut in half', cat: 'Food', diff: 'easy' },
    { word: 'WATER BOTTLE', hint: 'Tall flask carried to gym or school', cat: 'Daily', diff: 'easy' },
    { word: 'TEA BAG', hint: 'Small pouch on a string dipped in hot water', cat: 'Drinks', diff: 'easy' },
    { word: 'SPOON', hint: 'Shallow curved oval for sipping soup', cat: 'Daily', diff: 'easy' },
    { word: 'FORK', hint: 'Utensil with four pointed prongs for eating', cat: 'Daily', diff: 'easy' },
    { word: 'KNIFE', hint: 'Sharp kitchen blade used for chopping', cat: 'Daily', diff: 'easy' },
    { word: 'BOWL', hint: 'Deep round dish holding cereal or noodles', cat: 'Daily', diff: 'easy' },
    { word: 'FRYING PAN', hint: 'Flat round skillet with a long handle', cat: 'Kitchen', diff: 'easy' },
    { word: 'KETTLE', hint: 'Teapot whistling hot steam from its spout', cat: 'Kitchen', diff: 'easy' },
    { word: 'TOOTHBRUSH', hint: 'Plastic handle with bristles for brushing teeth', cat: 'Daily', diff: 'easy' },
    { word: 'TOOTHPASTE', hint: 'Squeezed paste tube kept on bathroom shelf', cat: 'Daily', diff: 'easy' },
    { word: 'SOAP', hint: 'Scented slippery bar producing soapy bubbles', cat: 'Daily', diff: 'easy' },
    { word: 'SHOWER', hint: 'Overhead nozzle spraying streams of water', cat: 'Daily', diff: 'easy' },
    { word: 'COMB', hint: 'Toothed plastic bar used to detangle hair', cat: 'Daily', diff: 'easy' },
    { word: 'HAIRDRYER', hint: 'Blows hot air to dry wet washed hair', cat: 'Daily', diff: 'easy' },
    { word: 'BED', hint: 'Mattress on a wooden frame with warm blanket', cat: 'Daily', diff: 'easy' },
    { word: 'SOFA', hint: 'Cushioned living room couch for lounging', cat: 'Daily', diff: 'easy' },
    { word: 'PILLOW', hint: 'Soft cushion for resting head while sleeping', cat: 'Daily', diff: 'easy' },
    { word: 'CURTAIN', hint: 'Cloth drapery hanging over bedroom window', cat: 'Daily', diff: 'easy' },
    { word: 'BUCKET', hint: 'Round plastic container with wire handle', cat: 'Daily', diff: 'easy' },
    { word: 'MOP', hint: 'Long pole with wet cloth head cleaning floor', cat: 'Daily', diff: 'easy' },
    { word: 'BROOM', hint: 'Bundle of straws tied together for sweeping', cat: 'Daily', diff: 'easy' },
    { word: 'TRASH CAN', hint: 'Waste basket with swinging lid for garbage', cat: 'Daily', diff: 'easy' },
    { word: 'LIGHT BULB', hint: 'Glass globe with glowing wire filament inside', cat: 'Daily', diff: 'easy' },
    { word: 'FLASHLIGHT', hint: 'Portable torch shining a bright yellow beam', cat: 'Daily', diff: 'easy' },
    { word: 'MATCHSTICK', hint: 'Small wooden stick with red sulfur tip', cat: 'Daily', diff: 'easy' },
    { word: 'SCARF', hint: 'Knitted wool wrap worn around neck in winter', cat: 'Style', diff: 'easy' },
    { word: 'SOCKS', hint: 'Pair of knit cloth slip-ons worn inside shoes', cat: 'Style', diff: 'easy' },
    { word: 'GLOVES', hint: 'Hand warmers with individual fingers', cat: 'Style', diff: 'easy' },
    { word: 'TIE', hint: 'Formal fabric accessory hanging down shirt collar', cat: 'Style', diff: 'easy' },
    { word: 'BOW TIE', hint: 'Little butterfly shaped ribbon on a tux collar', cat: 'Style', diff: 'easy' },
    { word: 'BELT', hint: 'Leather strap with metal buckle holding pants', cat: 'Style', diff: 'easy' },
    { word: 'SAFETY PIN', hint: 'Bent clasp pin used for emergency fabric fixes', cat: 'Daily', diff: 'easy' },
    { word: 'PAPERCLIP', hint: 'Looped metal wire binding loose sheets', cat: 'Daily', diff: 'easy' },
    { word: 'ERASER', hint: 'Rubbery block that wipes away pencil marks', cat: 'Daily', diff: 'easy' },
    { word: 'RULER', hint: 'Straight stick marked with inches and centimeters', cat: 'Daily', diff: 'easy' },
    { word: 'NOTEBOOK', hint: 'Spiral bound lined pages for scribbling notes', cat: 'Daily', diff: 'easy' },
    { word: 'CALENDAR', hint: 'Wall grid of months and numbered date boxes', cat: 'Daily', diff: 'easy' },
    { word: 'COIN', hint: 'Small flat circular metal piece of money', cat: 'Daily', diff: 'easy' },
    { word: 'WALLET', hint: 'Pocket leather folder holding cash and cards', cat: 'Daily', diff: 'easy' },
    { word: 'PIGGY BANK', hint: 'Ceramic coin bank with a coin slot on top', cat: 'Daily', diff: 'easy' },
    { word: 'MAGNET', hint: 'Red curved horseshoe pulling paperclips', cat: 'Science', diff: 'easy' },
    { word: 'BELL', hint: 'Hollow cup that dings when shaken', cat: 'Daily', diff: 'easy' },
    { word: 'DRUM', hint: 'Round cylinder struck with wooden drumsticks', cat: 'Music', diff: 'easy' },
    { word: 'WHISTLE', hint: 'Referee blows this to make a high pitch screech', cat: 'Fun', diff: 'easy' },
    { word: 'MICROPHONE', hint: 'Handheld mesh head device for stage singing', cat: 'Music', diff: 'easy' },
    { word: 'ANCHOR', hint: 'Heavy iron hook lowered from ships into sea', cat: 'Travel', diff: 'easy' },
    { word: 'TRAFFIC LIGHT', hint: 'Three circular lamps: Red, Yellow, Green', cat: 'Travel', diff: 'easy' },
    { word: 'WHEEL', hint: 'Round rotating circle with center hub and spokes', cat: 'Travel', diff: 'easy' },
    { word: 'FLAG', hint: 'Rectangle fabric waving from a tall pole', cat: 'Fun', diff: 'easy' },
    { word: 'DUCK', hint: 'Yellow bird with orange flat bill floating in water', cat: 'Animals', diff: 'easy' },
    { word: 'HORSE', hint: 'Noble riding animal with flowing mane and tail', cat: 'Animals', diff: 'easy' },
    { word: 'SHEEP', hint: 'Fluffy woolly white animal grazing in meadows', cat: 'Animals', diff: 'easy' },
    { word: 'BEE', hint: 'Yellow and black striped buzzing honey insect', cat: 'Animals', diff: 'easy' },
    { word: 'SPIDER', hint: 'Eight legged creepy crawler spinning a web', cat: 'Animals', diff: 'easy' },
    { word: 'LEAF', hint: 'Green shaped blade with veins fallen from tree', cat: 'Nature', diff: 'easy' },
    { word: 'CAMPING TENT', hint: 'Triangle canvas shelter pitched under stars', cat: 'Travel', diff: 'easy' }
  ];

  HINDI_WORDS.forEach(function (w) { w.lang = 'hi'; });
  ENGLISH_WORDS.forEach(function (w) { w.lang = 'en'; });

  // Fisher-Yates robust shuffle
  function shuffle(arr) {
    var b = arr.slice();
    for (var i = b.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = b[i];
      b[i] = b[j];
      b[j] = t;
    }
    return b;
  }

  // Non-repeating deck picker
  function getDeck(count, lang) {
    var l = (lang || 'mix').toLowerCase();
    var sourcePool = [];

    if (l === 'hi') {
      sourcePool = HINDI_WORDS;
    } else if (l === 'en') {
      sourcePool = ENGLISH_WORDS;
    } else {
      sourcePool = HINDI_WORDS.concat(ENGLISH_WORDS);
    }

    var playedHistory = getPlayedHistory();
    var playedSet = {};
    for (var i = 0; i < playedHistory.length; i++) {
      playedSet[playedHistory[i]] = true;
    }

    // Filter out recently played words
    var unplayed = sourcePool.filter(function (item) {
      var clean = item.word.toUpperCase().replace(/[^A-Z0-9]/g, '');
      return !playedSet[clean];
    });

    // If unplayed words are less than requested count, recycle history
    if (unplayed.length < (count || 10)) {
      try {
        localStorage.removeItem(MEMORY_KEY);
      } catch (e) {}
      unplayed = sourcePool.slice();
    }

    // Shuffle unplayed words thoroughly
    var shuffled = shuffle(unplayed);

    // If 'mix', ensure healthy blend of both Hindi and English
    var selected = [];
    if (l === 'mix') {
      var hiUnplayed = shuffled.filter(function (x) { return x.lang === 'hi'; });
      var enUnplayed = shuffled.filter(function (x) { return x.lang === 'en'; });
      var half = Math.ceil((count || 10) / 2);

      var pickedHi = hiUnplayed.slice(0, half);
      var pickedEn = enUnplayed.slice(0, (count || 10) - pickedHi.length);
      selected = shuffle(pickedHi.concat(pickedEn));
    } else {
      selected = shuffled.slice(0, Math.min(count || 10, shuffled.length));
    }

    // Record selected words into history so they won't repeat next time!
    recordPlayedWords(selected);

    return selected;
  }

  global.JodiWords = {
    HINDI: HINDI_WORDS,
    ENGLISH: ENGLISH_WORDS,
    ALL: HINDI_WORDS.concat(ENGLISH_WORDS),
    getDeck: getDeck,
    shuffle: shuffle,
    resetHistory: function () {
      try { localStorage.removeItem(MEMORY_KEY); } catch (e) {}
    }
  };
})(window);
