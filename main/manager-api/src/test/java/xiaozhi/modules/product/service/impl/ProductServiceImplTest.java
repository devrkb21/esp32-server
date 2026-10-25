package xiaozhi.modules.product.service.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.springframework.test.util.ReflectionTestUtils;

import xiaozhi.common.exception.ErrorCode;
import xiaozhi.common.exception.RenException;
import xiaozhi.common.utils.MessageUtils;
import xiaozhi.modules.product.dao.ProductDao;
import xiaozhi.modules.product.dto.ProductDTO;
import xiaozhi.modules.product.entity.ProductEntity;
import xiaozhi.modules.product.service.ProductService;
import xiaozhi.modules.product.vo.ProductVO;
import xiaozhi.modules.sys.service.SysParamsService;

class ProductServiceImplTest {

    private ProductDao dao;
    private SysParamsService sysParamsService;
    private ProductServiceImpl service;
    private List<ProductEntity> rows;

    // RenException looks its message up through Spring; there is no context in a unit test
    private MockedStatic<MessageUtils> messageUtils;

    @AfterEach
    void tearDown() {
        messageUtils.close();
    }

    @BeforeEach
    void setUp() {
        messageUtils = mockStatic(MessageUtils.class);
        dao = mock(ProductDao.class);
        sysParamsService = mock(SysParamsService.class);
        service = new ProductServiceImpl(sysParamsService);
        ReflectionTestUtils.setField(service, "baseDao", dao);
        rows = new ArrayList<>();
        rows.add(product(1L, "tinybot", "tinybot,tinybot-*", 1, 1,
                "[\"chat\",\"companion\",\"day\",\"prayer\"]"));
        rows.add(product(2L, "generic", "*", 999, 1, "[\"chat\",\"firmware\"]"));
        when(dao.selectList(any())).thenAnswer(inv -> new ArrayList<>(rows));
        when(sysParamsService.getValue(eq(ProductService.DEFAULT_KEY_PARAM), anyBoolean())).thenReturn("tinybot");
    }

    private static ProductEntity product(Long id, String key, String boards, int sort, int status, String features) {
        ProductEntity e = new ProductEntity();
        e.setId(id);
        e.setProductKey(key);
        e.setNameEn(key + "-en");
        e.setNameBn(key + "-bn");
        e.setBoardTypes(boards);
        e.setSort(sort);
        e.setStatus(status);
        e.setFeatures(features);
        return e;
    }

    @Test
    void exactBoardMatches() {
        ProductVO p = service.resolve("tinybot");
        assertEquals("tinybot", p.getProductKey());
        assertEquals("tinybot-en", p.getNameEn());
        assertTrue(p.hasFeature("companion"));
        assertEquals(List.of("chat", "companion", "day", "prayer"), p.getFeatures());
    }

    @Test
    void exactMatchIsCaseAndWhitespaceInsensitive() {
        assertEquals("tinybot", service.resolve("  TinyBot ").getProductKey());
    }

    @Test
    void wildcardPrefixMatches() {
        assertEquals("tinybot", service.resolve("tinybot-v2").getProductKey());
        // the prefix is "tinybot-", so a board that only starts with "tinybot" does not match it
        assertEquals("generic", service.resolve("tinybotx").getProductKey());
    }

    @Test
    void exactMatchBeatsWildcardAndLongerPrefixWins() {
        rows.add(product(3L, "lamp", "tinybot-lamp", 50, 1, "[\"chat\"]"));
        rows.add(product(4L, "toy", "tinybot-toy-*", 60, 1, "[\"chat\"]"));
        service.invalidateCache();
        assertEquals("lamp", service.resolve("tinybot-lamp").getProductKey());
        assertEquals("toy", service.resolve("tinybot-toy-mini").getProductKey());
        assertEquals("tinybot", service.resolve("tinybot-other").getProductKey());
    }

