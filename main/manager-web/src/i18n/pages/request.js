// What a failed request says to a person (src/utils/errorText.mjs, src/apis/httpRequest.js).
// Plain words, never the server's raw text. Keep in step with manager-mobile/src/i18n/pages/request.ts.
export default {
  bn: {
    'request.sessionEnded': 'আপনার সেশন শেষ হয়েছে। আবার সাইন ইন করুন।',
    'request.forbidden': 'এটি করার অনুমতি আপনার নেই।',
    'request.notFound': 'যা খুঁজছেন তা পাওয়া যায়নি। হয়তো এটি সরিয়ে ফেলা হয়েছে।',
    'request.server': 'সার্ভারে এখন সমস্যা হচ্ছে। একটু পরে আবার চেষ্টা করুন।',
    'request.failed': 'কাজটি করা গেল না। আবার চেষ্টা করুন।',
    'request.busy': 'এখন অনেক অনুরোধ আসছে। একটু পরে আবার চেষ্টা করুন।',
    'request.tooLarge': 'ফাইলটি অনেক বড়। ছোট একটি ফাইল দিন।',
    'request.connecting': 'সার্ভারের সাথে যুক্ত হওয়ার চেষ্টা চলছে ({n})',
    'network.timeout': 'সার্ভার উত্তর দিতে অনেক দেরি করেছে। সংযোগ দেখে আবার চেষ্টা করুন।',
    'network.unreachable': 'সার্ভারে পৌঁছানো যাচ্ছে না। আপনার ইন্টারনেট সংযোগ চালু আছে কি না দেখুন।',
  },
  en: {
    'request.sessionEnded': 'Your session has ended. Please sign in again.',
    'request.forbidden': 'You do not have permission to do this.',
    'request.notFound': 'That could not be found. It may have been removed.',
    'request.server': 'The server is having trouble right now. Try again in a little while.',
    'request.failed': 'That did not work. Please try again.',
    'request.busy': 'Too many requests right now. Try again in a moment.',
    'request.tooLarge': 'The file is too large. Choose a smaller one.',
    'request.connecting': 'Trying to reach the server ({n})',
    'network.timeout': 'The server took too long to answer. Check your connection and try again.',
    'network.unreachable': 'Can\'t reach the server. Check that your internet connection is on.',
  },
};
