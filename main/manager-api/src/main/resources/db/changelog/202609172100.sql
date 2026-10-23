-- Web search plugin: add the Serply search provider

UPDATE `ai_model_provider`
SET `fields` = JSON_SET(
    `fields`,
    '$[0].label',
    'Search provider: metaso / tavily / serply'
)
WHERE `id` = 'SYSTEM_PLUGIN_WEB_SEARCH';
