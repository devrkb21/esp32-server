-- Wake words the server recognises (ASR text equal to a wake word gets the quick greeting).
-- No Chinese words: the robot's on-device wake word is the English "Hi ESP" (WakeNet), and
-- owners may also say the robot's name in English or Bangla.
UPDATE `sys_params`
SET `param_value` = 'Hi ESP;Hey TinyBot;Hi TinyBot;TinyBot;হাই টাইনিবট;হেই টাইনিবট;টাইনিবট'
WHERE `param_code` = 'wakeup_words';
