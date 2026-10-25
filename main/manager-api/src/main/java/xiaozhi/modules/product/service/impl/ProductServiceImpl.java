package xiaozhi.modules.product.service.impl;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;

import lombok.extern.slf4j.Slf4j;
import xiaozhi.common.exception.ErrorCode;
import xiaozhi.common.exception.RenException;
import xiaozhi.common.page.PageData;
import xiaozhi.common.service.impl.BaseServiceImpl;
import xiaozhi.common.utils.JsonUtils;
import xiaozhi.modules.product.dao.ProductDao;
import xiaozhi.modules.product.dto.ProductDTO;
import xiaozhi.modules.product.entity.ProductEntity;
import xiaozhi.modules.product.service.ProductService;
import xiaozhi.modules.product.vo.ProductListVO;
import xiaozhi.modules.product.vo.ProductVO;
import xiaozhi.modules.sys.service.SysParamsService;

/**
 * Product catalog. The enabled products are cached in memory (the table is tiny and read on
 * every device list); the cache is dropped on save/update/delete and expires after
 * {@link #CACHE_TTL_MS} so direct database edits are picked up too.
 */
@Slf4j
@Service
public class ProductServiceImpl extends BaseServiceImpl<ProductDao, ProductEntity> implements ProductService {

    static final long CACHE_TTL_MS = 5 * 60 * 1000L;

    private static final Pattern PRODUCT_KEY = Pattern.compile("^[a-z][a-z0-9_-]{1,49}$");
    private static final Pattern FEATURE_KEY = Pattern.compile("^[a-z_]+$");
    private static final Pattern BOARD_PATTERN = Pattern.compile("^(\\*|[a-z0-9][a-z0-9_.:-]*\\*?)$");

    /** Used when even the generic row is missing or disabled, so resolve() never returns null. */
    private static final List<String> BUILTIN_GENERIC_FEATURES = List.of("chat", "character", "voiceprint",
            "chat_history", "firmware");

    private final SysParamsService sysParamsService;

    private volatile List<ProductVO> enabledCache;
    private volatile long enabledCacheLoadedAt;

    public ProductServiceImpl(SysParamsService sysParamsService) {
        this.sysParamsService = sysParamsService;
    }

    // ---------------------------------------------------------------- resolve

    @Override
    public ProductVO resolve(String board) {
        List<ProductVO> products = enabledProducts();
        String normalized = StringUtils.isBlank(board) ? null : board.trim().toLowerCase(Locale.ROOT);

        if (normalized == null) {
            String defaultKey = defaultKey();
            for (ProductVO p : products) {
                if (p.getProductKey().equals(defaultKey)) {
                    return p;
                }
            }
            return fallback(products);
        }

        ProductVO best = null;
        int bestRank = Integer.MAX_VALUE;
        int bestPrefixLen = -1;
        for (ProductVO p : products) {
            // products are already ordered by sort, so on a tie the first one found wins
            for (String pattern : patterns(p.getBoardTypes())) {
                int rank;
                int prefixLen = 0;
                if ("*".equals(pattern)) {
                    rank = 3;
                } else if (pattern.endsWith("*")) {
                    String prefix = pattern.substring(0, pattern.length() - 1);
                    if (!normalized.startsWith(prefix)) {
                        continue;
                    }
                    rank = 2;
                    prefixLen = prefix.length();
                } else if (pattern.equals(normalized)) {
                    rank = 1;
                } else {
                    continue;
                }
                if (rank < bestRank || (rank == bestRank && prefixLen > bestPrefixLen)) {
                    best = p;
                    bestRank = rank;
                    bestPrefixLen = prefixLen;
                }
            }
        }
        return best != null ? best : fallback(products);
    }

    @Override
    public boolean hasFeature(String board, String feature) {
        return resolve(board).hasFeature(feature);
    }

    @Override
    public void requireFeature(String board, String feature) {
        if (!hasFeature(board, feature)) {
            throw new RenException(ErrorCode.DEVICE_FEATURE_NOT_SUPPORTED, feature);
        }
    }

    private String defaultKey() {
        try {
            String value = sysParamsService.getValue(DEFAULT_KEY_PARAM, true);
            if (StringUtils.isNotBlank(value) && !"null".equalsIgnoreCase(value.trim())) {
                return value.trim().toLowerCase(Locale.ROOT);
            }
        } catch (Exception e) {
            log.warn("Could not read sys param {}: {}", DEFAULT_KEY_PARAM, e.getMessage());
        }
        return GENERIC_KEY;
    }

