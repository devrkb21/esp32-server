package xiaozhi.modules.knowledge.task;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import xiaozhi.modules.knowledge.service.KnowledgeFilesService;

/**
 * Knowledge base document status sync scheduled task
 * 
 * douse：
 * 1. Automatically scan documents in 'RUNNING' (parsing) state
 * 2. Invoke RAGFlow InterfaceGetMostNewStatus
 * 3. StatusInvert (RUNNING -> SUCCESS/FAIL) when，SyncUpdateDatalib
 * 4. [Key] Parsing succeededwhen，Compensate update knowledge base statistics (TokenCount)
 */
@Component
@AllArgsConstructor
@Slf4j
public class DocumentStatusSyncTask {

    private final KnowledgeFilesService knowledgeFilesService;

    /**
     * each 30 sExecuteonetimesSync
     * Using fixedDelay, ensuring the next execution starts 30 seconds after the previous completes to prevent backlog
     */
    @Scheduled(fixedDelay = 30000)
    public void syncRunningDocuments() {
        try {
            // log.debug("Start executing document status sync task...");
            knowledgeFilesService.syncRunningDocuments();
        } catch (Exception e) {
            log.error("Document status synchronization task exception", e);
        }
    }
}
