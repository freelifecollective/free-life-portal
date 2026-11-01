/** Reactions people can choose from. The thumbs up is the quick one-tap reaction. */
export const QUICK_REACTION = "👍";
const COMMON: readonly string[] = [
  "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "😉", "😊", "😇",
  "🥰", "😍", "🤩", "😘", "😗", "😚", "😋", "😛", "😜", "🤪", "😝", "🤑",
  "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄",
  "😬", "😌", "😔", "😪", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "🥵",
  "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "😎", "🤓", "🧐", "😕", "😟", "🙁",
  "😮", "😯", "😲", "😳", "🥺", "😦", "😧", "😨", "😰", "😥", "😢", "😭",
  "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "🤬",
  "😈", "💀", "💩", "🤡", "👻", "👽", "🤖", "🙈", "🙉", "🙊", "💋", "💌",
  "💘", "💝", "💖", "💗", "💓", "💞", "💕", "💟", "❣️", "💔", "❤️", "🧡",
  "💛", "💚", "💙", "💜", "🤎", "🖤", "🤍", "💯", "💢", "💥", "💫", "💦",
  "💨", "🕊️", "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉",
  "👆", "👇", "☝️", "✋", "🤚", "🖐️", "🖖", "👋", "🤝", "🙏", "✍️", "💪",
  "🦾", "👏", "🙌", "👐", "🤲", "🫶", "🙋", "🙆", "🙇", "🤷", "🤦", "💁",
  "🔥", "✨", "⭐", "🌟", "⚡", "🎉", "🎊", "🎈", "🎁", "🏆", "🥇", "🥈",
  "🥉", "🏅", "🎯", "🚀", "💎", "💰", "💵", "💸", "📈", "📣", "📢", "🔔",
  "💡", "📌", "📍", "✅", "☑️", "✔️", "❌", "❓", "❗", "‼️", "⚠️", "💧",
  "🚰", "🌊", "🌍", "🌎", "🌏", "🌱", "🌿", "🍀", "🌸", "🌹", "🌻", "🌞",
  "🌈", "☀️", "☁️", "❄️", "🍎", "🍌", "🍇", "🍓", "🍕", "🍔", "🍟", "☕",
  "🍷", "🍺", "🥂", "🏠", "🚗", "✈️", "⏰", "📱", "💻", "📷", "🎥", "🎧",
  "🎶", "🎵", "📚", "📝", "🔑", "🔒", "🕐",
];