    private ProductVO fallback(List<ProductVO> products) {
        for (ProductVO p : products) {
            if (GENERIC_KEY.equals(p.getProductKey())) {
                return p;
            }
        }
        ProductVO generic = new ProductVO();
        generic.setProductKey(GENERIC_KEY);
        generic.setNameEn("Nobix device");
        generic.setNameBn("নোবিক্স ডিভাইস");
        generic.setBoardTypes("*");
        generic.setFeatures(BUILTIN_GENERIC_FEATURES);
        generic.setSort(Integer.MAX_VALUE);
        generic.setStatus(1);
        return generic;
    }

    static List<String> patterns(String boardTypes) {
        if (StringUtils.isBlank(boardTypes)) {
            return Collections.emptyList();
        }
        List<String> out = new ArrayList<>();
        for (String part : boardTypes.split(",")) {
            String p = part.trim().toLowerCase(Locale.ROOT);
            if (!p.isEmpty()) {
                out.add(p);
            }
        }
        return out;
    }

    // ---------------------------------------------------------------- cache

    private List<ProductVO> enabledProducts() {
        List<ProductVO> cached = enabledCache;
        if (cached != null && System.currentTimeMillis() - enabledCacheLoadedAt < CACHE_TTL_MS) {
            return cached;
        }
        List<ProductVO> loaded;
        try {
            List<ProductEntity> all = baseDao.selectList(null);
            loaded = (all == null ? Collections.<ProductEntity>emptyList() : all).stream()
                    .filter(e -> e.getStatus() != null && e.getStatus() == 1)
                    .filter(e -> StringUtils.isNotBlank(e.getProductKey()))
                    .map(ProductServiceImpl::toVO)
                    .sorted(Comparator.comparing((ProductVO v) -> v.getSort() == null ? 0 : v.getSort())
                            .thenComparing(v -> v.getId() == null ? Long.MAX_VALUE : v.getId()))
                    .toList();
        } catch (Exception e) {
            // e.g. table not migrated yet: keep the old list if there is one, else behave as generic only
            log.warn("Could not load products: {}", e.getMessage());
            return cached != null ? cached : Collections.emptyList();
        }
        enabledCache = loaded;
        enabledCacheLoadedAt = System.currentTimeMillis();
        return loaded;
    }

    @Override
    public void invalidateCache() {
        enabledCache = null;
    }

    static ProductVO toVO(ProductEntity entity) {
        ProductVO vo = new ProductVO();
        vo.setId(entity.getId());
        vo.setProductKey(entity.getProductKey() == null ? null : entity.getProductKey().trim().toLowerCase(Locale.ROOT));
        vo.setNameEn(entity.getNameEn());
        vo.setNameBn(entity.getNameBn());
        vo.setDescription(entity.getDescription());
        vo.setIconUrl(entity.getIconUrl());
        vo.setBoardTypes(entity.getBoardTypes());
        vo.setFeatures(parseFeatures(entity.getFeatures()));
        vo.setSort(entity.getSort());
        vo.setStatus(entity.getStatus());
        vo.setCreateDate(entity.getCreateDate());
        vo.setUpdateDate(entity.getUpdateDate());
        return vo;
    }

    private static List<String> parseFeatures(String json) {
        if (StringUtils.isBlank(json)) {
            return Collections.emptyList();
        }
        try {
            List<String> list = JsonUtils.parseArray(json, String.class);
            return list.stream().filter(Objects::nonNull).toList();
        } catch (Exception e) {
            log.warn("Invalid product features JSON: {}", json);
            return Collections.emptyList();
        }
    }

    // ---------------------------------------------------------------- queries

    @Override
    public List<ProductListVO> listEnabled() {
        return enabledProducts().stream().map(p -> {
            ProductListVO vo = new ProductListVO();
            vo.setProductKey(p.getProductKey());
            vo.setNameEn(p.getNameEn());
            vo.setNameBn(p.getNameBn());
            vo.setIconUrl(p.getIconUrl());
            vo.setFeatures(p.getFeatures());
            vo.setSort(p.getSort());
            return vo;
        }).toList();
    }

    @Override
    public PageData<ProductVO> page(Map<String, Object> params) {
        String keywords = (String) params.get("keywords");
        QueryWrapper<ProductEntity> wrapper = new QueryWrapper<>();
        if (StringUtils.isNotBlank(keywords)) {
            wrapper.and(w -> w.like("product_key", keywords).or().like("name_en", keywords)
                    .or().like("name_bn", keywords));
        }
        IPage<ProductEntity> page = baseDao.selectPage(getPage(params, "sort", true), wrapper);
        List<ProductVO> list = page.getRecords().stream().map(ProductServiceImpl::toVO).toList();
        return new PageData<>(list, page.getTotal());
    }

