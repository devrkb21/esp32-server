// Feature configuration manager
import Api from "@/apis/api";
import store from "@/store";

class FeatureManager {
    constructor() {
        this.defaultFeatures = {
            voiceprintRecognition: {
                name: 'feature.voiceprintRecognition.name',
                enabled: false,
                description: 'feature.voiceprintRecognition.description'
            },
            voiceClone: {
                name: 'feature.voiceClone.name',
                enabled: false,
                description: 'feature.voiceClone.description'
            },
            knowledgeBase: {
                name: 'feature.knowledgeBase.name',
                enabled: false,
                description: 'feature.knowledgeBase.description'
            },
            mcpAccessPoint: {
                name: 'feature.mcpAccessPoint.name',
                enabled: false,
                description: 'feature.mcpAccessPoint.description'
            },
            vad: {
                name: 'feature.vad.name',
                enabled: false,
                description: 'feature.vad.description'
            },
            asr: {
                name: 'feature.asr.name',
                enabled: false,
                description: 'feature.asr.description'
            },
            addressBook: {
                name: 'feature.addressBook.name',
                enabled: false,
                description: 'feature.addressBook.description'
            }
        };
        this.currentFeatures = { ...this.defaultFeatures }; // In-memory config
        this.initialized = false;
        this.initPromise = null;
    }

    /**
     * Wait for initialization complete
     */
    async waitForInitialization() {
        if (!this.initPromise) {
            this.initPromise = this.init();
        }
        await this.initPromise;
        return this.initialized;
    }

    /**
     * Initialize feature config
     */
    async init() {
        try {
            // Get config from pub-config endpoint
            const config = await this.getConfigFromPubConfig();
            if (config) {
                this.currentFeatures = { ...config }; // Save to memory
                this.initialized = true;
                return;
            }
        } catch (error) {
            console.warn('Failed to get config from pub-config endpoint:', error);
        }

        // pub-config failed, use default config
        this.currentFeatures = { ...this.defaultFeatures }; // Save default to memory
        this.initialized = true;
    }

    /**
     * Update config cache
     */
    updateConfigCache(config) {
        store.commit('setPubConfig', config);
        localStorage.setItem('pubConfig', JSON.stringify(config));
    }

    /**
     * Get config from pub-config endpoint
     */
    async getConfigFromPubConfig() {
        return new Promise((resolve) => {
            // Call pub-config endpoint directly
            Api.user.getPubConfig((result) => {
                // Check return structure
                if (result && result.status === 200) {
                    // Check data field
                    if (result.data) {
                        const configCache = result.data.data || {};
                        // Check code field
                        if (result.data.code !== undefined) {
                            if (result.data.code === 0 && result.data.data && result.data.data.systemWebMenu) {
                                try {
                                    let config;
                                    if (typeof result.data.data.systemWebMenu === 'string') {
                                        // Parse JSON if string
                                        config = JSON.parse(result.data.data.systemWebMenu);
                                    } else {
                                        // Use directly if object
                                        config = result.data.data.systemWebMenu;
                                    }

                                    // Check if features object exists
                                    if (config && config.features) {
                                        // Ensure knowledgeBase feature exists
                                        if (!config.features.knowledgeBase) {
                                            console.warn('Config missing knowledgeBase feature, merging default');
                                            config.features = { ...this.defaultFeatures, ...config.features };
                                        }
                                        resolve(config.features);
                                    } else {
                                        console.warn('Config missing features object, using default');
                                        resolve(this.defaultFeatures);
                                    }
                                    configCache.systemWebMenu = config;
                                } catch (error) {
                                    console.warn('Failed to process systemWebMenu config:', error);
                                    resolve(null);
                                }
                            } else {
                                console.warn('API returned non-zero code or missing data, using default');
                                resolve(null);
                            }
                        } else {
                            // If no code field, check systemWebMenu directly
                            if (result.data && result.data.systemWebMenu) {
                                try {
                                    let config;
                                    if (typeof result.data.systemWebMenu === 'string') {
                                        // Parse JSON if string
                                        config = JSON.parse(result.data.systemWebMenu);
                                    } else {
                                        // Use directly if object
                                        config = result.data.systemWebMenu;
                                    }

                                    // Check if features object exists
                                    if (config && config.features) {
                                        // Ensure knowledgeBase feature exists
                                        if (!config.features.knowledgeBase) {
                                            console.warn('Config missing knowledgeBase feature, merging default');
                                            config.features = { ...this.defaultFeatures, ...config.features };
                                        }
                                        resolve(config.features);
                                    } else {
                                        console.warn('Config missing features object, using default');
                                        resolve(this.defaultFeatures);
                                    }
                                    configCache.systemWebMenu = config;
                                } catch (error) {
                                    console.warn('Failed to process systemWebMenu config:', error);
                                    resolve(null);
                                }
                            } else {
                                console.warn('Missing systemWebMenu data in API return, using default');
                                resolve(null);
                            }
                        }
                        this.updateConfigCache(configCache)
                    } else {
                        console.warn('Missing data field in API return, using default');
                        resolve(null);
                    }
                } else {
                    console.warn('pub-config call failed, using default');
                    resolve(null);
                }
            });
        });
    }

