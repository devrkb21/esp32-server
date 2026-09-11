/**
 * Live2D Manager
 * Handles Live2D model initialization, mouth animation control, etc.
 */
class Live2DManager {
    constructor() {
        this.live2dApp = null;
        this.live2dModel = null;
        this.isTalking = false;
        this.mouthAnimationId = null;
        this.mouthParam = 'ParamMouthOpenY';
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.lastEmotionActionTime = null;
        this.currentModelName = null;

        // Model specific configuration
        this.modelConfig = {
            'hiyori_pro_zh': {
                mouthParam: 'ParamMouthOpenY',
                mouthAmplitude: 1.0,
                mouthThresholds: { low: 0.3, high: 0.7 },
                motionMap: {
                    'FlickUp': 'FlickUp',
                    'FlickDown': 'FlickDown',
                    'Tap': 'Tap',
                    'Tap@Body': 'Tap@Body',
                    'Flick': 'Flick',
                    'Flick@Body': 'Flick@Body'
                }
            },
            'natori_pro_zh': {
                mouthParam: 'ParamMouthOpenY',
                mouthAmplitude: 1.0,
                mouthThresholds: { low: 0.1, high: 0.4 },
                mouthFormParam: 'ParamMouthForm',
                mouthFormAmplitude: 1.0,
                mouthForm2Param: 'ParamMouthForm2',
                mouthForm2Amplitude: 0.8,
                motionMap: {
                    'FlickUp': 'FlickUp',
                    'FlickDown': 'Flick@Body',
                    'Tap': 'Tap',
                    'Tap@Body': 'Tap@Head',
                    'Flick': 'Tap',
                    'Flick@Body': 'Flick@Body'
                }
            }
        };

        // Emotion to motion mapping
        this.emotionToActionMap = {
            'happy': 'FlickUp',      // Happy - flick up motion
            'laughing': 'FlickUp',   // Laughing - flick up motion
            'funny': 'FlickUp',      // Funny - flick up motion
            'sad': 'FlickDown',      // Sad - flick down motion
            'crying': 'FlickDown',   // Crying - flick down motion
            'angry': 'Tap@Body',     // Angry - body tap motion
            'surprised': 'Tap',      // Surprised - tap motion
            'neutral': 'Flick',      // Neutral - flick motion
            'default': 'Flick@Body'  // Default - body flick motion
        };

        // Single/double click determination config and state
        this._lastClickTime = 0;
        this._lastClickPos = { x: 0, y: 0 };
        this._singleClickTimer = null;
        this._doubleClickMs = 280; // Double click threshold (ms)
        this._doubleClickDist = 16; // Max displacement for double click (px)
        // Swipe determination
        this._pointerDown = false;
        this._downPos = { x: 0, y: 0 };
        this._downTime = 0;
        this._downArea = 'Body';
        this._movedBeyondClick = false;
        this._swipeMinDist = 24; // Min distance for swipe
    }

