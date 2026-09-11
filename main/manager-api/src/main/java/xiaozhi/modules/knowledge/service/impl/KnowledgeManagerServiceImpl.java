package xiaozhi.modules.knowledge.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import xiaozhi.modules.knowledge.service.KnowledgeBaseService;
import xiaozhi.modules.knowledge.service.KnowledgeFilesService;
import xiaozhi.modules.knowledge.service.KnowledgeManagerService;

import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class KnowledgeManagerServiceImpl implements KnowledgeManagerService {

    private final KnowledgeBaseService knowledgeBaseService;
    private final KnowledgeFilesService knowledgeFilesService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteDatasetWithFiles(String datasetId) {
        log.info("=== CascadeDeleteStart: datasetId={} ===", datasetId);

        // 1. firstInvokeFileService，Clean up all document records under this dataset (Contain RAGFlow side)
        log.info("Step 1: CleanAssociateDocument...");
        knowledgeFilesService.deleteDocumentsByDatasetId(datasetId);

        // 2. AgainInvokeKnowledge base service，ThoroughlyUnregisterDataset (Contain RAGFlow side)
        log.info("Step 2: DeleteDatasetPrimaryAgent...");
        knowledgeBaseService.deleteByDatasetId(datasetId);

        log.info("=== CascadeDeleteSucceeded: datasetId={} ===", datasetId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void batchDeleteDatasetsWithFiles(List<String> datasetIds) {
        if (datasetIds == null || datasetIds.isEmpty())
            return;
        log.info("=== BatchCascadeDeleteStart: count={} ===", datasetIds.size());
        for (String id : datasetIds) {
            deleteDatasetWithFiles(id);
        }
    }
}