    /**
     * Get current configuration
     */
    getCurrentConfig() {
        // Return in-memory configuration
        return this.currentFeatures;
    }

    /**
     * Save configuration to backend API
     */
    async saveConfig(config) {
        try {
            // Update in-memory configuration
            this.currentFeatures = { ...config };

            // Asynchronously save to backend API
            this.saveConfigToAPI(config).catch(error => {
                console.warn('Failed to save config to API:', error);
            }).finally(() => {
                this.init()
            });

            // Emit config changed event
            window.dispatchEvent(new CustomEvent('featureConfigChanged', {
                detail: config
            }));
        } catch (error) {
            console.error('Failed to save feature config:', error);
        }
    }

    /**
     * Save configuration to backend API
     */
    async saveConfigToAPI(config) {
        return new Promise((resolve) => {
            // Update param using known ID (600)
            Api.admin.updateParam(
                {
                    id: 600,
                    paramCode: 'system-web.menu',
                    paramValue: JSON.stringify({
                        features: config,
                        groups: {
                            featureManagement: ["voiceprintRecognition", "voiceClone", "knowledgeBase", "mcpAccessPoint", "addressBook"],
                            voiceManagement: ["vad", "asr"]
                        }
                    }),
                    valueType: 'json',
                    remark: 'System Feature Menu Configuration'
                },
                (updateResult) => {
                    if (updateResult.code === 0) {
                        resolve();
                    } else {
                        // If update fails, log but do not block localStorage save
                        console.warn('Failed to update param:', updateResult.msg);
                        resolve(); // Do not block saving to localStorage
                    }
                },
                (error) => {
                    console.warn('Failed to update param:', error);
                    resolve(); // Do not block saving to localStorage
                }
            );
        });
    }



    /**
     * Get all feature configurations
     */
    getAllFeatures() {
        return this.getCurrentConfig();
    }

    /**
     * Get simplified config object (for home component)
     */
    getConfig() {
        const features = this.getAllFeatures();
        return {
            voiceprintRecognition: features.voiceprintRecognition?.enabled || false,
            voiceClone: features.voiceClone?.enabled || false,
            knowledgeBase: features.knowledgeBase?.enabled || false,
            mcpAccessPoint: features.mcpAccessPoint?.enabled || false,
            vad: features.vad?.enabled || false,
            asr: features.asr?.enabled || false,
            addressBook: features.addressBook?.enabled || false
        };
    }

    /**
     * Get status of specified feature
     */
    getFeatureStatus(featureKey) {
        const features = this.getAllFeatures();
        return features[featureKey]?.enabled || false;
    }

    /**
     * Set feature status
     */
    setFeatureStatus(featureKey, enabled) {
        const features = this.getAllFeatures();
        if (features[featureKey]) {
            features[featureKey].enabled = enabled;
            this.saveConfig(features);
            return true;
        }
        return false;
    }

    /**
     * Enable feature
     */
    enableFeature(featureKey) {
        return this.setFeatureStatus(featureKey, true);
    }

    /**
     * Disable feature
     */
    disableFeature(featureKey) {
        return this.setFeatureStatus(featureKey, false);
    }

    /**
     * Toggle feature status
     */
    toggleFeature(featureKey) {
        const currentStatus = this.getFeatureStatus(featureKey);
        return this.setFeatureStatus(featureKey, !currentStatus);
    }

    /**
     * Reset all features to default state
     */
    resetToDefault() {
        this.saveConfig(this.defaultFeatures);
    }

    /**
     * Batch update feature status
     */
    updateFeatures(featureUpdates) {
        const features = this.getAllFeatures();
        Object.keys(featureUpdates).forEach(featureKey => {
            if (features[featureKey]) {
                features[featureKey].enabled = featureUpdates[featureKey];
            } else if (this.defaultFeatures[featureKey]) {
                features[featureKey] = { ...this.defaultFeatures[featureKey] };
                features[featureKey].enabled = featureUpdates[featureKey];
            }
        });
        this.saveConfig(features);
    }

    /**
     * Get list of enabled features
     */
    getEnabledFeatures() {
        const features = this.getAllFeatures();
        return Object.keys(features).filter(key => features[key].enabled);
    }

    /**
     * Check if feature is enabled
     */
    isFeatureEnabled(featureKey) {
        return this.getFeatureStatus(featureKey);
    }
}

// Create singleton instance
const featureManager = new FeatureManager();

export default featureManager;