    /**
     * Initialize Live2D
     */
    async initializeLive2D() {
        try {
            const canvas = document.getElementById('live2d-stage');

            // For internal use
            window.PIXI = PIXI;

            this.live2dApp = new PIXI.Application({
                view: canvas,
                height: window.innerHeight,
                width: window.innerWidth,
                resolution: window.devicePixelRatio,
                autoDensity: true,
                antialias: true,
                backgroundAlpha: 0,
            });

            // Load Live2D model - dynamically detect current dir, adapting to environments
            // Get directory path of current HTML file
            const currentPath = window.location.pathname;
            const lastSlashIndex = currentPath.lastIndexOf('/');
            const basePath = currentPath.substring(0, lastSlashIndex + 1);

            // Read last selected model from localStorage, or use default if none
            const savedModelName = localStorage.getItem('live2dModel') || 'hiyori_pro_zh';
            const modelFileMap = {
                'hiyori_pro_zh': 'hiyori_pro_t11.model3.json',
                'natori_pro_zh': 'natori_pro_t06.model3.json'
            };
            const modelFileName = modelFileMap[savedModelName] || 'hiyori_pro_t11.model3.json';
            const modelPath = basePath + 'resources/' + savedModelName + '/runtime/' + modelFileName;

            this.live2dModel = await PIXI.live2d.Live2DModel.from(modelPath);
            this.live2dApp.stage.addChild(this.live2dModel);

            // Save current model name
            this.currentModelName = savedModelName;

            // Update dropdown display
            const modelSelect = document.getElementById('live2dModelSelect');
            if (modelSelect) {
                modelSelect.value = savedModelName;
            }

            // Set model specific mouth parameter names
            if (this.modelConfig[savedModelName]) {
                this.mouthParam = this.modelConfig[savedModelName].mouthParam || 'ParamMouthOpenY';
            }

            // Set model properties
            this.live2dModel.scale.set(0.33);
            this.live2dModel.x = (window.innerWidth - this.live2dModel.width) * 0.5;
            this.live2dModel.y = -50;

            // Enable interaction and listen for tap hits (head/body, etc.)

            this.live2dModel.interactive = true;


            this.live2dModel.on('doublehit', (args) => {
                const area = Array.isArray(args) ? args[0] : args;

                // Trigger double click motion
                if (area === 'Body') {
                    this.motion('Flick@Body');
                } else if (area === 'Head' || area === 'Face') {
                    this.motion('Flick');
                }

                const app = window.chatApp;
                const payload = JSON.stringify({ type: 'live2d', event: 'doublehit', area });
                if (app && app.dataChannel && app.dataChannel.readyState === 'open') {
                    app.dataChannel.send(payload);
                }

            });

            this.live2dModel.on('singlehit', (args) => {
                const area = Array.isArray(args) ? args[0] : args;

                // Trigger single click motion
                if (area === 'Body') {
                    this.motion('Tap@Body');
                } else if (area === 'Head' || area === 'Face') {
                    this.motion('Tap');
                }

                const app = window.chatApp;
                const payload = JSON.stringify({ type: 'live2d', event: 'singlehit', area });
                if (app && app.dataChannel && app.dataChannel.readyState === 'open') {
                    app.dataChannel.send(payload);
                }

            });

            this.live2dModel.on('swipe', (args) => {
                const area = Array.isArray(args) ? args[0] : args;
                const dir = Array.isArray(args) ? args[1] : undefined;

                // Trigger swipe motion
                if (area === 'Body') {
                    if (dir === 'up') {
                        this.motion('FlickUp');
                    } else if (dir === 'down') {
                        this.motion('FlickDown');
                    }
                } else if (area === 'Head' || area === 'Face') {
                    if (dir === 'up') {
                        this.motion('FlickUp');
                    } else if (dir === 'down') {
                        this.motion('FlickDown');
                    }
                }

                const app = window.chatApp;
                const payload = JSON.stringify({ type: 'live2d', event: 'swipe', area, dir });
                if (app && app.dataChannel && app.dataChannel.readyState === 'open') {
                    app.dataChannel.send(payload);
                }

            });

            // Fallback: custom head/body hit area + single/double click/swipe distinction
            this.live2dModel.on('pointerdown', (event) => {
                try {
                    const global = event.data.global;
                    const bounds = this.live2dModel.getBounds();
                    // Only evaluate when tap falls within model visible area
                    if (!bounds || !bounds.contains(global.x, global.y)) return;

                    const relX = (global.x - bounds.x) / (bounds.width || 1);
                    const relY = (global.y - bounds.y) / (bounds.height || 1);
                    let area = '';
                    // Threshold: upper 20% of visible rectangle considered "head" area
                    if (relX >= 0.4 && relX <= 0.6) {
                        if (relY <= 0.15) {
                            area = 'Head';
                        } else if (relY <= 0.23) {
                            area = 'Face';
                        } else {
                            area = 'Body';
                        }
                    }
                    if (area === '') {
                        return;
                    }

                    // Record pointer down state for swipe determination
                    this._pointerDown = true;
                    this._downPos = { x: global.x, y: global.y };
                    this._downTime = performance.now();
                    this._downArea = area;
                    this._movedBeyondClick = false;

                    const now = performance.now();
                    const dt = now - (this._lastClickTime || 0);
                    const dx = global.x - (this._lastClickPos?.x || 0);
                    const dy = global.y - (this._lastClickPos?.y || 0);
                    const dist = Math.hypot(dx, dy);

                    // Hit confirmation: only evaluate single/double click when tap is on model
                    if (this._lastClickTime && dt <= this._doubleClickMs && dist <= this._doubleClickDist) {
                        // Determined as double click: cancel pending single click event
                        if (this._singleClickTimer) {
                            clearTimeout(this._singleClickTimer);
                            this._singleClickTimer = null;
                        }
                        if (typeof this.live2dModel.emit === 'function') {
                            this.live2dModel.emit('doublehit', [area]);
                        }
                        this._lastClickTime = 0;
                        this._pointerDown = false; // Double click finished, reset state
                        return;
                    }

                    // Possible single click: record and defer confirmation
                    this._lastClickTime = now;
                    this._lastClickPos = { x: global.x, y: global.y };
                    if (this._singleClickTimer) {
                        clearTimeout(this._singleClickTimer);
                        this._singleClickTimer = null;
                    }
                    this._singleClickTimer = setTimeout(() => {
                        // If movement exceeded threshold during wait, cancel single click
                        if (!this._movedBeyondClick && typeof this.live2dModel.emit === 'function') {
                            this.live2dModel.emit('singlehit', [area]);
                        }
                        this._singleClickTimer = null;
                        this._lastClickTime = 0;
                    }, this._doubleClickMs);
                } catch (e) {
                    // Ignore exceptions in custom hit judgment to avoid impacting main flow
                }
            });

            // Pointer move: determine whether click upgrades to swipe
            this.live2dModel.on('pointermove', (event) => {
                try {
                    if (!this._pointerDown) return;
                    const global = event.data.global;
                    const dx = global.x - this._downPos.x;
                    const dy = global.y - this._downPos.y;
                    const dist = Math.hypot(dx, dy);

                    // Use _doubleClickDist as threshold between click and swipe
                    if (dist > this._doubleClickDist) {
                        this._movedBeyondClick = true;
                        // If exceeded click threshold, cancel pending click
                        if (this._singleClickTimer) {
                            clearTimeout(this._singleClickTimer);
                            this._singleClickTimer = null;
                        }
                        this._lastClickTime = 0;
                    }
                } catch (e) {
                    // Ignore exceptions in move judgment
                }
            });

            // Pointer up: confirm whether it is a swipe
            const handlePointerUp = (event) => {
                try {
                    if (!this._pointerDown) return;
                    const global = (event && event.data && event.data.global) ? event.data.global : { x: this._downPos.x, y: this._downPos.y };
                    const dx = global.x - this._downPos.x;
                    const dy = global.y - this._downPos.y;
                    const dist = Math.hypot(dx, dy);

                    // Swipe: trigger swipe event if exceeding min distance (carrying direction and area)
                    if (this._movedBeyondClick && dist >= this._swipeMinDist) {
                        if (typeof this.live2dModel.emit === 'function') {
                            const dir = Math.abs(dx) >= Math.abs(dy)
                                ? (dx > 0 ? 'right' : 'left')
                                : (dy > 0 ? 'down' : 'up');
                            this.live2dModel.emit('swipe', [this._downArea, dir]);
                        }
                        // Terminate: prevent single/double click from triggering
                        if (this._singleClickTimer) {
                            clearTimeout(this._singleClickTimer);
                            this._singleClickTimer = null;
                        }
                        this._lastClickTime = 0;
                    }
                } catch (e) {
                    // Ignore exceptions in pointer up judgment
                }
                finally {
                    this._pointerDown = false;
                    this._movedBeyondClick = false;
                }
            };

            this.live2dModel.on('pointerup', handlePointerUp);
            this.live2dModel.on('pointerupoutside', handlePointerUp);

            // Add window resize listener to keep model centered and at bottom of Canvas
            window.addEventListener('resize', () => {
                if (this.live2dModel) {
                    // Recalculate model position using actual window dimensions
                    this.live2dModel.x = (window.innerWidth - this.live2dModel.width) * 0.5;
                    this.live2dModel.y = -50;
                }
            });

        } catch (err) {
            console.error('Failed to load Live2D model:', err);
        }
    }

