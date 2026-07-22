import { haversineDistance } from '../services/location/distance';

export interface TreasureHunt {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: string;
  rewardCoins: number;
  rewardBadge?: string;
  city: string;
  checkpoints: TreasureCheckpoint[];
  isActive: boolean;
  progress: number;
}

export interface TreasureCheckpoint {
  id: string;
  spotId: string;
  spotName: string;
  clue: string;
  isCompleted: boolean;
  order: number;
  /** GPS coordinates for location verification */
  lat?: number;
  lng?: number;
  /** Photo proof required for medium/hard quests */
  verificationMode?: 'gps' | 'gps_photo';
}

export const treasureHunts: TreasureHunt[] = [
  {
    id: 'hunt_jabalpur_mystery',
    title: 'Jabalpur Mystery Trail',
    description: 'Uncover the secrets of Jabalpur! From marble rocks to ancient temples, discover the hidden wonders.',
    difficulty: 'medium',
    estimatedTime: '3-4 hours',
    rewardCoins: 200,
    rewardBadge: '👑 Jabalpur Legend',
    city: 'Jabalpur',
    checkpoints: [
      { id: 'cp_1', spotId: 'bhedaghat-marble-rocks', spotName: 'Bhedaghat Marble Rocks', clue: 'Where white marble meets the flowing Narmada, look for the boat that takes you to wonder.', isCompleted: false, order: 1, lat: 23.1310, lng: 79.7947, verificationMode: 'gps_photo' },
      { id: 'cp_2', spotId: 'dhuandhar-falls', spotName: 'Dhuandhar Falls', clue: 'Follow the thundering sound to where the waterfall creates misty rainbows.', isCompleted: false, order: 2, lat: 23.1345, lng: 79.7930, verificationMode: 'gps_photo' },
      { id: 'cp_3', spotId: 'chausath-yogini-temple', spotName: 'Chausath Yogini Temple', clue: 'Find the hill where 64 yoginis guard ancient secrets.', isCompleted: false, order: 3, lat: 23.1657, lng: 79.8949, verificationMode: 'gps_photo' },
      { id: 'cp_4', spotId: 'madan-mahal-fort', spotName: 'Madan Mahal Fort', clue: 'Climb to the fort where Gond kings once ruled and view the city from above.', isCompleted: false, order: 4, lat: 23.1591, lng: 79.9078, verificationMode: 'gps_photo' },
    ],
    isActive: true,
    progress: 0,
  },
  {
    id: 'hunt_nature_lover',
    title: "Nature Lover's Paradise",
    description: 'Explore the natural beauty of Jabalpur - waterfalls, forests, and scenic viewpoints.',
    difficulty: 'easy',
    estimatedTime: '2-3 hours',
    rewardCoins: 150,
    rewardBadge: '🌿 Nature Lover',
    city: 'Jabalpur',
    checkpoints: [
      { id: 'cp_n1', spotId: 'dhuandhar-falls', spotName: 'Dhuandhar Falls', clue: 'The smoke-like falls that create endless mist.', isCompleted: false, order: 1, lat: 23.1345, lng: 79.7930, verificationMode: 'gps' },
      { id: 'cp_n2', spotId: 'bhedaghat-marble-rocks', spotName: 'Bhedaghat Marble Rocks', clue: 'White marble cliffs reflecting in the Narmada.', isCompleted: false, order: 2, lat: 23.1310, lng: 79.7947, verificationMode: 'gps' },
      { id: 'cp_n3', spotId: 'dumna-nature-reserve', spotName: 'Dumna Nature Reserve', clue: 'A wild forest home to many birds and animals.', isCompleted: false, order: 3, lat: 23.2135, lng: 79.9890, verificationMode: 'gps' },
    ],
    isActive: true,
    progress: 0,
  },
  {
    id: 'hunt_history_seeker',
    title: "History Seeker's Journey",
    description: 'Dive deep into the rich history of Jabalpur - forts, temples, and ancient stories.',
    difficulty: 'hard',
    estimatedTime: '4-5 hours',
    rewardCoins: 250,
    rewardBadge: '🏛️ History Buff',
    city: 'Jabalpur',
    checkpoints: [
      { id: 'cp_h1', spotId: 'madan-mahal-fort', spotName: 'Madan Mahal Fort', clue: 'The 12th century fort of the Gond kingdom.', isCompleted: false, order: 1, lat: 23.1591, lng: 79.9078, verificationMode: 'gps_photo' },
      { id: 'cp_h2', spotId: 'garha-fort', spotName: 'Garha Fort', clue: 'The oldest fort in Jabalpur with Gond dynasty ruins.', isCompleted: false, order: 2, lat: 23.1482, lng: 79.9212, verificationMode: 'gps_photo' },
      { id: 'cp_h3', spotId: 'chausath-yogini-temple', spotName: 'Chausath Yogini Temple', clue: 'One of the oldest temples dedicated to goddess Durga.', isCompleted: false, order: 3, lat: 23.1657, lng: 79.8949, verificationMode: 'gps_photo' },
    ],
    isActive: true,
    progress: 0,
  },
  // Delhi
  {
    id: 'hunt_delhi_mughal',
    title: 'Delhi Mughal Heritage',
    description: 'Trace the architectural legacy of the great Mughal Empire in Delhi.',
    difficulty: 'medium',
    estimatedTime: '3-4 hours',
    rewardCoins: 200,
    rewardBadge: '🏰 Mughal Historian',
    city: 'Delhi',
    checkpoints: [
      { id: 'cp_d1', spotId: 'red-fort', spotName: 'Red Fort', clue: 'The sandstone ramparts where independent India first hoisted its flag.', isCompleted: false, order: 1, lat: 28.6562, lng: 77.2410, verificationMode: 'gps_photo' },
      { id: 'cp_d2', spotId: 'humayuns-tomb', spotName: 'Humayuns Tomb', clue: 'A precursor to the Taj Mahal with beautiful garden tombs.', isCompleted: false, order: 2, lat: 28.5933, lng: 77.2507, verificationMode: 'gps_photo' },
      { id: 'cp_d3', spotId: 'jama-masjid', spotName: 'Jama Masjid', clue: 'One of the largest mosques in India with towering minarets.', isCompleted: false, order: 3, lat: 28.6507, lng: 77.2334, verificationMode: 'gps_photo' },
    ],
    isActive: true,
    progress: 0,
  },
  {
    id: 'hunt_lutyens_delhi',
    title: 'Lutyens Delhi Walk',
    description: 'Explore the modern government seat and grand colonial architecture of Delhi.',
    difficulty: 'easy',
    estimatedTime: '1-2 hours',
    rewardCoins: 120,
    rewardBadge: '🏛️ Capital Guide',
    city: 'Delhi',
    checkpoints: [
      { id: 'cp_ld1', spotId: 'india-gate', spotName: 'India Gate', clue: 'The grand triumphal arch honoring Indian soldiers.', isCompleted: false, order: 1, lat: 28.6129, lng: 77.2295, verificationMode: 'gps' },
      { id: 'cp_ld2', spotId: 'rashtrapati-bhavan', spotName: 'Rashtrapati Bhavan', clue: 'The official home of the President of India.', isCompleted: false, order: 2, lat: 28.6143, lng: 77.1991, verificationMode: 'gps' },
      { id: 'cp_ld3', spotId: 'jantar-mantar', spotName: 'Jantar Mantar', clue: 'Giant outdoor astronomical instruments built by Maharaja Jai Singh.', isCompleted: false, order: 3, lat: 28.6270, lng: 77.2167, verificationMode: 'gps' },
    ],
    isActive: true,
    progress: 0,
  },
  // Udaipur
  {
    id: 'hunt_udaipur_lakes',
    title: 'Udaipur Lakes Exploration',
    description: 'Visit the romantic waterways and lakes of Udaipur.',
    difficulty: 'easy',
    estimatedTime: '2 hours',
    rewardCoins: 150,
    rewardBadge: '🏞️ Lake Warden',
    city: 'Udaipur',
    checkpoints: [
      { id: 'cp_ul1', spotId: 'lake-pichola', spotName: 'Lake Pichola', clue: 'The majestic lake featuring the floating Lake Palace.', isCompleted: false, order: 1, lat: 24.5718, lng: 73.6803, verificationMode: 'gps' },
      { id: 'cp_ul2', spotId: 'fateh-sagar-lake', spotName: 'Fateh Sagar Lake', clue: "Enjoy boating and checking in at Udaipur's second-largest lake.", isCompleted: false, order: 2, lat: 24.5939, lng: 73.6741, verificationMode: 'gps' },
    ],
    isActive: true,
    progress: 0,
  },
  {
    id: 'hunt_udaipur_palaces',
    title: 'Udaipur Palaces Walk',
    description: 'Tour the grand residences of Mewar rulers in Udaipur.',
    difficulty: 'medium',
    estimatedTime: '3 hours',
    rewardCoins: 180,
    rewardBadge: '👑 Mewar Royalty',
    city: 'Udaipur',
    checkpoints: [
      { id: 'cp_up1', spotId: 'city-palace-udaipur', spotName: 'City Palace', clue: 'The largest palace complex in Rajasthan, overlooking Pichola.', isCompleted: false, order: 1, lat: 24.5754, lng: 73.6837, verificationMode: 'gps_photo' },
      { id: 'cp_up2', spotId: 'sajjangarh-monsoon-palace', spotName: 'Monsoon Palace', clue: 'Perched high on a hill, watching the monsoon clouds.', isCompleted: false, order: 2, lat: 24.5586, lng: 73.6517, verificationMode: 'gps_photo' },
    ],
    isActive: true,
    progress: 0,
  },
  // Agra
  {
    id: 'hunt_agra_taj',
    title: 'Agra Taj Heritage Walk',
    description: 'Visit the world-famous Taj Mahal and surrounding heritage landmarks.',
    difficulty: 'easy',
    estimatedTime: '2 hours',
    rewardCoins: 150,
    rewardBadge: '🕌 Taj Guardian',
    city: 'Agra',
    checkpoints: [
      { id: 'cp_at1', spotId: 'taj-mahal', spotName: 'Taj Mahal', clue: 'The eternal monument of love in white marble.', isCompleted: false, order: 1, lat: 27.1751, lng: 78.0421, verificationMode: 'gps_photo' },
      { id: 'cp_at2', spotId: 'mehtab-bagh', spotName: 'Mehtab Bagh', clue: 'Moonlight garden offering direct views of the Taj from across Yamuna.', isCompleted: false, order: 2, lat: 27.1885, lng: 78.0397, verificationMode: 'gps' },
    ],
    isActive: true,
    progress: 0,
  },
  {
    id: 'hunt_agra_forts',
    title: 'Agra Mughal Forts Trail',
    description: 'Explore the military strongholds of Agra.',
    difficulty: 'medium',
    estimatedTime: '3 hours',
    rewardCoins: 180,
    rewardBadge: '🏰 Agra Defender',
    city: 'Agra',
    checkpoints: [
      { id: 'cp_af1', spotId: 'agra-fort', spotName: 'Agra Fort', clue: 'The grand walled city where Shah Jahan was imprisoned by Aurangzeb.', isCompleted: false, order: 1, lat: 27.1795, lng: 78.0211, verificationMode: 'gps_photo' },
      { id: 'cp_af2', spotId: 'itmad-ud-daulah', spotName: 'Baby Taj', clue: 'The tomb of Mirza Ghiyas Beg, built entirely of white marble.', isCompleted: false, order: 2, lat: 27.1930, lng: 78.0380, verificationMode: 'gps_photo' },
    ],
    isActive: true,
    progress: 0,
  },
  // Jaipur
  {
    id: 'hunt_jaipur_forts',
    title: 'Jaipur Pink City Forts',
    description: 'Explore the defensive hill forts guarding Jaipur.',
    difficulty: 'hard',
    estimatedTime: '4 hours',
    rewardCoins: 220,
    rewardBadge: '🏰 Royal Rajput',
    city: 'Jaipur',
    checkpoints: [
      { id: 'cp_jf1', spotId: 'amber-fort', spotName: 'Amber Fort', clue: 'The grand palace fort with sheesh mahal, overlooking Maota Lake.', isCompleted: false, order: 1, lat: 26.9855, lng: 75.8513, verificationMode: 'gps_photo' },
      { id: 'cp_jf2', spotId: 'jaigarh-fort', spotName: 'Jaigarh Fort', clue: "Home to Jaivana, the world's largest cannon on wheels.", isCompleted: false, order: 2, lat: 26.9928, lng: 75.8478, verificationMode: 'gps_photo' },
      { id: 'cp_jf3', spotId: 'nahargarh-fort', spotName: 'Nahargarh Fort', clue: 'Offers beautiful panoramic views of Jaipur city lights.', isCompleted: false, order: 3, lat: 26.9338, lng: 75.8097, verificationMode: 'gps_photo' },
    ],
    isActive: true,
    progress: 0,
  },
  {
    id: 'hunt_jaipur_palaces',
    title: 'Jaipur Royal Palace Tour',
    description: "See the ornate palaces inside Jaipur's walled city.",
    difficulty: 'easy',
    estimatedTime: '2 hours',
    rewardCoins: 140,
    rewardBadge: '🌸 Jaipur Prince',
    city: 'Jaipur',
    checkpoints: [
      { id: 'cp_jp1', spotId: 'hawa-mahal', spotName: 'Hawa Mahal', clue: 'The Palace of Winds with 953 small casements.', isCompleted: false, order: 1, lat: 26.9239, lng: 75.8267, verificationMode: 'gps' },
      { id: 'cp_jp2', spotId: 'city-palace-jaipur', spotName: 'City Palace', clue: 'The royal residence containing museum exhibits and peacock courtyards.', isCompleted: false, order: 2, lat: 26.9258, lng: 75.8237, verificationMode: 'gps' },
    ],
    isActive: true,
    progress: 0,
  },
  // Mumbai
  {
    id: 'hunt_mumbai_colonial',
    title: 'Mumbai Colonial Architecture',
    description: 'Explore the grand Victorian Gothic monuments of South Mumbai.',
    difficulty: 'easy',
    estimatedTime: '2 hours',
    rewardCoins: 150,
    rewardBadge: '🏢 Bombay Chronicler',
    city: 'Mumbai',
    checkpoints: [
      { id: 'cp_mc1', spotId: 'gateway-of-india', spotName: 'Gateway of India', clue: 'The monumental arch built to welcome King George V.', isCompleted: false, order: 1, lat: 18.9220, lng: 72.8347, verificationMode: 'gps_photo' },
      { id: 'cp_mc2', spotId: 'chhatrapati-shivaji-terminus', spotName: 'CST Terminus', clue: 'The bustling railway hub displaying Victorian Gothic architectural design.', isCompleted: false, order: 2, lat: 18.9401, lng: 72.8350, verificationMode: 'gps_photo' },
    ],
    isActive: true,
    progress: 0,
  },
  {
    id: 'hunt_mumbai_marine',
    title: 'Mumbai Marine Drive Sunset',
    description: 'Walk along the beautiful Arabian Sea promenade in Mumbai.',
    difficulty: 'easy',
    estimatedTime: '1 hour',
    rewardCoins: 100,
    rewardBadge: '🌊 Marine Sailor',
    city: 'Mumbai',
    checkpoints: [
      { id: 'cp_mm1', spotId: 'marine-drive', spotName: 'Marine Drive', clue: "The Queen's Necklace arching along the bay.", isCompleted: false, order: 1, lat: 18.9438, lng: 72.8230, verificationMode: 'gps' },
      { id: 'cp_mm2', spotId: 'girgaon-chowpatty', spotName: 'Girgaon Chowpatty', clue: 'The sandy beach famous for spicy Bhel Puri stalls.', isCompleted: false, order: 2, lat: 18.9549, lng: 72.8149, verificationMode: 'gps' },
    ],
    isActive: true,
    progress: 0,
  },
  // Goa
  {
    id: 'hunt_goa_beaches',
    title: 'Goa Beaches and Churches',
    description: 'Explore Portuguese heritage and golden sands in Goa.',
    difficulty: 'easy',
    estimatedTime: '3 hours',
    rewardCoins: 160,
    rewardBadge: '🏖️ Sun-kissed Traveler',
    city: 'Goa',
    checkpoints: [
      { id: 'cp_gb1', spotId: 'basilica-of-bom-jesus', spotName: 'Basilica of Bom Jesus', clue: 'Holds the sacred mortal remains of St. Francis Xavier.', isCompleted: false, order: 1, lat: 15.5009, lng: 73.9116, verificationMode: 'gps_photo' },
      { id: 'cp_gb2', spotId: 'calangute-beach', spotName: 'Calangute Beach', clue: 'The Queen of Beaches buzzing with shacks and water sports.', isCompleted: false, order: 2, lat: 15.5440, lng: 73.7552, verificationMode: 'gps' },
    ],
    isActive: true,
    progress: 0,
  },
  {
    id: 'hunt_goa_heritage',
    title: 'Goa Old Heritage Trail',
    description: "Uncover Panaji's colorful Latin quarters and historic structures.",
    difficulty: 'medium',
    estimatedTime: '2 hours',
    rewardCoins: 150,
    rewardBadge: '🇵🇹 Portuguese Historian',
    city: 'Goa',
    checkpoints: [
      { id: 'cp_gh1', spotId: 'fontainhas-latin-quarter', spotName: 'Fontainhas', clue: 'Brightly painted Portuguese-style heritage homes.', isCompleted: false, order: 1, lat: 15.4929, lng: 73.8313, verificationMode: 'gps_photo' },
      { id: 'cp_gh2', spotId: 'our-lady-of-immaculate-conception', spotName: 'Immaculate Conception Church', clue: 'Famous zig-zag white staircases overlooking Panaji town.', isCompleted: false, order: 2, lat: 15.4990, lng: 73.8284, verificationMode: 'gps_photo' },
    ],
    isActive: true,
    progress: 0,
  },
  // Bangalore
  {
    id: 'hunt_bangalore_gardens',
    title: 'Bangalore Tech and Gardens',
    description: "Walk through Bangalore's famous parks and botanical exhibits.",
    difficulty: 'easy',
    estimatedTime: '2 hours',
    rewardCoins: 130,
    rewardBadge: '🌳 Garden City Guide',
    city: 'Bangalore',
    checkpoints: [
      { id: 'cp_bg1', spotId: 'lalbagh-botanical-garden', spotName: 'Lalbagh Botanical Garden', clue: "The historic glasshouse designed after London's Crystal Palace.", isCompleted: false, order: 1, lat: 12.9507, lng: 77.5848, verificationMode: 'gps' },
      { id: 'cp_bg2', spotId: 'cubbon-park', spotName: 'Cubbon Park', clue: 'Lush green woods right in the center of Bengaluru.', isCompleted: false, order: 2, lat: 12.9763, lng: 77.5929, verificationMode: 'gps' },
    ],
    isActive: true,
    progress: 0,
  },
  {
    id: 'hunt_bangalore_palaces',
    title: 'Bangalore Royal Palaces',
    description: 'Visit royal estates and forts inside Bengaluru.',
    difficulty: 'medium',
    estimatedTime: '3 hours',
    rewardCoins: 180,
    rewardBadge: '🏰 Wodeyar Chronicler',
    city: 'Bangalore',
    checkpoints: [
      { id: 'cp_bp1', spotId: 'bangalore-palace', spotName: 'Bangalore Palace', clue: 'Resembles Windsor Castle with beautiful Tudor towers.', isCompleted: false, order: 1, lat: 12.9985, lng: 77.5920, verificationMode: 'gps_photo' },
      { id: 'cp_bp2', spotId: 'tipu-sultans-summer-palace', spotName: 'Tipu Sultan Summer Palace', clue: 'Ornate teakwood palace of the Tiger of Mysore.', isCompleted: false, order: 2, lat: 12.9588, lng: 77.5720, verificationMode: 'gps_photo' },
    ],
    isActive: true,
    progress: 0,
  },
  // Varanasi
  {
    id: 'hunt_varanasi_ghats',
    title: 'Varanasi Ghats Spiritual Journey',
    description: 'Perform a pilgrimage along the sacred Ganges river ghats.',
    difficulty: 'medium',
    estimatedTime: '3 hours',
    rewardCoins: 200,
    rewardBadge: '🙏 Ganga Pilgrim',
    city: 'Varanasi',
    checkpoints: [
      { id: 'cp_vg1', spotId: 'dashashwamedh-ghat', spotName: 'Dashashwamedh Ghat', clue: 'Where the grand evening Ganga Aarti rituals are performed.', isCompleted: false, order: 1, lat: 25.3057, lng: 83.0137, verificationMode: 'gps_photo' },
      { id: 'cp_vg2', spotId: 'manikarnika-ghat', spotName: 'Manikarnika Ghat', clue: 'The primary cremation ghat representing lifecycle endings.', isCompleted: false, order: 2, lat: 25.3092, lng: 83.0107, verificationMode: 'gps' },
      { id: 'cp_vg3', spotId: 'asshi-ghat', spotName: 'Assi Ghat', clue: 'Where the Assi river meets the Ganges, hosting early morning prayers.', isCompleted: false, order: 3, lat: 25.2830, lng: 83.0108, verificationMode: 'gps' },
    ],
    isActive: true,
    progress: 0,
  },
  {
    id: 'hunt_varanasi_temples',
    title: 'Varanasi Ancient Temples',
    description: 'Explore the oldest temples inside the spiritual capital.',
    difficulty: 'hard',
    estimatedTime: '4 hours',
    rewardCoins: 220,
    rewardBadge: '🔱 Mahadev Devotee',
    city: 'Varanasi',
    checkpoints: [
      { id: 'cp_vt1', spotId: 'kashi-vishwanath-temple', spotName: 'Kashi Vishwanath', clue: 'The golden spire housing the sacred Shiva Jyotirlinga.', isCompleted: false, order: 1, lat: 25.3108, lng: 83.0105, verificationMode: 'gps_photo' },
      { id: 'cp_vt2', spotId: 'sankat-mochan-hanuman-temple', spotName: 'Sankat Mochan', clue: 'Ancient monkey temple dedicated to Lord Hanuman.', isCompleted: false, order: 2, lat: 25.2880, lng: 83.0034, verificationMode: 'gps_photo' },
    ],
    isActive: true,
    progress: 0,
  },
  // Hyderabad
  {
    id: 'hunt_hyderabad_nizams',
    title: 'Hyderabad Nizams Heritage',
    description: 'Walk through royal heritage landmarks of the Deccan.',
    difficulty: 'medium',
    estimatedTime: '3 hours',
    rewardCoins: 190,
    rewardBadge: '👑 Deccan Nizam',
    city: 'Hyderabad',
    checkpoints: [
      { id: 'cp_hn1', spotId: 'charminar', spotName: 'Charminar', clue: 'The four-minareted global emblem of Hyderabad.', isCompleted: false, order: 1, lat: 17.3616, lng: 78.4747, verificationMode: 'gps_photo' },
      { id: 'cp_hn2', spotId: 'golconda-fort', spotName: 'Golconda Fort', clue: 'The acoustic wonder citadel where diamonds like Kohinoor were kept.', isCompleted: false, order: 2, lat: 17.3833, lng: 78.4011, verificationMode: 'gps_photo' },
    ],
    isActive: true,
    progress: 0,
  },
  {
    id: 'hunt_hyderabad_bazaars',
    title: 'Hyderabad Biryani and Bazaars',
    description: 'Savor Hyderabadi culinary treats and pearl markets.',
    difficulty: 'easy',
    estimatedTime: '2 hours',
    rewardCoins: 120,
    rewardBadge: '🍽️ Biryani Connoisseur',
    city: 'Hyderabad',
    checkpoints: [
      { id: 'cp_hb1', spotId: 'lad-bazaar', spotName: 'Lad Bazaar', clue: 'Historic bangle market near Charminar.', isCompleted: false, order: 1, lat: 17.3610, lng: 78.4740, verificationMode: 'gps' },
      { id: 'cp_hb2', spotId: 'chowmahalla-palace', spotName: 'Chowmahalla Palace', clue: 'Grand court halls of the Nizams containing vintage car collections.', isCompleted: false, order: 2, lat: 17.3583, lng: 78.4722, verificationMode: 'gps' },
    ],
    isActive: true,
    progress: 0,
  },
  // Amritsar
  {
    id: 'hunt_amritsar_golden',
    title: 'Amritsar Golden Temple Trail',
    description: 'Visit the holiest Sikh shrine and surrounding memorials.',
    difficulty: 'easy',
    estimatedTime: '2 hours',
    rewardCoins: 150,
    rewardBadge: '🕊️ Amritsar Peace',
    city: 'Amritsar',
    checkpoints: [
      { id: 'cp_am1', spotId: 'harmandir-sahib-golden-temple', spotName: 'Golden Temple', clue: 'The stunning golden sanctum surrounded by Amrit Sarovar lake.', isCompleted: false, order: 1, lat: 31.6200, lng: 74.8765, verificationMode: 'gps_photo' },
      { id: 'cp_am2', spotId: 'jallianwala-bagh', spotName: 'Jallianwala Bagh', clue: 'The memorial garden conserving the bullet-ridden walls.', isCompleted: false, order: 2, lat: 31.6213, lng: 74.8796, verificationMode: 'gps' },
    ],
    isActive: true,
    progress: 0,
  },
  // Hampi
  {
    id: 'hunt_hampi_ruins',
    title: 'Hampi Ruins Exploration',
    description: 'Explore the boulders and grand ruins of Vijayanagara Empire.',
    difficulty: 'hard',
    estimatedTime: '5 hours',
    rewardCoins: 260,
    rewardBadge: '🗿 Vijayanagara Scholar',
    city: 'Hampi',
    checkpoints: [
      { id: 'cp_ham1', spotId: 'virupaksha-temple', spotName: 'Virupaksha Temple', clue: 'The functioning tower temple dedicated to Lord Shiva.', isCompleted: false, order: 1, lat: 15.3350, lng: 76.4600, verificationMode: 'gps_photo' },
      { id: 'cp_ham2', spotId: 'vittala-temple', spotName: 'Vittala Temple', clue: 'The iconic stone chariot and musical pillars.', isCompleted: false, order: 2, lat: 15.3388, lng: 76.4661, verificationMode: 'gps_photo' },
    ],
    isActive: true,
    progress: 0,
  },
  // Darjeeling
  {
    id: 'hunt_darjeeling_tea',
    title: 'Darjeeling Tea Gardens Walk',
    description: 'Enjoy Himalayan views and misty tea valleys.',
    difficulty: 'easy',
    estimatedTime: '2 hours',
    rewardCoins: 140,
    rewardBadge: '🏔️ Himalayan Wanderer',
    city: 'Darjeeling',
    checkpoints: [
      { id: 'cp_dj1', spotId: 'tiger-hill-darjeeling', spotName: 'Tiger Hill', clue: 'Offers glorious sunrise views of Mt. Kanchenjunga.', isCompleted: false, order: 1, lat: 27.0119, lng: 88.2645, verificationMode: 'gps_photo' },
      { id: 'cp_dj2', spotId: 'happy-valley-tea-estate', spotName: 'Happy Valley Tea Estate', clue: 'Observe tea plucking along steep organic valley hills.', isCompleted: false, order: 2, lat: 27.0494, lng: 88.2592, verificationMode: 'gps' },
    ],
    isActive: true,
    progress: 0,
  },
  // Mysore
  {
    id: 'hunt_mysore_palace',
    title: 'Mysore Palace Heritage Trail',
    description: "Explore Mysore's royal legacy and sandalwood shops.",
    difficulty: 'easy',
    estimatedTime: '2 hours',
    rewardCoins: 150,
    rewardBadge: '👑 Mysore Prince',
    city: 'Mysore',
    checkpoints: [
      { id: 'cp_my1', spotId: 'mysore-palace', spotName: 'Mysore Palace', clue: 'The dazzling palace illuminated by 97,000 lightbulbs on Sundays.', isCompleted: false, order: 1, lat: 12.3052, lng: 76.6552, verificationMode: 'gps_photo' },
      { id: 'cp_my2', spotId: 'chamundi-hills', spotName: 'Chamundi Hills', clue: 'Climb the steps to the temple guarding Mysore valley.', isCompleted: false, order: 2, lat: 12.2724, lng: 76.6720, verificationMode: 'gps' },
    ],
    isActive: true,
    progress: 0,
  },
];

