DROP TABLE IF EXISTS ai_agent_voice_print;
create table ai_agent_voice_print (
  id varchar(32) NOT NULL COMMENT 'Voiceprint ID',
  agent_id varchar(32)  NOT NULL COMMENT 'Associated agent ID',
  source_name varchar(50)  NOT NULL COMMENT 'Name of the person from whom voiceprint originates',
  introduce varchar(200) COMMENT 'Description of the person from whom voiceprint originates',
  create_date DATETIME COMMENT 'Create time',
  creator bigint COMMENT 'Creator',
  update_date DATETIME COMMENT 'Modification time',
  updater bigint COMMENT 'Modified by',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Agent voiceprint table'