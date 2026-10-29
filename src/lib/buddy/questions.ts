/* Copied from the approved questionnaire prototype. Question keys (not positions) identify saved answers. */
export type Question = { k: string; sec: string; t: "single" | "multi" | "select" | "text" | "number" | "city"; q: string; h?: string; o?: string[]; max?: number; one?: boolean; excl?: string[]; tags?: boolean; ph?: string; min?: number };
export const RANKS = ["1A","2A","3A","4A","5A","6A","6A+"] as const;
export const PNA = "Prefer not to answer";
export const MINLEN = 10;
export const QUESTIONS: Question[] = [
 {
  "sec": "Let's find you an accountability buddy",
  "t": "city",
  "q": "Which city are you closest to?",
  "h": "Start typing your city and we'll set your timezone for you, including daylight saving.",
  "k": "tz"
 },
 {
  "sec": "Let's find you an accountability buddy",
  "t": "single",
  "q": "Are you a morning or a night person?",
  "o": [
   "Early bird",
   "Midday",
   "Night owl",
   "It varies"
  ],
  "k": "chrono"
 },
 {
  "sec": "Let's find you an accountability buddy",
  "t": "single",
  "q": "How often do you want to check in with your AB?",
  "o": [
   "1-2 times a week",
   "3-4 times a week",
   "5-6 times a week",
   "Daily"
  ],
  "k": "checkin"
 },
 {
  "sec": "Let's find you an accountability buddy",
  "t": "single",
  "q": "How would you prefer to connect?",
  "o": [
   "Text or voice notes",
   "Quick calls",
   "Video calls",
   "A mix of everything"
  ],
  "k": "connect"
 },
 {
  "sec": "Let's find you an accountability buddy",
  "t": "single",
  "q": "What is your gender?",
  "o": [
   "Male",
   "Female"
  ],
  "k": "gender"
 },
 {
  "sec": "Let's find you an accountability buddy",
  "t": "number",
  "q": "How old are you?",
  "h": "We use this to match you with people around your age. Other members never see it.",
  "min": 18,
  "max": 99,
  "ph": "Age",
  "k": "age"
 },
 {
  "sec": "Let's find you an accountability buddy",
  "t": "multi",
  "max": 99,
  "excl": [
   "No kids",
   "Prefer not to answer"
  ],
  "q": "Do you have kids?",
  "h": "Choose all that apply. Your family life shapes your time and energy, so we match on it.",
  "o": [
   "No kids",
   "I have kids ages 4 and under",
   "I have kids ages 5-12",
   "I have teenagers",
   "I have adult children",
   "Prefer not to answer"
  ],
  "k": "kids"
 },
 {
  "sec": "Let's find you an accountability buddy",
  "t": "single",
  "q": "Would you prefer to be paired with someone of the same gender?",
  "o": [
   "Yes, same gender",
   "No preference"
  ],
  "k": "samegender"
 },
 {
  "sec": "Your business",
  "t": "single",
  "q": "When did you join our community?",
  "o": [
   "Less than a month ago",
   "1 to 3 months ago",
   "3 to 6 months ago",
   "6 to 12 months ago",
   "More than a year ago"
  ],
  "k": "joined"
 },
 {
  "sec": "Your business",
  "t": "single",
  "q": "When did you order your products?",
  "o": [
   "Less than a month ago",
   "1 to 3 months ago",
   "3 to 6 months ago",
   "6 to 12 months ago",
   "More than a year ago"
  ],
  "k": "ordered"
 },
 {
  "sec": "Your business",
  "t": "select",
  "q": "What is your current rank?",
  "h": "This is only used for matching. It is never shown to other members.",
  "o": [
   "1A",
   "2A",
   "3A",
   "4A",
   "5A",
   "6A",
   "6A+"
  ],
  "ph": "Choose your rank",
  "k": "rank"
 },
 {
  "sec": "Your business",
  "t": "single",
  "q": "Would you prefer to be paired with someone at the same rank as you?",
  "h": "If you select 'It does not matter' you will be shown people two ranks below and above you.",
  "o": [
   "Yes, my rank only",
   "It does not matter"
  ],
  "k": "rankpref"
 },
 {
  "sec": "Goals and drive",
  "t": "multi",
  "max": 3,
  "one": true,
  "q": "What are your top three goals for your business?",
  "h": "Choose up to 3.",
  "o": [
   "Create a legacy I can be proud of",
   "Help other people",
   "Leave my job",
   "Personal growth",
   "Prioritize my health and wellness",
   "Stay home with my family",
   "Travel the world"
  ],
  "k": "goals"
 },
 {
  "sec": "Goals and drive",
  "t": "multi",
  "max": 99,
  "q": "What would success look like for you in 12 months?",
  "h": "Select as many as you like.",
  "o": [
   "I've grown and let go of many limiting beliefs",
   "I'm proud of the person I've become",
   "I've earned back my investment",
   "I've ranked up to 4A",
   "Money is no longer tight at home",
   "No more fear around money",
   "I've replaced my 9-5 income",
   "I've left my 9-5",
   "I'm able to buy + do things I couldn't before"
  ],
  "k": "success"
 },
 {
  "sec": "Goals and drive",
  "t": "multi",
  "max": 99,
  "excl": [
   "All of the above"
  ],
  "q": "What usually gets in your way?",
  "h": "Choose all that apply.",
  "o": [
   "Confidence",
   "Fear of reaching out",
   "Feeling overwhelmed",
   "Finding time",
   "Knowing where to start",
   "Self-doubt",
   "Staying consistent",
   "All of the above"
  ],
  "k": "derail"
 },
 {
  "sec": "Goals and drive",
  "t": "multi",
  "max": 3,
  "q": "What do you most want from an AB?",
  "h": "Pick your top three",
  "o": [
   "Firm accountability",
   "Gentle encouragement",
   "Idea sharing",
   "Someone to celebrate wins with",
   "Someone to vent to",
   "Someone who pushes me out of my comfort zone",
   "Someone who won't take my excuses"
  ],
  "k": "want"
 },
 {
  "sec": "Goals and drive",
  "t": "multi",
  "max": 99,
  "excl": [
   "All of the above"
  ],
  "q": "How do you respond best to being held accountable?",
  "h": "Choose all that apply.",
  "o": [
   "A gentle nudge",
   "Direct, blunt honesty",
   "Humour and keeping it light",
   "All of the above"
  ],
  "k": "style"
 },
 {
  "sec": "Personality",
  "t": "single",
  "q": "After a long day, how do you recharge?",
  "o": [
   "Time with people",
   "Time alone",
   "A bit of both"
  ],
  "k": "recharge"
 },
 {
  "sec": "Personality",
  "t": "single",
  "q": "When you make decisions, which sounds more like you?",
  "h": "Choose the option most suitable to you",
  "o": [
   "I go with my gut",
   "I think it through carefully",
   "I overthink everything, I like to bounce decisions off other people",
   "I wait until the last minute to make decisions"
  ],
  "k": "decide"
 },
 {
  "sec": "Personality",
  "t": "single",
  "q": "Which describes you better?",
  "o": [
   "I like a plan",
   "I like to go with the flow"
  ],
  "k": "plan"
 },
 {
  "sec": "Personality",
  "t": "multi",
  "max": 3,
  "tags": true,
  "q": "How would your friends describe you?",
  "h": "Choose up to 3.",
  "o": [
   "Adventurous",
   "Calm",
   "Caring",
   "Creative",
   "Curious",
   "Direct",
   "Driven",
   "Easygoing",
   "Funny",
   "Loyal",
   "Organized",
   "Spiritual"
  ],
  "k": "friends"
 },
 {
  "sec": "Interests and life",
  "t": "multi",
  "max": 5,
  "tags": true,
  "q": "What are your biggest passions and interests?",
  "h": "Choose up to 5.",
  "o": [
   "Art",
   "Cooking",
   "Entrepreneurship",
   "Faith",
   "Family",
   "Fashion",
   "Fitness",
   "Gardening",
   "Movies",
   "Music",
   "Nature",
   "Personal growth",
   "Pets",
   "Reading",
   "Sports",
   "Travel",
   "Volunteering",
   "Writing"
  ],
  "k": "interests"
 },
 {
  "sec": "Interests and life",
  "t": "multi",
  "max": 99,
  "excl": [
   "All of the above"
  ],
  "q": "What does a great weekend look like for you?",
  "h": "Not every weekend will look the same, choose the options you like in general",
  "o": [
   "Spending time alone",
   "Spending time with family",
   "Spending time with friends",
   "Going on an adventure",
   "Going to a social event",
   "Working on my business",
   "All of the above"
  ],
  "k": "weekend"
 },
 {
  "sec": "Values",
  "t": "multi",
  "max": 3,
  "q": "What matters most to you in a friendship?",
  "h": "Choose the top 3 most important things to you",
  "o": [
   "Honesty",
   "Integrity",
   "Loyalty",
   "Shared beliefs",
   "Shared interests",
   "We both prioritize personal growth",
   "We enjoy spending time together",
   "We're extremely supportive of each other",
   "We're unafraid to call each other out"
  ],
  "k": "values"
 },
 {
  "sec": "Values",
  "t": "text",
  "q": "In a sentence or two, tell your AB a bit about you.",
  "ph": "A little about me…",
  "k": "about"
 },
 {
  "sec": "Values",
  "t": "text",
  "q": "What is one personal goal you're working on right now, outside of your business?",
  "h": "For example: running a half marathon, learning a new language, paying off debt, being more present with my kids, or reading more.",
  "ph": "Right now I am working on…",
  "k": "working"
 }
];
/** [city, country, IANA time zone] */
export const CITIES: [string, string, string][] = [["New York","United States","America/New_York"],["Los Angeles","United States","America/Los_Angeles"],["Chicago","United States","America/Chicago"],["Houston","United States","America/Chicago"],["Phoenix","United States","America/Phoenix"],["Philadelphia","United States","America/New_York"],["San Antonio","United States","America/Chicago"],["San Diego","United States","America/Los_Angeles"],["Dallas","United States","America/Chicago"],["San Jose","United States","America/Los_Angeles"],["Austin","United States","America/Chicago"],["Jacksonville","United States","America/New_York"],["Fort Worth","United States","America/Chicago"],["Columbus","United States","America/New_York"],["Charlotte","United States","America/New_York"],["San Francisco","United States","America/Los_Angeles"],["Indianapolis","United States","America/Indiana/Indianapolis"],["Seattle","United States","America/Los_Angeles"],["Denver","United States","America/Denver"],["Washington DC","United States","America/New_York"],["Boston","United States","America/New_York"],["El Paso","United States","America/Denver"],["Nashville","United States","America/Chicago"],["Detroit","United States","America/Detroit"],["Oklahoma City","United States","America/Chicago"],["Portland","United States","America/Los_Angeles"],["Las Vegas","United States","America/Los_Angeles"],["Memphis","United States","America/Chicago"],["Louisville","United States","America/Kentucky/Louisville"],["Baltimore","United States","America/New_York"],["Milwaukee","United States","America/Chicago"],["Albuquerque","United States","America/Denver"],["Tucson","United States","America/Phoenix"],["Fresno","United States","America/Los_Angeles"],["Sacramento","United States","America/Los_Angeles"],["Kansas City","United States","America/Chicago"],["Atlanta","United States","America/New_York"],["Miami","United States","America/New_York"],["Omaha","United States","America/Chicago"],["Raleigh","United States","America/New_York"],["Minneapolis","United States","America/Chicago"],["Tampa","United States","America/New_York"],["Orlando","United States","America/New_York"],["New Orleans","United States","America/Chicago"],["Cleveland","United States","America/New_York"],["Pittsburgh","United States","America/New_York"],["Cincinnati","United States","America/New_York"],["St. Louis","United States","America/Chicago"],["Salt Lake City","United States","America/Denver"],["Honolulu","United States","Pacific/Honolulu"],["Anchorage","United States","America/Anchorage"],["Boise","United States","America/Boise"],["Charleston","United States","America/New_York"],["Birmingham","United States","America/Chicago"],["Richmond","United States","America/New_York"],["Buffalo","United States","America/New_York"],["Tulsa","United States","America/Chicago"],["Des Moines","United States","America/Chicago"],["Little Rock","United States","America/Chicago"],["Spokane","United States","America/Los_Angeles"],["Colorado Springs","United States","America/Denver"],["Greenville","United States","America/New_York"],["Savannah","United States","America/New_York"],["Madison","United States","America/Chicago"],["Providence","United States","America/New_York"],["Hartford","United States","America/New_York"],["Albany","United States","America/New_York"],["Lexington","United States","America/New_York"],["Knoxville","United States","America/New_York"],["Baton Rouge","United States","America/Chicago"],["Reno","United States","America/Los_Angeles"],["Santa Barbara","United States","America/Los_Angeles"],["Orange County","United States","America/Los_Angeles"],["Scottsdale","United States","America/Phoenix"],["Toronto","Canada","America/Toronto"],["Montreal","Canada","America/Toronto"],["Vancouver","Canada","America/Vancouver"],["Calgary","Canada","America/Edmonton"],["Edmonton","Canada","America/Edmonton"],["Ottawa","Canada","America/Toronto"],["Winnipeg","Canada","America/Winnipeg"],["Quebec City","Canada","America/Toronto"],["Hamilton","Canada","America/Toronto"],["Halifax","Canada","America/Halifax"],["Saskatoon","Canada","America/Regina"],["Regina","Canada","America/Regina"],["St. John's","Canada","America/St_Johns"],["Victoria","Canada","America/Vancouver"],["London","Canada","America/Toronto"],["Kelowna","Canada","America/Vancouver"],["Moncton","Canada","America/Moncton"],["Fredericton","Canada","America/Moncton"],["Charlottetown","Canada","America/Halifax"],["Whitehorse","Canada","America/Whitehorse"],["Yellowknife","Canada","America/Edmonton"],["Mississauga","Canada","America/Toronto"],["Brampton","Canada","America/Toronto"],["Surrey","Canada","America/Vancouver"],["Kitchener","Canada","America/Toronto"],["Windsor","Canada","America/Toronto"],["Red Deer","Canada","America/Edmonton"],["Lethbridge","Canada","America/Edmonton"],["Thunder Bay","Canada","America/Toronto"],["Sudbury","Canada","America/Toronto"],["Mexico City","Mexico","America/Mexico_City"],["Guadalajara","Mexico","America/Mexico_City"],["Monterrey","Mexico","America/Monterrey"],["Puebla","Mexico","America/Mexico_City"],["Tijuana","Mexico","America/Tijuana"],["Cancun","Mexico","America/Cancun"],["Merida","Mexico","America/Merida"],["Leon","Mexico","America/Mexico_City"],["Queretaro","Mexico","America/Mexico_City"],["Chihuahua","Mexico","America/Chihuahua"],["Hermosillo","Mexico","America/Hermosillo"],["Culiacan","Mexico","America/Mazatlan"],["La Paz","Mexico","America/Mazatlan"],["Acapulco","Mexico","America/Mexico_City"],["Veracruz","Mexico","America/Mexico_City"],["Oaxaca","Mexico","America/Mexico_City"],["Playa del Carmen","Mexico","America/Cancun"],["Puerto Vallarta","Mexico","America/Mexico_City"],["San Luis Potosi","Mexico","America/Mexico_City"],["Mazatlan","Mexico","America/Mazatlan"],["Ciudad Juarez","Mexico","America/Ciudad_Juarez"],["Mexicali","Mexico","America/Tijuana"],["London","United Kingdom","Europe/London"],["Manchester","United Kingdom","Europe/London"],["Birmingham","United Kingdom","Europe/London"],["Glasgow","United Kingdom","Europe/London"],["Edinburgh","United Kingdom","Europe/London"],["Liverpool","United Kingdom","Europe/London"],["Leeds","United Kingdom","Europe/London"],["Bristol","United Kingdom","Europe/London"],["Cardiff","United Kingdom","Europe/London"],["Belfast","United Kingdom","Europe/London"],["Sheffield","United Kingdom","Europe/London"],["Newcastle","United Kingdom","Europe/London"],["Nottingham","United Kingdom","Europe/London"],["Southampton","United Kingdom","Europe/London"],["Brighton","United Kingdom","Europe/London"],["Dublin","Ireland","Europe/Dublin"],["Cork","Ireland","Europe/Dublin"],["Galway","Ireland","Europe/Dublin"],["Limerick","Ireland","Europe/Dublin"],["Paris","France","Europe/Paris"],["Lyon","France","Europe/Paris"],["Marseille","France","Europe/Paris"],["Berlin","Germany","Europe/Berlin"],["Munich","Germany","Europe/Berlin"],["Hamburg","Germany","Europe/Berlin"],["Frankfurt","Germany","Europe/Berlin"],["Cologne","Germany","Europe/Berlin"],["Madrid","Spain","Europe/Madrid"],["Barcelona","Spain","Europe/Madrid"],["Valencia","Spain","Europe/Madrid"],["Seville","Spain","Europe/Madrid"],["Lisbon","Portugal","Europe/Lisbon"],["Porto","Portugal","Europe/Lisbon"],["Rome","Italy","Europe/Rome"],["Milan","Italy","Europe/Rome"],["Naples","Italy","Europe/Rome"],["Turin","Italy","Europe/Rome"],["Florence","Italy","Europe/Rome"],["Amsterdam","Netherlands","Europe/Amsterdam"],["Rotterdam","Netherlands","Europe/Amsterdam"],["Brussels","Belgium","Europe/Brussels"],["Antwerp","Belgium","Europe/Brussels"],["Vienna","Austria","Europe/Vienna"],["Zurich","Switzerland","Europe/Zurich"],["Geneva","Switzerland","Europe/Zurich"],["Stockholm","Sweden","Europe/Stockholm"],["Gothenburg","Sweden","Europe/Stockholm"],["Oslo","Norway","Europe/Oslo"],["Copenhagen","Denmark","Europe/Copenhagen"],["Helsinki","Finland","Europe/Helsinki"],["Warsaw","Poland","Europe/Warsaw"],["Krakow","Poland","Europe/Warsaw"],["Prague","Czechia","Europe/Prague"],["Budapest","Hungary","Europe/Budapest"],["Athens","Greece","Europe/Athens"],["Bucharest","Romania","Europe/Bucharest"],["Sofia","Bulgaria","Europe/Sofia"],["Kyiv","Ukraine","Europe/Kyiv"],["Istanbul","Turkey","Europe/Istanbul"],["Moscow","Russia","Europe/Moscow"],["Reykjavik","Iceland","Atlantic/Reykjavik"],["Luxembourg","Luxembourg","Europe/Luxembourg"],["Zagreb","Croatia","Europe/Zagreb"],["Belgrade","Serbia","Europe/Belgrade"],["Tallinn","Estonia","Europe/Tallinn"],["Riga","Latvia","Europe/Riga"],["Vilnius","Lithuania","Europe/Vilnius"],["Malta","Malta","Europe/Malta"],["Valletta","Malta","Europe/Malta"],["Sydney","Australia","Australia/Sydney"],["Melbourne","Australia","Australia/Melbourne"],["Brisbane","Australia","Australia/Brisbane"],["Perth","Australia","Australia/Perth"],["Adelaide","Australia","Australia/Adelaide"],["Gold Coast","Australia","Australia/Brisbane"],["Canberra","Australia","Australia/Sydney"],["Hobart","Australia","Australia/Hobart"],["Darwin","Australia","Australia/Darwin"],["Newcastle","Australia","Australia/Sydney"],["Cairns","Australia","Australia/Brisbane"],["Townsville","Australia","Australia/Brisbane"],["Sunshine Coast","Australia","Australia/Brisbane"],["Wollongong","Australia","Australia/Sydney"],["Geelong","Australia","Australia/Melbourne"],["Alice Springs","Australia","Australia/Darwin"],["Auckland","New Zealand","Pacific/Auckland"],["Wellington","New Zealand","Pacific/Auckland"],["Christchurch","New Zealand","Pacific/Auckland"],["Hamilton","New Zealand","Pacific/Auckland"],["Tauranga","New Zealand","Pacific/Auckland"],["Dunedin","New Zealand","Pacific/Auckland"],["Queenstown","New Zealand","Pacific/Auckland"],["Napier","New Zealand","Pacific/Auckland"],["Nelson","New Zealand","Pacific/Auckland"],["Rotorua","New Zealand","Pacific/Auckland"],["Dubai","UAE","Asia/Dubai"],["Abu Dhabi","UAE","Asia/Dubai"],["Doha","Qatar","Asia/Qatar"],["Riyadh","Saudi Arabia","Asia/Riyadh"],["Tel Aviv","Israel","Asia/Jerusalem"],["Mumbai","India","Asia/Kolkata"],["Delhi","India","Asia/Kolkata"],["Bangalore","India","Asia/Kolkata"],["Singapore","Singapore","Asia/Singapore"],["Hong Kong","Hong Kong","Asia/Hong_Kong"],["Tokyo","Japan","Asia/Tokyo"],["Seoul","South Korea","Asia/Seoul"],["Manila","Philippines","Asia/Manila"],["Bangkok","Thailand","Asia/Bangkok"],["Jakarta","Indonesia","Asia/Jakarta"],["Kuala Lumpur","Malaysia","Asia/Kuala_Lumpur"],["Johannesburg","South Africa","Africa/Johannesburg"],["Cape Town","South Africa","Africa/Johannesburg"],["Lagos","Nigeria","Africa/Lagos"],["Nairobi","Kenya","Africa/Nairobi"],["Cairo","Egypt","Africa/Cairo"],["Sao Paulo","Brazil","America/Sao_Paulo"],["Rio de Janeiro","Brazil","America/Sao_Paulo"],["Buenos Aires","Argentina","America/Argentina/Buenos_Aires"],["Bogota","Colombia","America/Bogota"],["Lima","Peru","America/Lima"],["Santiago","Chile","America/Santiago"],["San Juan","Puerto Rico","America/Puerto_Rico"],["Panama City","Panama","America/Panama"],["San Jose","Costa Rica","America/Costa_Rica"],["Kingston","Jamaica","America/Jamaica"],["Nassau","Bahamas","America/Nassau"],["Bermuda","Bermuda","Atlantic/Bermuda"]];
/** [label, IANA time zone] for people who cannot find their city */
export const ZONES: [string, string][] = [["Hawaii (Honolulu)","Pacific/Honolulu"],["Alaska (Anchorage)","America/Anchorage"],["Pacific Time (Los Angeles, Vancouver, Seattle)","America/Los_Angeles"],["Mountain Time (Denver, Calgary)","America/Denver"],["Arizona, no daylight saving (Phoenix)","America/Phoenix"],["Central Time (Chicago, Dallas, Winnipeg)","America/Chicago"],["Mexico (Mexico City, Guadalajara, Monterrey)","America/Mexico_City"],["Eastern Time (New York, Toronto, Miami)","America/New_York"],["Atlantic Time (Halifax, San Juan)","America/Halifax"],["Newfoundland (St. John's)","America/St_Johns"],["Brazil (São Paulo)","America/Sao_Paulo"],["UK, Ireland and Portugal (London, Dublin, Lisbon)","Europe/London"],["Central Europe (Paris, Berlin, Madrid, Rome)","Europe/Paris"],["Eastern Europe (Athens, Helsinki, Kyiv)","Europe/Athens"],["Moscow and Turkey (Moscow, Istanbul)","Europe/Istanbul"],["Gulf (Dubai, Abu Dhabi)","Asia/Dubai"],["India (Mumbai, Delhi, Bangalore)","Asia/Kolkata"],["Southeast Asia (Bangkok, Jakarta)","Asia/Bangkok"],["Singapore, Perth, Hong Kong","Asia/Singapore"],["Japan and Korea (Tokyo, Seoul)","Asia/Tokyo"],["Central Australia (Adelaide, Darwin)","Australia/Adelaide"],["Eastern Australia (Sydney, Melbourne, Brisbane)","Australia/Sydney"],["New Zealand (Auckland, Wellington)","Pacific/Auckland"]];
