// Products: the "not on this device" state, the product tag on robots, and Today for a device
// that is not a TinyBot. Owner: products. Wording follows manager-web src/i18n/pages/products.js.
const messages: Record<string, Record<string, string>> = {
  bn: {
    'product.notHere.title': 'এই ডিভাইসে এই সুবিধা নেই',
    'product.notHere.text': '{name} এই কাজটি করতে পারে না। আজ পাতায় ফিরে যান, অথবা আমার রোবট পাতা থেকে অন্য ডিভাইস বেছে নিন।',
    'product.notHere.today': 'আজ পাতায় যান',
    'today.device.title': 'চরিত্র ও কথা',
    'today.device.text': 'এটি একটি {product}। এতে দিনের রুটিন, চেহারা বা কাজের বোতাম নেই। কী নিয়ে, কোন কণ্ঠে কথা বলবে, তা চরিত্র পাতায় ঠিক করুন।',
    'today.device.character': 'চরিত্র ও কণ্ঠ',
    'today.device.voiceprint': 'কণ্ঠ চেনা',
    'today.device.seen': 'শেষ কথা {when}',
    'today.device.never': 'এখনো কথা হয়নি',
  },
  en: {
    'product.notHere.title': 'This device does not have this feature',
    'product.notHere.text': '{name} cannot do this. Go back to Today, or choose another device on My robots.',
    'product.notHere.today': 'Go to Today',
    'today.device.title': 'Character and chat',
    'today.device.text': 'This is a {product}. It has no day plan, look or command buttons. Set what it talks about, and in which voice, on the Character page.',
    'today.device.character': 'Character and voice',
    'today.device.voiceprint': 'Voice recognition',
    'today.device.seen': 'Last talked {when}',
    'today.device.never': 'Has not talked yet',
  },
}

export default messages