    // ---------------------------------------------------------------- admin CRUD

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void save(ProductDTO dto) {
        ProductEntity entity = toEntity(dto);
        checkKeyUnique(entity.getProductKey(), null);
        insert(entity);
        invalidateCache();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void update(ProductDTO dto) {
        ProductEntity existing = baseDao.selectById(dto.getId());
        if (existing == null) {
            throw new RenException(ErrorCode.PRODUCT_NOT_EXIST);
        }
        ProductEntity entity = toEntity(dto);
        if (GENERIC_KEY.equals(existing.getProductKey()) && !GENERIC_KEY.equals(entity.getProductKey())) {
            throw new RenException(ErrorCode.PRODUCT_GENERIC_PROTECTED);
        }
        checkKeyUnique(entity.getProductKey(), dto.getId());
        entity.setId(dto.getId());
        baseDao.updateById(entity);
        invalidateCache();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long[] ids) {
        if (ids == null || ids.length == 0) {
            return;
        }
        List<Long> idList = Arrays.stream(ids).filter(Objects::nonNull).toList();
        if (idList.isEmpty()) {
            return;
        }
        boolean touchesGeneric = baseDao.exists(new QueryWrapper<ProductEntity>()
                .in("id", idList)
                .eq("product_key", GENERIC_KEY));
        if (touchesGeneric) {
            throw new RenException(ErrorCode.PRODUCT_GENERIC_PROTECTED);
        }
        deleteBatchIds(idList);
        invalidateCache();
    }

    private ProductEntity toEntity(ProductDTO dto) {
        String key = dto.getProductKey() == null ? "" : dto.getProductKey().trim();
        if (!PRODUCT_KEY.matcher(key).matches()) {
            throw new RenException(ErrorCode.PRODUCT_KEY_INVALID);
        }
        if (StringUtils.isBlank(dto.getNameEn())) {
            throw new RenException(ErrorCode.NOT_NULL, "nameEn");
        }
        String boardTypes = normalizeBoardTypes(dto.getBoardTypes());
        List<String> features = validateFeatures(dto.getFeatures());

        ProductEntity entity = new ProductEntity();
        entity.setProductKey(key);
        entity.setNameEn(dto.getNameEn().trim());
        entity.setNameBn(StringUtils.trimToNull(dto.getNameBn()));
        entity.setDescription(StringUtils.trimToNull(dto.getDescription()));
        entity.setIconUrl(StringUtils.trimToNull(dto.getIconUrl()));
        entity.setBoardTypes(boardTypes);
        entity.setFeatures(JsonUtils.toJsonString(features));
        entity.setSort(dto.getSort() == null ? 0 : dto.getSort());
        entity.setStatus(dto.getStatus() == null ? 1 : (dto.getStatus() == 0 ? 0 : 1));
        return entity;
    }

    static String normalizeBoardTypes(String boardTypes) {
        List<String> patterns = patterns(boardTypes);
        if (patterns.isEmpty()) {
            throw new RenException(ErrorCode.PRODUCT_BOARD_TYPES_INVALID);
        }
        for (String p : patterns) {
            if (!BOARD_PATTERN.matcher(p).matches()) {
                throw new RenException(ErrorCode.PRODUCT_BOARD_TYPES_INVALID);
            }
        }
        return String.join(",", patterns.stream().distinct().toList());
    }

    static List<String> validateFeatures(List<String> features) {
        if (features == null) {
            return Collections.emptyList();
        }
        List<String> out = new ArrayList<>();
        for (String f : features) {
            if (f == null || !FEATURE_KEY.matcher(f).matches()) {
                throw new RenException(ErrorCode.PRODUCT_FEATURES_INVALID);
            }
            if (!out.contains(f)) {
                out.add(f);
            }
        }
        return out;
    }

    private void checkKeyUnique(String productKey, Long excludeId) {
        QueryWrapper<ProductEntity> wrapper = new QueryWrapper<>();
        wrapper.eq("product_key", productKey);
        if (excludeId != null) {
            wrapper.ne("id", excludeId);
        }
        if (baseDao.exists(wrapper)) {
            throw new RenException(ErrorCode.PRODUCT_KEY_DUPLICATE);
        }
    }
}
