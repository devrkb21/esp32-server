package xiaozhi.modules.knowledge.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import xiaozhi.modules.knowledge.rag.KnowledgeBaseAdapterFactory;

/**
 * Knowledge base configurationClass
 * ConfigKnowledge baseRelatedBean
 */
@Configuration
public class KnowledgeBaseConfig {

    /**
     * ProvideKnowledgeBaseAdapterFactoryBeanInstance
     * @return KnowledgeBaseAdapterFactoryInstance
     */
    @Bean
    public KnowledgeBaseAdapterFactory knowledgeBaseAdapterFactory() {
        return new KnowledgeBaseAdapterFactory();
    }
}