    /**
     * Initialize audio analyser - using audio player analyser node
     */
    initializeAudioAnalyzer() {
        try {
            // Get audio player instance
            const audioPlayer = window.chatApp?.audioPlayer;
            if (!audioPlayer) {
                console.warn('Audio player not initialized, unable to get analyser node');
                return false;
            }

            // Get audio player audio context
            this.audioContext = audioPlayer.getAudioContext();
            if (!this.audioContext) {
                console.warn('Unable to get audio player audio context');
                return false;
            }

            // Create analyser node
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

            return true;
        } catch (error) {
            console.error('Failed to initialize audio analyser:', error);
            return false;
        }
    }

    /**
     * Connect to audio player output node
     */
    connectToAudioPlayer() {
        try {
            // Get audio player stream context
            const audioPlayer = window.chatApp?.audioPlayer;
            if (!audioPlayer || !audioPlayer.streamingContext) {
                console.warn('Audio player or stream context not initialized');
                return false;
            }

            // Get audio player stream context
            const streamingContext = audioPlayer.streamingContext;

            // Get analyser node
            const analyser = streamingContext.getAnalyser();
            if (!analyser) {
                console.warn('Audio player has not created analyser node yet, unable to connect');
                return false;
            }

            // Use audio player analyser node
            this.analyser = analyser;
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            return true;
        } catch (error) {
            console.error('Failed to connect to audio player:', error);
            return false;
        }
    }

