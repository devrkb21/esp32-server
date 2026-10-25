// Wake word & theme, back office (owner: web-theme). Page title comes from nav.themeGenerator.
// Most strings of this page are the themeGen.* keys of the shared locale files (bn and en are both
// written there); only the strings the new layout adds live here.
// themeGen.preview.sample stays English in Bangla on purpose: it is what the robot's 8 px subtitle
// line shows, and the preview draws it in a Latin bitmap-like font.
// Owner to confirm: the install is only offered to robots on the account's own list (plus a
// ?deviceId= link), as the legacy page did; there is no admin-wide robot search here.
export default {
  bn: {
    'theme.desc': 'কোন কথা শুনে টাইনিবট জেগে উঠবে তা বেছে নিন, assets.bin তৈরি করুন, আর Wi-Fi দিয়ে রোবটে ইনস্টল করুন।',
    'theme.rule': 'ইনস্টল করলে রোবট রিস্টার্ট হয়। মুখ, তার নড়াচড়া আর চ্যাটের ফন্ট ঠিক করা হয় চেহারা পাতায়।',
    'theme.openLook': 'চেহারা পাতা খুলুন',
    'theme.robot.title': 'রোবট',
    'theme.robot.desc': 'থিম কোন রোবটে যাবে। রোবট ছাড়াও ফাইলটি ডাউনলোড করতে পারবেন।',
    'theme.robot.pick': 'কোন রোবটে',
    'theme.robot.noneOption': 'কোনো রোবট নয় (শুধু ডাউনলোড)',
    'theme.robot.mac': 'MAC',
    'theme.wake.langLabel': 'কথার ভাষা',
    'theme.wake.searchLabel': 'জাগানোর কথা খুঁজুন',
    'theme.wake.searchPlaceholder': 'কথা খুঁজুন, যেমন Alexa',
    'theme.wake.clearSearch': 'খোঁজা মুছুন',
    'theme.wake.listLabel': 'জাগানোর কথাগুলো',
    'theme.wake.noMatch': '"{q}" এর সাথে কোনো কথা মেলেনি',
    'theme.sideLabel': 'প্রিভিউ আর ইনস্টল',
    'theme.preview.replay': 'আবার চালান',
    'theme.file.of': '{limit}-এর মধ্যে',
    'theme.steps.title': 'ইনস্টলের ধাপ',
    'theme.steps.pending': 'বাকি',
    'theme.steps.active': 'চলছে',
    'theme.steps.done': 'হয়েছে',
    'theme.steps.error': 'হয়নি',
  },
  en: {
    'theme.desc': 'Choose the phrase that wakes TinyBot, build its assets.bin and install it on a robot over Wi-Fi.',
    'theme.rule': 'Installing restarts the robot. The face, its moves and the chat font are set on the Look page.',
    'theme.openLook': 'Open Look',
    'theme.robot.title': 'Robot',
    'theme.robot.desc': 'Where the theme goes. Without a robot you can still download the file.',
    'theme.robot.pick': 'Install on',
    'theme.robot.noneOption': 'No robot (download only)',
    'theme.robot.mac': 'MAC',
    'theme.wake.langLabel': 'Language of the phrase',
    'theme.wake.searchLabel': 'Search wake phrases',
    'theme.wake.searchPlaceholder': 'Search a phrase, like Alexa',
    'theme.wake.clearSearch': 'Clear search',
    'theme.wake.listLabel': 'Wake phrases',
    'theme.wake.noMatch': 'No phrase matches "{q}"',
    'theme.sideLabel': 'Preview and install',
    'theme.preview.replay': 'Play again',
    'theme.file.of': 'of {limit}',
    'theme.steps.title': 'Install progress',
    'theme.steps.pending': 'waiting',
    'theme.steps.active': 'in progress',
    'theme.steps.done': 'done',
    'theme.steps.error': 'failed',
  },
};
