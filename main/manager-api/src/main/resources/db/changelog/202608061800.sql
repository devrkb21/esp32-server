UPDATE `ai_model_config`
SET `config_json` = JSON_SET(`config_json`, '$.model_name', 'doubao-seed-2-0-lite-260215')
WHERE `id` = 'LLM_DoubaoLLM'
  AND JSON_UNQUOTE(JSON_EXTRACT(`config_json`, '$.model_name')) IN (
    'doubao-1-5-pro-32k-250115'
  );

UPDATE `ai_model_config`
SET `remark` = REPLACE(
    REPLACE(
        `remark`,
        'Activate Doubao-1.5-pro service',
        'Activate Doubao-Seed-2.0-Lite service'
    ),
    'Currently recommended: doubao-1-5-pro-32k-250115',
    'Currently recommended: doubao-seed-2-0-lite-260215'
)
WHERE `id` = 'LLM_DoubaoLLM'
  AND (
    `remark` LIKE '%Doubao-1.5-pro%'
    OR `remark` LIKE '%doubao-1-5-pro-32k-250115%'
  );