    /**
     * Mouth animation loop
     */
    animateMouth() {
        if (!this.isTalking) return;
        if (!this.live2dModel) return;
        const internal = this.live2dModel && this.live2dModel.internalModel;
        if (internal && internal.coreModel) {
            const coreModel = internal.coreModel;

            let mouthOpenY = 0;
            let mouthForm = 0;
            let mouthForm2 = 0;
            let average = 0;

            if (this.analyser && this.dataArray) {
                this.analyser.getByteFrequencyData(this.dataArray);
                average = this.dataArray.reduce((a, b) => a + b) / this.dataArray.length;

                const normalizedVolume = average / 255;

                // Get model specific thresholds
                let lowThreshold = 0.3;
                let highThreshold = 0.7;
                if (this.currentModelName && this.modelConfig[this.currentModelName]) {
                    lowThreshold = this.modelConfig[this.currentModelName].mouthThresholds?.low || 0.3;
                    highThreshold = this.modelConfig[this.currentModelName].mouthThresholds?.high || 0.7;
                }

                // Map using model specific thresholds
                let minOpenY = 0.1;
                if (this.currentModelName && this.modelConfig[this.currentModelName]) {
                    minOpenY = this.modelConfig[this.currentModelName].mouthMinOpenY || 0.1;
                }

                if (normalizedVolume < lowThreshold) {
                    mouthOpenY = minOpenY + Math.pow(normalizedVolume / lowThreshold, 1.5) * (0.4 - minOpenY);
                } else if (normalizedVolume < highThreshold) {
                    mouthOpenY = 0.4 + (normalizedVolume - lowThreshold) / (highThreshold - lowThreshold) * 0.4;
                } else {
                    mouthOpenY = 0.8 + Math.pow((normalizedVolume - highThreshold) / (1 - highThreshold), 1.2) * 0.2;
                }

                // Apply model specific mouth open amplitude
                let amplitudeMultiplier = 1.0;
                let maxOpenY = 2.5;
                if (this.currentModelName && this.modelConfig[this.currentModelName]) {
                    amplitudeMultiplier = this.modelConfig[this.currentModelName].mouthAmplitude;
                    maxOpenY = this.modelConfig[this.currentModelName].maxOpenY || 2.5;
                }
                mouthOpenY = mouthOpenY * amplitudeMultiplier;
                mouthOpenY = Math.min(Math.max(mouthOpenY, 0), maxOpenY);

                // Calculate mouth form parameter (only for models supporting form variation)
                if (this.currentModelName && this.modelConfig[this.currentModelName]?.mouthFormParam) {
                    const config = this.modelConfig[this.currentModelName];
                    const formAmplitude = config.mouthFormAmplitude || 0.5;
                    const form2Amplitude = config.mouthForm2Amplitude || 0;

                    // Mouth form varies with volume:
                    // Low volume: mouth form skewed towards flat (negative)
                    // High volume: mouth form skewed towards "o" shape (positive)
                    // Volume = 0: mouth form = 0 (natural state)
                    mouthForm = (normalizedVolume - 0.5) * 2 * formAmplitude;
                    mouthForm = Math.max(-formAmplitude, Math.min(formAmplitude, mouthForm));

                    // Second mouth form parameter (natori specific)
                    if (config.mouthForm2Param) {
                        mouthForm2 = (normalizedVolume - 0.3) * 2 * form2Amplitude;
                        mouthForm2 = Math.max(-form2Amplitude, Math.min(form2Amplitude, mouthForm2));
                    }
                }

                // Debug log: output mouth parameters
                console.log(`[Live2D] Model: ${this.currentModelName || 'unknown'}, Volume: ${average?.toFixed(0)}, OpenY: ${mouthOpenY.toFixed(3)}, Form: ${mouthForm.toFixed(3)}, Form2: ${mouthForm2.toFixed(3)}`);
            }

            // Set mouth open parameter
            coreModel.setParameterValueById(this.mouthParam, mouthOpenY);

            // Set mouth form parameter (only for models supporting form variation)
            if (this.currentModelName && this.modelConfig[this.currentModelName]?.mouthFormParam) {
                const config = this.modelConfig[this.currentModelName];
                const formParam = config.mouthFormParam;
                coreModel.setParameterValueById(formParam, mouthForm);

                // Set second mouth form parameter (natori specific)
                if (config.mouthForm2Param) {
                    coreModel.setParameterValueById(config.mouthForm2Param, mouthForm2);
                }
            }

            coreModel.update();
        }
        this.mouthAnimationId = requestAnimationFrame(() => this.animateMouth());
    }