const sp = (t: string) => t.split(/\s+/).filter(Boolean);
const ANIMALS = sp("🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🪱 🐛 🦋 🐌 🐞 🐜 🪲 🦟 🐢 🐍 🦎 🦖 🐙 🦑 🦐 🦀 🐡 🐠 🐟 🐬 🐳 🐋 🦈 🐊 🐅 🐆 🦓 🦍 🐘 🦛 🦏 🐪 🦒 🦘 🐃 🐂 🐄 🐎 🐖 🐏 🐑 🦙 🐐 🦌 🐕 🐩 🐈 🐓 🦃 🦚 🦜 🦢 🦩 🕊️ 🐇 🦝 🦨 🦦 🦥 🐁 🐀 🐿️ 🦔 🌵 🎄 🌲 🌳 🌴 🌱 🌿 ☘️ 🍀 🎍 🍃 🍂 🍁 🍄 🌾 💐 🌷 🌹 🥀 🌺 🌸 🌼 🌻");
const FOOD = sp("🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥬 🥒 🌶️ 🌽 🥕 🧄 🧅 🥔 🍠 🥐 🥯 🍞 🥖 🥨 🧀 🥚 🍳 🧈 🥞 🧇 🥓 🥩 🍗 🍖 🌭 🍔 🍟 🍕 🥪 🥙 🧆 🌮 🌯 🥗 🥘 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🍤 🍙 🍚 🍘 🍥 🥠 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍿 🍩 🍪 🌰 🥜 🍯 🥛 🍼 ☕ 🍵 🧃 🥤 🍶 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🍾 🧊 🥄 🍴 🍽️");
const TRAVEL = sp("🚗 🚕 🚙 🚌 🏎️ 🚓 🚑 🚒 🚚 🚜 🛵 🏍️ 🚲 🛴 🚂 🚆 🚇 🚊 ✈️ 🛫 🛬 🚁 🚀 🛸 ⛵ 🚤 🛳️ 🚢 ⚓ ⛽ 🚦 🗺️ 🗽 🗼 🏰 🏯 🎡 🎢 🎠 ⛲ ⛱️ 🏖️ 🏝️ 🏜️ 🌋 ⛰️ 🏔️ 🗻 🏕️ ⛺ 🏠 🏡 🏢 🏬 🏥 🏦 🏨 🏫 ⛪ 🕌 🌅 🌄 🌆 🌇 🌉 🌃 🌌 🌠 🎆 🎇 🌍 🌎 🌏");
const ACTIVITIES = sp("⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🎱 🏓 🏸 🥅 ⛳ 🏹 🎣 🥊 🥋 ⛸️ 🎿 🛷 🏂 🏋️ 🤸 🤾 🏌️ 🏇 🧘 🏄 🏊 🚴 🏆 🥇 🥈 🥉 🏅 🎖️ 🎗️ 🎫 🎟️ 🎪 🎭 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🎸 🎻 🎲 ♟️ 🎯 🎳 🎮 🎰 🧩");
const OBJECTS = sp("⌚ 📱 💻 ⌨️ 🖥️ 🖨️ 🖱️ 💽 💾 📷 📸 📹 🎥 📞 ☎️ 📺 📻 ⏰ ⏱️ ⏳ 📡 🔋 🔌 💡 🔦 🕯️ 💸 💵 💴 💶 💷 💰 💳 💎 ⚖️ 🔧 🔨 ⚒️ 🛠️ ⛏️ 🔩 ⚙️ 🧰 🔫 💣 🔪 🛡️ 🚪 🛏️ 🛋️ 🚿 🛁 🧴 🧼 🧽 🛒 🎁 🎈 🎀 🎊 🎉 ✉️ 📧 📦 📮 📜 📃 📄 📊 📈 📉 📅 📆 📋 📌 📍 📎 ✂️ 🗂️ 📁 📂 🗑️ 🔒 🔓 🔑 🗝️ 📝 ✏️ 🖊️ 🖌️ 🔍 🔎 📚 📖 🔖 🧲 🧪 🧬 🔬 🔭 💊 💉 🩺 🩹");
const SYMBOLS = sp("❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ☮️ ✝️ ☪️ 🕉️ ☸️ ✡️ 🔯 ☯️ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ ⛎ ✅ ☑️ ✔️ ❌ ❎ ➕ ➖ ➗ ✖️ ♾️ ‼️ ⁉️ ❓ ❔ ❕ ❗ 〰️ 💯 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤 🔺 🔻 🔸 🔹 🔶 🔷 ⬆️ ⬇️ ⬅️ ➡️ ↗️ ↘️ ↙️ ↖️ ↕️ ↔️ 🔄 🔁 🔃 ▶️ ⏸️ ⏹️ ⏩ ⏪ 🔔 🔕 📣 📢 💬 💭 🗯️ ♠️ ♥️ ♦️ ♣️ 🃏 🆗 🆒 🆕 🆓 🔝 🔜 ™️ ©️ ®️ ✨ ⭐ 🌟 💫 ⚡ 🔥 💥 💢 💦 💨 ☮️");
const CODES = "AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BM BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CK CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FK FO FR GA GB GD GE GF GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MK ML MM MN MO MQ MR MS MT MU MV MW MX MY MZ NA NC NE NG NI NL NO NP NR NZ OM PA PE PF PG PH PK PL PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TC TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WS XK YE ZA ZM ZW".split(" ");
const FLAGS = [...["🏁", "🚩", "🎌", "🏴", "🏳️", "🏳️‍🌈", "🏴‍☠️"], ...CODES.map((c) => String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)))];

/** The emoji picker's tabs. */
export const EMOJI_CATEGORIES: readonly { id: string; icon: string; name: string; list: readonly string[] }[] = [
  { id: "smileys", icon: "😀", name: "Smileys and people", list: COMMON },
  { id: "animals", icon: "🐶", name: "Animals and nature", list: ANIMALS },
  { id: "food", icon: "🍔", name: "Food and drink", list: FOOD },
  { id: "travel", icon: "🚗", name: "Travel and places", list: TRAVEL },
  { id: "activities", icon: "⚽", name: "Activities", list: ACTIVITIES },
  { id: "objects", icon: "💡", name: "Objects", list: OBJECTS },
  { id: "symbols", icon: "❤️", name: "Symbols", list: SYMBOLS },
  { id: "flags", icon: "🏁", name: "Flags", list: FLAGS },
];
export const EMOJI: readonly string[] = [...new Set(EMOJI_CATEGORIES.flatMap((c) => c.list))];
export const EMOJI_SET = new Set<string>(EMOJI);
