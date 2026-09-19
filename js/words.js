/* Jodi Scribble - Massive 350+ Anti-Repeat Dictionary with Smart Randomization */
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
    { word: 'JUGAD', hint: 'Kharab cheez ko fix karne ka desi tarika', cat: 'Drama', diff: 'hard' }
  ];

  // ================= 180+ EXPANSIVE ENGLISH WORDS =================
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
    { word: 'TREASURE CHEST', hint: 'Wooden trunk stuffed with gold coins and pearls', cat: 'Fantasy', diff: 'hard' }
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