    @Test
    void unknownBoardFallsBackToGeneric() {
        ProductVO p = service.resolve("bread-compact-wifi");
        assertEquals("generic", p.getProductKey());
        assertFalse(p.hasFeature("companion"));
    }

    @Test
    void neverNullEvenWithoutAnyProducts() {
        rows.clear();
        service.invalidateCache();
        ProductVO p = service.resolve("whatever");
        assertNotNull(p);
        assertEquals("generic", p.getProductKey());
        assertFalse(p.hasFeature("companion"));
        assertEquals("generic", service.resolve(null).getProductKey());
    }

    @Test
    void nullOrBlankBoardResolvesToDefaultKey() {
        assertEquals("tinybot", service.resolve(null).getProductKey());
        assertEquals("tinybot", service.resolve("  ").getProductKey());
        assertTrue(service.hasFeature(null, "companion"));

        when(sysParamsService.getValue(eq(ProductService.DEFAULT_KEY_PARAM), anyBoolean())).thenReturn("generic");
        assertEquals("generic", service.resolve(null).getProductKey());
    }

    @Test
    void nullBoardWithMissingDefaultKeyFallsBackToGeneric() {
        when(sysParamsService.getValue(eq(ProductService.DEFAULT_KEY_PARAM), anyBoolean())).thenReturn("nope");
        assertEquals("generic", service.resolve(null).getProductKey());
    }

    @Test
    void disabledProductIsSkipped() {
        rows.get(0).setStatus(0);
        service.invalidateCache();
        assertEquals("generic", service.resolve("tinybot").getProductKey());
        assertEquals("generic", service.resolve("tinybot-v2").getProductKey());
        // the default key points at a disabled product: fall back to generic
        assertEquals("generic", service.resolve(null).getProductKey());
        assertFalse(service.listEnabled().stream().anyMatch(p -> "tinybot".equals(p.getProductKey())));
    }

    @Test
    void enabledListIsCached() {
        service.resolve("tinybot");
        service.resolve("x");
        service.listEnabled();
        verify(dao, times(1)).selectList(any());
        service.invalidateCache();
        service.resolve("tinybot");
        verify(dao, times(2)).selectList(any());
    }

    @Test
    void requireFeatureThrowsForMissingFeature() {
        service.requireFeature("tinybot", "companion");
        RenException e = assertThrows(RenException.class,
                () -> service.requireFeature("bread-compact-wifi", "companion"));
        assertEquals(ErrorCode.DEVICE_FEATURE_NOT_SUPPORTED, e.getCode());
    }

    @Test
    void validationOfKeyFeaturesAndBoards() {
        ProductDTO dto = new ProductDTO();
        dto.setProductKey("Bad Key");
        dto.setNameEn("X");
        dto.setBoardTypes("x");
        assertEquals(ErrorCode.PRODUCT_KEY_INVALID, assertThrows(RenException.class, () -> service.save(dto)).getCode());

        dto.setProductKey("lamp");
        dto.setFeatures(List.of("chat", "Bad-Feature"));
        assertEquals(ErrorCode.PRODUCT_FEATURES_INVALID,
                assertThrows(RenException.class, () -> service.save(dto)).getCode());

        dto.setFeatures(List.of("chat"));
        dto.setBoardTypes("lamp, *x");
        assertEquals(ErrorCode.PRODUCT_BOARD_TYPES_INVALID,
                assertThrows(RenException.class, () -> service.save(dto)).getCode());
        verify(dao, never()).insert(any(ProductEntity.class));

        assertEquals("lamp,lamp-*", ProductServiceImpl.normalizeBoardTypes(" Lamp , lamp-* ,lamp"));
    }

    @Test
    void genericCannotBeDeleted() {
        when(dao.exists(any())).thenReturn(true);
        RenException e = assertThrows(RenException.class, () -> service.delete(new Long[] { 2L }));
        assertEquals(ErrorCode.PRODUCT_GENERIC_PROTECTED, e.getCode());
        verify(dao, never()).deleteByIds(any());
    }
}
