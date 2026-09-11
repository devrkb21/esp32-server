# Technical Documentation: `xiaozhi-esp32-server`

**Table of Contents:**

1.  [Introduction](#1-introduction)
2.  [Overall Architecture](#2-overall-architecture)
3.  [Core Component Deep Dive](#3-core-component-deep-dive)
    *   [3.1. `xiaozhi-server` (Core AI Engine - Python Implementation)](#31-xiaozhi-server-core-ai-engine---python-implementation)
    *   [3.2. `manager-api` (Management Backend - Java Spring Boot Implementation)](#32-manager-api-management-backend---java-spring-boot-implementation)
    *   [3.3. `manager-web` (Web Management Frontend - Vue.js Implementation)](#33-manager-web-web-management-frontend---vuejs-implementation)
    *   [3.4. `manager-mobile` (Mobile Management Client - uni-app + Vue 3 Implementation)](#34-manager-mobile-mobile-management-client---uni-app--vue-3-implementation)
    *   [3.5. `digital-human` (Digital Human Test Module - Python + Web Implementation)](#35-digital-human-digital-human-test-module---python--web-implementation)
4.  [Data Flow and Interaction Mechanisms](#4-data-flow-and-interaction-mechanisms)
5.  [Core Feature Summary](#5-core-feature-summary)
6.  [Deployment and Configuration Overview](#6-deployment-and-configuration-overview)

---

## 1. Introduction

The `xiaozhi-esp32-server` project is a comprehensive backend system purpose-built to empower ESP32-based smart hardware. Its core objective is to enable developers to rapidly construct a robust server infrastructure that not only comprehends natural language instructions, but also efficiently interacts with diverse AI services (for automated speech recognition, natural language understanding, and speech synthesis), manages Internet of Things (IoT) devices, and provides a web-based user interface for intuitive system configuration and administrative control. By unifying cutting-edge technologies into a cohesive and extensible platform, this project streamlines and accelerates the development lifecycle of customizable voice assistants and intelligent control systems. It acts as a bridge connecting hardware devices, AI capabilities, and administrative management.

---

## 2. Overall Architecture

The `xiaozhi-esp32-server` system adopts a distributed, multi-component collaborative architectural design, ensuring modularity, maintainability, and horizontal scalability. Each core component serves a dedicated responsibility:

1.  **ESP32 Hardware (Client Devices):**
    The physical smart hardware units that end users directly interact with. Primary responsibilities include:
    *   Capturing user voice input via onboard microphones.
    *   Securely streaming raw audio data to `xiaozhi-server` in real time.
    *   Receiving synthesized audio streams from `xiaozhi-server` and playing them back through speakers.
    *   Executing hardware control actions on attached peripherals or IoT devices (such as smart lights and relays) based on directives received from `xiaozhi-server`.

2.  **`xiaozhi-server` (Core AI Engine - Python Implementation):**
    This Python-based server serves as the intelligent brain of the system, handling all real-time voice processing and AI service orchestration:
    *   Establishes stable, low-latency, full-duplex WebSocket communication links with ESP32 devices.
    *   Ingests incoming audio streams from ESP32 clients and utilizes Voice Activity Detection (VAD) to accurately segment valid speech frames.
    *   Integrates and invokes Automated Speech Recognition (ASR) services (local models or cloud APIs) to transcribe speech into text.
    *   Engages Large Language Models (LLMs) to infer user intent, perform natural language understanding, and generate context-aware conversational responses.
    *   Manages multi-turn dialogue context, session state, and user memory to ensure coherent conversational interactions.
    *   Invokes Text-to-Speech (TTS) engines to synthesize natural, expressive audio streams from LLM text responses.
    *   Executes custom functions and IoT control logic via an extensible plugin architecture.
    *   Retrieves operational configurations dynamically from `manager-api`.

3.  **`manager-api` (Management Backend - Java Spring Boot Implementation):**
    A enterprise-grade service built on Java 21 and Spring Boot 3 providing secure RESTful management APIs:
    *   Provides user authentication (login, token validation) and role-based access control (RBAC).
    *   Manages ESP32 device registration, lifecycle state, and device-specific parameters.
    *   Persists system configurations, AI provider credentials, model settings, and plugin parameters in a MySQL database.
    *   Exposes endpoints for `xiaozhi-server` to pull real-time configurations on startup and upon configuration changes.
    *   Manages TTS voice timbres, Over-The-Air (OTA) firmware upgrade versions, and metadata.
    *   Utilizes Redis as a high-speed in-memory cache for session tokens and high-frequency configuration data.

4.  **`manager-web` (Web Management Console - Vue.js Implementation):**
    A Single Page Application (SPA) built with Vue.js 2 and Element UI providing an intuitive graphical dashboard for administrators:
    *   Visual configuration of AI providers and models (ASR, LLM, TTS provider switching, API keys, temperature, prompts).
    *   Management of platform user accounts, roles, and granular permissions.
    *   Management and monitoring of registered ESP32 devices.
    *   Real-time system configuration, dictionary management, and OTA update dispatching.

5.  **`manager-mobile` (Mobile Management Client - uni-app + Vue 3 Implementation):**
    A cross-platform mobile client built on uni-app v3 + Vue 3 + Vite, supporting Android, iOS, and WeChat Mini Programs:
    *   Convenient mobile administration interface tailored for smaller viewports.
    *   Device binding, status checks, and AI configuration updates on the go.
    *   Unified codebase executing across mobile platforms using conditional compilation.
    *   Network request layer powered by alova and state management using Pinia with persistence.

6.  **`digital-human` (Digital Human Test Module - Python + Web Implementation):**
    An autonomous digital human testing module providing a local browser test interface, wake-word runtime, and event bridge:
    *   Browser-based testing interface to validate bidirectional audio streaming and interactive animations.
    *   Integrated local wake-word runtime powered by Sherpa-ONNX for low-latency keyword spotting.
    *   Event bridge connecting page state with local runtimes for end-to-end debugging.
    *   Standalone module deployable independently alongside `xiaozhi-server` and management consoles.

**High-Level Interaction Flow:**

*   **Voice Pipeline:** The ESP32 device captures user speech and streams audio frames over WebSocket to `xiaozhi-server`. `xiaozhi-server` executes the AI pipeline (VAD -> ASR -> LLM -> TTS) and streams synthesized audio back to the ESP32 for immediate playback.
*   **Management Pipeline:** Administrators interact with `manager-web` or `manager-mobile`, which execute authenticated RESTful HTTP calls against `manager-api` to persist configurations in MySQL and Redis.
*   **Configuration Synchronization:** `xiaozhi-server` fetches operational configurations from `manager-api` via HTTP on boot and reloads providers dynamically when notifications are received.

```text
xiaozhi-esp32-server
  ├─ xiaozhi-server  (Port 8000) Python    - Core AI engine, communicates with ESP32 over WebSocket
  ├─ manager-web     (Port 8001) Vue 2     - Web admin console
  ├─ manager-api     (Port 8002) Java 21   - Spring Boot RESTful API service & configuration hub
  ├─ manager-mobile  Cross-platform uni-app- Mobile management app (Android, iOS, Mini Programs)
  └─ digital-human   Python + Web          - Digital human testing interface, wake-word runtime & event bridge
```

---

## 3. Core Component Deep Dive

### 3.1. `xiaozhi-server` (Core AI Engine - Python Implementation)

`xiaozhi-server` is the intelligent nucleus of the system, responsible for real-time voice processing, third-party AI service orchestration, and ESP32 socket communication.

*   **Core Objectives:**
    *   Deliver real-time voice command processing for ESP32 devices.
    *   Provide modular abstractions for ASR, LLM, TTS, VAD, Intent Recognition, and Memory providers.
    *   Manage multi-turn conversational state and user context.
    *   Execute custom functions and IoT hardware commands via a plugin registry.
    *   Support dynamic hot-reloading of configurations pulled from `manager-api`.

*   **Technical Stack:**
    *   **Python 3:** Primary language leveraging the rich AI/ML ecosystem.
    *   **Asyncio:** Core asynchronous framework enabling non-blocking concurrency for thousands of simultaneous WebSocket connections and external API calls.
    *   **`websockets`:** Asynchronous WebSocket server implementation handling low-latency binary and text framing.
    *   **HTTP Clients (`aiohttp`, `httpx`):** Asynchronous HTTP communication with `manager-api` and cloud AI endpoints.
    *   **PyYAML:** Parsing local configuration files (`config.yaml`).
    *   **FFmpeg:** Audio decoding, resampling, and format conversion (e.g. Opus to PCM).

*   **Key Architectural Details:**
    1.  **AI Service Provider Pattern (`core/providers/`):**
        *   Each AI service type defines an Abstract Base Class (ABC) specifying standard asynchronous contracts (e.g. `async def transcribe(self, audio_chunk: bytes) -> str:` in `core/providers/asr/base.py`).
        *   Concrete implementations implement these interfaces (e.g. `fun_local.py` for local FunASR, `openai.py` for OpenAI GPT).
        *   `core/utils/modules_initialize.py` serves as a dynamic factory, instantiating configured providers based on active configuration settings.
    2.  **WebSocket Server and Connection Handlers (`core/websocket_server.py`, `core/connection.py`):**
        *   `WebSocketServer` binds to `0.0.0.0:8000` (path `/xiaozhi/v1/`). Each incoming connection instantiates a dedicated `ConnectionHandler`.
        *   Per-connection isolation ensures conversation states and audio streams do not leak across concurrent sessions.
        *   Dynamic reconfiguration method `update_config()` re-evaluates provider differences under an `asyncio.Lock` and hot-reloads modified modules without terminating active connections.
    3.  **Modular Message Handlers (`core/handle/`):**
        *   `helloHandle.py`: Connection handshake, device authentication, and protocol version negotiation.
        *   `receiveAudioHandle.py`: Ingestion of raw audio frames, VAD segmentation, and forwarding to ASR.
        *   `textHandle.py` / `intentHandler.py`: Parsing ASR output, executing intent matching, and dispatching to LLM.
        *   `functionHandler.py`: Parsing LLM function-call requests, executing matching plugin functions, and returning structured outputs back to the LLM.
        *   `sendAudioHandle.py`: Streaming synthesized TTS audio frames back to the client over WebSocket.
        *   `abortHandle.py`: Handling client-side interruptions (e.g. user speaking while TTS is playing).
    4.  **Extensible Plugin System (`plugins_func/`):**
        *   Plugins reside in `plugins_func/functions/` (e.g. `get_weather.py`, `get_news_from_newsnow.py`, `hass_set_state.py`).
        *   `loadplugins.py` scans and registers available tools into JSON schemas consumed by LLM function calling.

---

### 3.2. `manager-api` (Management Backend - Java Spring Boot Implementation)

`manager-api` is the administrative backbone and configuration authority for the entire platform.

*   **Core Objectives:**
    *   Deliver secure, standardized RESTful APIs for administrative web and mobile consoles.
    *   Serve as the centralized, authoritative configuration registry for `xiaozhi-server`.
    *   Persist accounts, device profiles, AI credentials, and firmware versions in MySQL.

*   **Technical Stack:**
    *   **Java 21:** LTS Java runtime utilizing modern language capabilities.
    *   **Spring Boot 3:** Production-grade application framework with embedded server and dependency management.
    *   **MyBatis-Plus:** Enhanced persistence layer providing CRUD generation and dynamic SQL builders.
    *   **MySQL:** Primary relational database storage.
    *   **Alibaba Druid:** High-performance JDBC connection pooling and SQL monitoring.
    *   **Redis (Spring Data Redis):** In-memory cache for user authentication tokens and hot configuration snapshots.
    *   **Apache Shiro:** Robust access control, session management, and role/permission authorization.
    *   **Liquibase:** Automated database schema migration and changelog versioning.
    *   **Knife4j:** OpenAPI 3 / Swagger interactive API documentation (`/xiaozhi/doc.html`).

*   **Key Architectural Details:**
    1.  **Modular Package Architecture (`xiaozhi.modules`):**
        *   Domain-driven packaging: `sys` (system administration), `agent` (assistant configuration), `device` (hardware device management), `config` (server runtime config endpoints), `timbre` (voice profiles), and `ota` (firmware management).
        *   Standardized 3-tier structure: Controller -> Service -> Mapper/DAO, supplemented by Entities and DTOs.
    2.  **Shared Common Infrastructure (`xiaozhi.common`):**
        *   Base CRUD controllers and services (`CrudService`, `BaseEntity`).
        *   Global exception handler (`RenExceptionHandler`) returning standardized `Result<T>` envelopes.
        *   XSS sanitization filters and automatic audit metadata population (`FieldMetaObjectHandler`).

---

### 3.3. `manager-web` (Web Management Frontend - Vue.js Implementation)

`manager-web` is a responsive administrative dashboard built with Vue.js 2 and Element UI.

*   **Core Objectives:**
    *   Centralized visual administration panel for all platform services.
    *   Intuitive management of AI providers (ASR, LLM, TTS parameters, tokens, and model routes).
    *   Role-based access control and device registration workflows.
    *   Sound timbre customization and OTA firmware distribution.

*   **Technical Stack:**
    *   **Vue 2 + Vue CLI:** Reactive component framework and build pipeline.
    *   **Vue Router & Vuex:** Client-side SPA navigation with route guards and centralized state management.
    *   **Element UI:** Desktop component design system.
    *   **SCSS:** Modular stylesheets and theme variables.
    *   **Workbox:** Service Worker integration for caching and progressive web app capabilities.

---

### 3.4. `manager-mobile` (Mobile Management Client - uni-app + Vue 3 Implementation)

`manager-mobile` provides an optimized mobile management console for administrators.

*   **Platform Compatibility:**
    *   Android (APK)
    *   iOS (IPA)
    *   WeChat Mini Program
    *   Mobile H5

*   **Technical Stack:**
    *   **uni-app v3 + Vue 3:** Cross-platform mobile application framework.
    *   **Vite + TypeScript:** Fast builds with strict compile-time type safety.
    *   **alova:** Lightweight declarative request strategy library with uni-app adapter.
    *   **Pinia:** Modern state management with persistent storage plugins.
    *   **UnoCSS:** High-performance atomic CSS engine.

---

### 3.5. `digital-human` (Digital Human Test Module - Python + Web Implementation)

`digital-human` is a dedicated standalone module for testing interactive digital avatar pipelines.

*   **Core Objectives:**
    *   Isolated local testing environment for digital human visual and voice interactions.
    *   Local wake-word spotting runtime powered by Sherpa-ONNX.
    *   Bidirectional event bridge between browser UI and Python background runtime.

*   **Technical Stack:**
    *   **Python 3:** Host runtime for service lifecycles and wake-word audio ingestion.
    *   **Sherpa-ONNX:** Embedded keyword spotting and acoustic model execution.
    *   **HTML5 / Vanilla JavaScript:** Canvas rendering, Live2D/avatar animation, and audio playback.

---

## 4. Data Flow and Interaction Mechanisms

### 4.1. Core Voice Pipeline (ESP32 <-> `xiaozhi-server`)

The voice pipeline runs in real time over low-latency WebSocket connections:

1.  **Handshake:** The ESP32 device initiates a WebSocket handshake to `ws://<SERVER_HOST>:8000/xiaozhi/v1/`. The server creates a dedicated `ConnectionHandler` instance and processes the initial handshake via `helloHandle.py`.
2.  **Audio Ingestion:** While the user speaks, the ESP32 streams raw audio chunks as binary WebSocket frames. `receiveAudioHandle.py` buffers the incoming stream and invokes VAD.
3.  **Recognition & Understanding:** When speech ends, the audio slice is transcribed by the configured ASR provider into text. The text, conversation history from Memory, and available plugin schemas are forwarded to the LLM.
4.  **Function Calling:** If the LLM determines a tool is needed, `functionHandler.py` invokes the registered plugin and provides the execution result back to the LLM for final response synthesis.
5.  **Audio Delivery:** The synthesized response text is streamed to the TTS provider. Resulting audio chunks are immediately delivered back to the ESP32 as binary WebSocket frames for smooth, low-latency playback.

### 4.2. Management and Configuration Pipeline

1.  **Administrative Actions:** Administrators submit configuration changes through `manager-web` or `manager-mobile`.
2.  **Persistence:** `manager-api` validates credentials, authorizes permissions via Shiro, and commits changes to MySQL while invalidating relevant Redis cache keys.
3.  **Server Reload:** `xiaozhi-server` fetches the updated configuration from `manager-api` over RESTful HTTP and reinitializes modified AI provider modules on the fly.

---

## 5. Core Feature Summary

*   **End-to-End Voice AI Pipeline:** Real-time VAD, ASR, LLM, TTS, and wake-word detection.
*   **Modular AI Abstractions:** Pluggable local and cloud providers for speech recognition, reasoning, and synthesis.
*   **Multi-Turn Dialogue Management:** Session memory, contextual reasoning, and real-time interruption handling.
*   **Multilingual Support:** English, Chinese, Cantonese, Japanese, Korean, and more depending on provider models.
*   **Extensible Tool Calling:** Plugin ecosystem integrating smart home controls (Home Assistant), news search, weather, and custom tools.
*   **Centralized Administration:** Web and mobile management dashboards for roles, devices, configurations, and OTA updates.
*   **Flexible Deployment Options:** One-click Docker Compose environments or individual source installations.

---

## 6. Deployment and Configuration Overview

*   **Docker Deployment:**
    *   `Dockerfile-server`: Production container for `xiaozhi-server`.
    *   `Dockerfile-server-base`: Cached base environment containing system libraries (FFmpeg, Opus) and Python dependencies.
    *   `Dockerfile-web`: Multi-stage build for frontend assets and the Java Spring Boot JAR.
    *   `docker-compose.yml` & `docker-compose_all.yml`: Orchestration files for single-service or full-stack deployments.
*   **Source Deployment:**
    *   `main/xiaozhi-server`: Python 3.10+, run with `python app.py`.
    *   `main/manager-api`: JDK 21 + Maven, run with `mvn spring-boot:run`.
    *   `main/manager-web`: Node.js 18+, run with `npm run serve`.
    *   `main/manager-mobile`: Node.js 18+, run with `pnpm dev:h5` or build via HBuilderX.
    *   `main/digital-human`: Python 3.10+, run with `python start.py`.
