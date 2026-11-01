package xiaozhi.modules.shopbridge;

import java.util.LinkedHashMap;
import java.util.Map;

import org.apache.shiro.spring.web.ShiroFilterFactoryBean;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.context.EnvironmentAware;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Adds the shop bridge's Shiro filter and URL rules from outside, so upstream's ShiroConfig stays
 * untouched (see UPSTREAM.md). Runs on the ShiroFilterFactoryBean before it builds its filter chain:
 * our rules go first, ahead of upstream's catch-all "/**" -> oauth2.
 *
 *   /shop-bridge/redeem  anon        the browser swaps a one-time code for its token
 *   /shop-bridge/**      shopBridge  the shop's server, with SHOP_BRIDGE_SECRET
 */
@Component
public class ShopBridgeShiroConfig implements BeanPostProcessor, EnvironmentAware {
    static final String FILTER = "shopBridge";
    private Environment env;

    @Override
    public void setEnvironment(Environment environment) {
        this.env = environment;
    }

    @Override
    public Object postProcessBeforeInitialization(Object bean, String beanName) {
        if (bean instanceof ShiroFilterFactoryBean shiro) {
            shiro.getFilters().put(FILTER, new ShopBridgeFilter(env.getProperty("SHOP_BRIDGE_SECRET", "")));
            shiro.setFilterChainDefinitionMap(withBridgeRules(shiro.getFilterChainDefinitionMap()));
        }
        return bean;
    }

    /** The bridge's rules first, then everything that was there, in its order. */
    static Map<String, String> withBridgeRules(Map<String, String> existing) {
        Map<String, String> rules = new LinkedHashMap<>();
        rules.put("/shop-bridge/redeem", "anon");
        rules.put("/shop-bridge/**", FILTER);
        if (existing != null) {
            existing.forEach(rules::putIfAbsent);
        }
        return rules;
    }
}
