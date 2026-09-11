import time
import json
import asyncio
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from core.connection import ConnectionHandler
from core.utils.util import audio_to_data
from core.handle.abortHandle import handleAbortMessage
from core.handle.intentHandler import handle_user_intent
from core.utils.output_counter import check_device_output_limit
from core.handle.sendAudioHandle import send_stt_message, SentenceType

TAG = __name__


async def handleAudioMessage(conn: "ConnectionHandler", pcm_frame):
    # Whether someone is speaking in current segment
    have_voice = conn.vad.is_vad(conn, pcm_frame)
    # If device was just woken up, briefly ignore VAD detection
    if hasattr(conn, "just_woken_up") and conn.just_woken_up:
        have_voice = False
        # Set brief delay before resuming VAD detection
        if not hasattr(conn, "vad_resume_task") or conn.vad_resume_task.done():
            conn.vad_resume_task = asyncio.create_task(resume_vad_detection(conn))
        return
    # Server-side AEC feature requires real-time interrupt trigger
    if conn.client_aec and have_voice:
        if conn.client_is_speaking and conn.client_listen_mode != "manual":
            await handleAbortMessage(conn)
    # Long idle detection for say goodbye
    await no_voice_close_connect(conn, have_voice)
    # Receive audio
    await conn.asr.receive_audio(conn, pcm_frame, have_voice)


async def resume_vad_detection(conn: "ConnectionHandler"):
    # Wait 2 seconds before resuming VAD detection
    await asyncio.sleep(2)
    conn.just_woken_up = False


async def startToChat(conn: "ConnectionHandler", text):
    # Check if input is JSON format (contains speaker info)
    speaker_name = None
    actual_text = text

    try:
        # Attempt parsing JSON format input
        if text.strip().startswith("{") and text.strip().endswith("}"):
            data = json.loads(text)
            if "speaker" in data and "content" in data:
                speaker_name = data["speaker"]
                actual_content = data["content"]
                conn.logger.bind(tag=TAG).info(f"Parsed speaker information: {speaker_name}")

                # Retain {"speaker":...} JSON only on first occurrence for natural address;
                # subsequent turns degrade to plain text to prevent model repetitive naming
                if speaker_name not in conn.introduced_speakers:
                    conn.introduced_speakers.add(speaker_name)
                    actual_text = text
                else:
                    actual_text = actual_content
    except (json.JSONDecodeError, KeyError):
        # If parse fails, continue using original text
        pass

    # Save speaker information to connection object
    if speaker_name:
        conn.current_speaker = speaker_name
    else:
        conn.current_speaker = None

    if conn.need_bind:
        await check_bind_device(conn)
        return

    # If daily output characters exceed limit
    if conn.max_output_size > 0:
        if check_device_output_limit(
            conn.headers.get("device-id"), conn.max_output_size
        ):
            await max_out_size(conn)
            return

    # In manual mode, do not interrupt currently playing content
    if conn.client_is_speaking and conn.client_listen_mode != "manual":
        await handleAbortMessage(conn)

    # Analyze intent first using actual text content
    intent_handled = await handle_user_intent(conn, actual_text)

    if intent_handled:
        # If intent already handled, do not proceed to chat
        return

    # Intent not handled, continue normal chat flow using actual text content
    await send_stt_message(conn, actual_text)

    # Prepare to start new session
    conn.client_abort = False

    conn.executor.submit(conn.chat, actual_text)


async def no_voice_close_connect(conn: "ConnectionHandler", have_voice):
    if have_voice:
        conn.last_activity_time = time.time() * 1000
        return
    # Check timeout only if timestamp has been initialized
    if conn.last_activity_time > 0.0:
        no_voice_time = time.time() * 1000 - conn.last_activity_time
        close_connection_no_voice_time = int(
            conn.config.get("close_connection_no_voice_time", 120)
        )
        if (
            not conn.close_after_chat
            and no_voice_time > 1000 * close_connection_no_voice_time
        ):
            conn.close_after_chat = True
            conn.client_abort = False
            end_prompt = conn.config.get("end_prompt", {})
            if end_prompt and end_prompt.get("enable", True) is False:
                conn.logger.bind(tag=TAG).info("Ending conversation, no closing prompt required")
                await conn.close()
                return
            prompt = end_prompt.get("prompt")
            if not prompt:
                prompt = "Please end this conversation warmly and affectionately, beginning with ```Time really flies```."
            await startToChat(conn, prompt)


async def max_out_size(conn: "ConnectionHandler"):
    # Play prompt for exceeding maximum output character count
    conn.client_abort = False
    text = "I'm sorry, I have something to take care of right now. Let's chat again tomorrow at this time, it's a promise! See you tomorrow, goodbye!"
    await send_stt_message(conn, text)
    file_path = "config/assets/max_output_size.wav"
    opus_packets = await audio_to_data(file_path)
    conn.tts.tts_audio_queue.put((SentenceType.LAST, opus_packets, text))
    conn.close_after_chat = True


async def check_bind_device(conn: "ConnectionHandler"):
    if conn.bind_code:
        # Ensure bind_code is 6 digits
        if len(conn.bind_code) != 6:
            conn.logger.bind(tag=TAG).error(f"Invalid binding code format: {conn.bind_code}")
            text = "Binding code format error, please check configuration."
            await send_stt_message(conn, text)
            return

        text = f"Please log in to the management panel and enter {conn.bind_code} to bind your device."
        await send_stt_message(conn, text)

        # Play prompt tone
        music_path = "config/assets/bind_code.wav"
        opus_packets = await audio_to_data(music_path)
        conn.tts.tts_audio_queue.put((SentenceType.FIRST, opus_packets, text))

        # Play digits sequentially
        for i in range(6):  # Ensure only 6 digits are played
            try:
                digit = conn.bind_code[i]
                num_path = f"config/assets/bind_code/{digit}.wav"
                num_packets = await audio_to_data(num_path)
                conn.tts.tts_audio_queue.put((SentenceType.MIDDLE, num_packets, None))
            except Exception as e:
                conn.logger.bind(tag=TAG).error(f"Failed to play digit audio: {e}")
                continue
        conn.tts.tts_audio_queue.put((SentenceType.LAST, [], None))
    else:
        # Play unbound device prompt
        conn.client_abort = False
        text = "Version information for this device was not found. Please configure the OTA address correctly and recompile the firmware."
        await send_stt_message(conn, text)
        music_path = "config/assets/bind_not_found.wav"
        opus_packets = await audio_to_data(music_path)
        conn.tts.tts_audio_queue.put((SentenceType.LAST, opus_packets, text))
