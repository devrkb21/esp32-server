-- Update existing get_news_from_newsnow plugin configuration
UPDATE ai_model_provider 
SET fields = JSON_ARRAY(
JSON_OBJECT(
'key', 'url',
'type', 'string',
'label', 'API Address',
'default', 'https://newsnow.busiyi.world/api/s?id='
),
JSON_OBJECT(
'key', 'news_sources',
'type', 'string',
'label', 'News source configuration',
'default', 'ThePaper;Baidu;CLS'
)
)
WHERE provider_code = 'get_news_from_newsnow' 
AND model_type = 'Plugin'; 