    /**
     * Start talking animation
     */
    startTalking() {
        if (this.isTalking || !this.live2dModel) return;

        // Ensure audio analyser is initialized
        if (!this.analyser) {
            if (!this.initializeAudioAnalyzer()) {
                console.warn('Audio analyser initialization failed, will use simulated animation');
                // Start animation even if analyser fails (using simulated data)
                this.isTalking = true;
                this.animateMouth();
                return;
            }
        }

        // Connect to audio player output
        if (!this.connectToAudioPlayer()) {
            console.warn('Unable to connect to audio player output, will use simulated animation');
        }

        this.isTalking = true;
        this.animateMouth();
    }

    /**
     * Stop talking animation
     */
    stopTalking() {
        this.isTalking = false;
        if (this.mouthAnimationId) {
            cancelAnimationFrame(this.mouthAnimationId);
            this.mouthAnimationId = null;
        }

        // Reset mouth parameters
        if (this.live2dModel) {
            const internal = this.live2dModel.internalModel;
            if (internal && internal.coreModel) {
                const coreModel = internal.coreModel;
                coreModel.setParameterValueById(this.mouthParam, 0);
                coreModel.update();
            }
        }
    }

    /**
     * Trigger motion based on emotion
     * @param {string} emotion - Emotion name
     */
    triggerEmotionAction(emotion) {
        if (!this.live2dModel) return;

        // Add cooldown control to prevent triggering too frequently
        const now = Date.now();
        if (this.lastEmotionActionTime && now - this.lastEmotionActionTime < 5000) { // 5-second cooldown
            return;
        }

        // Get corresponding motion based on emotion
        const action = this.emotionToActionMap[emotion] || this.emotionToActionMap['default'];

        // Trigger motion and record time
        this.motion(action);
        this.lastEmotionActionTime = now;
    }



