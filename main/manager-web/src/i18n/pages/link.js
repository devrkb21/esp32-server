// Linking a robot to the account (the robot's QR opens /#/link?code=123456), and the way in from
// My robots ("add with a code").
export default {
  bn: {
    'link.title': 'রোবট যুক্ত করুন',
    'link.lead': 'রোবটের স্ক্রিনের কোড দিয়ে রোবটটা আপনার অ্যাকাউন্টে যুক্ত হবে।',
    'link.signInLead': 'সাইন ইন করলেই রোবটটা আপনার অ্যাকাউন্টে যুক্ত হয়ে যাবে।',
    'link.codeLabel': 'রোবটের ৬ অঙ্কের কোড',
    'link.codeHint': 'কোডটা রোবটের স্ক্রিনে আছে। পুরো লিংক পেস্ট করলেও চলবে।',
    'link.robotFallback': 'আপনার রোবট',
    'link.macTail': 'MAC-এর শেষে {tail}',
    'link.robotCode': 'কোড',

    'link.enter.title': 'কোড দিয়ে রোবট যুক্ত করুন',
    'link.enter.lead': 'রোবট চালু করে Wi-Fi-তে যুক্ত করুন। স্ক্রিনে একটা QR আর ৬ অঙ্কের কোড আসবে। ফোনে QR স্ক্যান করুন, অথবা কোডটা এখানে লিখুন।',
    'link.enter.next': 'রোবট খুঁজুন',

    'link.guest.text': 'রোবটটা কোন অ্যাকাউন্টে যাবে, তা জানতে আগে সাইন ইন করুন। সাইন ইন শেষে এই পাতায় ফিরে রোবটটা যুক্ত হয়ে যাবে।',
    'link.guest.signIn': 'সাইন ইন করে যুক্ত করুন',
    'link.guest.register': 'নতুন অ্যাকাউন্ট খুলুন',

    'link.looking': 'রোবট খোঁজা হচ্ছে…',
    'link.linking': 'যুক্ত হচ্ছে…',
    'link.linkingInto': '{name} চরিত্রে যুক্ত হচ্ছে…',
    'link.found': 'এই রোবটটা যুক্ত হবে',

    'link.choose.title': 'কোন চরিত্রে চলবে?',
    'link.choose.lead': 'আপনার কয়েকটা চরিত্র আছে। রোবটটা কোন চরিত্রে কথা বলবে, বেছে নিন।',
    'link.choose.legend': 'চরিত্র',
    'link.choose.robots': 'রোবট নেই | রোবট {n}টা | রোবট {n}টা',
    'link.choose.current': 'এখন বেছে রাখা',
    'link.submit': 'যুক্ত করুন',

    'link.done': 'রোবট যুক্ত হয়েছে',
    'link.doneNew': 'রোবট যুক্ত হয়েছে, সাথে একটা নতুন চরিত্রও বানানো হলো',

    'link.err.title': 'রোবট যুক্ত হয়নি',
    'link.err.format': 'কোডটা ৬ অঙ্কের হতে হবে। রোবটের স্ক্রিন দেখে আবার লিখুন।',
    'link.err.expired': 'এই কোডটা আর চলছে না, হয়তো পুরনো হয়ে গেছে বা ভুল লেখা হয়েছে। রোবটটা আবার চালু করুন, স্ক্রিনে নতুন কোড আসবে।',
    'link.err.taken': 'এই রোবটটা আগে থেকেই একটা অ্যাকাউন্টে যুক্ত আছে। আপনার অ্যাকাউন্টে হলে রোবটের তালিকায় পাবেন।',
    'link.err.denied': 'এই চরিত্রটা আপনার অ্যাকাউন্টের নয়। অন্য চরিত্র বেছে নিন।',
    'link.err.failed': 'রোবট যুক্ত করা যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।',
    'link.err.agents': 'আপনার চরিত্রগুলো আনা যায়নি। আবার চেষ্টা করুন।',
    'link.retry': 'আবার চেষ্টা করুন',
    'link.manual': 'কোড নিজে লিখুন',
    'link.toRobots': 'রোবটের তালিকা দেখুন',
    'link.back': 'আমার রোবট',

    'robots.addByCode': 'কোড দিয়ে যোগ করুন',
    'robots.empty.linkText': 'টাইনিবট চালু করে Wi-Fi-তে যুক্ত করুন। স্ক্রিনে একটা QR আর ৬ অঙ্কের কোড আসবে। কোডটা দিলেই রোবট যুক্ত হবে, প্রথম চরিত্রটাও নিজে থেকে বানানো হবে।',
    'robots.add.codePaste': 'কোড, অথবা রোবটের পুরো লিংক পেস্ট করুন।',
  },
  en: {
    'link.title': 'Link your robot',
    'link.lead': 'The code on the robot\'s screen links the robot to your account.',
    'link.signInLead': 'Sign in and the robot is linked to your account right away.',
    'link.codeLabel': 'The robot\'s 6-digit code',
    'link.codeHint': 'The code is on the robot\'s screen. Pasting the whole link works too.',
    'link.robotFallback': 'Your robot',
    'link.macTail': 'MAC ends in {tail}',
    'link.robotCode': 'Code',

    'link.enter.title': 'Link a robot with its code',
    'link.enter.lead': 'Turn the robot on and connect it to Wi-Fi. Its screen shows a QR and a 6-digit code. Scan the QR with your phone, or type the code here.',
    'link.enter.next': 'Find the robot',

    'link.guest.text': 'Sign in first so we know whose account the robot joins. After signing in you come back here and the robot is linked.',
    'link.guest.signIn': 'Sign in to link it',
    'link.guest.register': 'Create an account',

    'link.looking': 'Looking for the robot…',
    'link.linking': 'Linking…',
    'link.linkingInto': 'Linking as {name}…',
    'link.found': 'This robot will be linked',

    'link.choose.title': 'Which character should it be?',
    'link.choose.lead': 'You have several characters. Choose the one this robot talks as.',
    'link.choose.legend': 'Character',
    'link.choose.robots': 'No robots | {n} robot | {n} robots',
    'link.choose.current': 'Chosen now',
    'link.submit': 'Link',

    'link.done': 'Robot linked',
    'link.doneNew': 'Robot linked, and a first character was made for it',

    'link.err.title': 'The robot was not linked',
    'link.err.format': 'The code has 6 digits. Check the robot\'s screen and type it again.',
    'link.err.expired': 'This code no longer works: it may be old or mistyped. Restart the robot and its screen shows a new code.',
    'link.err.taken': 'This robot is already linked to an account. If it is yours, you find it in your list of robots.',
    'link.err.denied': 'This character is not in your account. Choose another one.',
    'link.err.failed': 'The robot could not be linked. Check the internet connection and try again.',
    'link.err.agents': 'Your characters could not be loaded. Try again.',
    'link.retry': 'Try again',
    'link.manual': 'Type the code',
    'link.toRobots': 'See your robots',
    'link.back': 'My robots',

    'robots.addByCode': 'Add with a code',
    'robots.empty.linkText': 'Turn TinyBot on and connect it to Wi-Fi. Its screen shows a QR and a 6-digit code. Enter the code and the robot is added, with a first character made for you.',
    'robots.add.codePaste': 'Paste the code, or the robot\'s whole link.',
  },
};
