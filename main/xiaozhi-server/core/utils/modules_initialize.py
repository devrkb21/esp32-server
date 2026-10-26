from typing import Dict, Any
from config.logger import setup_logging
from core.utils import tts, llm, intent, memory, vad, asr
from core.providers.llm.fallback import FallbackLLM, fallback_entries, redact
from core.providers.asr.fallback import wrap_asr

TAG = __name__
logger = setup_logging()


def initialize_modules(
    logger,
    config: Dict[str, Any],
    init_vad=False,
    init_asr=False,
    init_llm=False,
    init_tts=False,
    init_memory=False,
    init_intent=False,
) -> Dict[str, Any]:
    """
    Initialize all module components

    Args:
        config: Configuration dictionary

    Returns:
        Dict[str, Any]: Dictionary containing all initialized modules
    """
    modules = {}

    # Initialize TTS module
    if init_tts:
        select_tts_module = config["selected_module"]["TTS"]
        modules["tts"] = initialize_tts(config)
        logger.bind(tag=TAG).info(f"Component initialized: tts succeeded {select_tts_module}")

    # Initialize LLM module
    if init_llm:
        select_llm_module = config["selected_module"]["LLM"]
        llm_type = (
            select_llm_module
            if "type" not in config["LLM"][select_llm_module]
            else config["LLM"][select_llm_module]["type"]
        )
        primary_llm = llm.create_instance(
            llm_type,
            config["LLM"][select_llm_module],
        )
        modules["llm"] = initialize_llm_fallback(config, select_llm_module, primary_llm)
        logger.bind(tag=TAG).info(f"Component initialized: llm succeeded {select_llm_module}")

    # Initialize Intent module
    if init_intent:
        select_intent_module = config["selected_module"]["Intent"]
        intent_type = (
            select_intent_module
            if "type" not in config["Intent"][select_intent_module]
            else config["Intent"][select_intent_module]["type"]
        )
        modules["intent"] = intent.create_instance(
            intent_type,
            config["Intent"][select_intent_module],
        )
        logger.bind(tag=TAG).info(f"Component initialized: intent succeeded {select_intent_module}")

    # Initialize Memory module
    if init_memory:
        select_memory_module = config["selected_module"]["Memory"]
        memory_type = (
            select_memory_module
            if "type" not in config["Memory"][select_memory_module]
            else config["Memory"][select_memory_module]["type"]
        )
        modules["memory"] = memory.create_instance(
            memory_type,
            config["Memory"][select_memory_module],
            config.get("summaryMemory", None),
        )
        logger.bind(tag=TAG).info(f"Component initialized: memory succeeded {select_memory_module}")

    # Initialize VAD module
    if init_vad:
        select_vad_module = config["selected_module"]["VAD"]
        vad_type = (
            select_vad_module
            if "type" not in config["VAD"][select_vad_module]
            else config["VAD"][select_vad_module]["type"]
        )
        modules["vad"] = vad.create_instance(
            vad_type,
            config["VAD"][select_vad_module],
        )
        logger.bind(tag=TAG).info(f"Component initialized: vad succeeded {select_vad_module}")

    # Initialize ASR module
    if init_asr:
        select_asr_module = config["selected_module"]["ASR"]
        modules["asr"] = initialize_asr(config)
        logger.bind(tag=TAG).info(f"Component initialized: asr succeeded {select_asr_module}")
    return modules


def initialize_tts(config):
    select_tts_module = config["selected_module"]["TTS"]
    tts_config = config["TTS"][select_tts_module].copy()
    tts_config.setdefault("tts_timeout", config.get("tts_timeout", 15))
    tts_type = (
        select_tts_module
        if "type" not in tts_config
        else tts_config["type"]
    )
    new_tts = tts.create_instance(
        tts_type,
        tts_config,
        str(config.get("delete_audio", True)).lower() in ("true", "1", "yes"),
    )
    return new_tts


def initialize_asr(config):
    select_asr_module = config["selected_module"]["ASR"]
    asr_type = (
        select_asr_module
        if "type" not in config["ASR"][select_asr_module]
        else config["ASR"][select_asr_module]["type"]
    )
    delete_audio = str(config.get("delete_audio", True)).lower() in ("true", "1", "yes")
    new_asr = asr.create_instance(
        asr_type,
        config["ASR"][select_asr_module],
        delete_audio,
    )
    logger.bind(tag=TAG).info("ASR module initialization complete")
    return initialize_asr_fallback(config, select_asr_module, new_asr, delete_audio)


def initialize_llm_fallback(config, primary_id, primary):
    """The agent's LLM wrapped with its fallbacks (manager-api `fallback.LLM`, from the sys param
    llm.fallback_chain). A fallback that cannot be built is skipped; keys are never logged."""
    entries = [(primary_id, primary)]
    for model_id, model_cfg in fallback_entries(config, "LLM"):
        try:
            entries.append((model_id, llm.create_instance(model_cfg.get("type", model_id), model_cfg)))
        except Exception as e:
            logger.bind(tag=TAG).warning(f"LLM fallback {model_id} skipped: {redact(e)}")
    if len(entries) > 1:
        logger.bind(tag=TAG).info(f"LLM fallback chain: {' -> '.join(m for m, _ in entries)}")
    return FallbackLLM(entries)


def initialize_asr_fallback(config, primary_id, primary, delete_audio=True):
    """The agent's ASR wrapped with its fallbacks (manager-api `fallback.ASR`, from the sys param
    asr.fallback_chain), for whole-utterance recognizers."""
    fallbacks = []
    for model_id, model_cfg in fallback_entries(config, "ASR"):
        model_cfg = dict(model_cfg)
        model_cfg.setdefault("output_dir", "tmp/")
        try:
            fallbacks.append((model_id, asr.create_instance(model_cfg.get("type", model_id), model_cfg, delete_audio)))
        except Exception as e:
            logger.bind(tag=TAG).warning(f"ASR fallback {model_id} skipped: {redact(e)}")
    wrapped = wrap_asr(primary_id, primary, fallbacks)
    if wrapped is not primary:
        logger.bind(tag=TAG).info(f"ASR fallback chain: {' -> '.join(wrapped.model_ids)}")
    return wrapped


def initialize_voiceprint(asr_instance, config):
    """Initialize voiceprint recognition feature"""
    voiceprint_config = config.get("voiceprint")
    if not voiceprint_config:
        return False  

    # Apply configuration
    if not voiceprint_config.get("url") or not voiceprint_config.get("speakers"):
        logger.bind(tag=TAG).warning("Voiceprint configuration incomplete")
        return False
        
    try:
        asr_instance.init_voiceprint(voiceprint_config)
        logger.bind(tag=TAG).info("ASR module voiceprint recognition dynamically enabled")
        logger.bind(tag=TAG).info(f"Configured speaker count: {len(voiceprint_config['speakers'])}")
        return True
    except Exception as e:
        logger.bind(tag=TAG).error(f"Failed to dynamically initialize voiceprint recognition: {str(e)}")
        return False