    /**
     * Trigger model motion
     * @param {string} name - Motion group name, e.g. 'TapBody', 'FlickUp', 'Idle', etc.
     */
    motion(name) {
        try {
            if (!this.live2dModel) return;

            // Get corresponding motion name based on current model
            let actualMotionName = name;
            if (this.currentModelName && this.modelConfig[this.currentModelName]) {
                const motionMap = this.modelConfig[this.currentModelName].motionMap;
                actualMotionName = motionMap[name] || name;
            }

            this.live2dModel.motion(actualMotionName);
        } catch (error) {
            console.error('Failed to trigger motion:', error);
        }
    }

    /**
     * Set up model interaction events
     */
    setupModelInteractions() {
        if (!this.live2dModel) return;

        this.live2dModel.interactive = true;

        this.live2dModel.on('doublehit', (args) => {
            const area = Array.isArray(args) ? args[0] : args;

            if (area === 'Body') {
                this.motion('Flick@Body');
            } else if (area === 'Head' || area === 'Face') {
                this.motion('Flick');
            }

            const app = window.chatApp;
            const payload = JSON.stringify({ type: 'live2d', event: 'doublehit', area });
            if (app && app.dataChannel && app.dataChannel.readyState === 'open') {
                app.dataChannel.send(payload);
            }
        });

        this.live2dModel.on('singlehit', (args) => {
            const area = Array.isArray(args) ? args[0] : args;

            if (area === 'Body') {
                this.motion('Tap@Body');
            } else if (area === 'Head' || area === 'Face') {
                this.motion('Tap');
            }

            const app = window.chatApp;
            const payload = JSON.stringify({ type: 'live2d', event: 'singlehit', area });
            if (app && app.dataChannel && app.dataChannel.readyState === 'open') {
                app.dataChannel.send(payload);
            }
        });

        this.live2dModel.on('swipe', (args) => {
            const area = Array.isArray(args) ? args[0] : args;
            const dir = Array.isArray(args) ? args[1] : undefined;

            if (area === 'Body') {
                if (dir === 'up') {
                    this.motion('FlickUp');
                } else if (dir === 'down') {
                    this.motion('FlickDown');
                }
            }

            const app = window.chatApp;
            const payload = JSON.stringify({ type: 'live2d', event: 'swipe', area, dir });
            if (app && app.dataChannel && app.dataChannel.readyState === 'open') {
                app.dataChannel.send(payload);
            }
        });

        this.live2dModel.on('pointerdown', (event) => {
            try {
                const global = event.data.global;
                const bounds = this.live2dModel.getBounds();
                if (!bounds || !bounds.contains(global.x, global.y)) return;

                const relX = (global.x - bounds.x) / (bounds.width || 1);
                const relY = (global.y - bounds.y) / (bounds.height || 1);
                let area = '';

                if (relX >= 0.4 && relX <= 0.6) {
                    if (relY <= 0.15) {
                        area = 'Head';
                    } else if (relY >= 0.7) {
                        area = 'Body';
                    }
                }

                if (!area) return;

                const now = Date.now();
                const dt = now - (this._lastClickTime || 0);
                const dx = global.x - (this._lastClickPos?.x || 0);
                const dy = global.y - (this._lastClickPos?.y || 0);
                const dist = Math.hypot(dx, dy);

                if (this._lastClickTime && dt <= this._doubleClickMs && dist <= this._doubleClickDist) {
                    if (this._singleClickTimer) {
                        clearTimeout(this._singleClickTimer);
                        this._singleClickTimer = null;
                    }

                    this.live2dModel.emit('doublehit', area);
                    this._lastClickTime = null;
                    this._lastClickPos = null;
                } else {
                    this._lastClickTime = now;
                    this._lastClickPos = { x: global.x, y: global.y };

                    this._singleClickTimer = setTimeout(() => {
                        this._singleClickTimer = null;
                        this.live2dModel.emit('singlehit', area);
                    }, this._doubleClickMs);
                }
            } catch (e) {
                console.warn('Error handling pointerdown:', e);
            }
        });
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.stopTalking();

        // Clean up audio analyser
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.analyser = null;
        this.dataArray = null;

        // Clean up Live2D application
        if (this.live2dApp) {
            this.live2dApp.destroy(true);
            this.live2dApp = null;
        }
        this.live2dModel = null;
    }

