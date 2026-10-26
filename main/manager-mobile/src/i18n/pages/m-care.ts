// Care alerts (Robot > যত্নের সতর্কতা): settings.care of the companion config. Never medical
// monitoring: these are small alerts for the family. Owner: FAMILY (mobile).
const messages: Record<string, Record<string, string>> = {
  bn: {
    'mrobot.sec.care': 'যত্নের সতর্কতা',
    'care.title': 'যত্নের সতর্কতা',
    'care.lede': 'বাড়িতে কেউ একা থাকলে পরিবারকে জানানোর ছোট সতর্কতা। এটা চিকিৎসার যন্ত্র নয়।',
    'care.enabled': 'যত্নের সতর্কতা চালু',
    'care.enabledLine': 'বন্ধ থাকলে কোনো সতর্কতা যাবে না, আর টাইনিবট একা লাগলে নিজে থেকে কথা বলবে না।',
    'care.noActivity': 'অনেকক্ষণ সাড়া না পেলে',
    'care.noActivityLine': 'দিনের বেলা (সকাল ৮টা থেকে রাত ৯টা) এতক্ষণ কেউ টাইনিবটকে না ছুঁলে বা কথা না বললে জানাবে।',
    'care.hours.0': 'বন্ধ',
    'care.hours.n': '{n} ঘণ্টা',
    'care.fall': 'পড়ে গেলে জানান',
    'care.fallLine': 'টাইনিবট নিজে পড়ে গেলে বা জোরে ধাক্কা খেলে পরিবারকে জানাবে।',
    'care.medicine': 'ওষুধের রিমাইন্ডার মিস হলে',
    'care.medicineLine': 'ওষুধের রিমাইন্ডারে আধা ঘণ্টার মধ্যে টাইনিবটে চাপ দিয়ে নিশ্চিত না করলে জানাবে।',
    'care.who': 'সতর্কতা যায় মালিক আর পরিবারের সবার কাছে, নোটিফিকেশনে।',
  },
  en: {
    'mrobot.sec.care': 'Care alerts',
    'care.title': 'Care alerts',
    'care.lede': 'Small alerts that tell the family when someone at home may need a call. This is not a medical device.',
    'care.enabled': 'Care alerts on',
    'care.enabledLine': 'When off, no alerts are sent and TinyBot does not start a talk when it feels lonely.',
    'care.noActivity': 'No activity for a while',
    'care.noActivityLine': 'During the day (8 am to 9 pm), tells you when nobody has touched or talked to TinyBot for this long.',
    'care.hours.0': 'Off',
    'care.hours.n': '{n} h',
    'care.fall': 'Tell me after a fall',
    'care.fallLine': 'Tells the family when TinyBot itself falls or is knocked hard.',
    'care.medicine': 'Missed medicine reminder',
    'care.medicineLine': 'Tells you when a medicine reminder is not confirmed with a tap on TinyBot within half an hour.',
    'care.who': 'Alerts go to the owner and everyone in the family, as notifications.',
  },
}

export default messages