export function getHuntById(id: string): TreasureHunt | undefined {
  return treasureHunts.find(h => h.id === id);
}

export function getActiveHunts(): TreasureHunt[] {
  return treasureHunts.filter(h => h.isActive);
}

/** Average of checkpoint coordinates (fallback: null if none). */
export function getHuntCentroid(hunt: TreasureHunt): { lat: number; lng: number } | null {
  const pts = hunt.checkpoints.filter(
    (c) => typeof c.lat === 'number' && typeof c.lng === 'number' && !Number.isNaN(c.lat) && !Number.isNaN(c.lng),
  );
  if (!pts.length) return null;
  const lat = pts.reduce((s, c) => s + (c.lat as number), 0) / pts.length;
  const lng = pts.reduce((s, c) => s + (c.lng as number), 0) / pts.length;
  return { lat, lng };
}

/** True if any checkpoint (or hunt centroid) is within radiusKm of the user. */
export function isHuntNearPosition(
  hunt: TreasureHunt,
  lat: number,
  lng: number,
  radiusKm = 60,
): boolean {
  const radiusM = radiusKm * 1000;
  const withCoords = hunt.checkpoints.filter(
    (c) => typeof c.lat === 'number' && typeof c.lng === 'number',
  );
  if (withCoords.length) {
    return withCoords.some(
      (c) => haversineDistance(lat, lng, c.lat as number, c.lng as number) <= radiusM,
    );
  }
  const center = getHuntCentroid(hunt);
  if (!center) return false;
  return haversineDistance(lat, lng, center.lat, center.lng) <= radiusM;
}

/** Only hunts playable at the creator/user's current GPS. */
export function filterHuntsByGps(
  hunts: TreasureHunt[],
  lat?: number | null,
  lng?: number | null,
  radiusKm = 60,
): TreasureHunt[] {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return [];
  }
  return hunts.filter((h) => h.isActive !== false && isHuntNearPosition(h, lat, lng, radiusKm));
}

export function completeCheckpoint(huntId: string, checkpointId: string): void {
  const hunt = treasureHunts.find(h => h.id === huntId);
  if (hunt) {
    const checkpoint = hunt.checkpoints.find(c => c.id === checkpointId);
    if (checkpoint && !checkpoint.isCompleted) {
      checkpoint.isCompleted = true;
      const completedCount = hunt.checkpoints.filter(c => c.isCompleted).length;
      hunt.progress = Math.round((completedCount / hunt.checkpoints.length) * 100);
    }
  }
}

export function getUniqueCities(hunts: TreasureHunt[] = treasureHunts): string[] {
  return Array.from(new Set(hunts.map(h => h.city))).sort();
}