    /**
     * Switch Live2D model
     * @param {string} modelName - Model directory name, e.g. 'hiyori_pro_zh', 'natori_pro_zh'
     * @returns {Promise<boolean>} - Whether switch succeeded
     */
    async switchModel(modelName) {
        try {
            // Get model filename mapping
            const modelFileMap = {
                'hiyori_pro_zh': 'hiyori_pro_t11.model3.json',
                'natori_pro_zh': 'natori_pro_t06.model3.json',
                'chitose': 'chitose.model3.json',
                'haru_greeter_pro_jp': 'haru_greeter_t05.model3.json'
            };

            const modelFileName = modelFileMap[modelName];
            if (!modelFileName) {
                console.error('Unknown model name:', modelName);
                return false;
            }

            // Get base path
            const currentPath = window.location.pathname;
            const lastSlashIndex = currentPath.lastIndexOf('/');
            const basePath = currentPath.substring(0, lastSlashIndex + 1);
            const modelPath = basePath + 'resources/' + modelName + '/runtime/' + modelFileName;

            // If model already exists, remove it first
            if (this.live2dModel) {
                this.live2dApp.stage.removeChild(this.live2dModel);
                this.live2dModel.destroy();
                this.live2dModel = null;
            }

            // Show loading state
            const app = window.chatApp;
            if (app) {
                app.setModelLoadingStatus(true);
            }

            // Load new model
            this.live2dModel = await PIXI.live2d.Live2DModel.from(modelPath);
            this.live2dApp.stage.addChild(this.live2dModel);

            // Set model properties
            this.live2dModel.scale.set(0.33);
            this.live2dModel.x = (window.innerWidth - this.live2dModel.width) * 0.5;
            this.live2dModel.y = -50;

            // Re-bind interaction events
            this.setupModelInteractions();

            // Hide loading state
            if (app) {
                app.setModelLoadingStatus(false);
            }

            // Save current model name
            this.currentModelName = modelName;

            // Set model specific mouth parameter names
            if (this.modelConfig[modelName]) {
                this.mouthParam = this.modelConfig[modelName].mouthParam || 'ParamMouthOpenY';
            }

            // Save to localStorage
            localStorage.setItem('live2dModel', modelName);

            // Update dropdown display
            const modelSelect = document.getElementById('live2dModelSelect');
            if (modelSelect) {
                modelSelect.value = modelName;
            }

            console.log('Model switched successfully:', modelName);
            return true;
        } catch (error) {
            console.error('Failed to switch model:', error);
            const app = window.chatApp;
            if (app) {
                app.setModelLoadingStatus(false);
            }
            return false;
        }
    }


}

// Export global instance
window.Live2DManager = Live2DManager;
