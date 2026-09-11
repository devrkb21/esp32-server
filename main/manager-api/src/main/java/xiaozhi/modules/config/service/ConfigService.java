package xiaozhi.modules.config.service;

import java.util.List;
import java.util.Map;

public interface ConfigService {
    /**
     * Get server configuration
     *
     * @param isCache Whether cached
     * @return ConfigurationInformation
     */
    Map<String, Object> getConfig(Boolean isCache);

    /**
     * Get agent model configuration
     *
     * @param macAddress     MACAddress
     * @param selectedModule ClientInstantiated models
     * @return Model configurationInformation
     */
    Map<String, Object> getAgentModels(String macAddress, Map<String, String> selectedModule);

    /**
     * Get agent replacement words
     *
     * @param macAddress DeviceMACAddress
     * @return Replacement wordList，Formate.g. ["Template1|Template01", "Template2|Template02"]
     */
    List<String> getCorrectWords(String macAddress);
}
