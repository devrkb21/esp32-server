package xiaozhi.modules.knowledge.rag;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import lombok.extern.slf4j.Slf4j;
import xiaozhi.common.exception.ErrorCode;
import xiaozhi.common.exception.RenException;

/**
 * Knowledge base adapterFactoryClass
 * Responsible for creating and managing different types of knowledge basesAPIAdapter
 */
@Slf4j
public class KnowledgeBaseAdapterFactory {

    // Registered adapter type mapping
    private static final Map<String, Class<? extends KnowledgeBaseAdapter>> adapterRegistry = new HashMap<>();

    // Adapter instanceCache
    private static final Map<String, KnowledgeBaseAdapter> adapterCache = new ConcurrentHashMap<>();

    // Maximum cached instances, preventing memory leak (Issue 9)
    private static final int MAX_CACHE_SIZE = 50;

    static {
        // RegisterInnerPlaceAdapter type
        registerAdapter("ragflow", xiaozhi.modules.knowledge.rag.impl.RAGFlowAdapter.class);
        // More adapter types can be registered here
    }

    /**
     * RegisterNewAdapter type
     * 
     * @param adapterType  Adapter typeIdentifier
     * @param adapterClass AdapterClass
     */
    public static void registerAdapter(String adapterType, Class<? extends KnowledgeBaseAdapter> adapterClass) {
        if (adapterRegistry.containsKey(adapterType)) {
            log.warn("Adapter type '{}' Already exists，WillBeCover", adapterType);
        }
        adapterRegistry.put(adapterType, adapterClass);
        log.info("RegisterAdapter type: {} -> {}", adapterType, adapterClass.getSimpleName());
    }

    /**
     * GetAdapter instance
     * 
     * @param adapterType Adapter type
     * @param config      ConfigParameter
     * @return Adapter instance
     */
    public static KnowledgeBaseAdapter getAdapter(String adapterType, Map<String, Object> config) {
        String cacheKey = buildCacheKey(adapterType, config);

        // Check whether instance already exists in cache
        if (adapterCache.containsKey(cacheKey)) {
            log.debug("FromCacheGetAdapter instance: {}", cacheKey);
            return adapterCache.get(cacheKey);
        }

        // CreateNewAdapter instance
        KnowledgeBaseAdapter adapter = createAdapter(adapterType, config);

        // CacheAdapter instance (withCapacityamountLimitCheck)
        if (adapterCache.size() >= MAX_CACHE_SIZE) {
            log.warn("Adapter cache reached maximum limit ({}), executing memory-protective cleanup", MAX_CACHE_SIZE);
            // Simple handling: direct clear; LRU is recommended in production environment
            adapterCache.clear();
        }

        adapterCache.put(cacheKey, adapter);
        log.info("CreateAndCacheAdapter instance: {}", cacheKey);

        return adapter;
    }

    /**
     * GetAdapter instance（WithoutConfig）
     * 
     * @param adapterType Adapter type
     * @return Adapter instance
     */
    public static KnowledgeBaseAdapter getAdapter(String adapterType) {
        return getAdapter(adapterType, null);
    }

    /**
     * Get all registered adapter types
     * 
     * @return Adapter typeCollection
     */
    public static Set<String> getRegisteredAdapterTypes() {
        return adapterRegistry.keySet();
    }

    /**
     * Check whether adapter type is registered
     * 
     * @param adapterType Adapter type
     * @return WhetherAlreadyRegister
     */
    public static boolean isAdapterTypeRegistered(String adapterType) {
        return adapterRegistry.containsKey(adapterType);
    }

    /**
     * ClearAdapterCache
     */
    public static void clearCache() {
        int cacheSize = adapterCache.size();
        adapterCache.clear();
        log.info("Clear adapter cache, cleared {} instances in total", cacheSize);
    }

    /**
     * Remove cache for specific adapter type
     * 
     * @param adapterType Adapter type
     */
    public static void removeCacheByType(String adapterType) {
        int removedCount = 0;
        for (String cacheKey : adapterCache.keySet()) {
            if (cacheKey.startsWith(adapterType + "@")) {
                adapterCache.remove(cacheKey);
                removedCount++;
            }
        }
        log.info("Remove cache for adapter type '{}', removed {} instances in total", adapterType, removedCount);
    }

    /**
     * Get adapter factory status information
     * 
     * @return StatusInfo
     */
    public static Map<String, Object> getFactoryStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("registeredAdapterTypes", adapterRegistry.keySet());
        status.put("cachedAdapterCount", adapterCache.size());
        status.put("cacheKeys", adapterCache.keySet());
        return status;
    }

    /**
     * CreateAdapter instance
     * 
     * @param adapterType Adapter type
     * @param config      ConfigParameter
     * @return Adapter instance
     */
    private static KnowledgeBaseAdapter createAdapter(String adapterType, Map<String, Object> config) {
        if (!adapterRegistry.containsKey(adapterType)) {
            throw new RenException(ErrorCode.RAG_ADAPTER_TYPE_NOT_SUPPORTED,
                    "Unsupported adapter type: " + adapterType);
        }

        try {
            Class<? extends KnowledgeBaseAdapter> adapterClass = adapterRegistry.get(adapterType);
            KnowledgeBaseAdapter adapter = adapterClass.getDeclaredConstructor().newInstance();

            // InitializeAdapter
            if (config != null) {
                adapter.initialize(config);

                // VerifyConfig
                if (!adapter.validateConfig(config)) {
                    throw new RenException(ErrorCode.RAG_CONFIG_VALIDATION_FAILED,
                            "Adapter configuration validation failed: " + adapterType);
                }
            }

            log.info("SucceededCreateAdapter instance: {}", adapterType);
            return adapter;

        } catch (Exception e) {
            log.error("CreateAdapter instanceFailed: {}", adapterType, e);
            throw new RenException(ErrorCode.RAG_ADAPTER_CREATION_FAILED,
                    "Failed to create adapter: " + adapterType + ", Error: " + e.getMessage());
        }
    }

    /**
     * BuildCacheKey
     * 
     * @param adapterType Adapter type
     * @param config      ConfigParameter
     * @return CacheKey
     */
    private static String buildCacheKey(String adapterType, Map<String, Object> config) {
        if (config == null || config.isEmpty()) {
            return adapterType + "@default";
        }

        // Generate cache key based on configuration parameters
        StringBuilder keyBuilder = new StringBuilder(adapterType + "@");

        // Use hash value of configuration as part of cache key
        int configHash = config.hashCode();
        keyBuilder.append(configHash);

        return keyBuilder.toString();
    }
}