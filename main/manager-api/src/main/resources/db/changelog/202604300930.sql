-- Modify model name
UPDATE `ai_model_config` SET `model_name` = 'Doubao Speech Recognition 2.0 (Streaming)' WHERE `id` = 'ASR_DoubaoStreamASRV2';

UPDATE `ai_model_config` SET `model_name` = 'Doubao Speech Synthesis 2.0 (Streaming)' WHERE `id` = 'TTS_HSDSTTS_V2';

-- Adjust model voice
delete from `ai_tts_voice` where tts_model_id = 'TTS_HSDSTTS_V2';

-- General scenarios and video dubbing

-- Customer service scenarios

-- Multilingual
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0031', 'TTS_HSDSTTS_V2', 'Tim', 'en_male_tim_uranus_bigtts', 'English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/en_male_tim_uranus_bigtts.mp3', NULL, NULL, NULL, 31, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0032', 'TTS_HSDSTTS_V2', 'Dacey', 'en_female_dacey_uranus_bigtts', 'English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/en_female_dacey_uranus_bigtts.mp3', NULL, NULL, NULL, 32, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0033', 'TTS_HSDSTTS_V2', 'Stokie', 'en_female_stokie_uranus_bigtts', 'English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/en_female_stokie_uranus_bigtts.mp3', NULL, NULL, NULL, 33, NULL, NULL, NULL, NULL);

-- Audio reading

-- Role playing
