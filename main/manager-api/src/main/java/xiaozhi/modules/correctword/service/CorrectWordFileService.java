package xiaozhi.modules.correctword.service;

import java.util.List;
import java.util.Map;

import xiaozhi.common.page.PageData;
import xiaozhi.modules.correctword.dto.CorrectWordFileCreateDTO;
import xiaozhi.modules.correctword.vo.CorrectWordFileVO;
import xiaozhi.modules.correctword.vo.CorrectWordSimpleVO;

public interface CorrectWordFileService {

    /**
     * CreateReplacement word file
     *
     * @param dto CreateParameter
     * @return FileVO
     */
    CorrectWordFileVO createFile(CorrectWordFileCreateDTO dto);

    /**
     * UpdateReplacement word file（FullReplacement word entry）
     *
     * @param fileId FileID
     * @param dto    UpdateParameter
     */
    void updateFile(String fileId, CorrectWordFileCreateDTO dto);

    /**
     * Get current user's replacement word file list
     *
     * @param params Pagination parameters
     * @return Pagination data
     */
    PageData<CorrectWordFileVO> listFiles(Map<String, Object> params);

    /**
     * Get current user's replacement word file list（notPagination，Used for dropdown selection）
     *
     * @return FileList
     */
    List<CorrectWordFileVO> listAllFiles();

    /**
     * Get raw file content（Used for download）
     *
     * @param fileId FileID
     * @return FileEntity
     */
    CorrectWordFileVO getFileContent(String fileId);

    /**
     * Delete replacement word file and all its entries and association records
     *
     * @param fileId FileID
     */
    void deleteFile(String fileId);

    /**
     * Delete replacement word file association records associated with agent（Do not delete file itself）
     *
     * @param agentId AgentID
     */
    void deleteMappingsByAgentId(String agentId);

    /**
     * Get all replacement word entries for agent（Lite version，provideDevicesideUse）
     *
     * @param agentId AgentID
     * @return Replacement wordList
     */
    List<CorrectWordSimpleVO> getAllItemsByAgentId(String agentId);

    /**
     * Get replacement word files associated with agentIDList
     *
     * @param agentId AgentID
     * @return FileIDList
     */
    List<String> getAgentCorrectWordFileIds(String agentId);

    /**
     * Save replacement word files associated with agent（Full replacement）
     *
     * @param agentId AgentID
     * @param fileIds FileIDList
     */
    void saveAgentCorrectWords(String agentId, List<String> fileIds);

    /**
     * Batch delete replacement word files
     *
     * @param fileIds FileIDList
     */
    void batchDeleteFiles(List<String> fileIds);
}
