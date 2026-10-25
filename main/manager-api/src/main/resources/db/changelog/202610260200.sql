-- The app is Nobix (TinyBot is one product in it): the server name shown under sign-in and the
-- default verification SMS say Nobix. An admin may still change both.
UPDATE `sys_params` SET `param_value` = 'Nobix' WHERE `param_code` = 'server.name';
UPDATE `sys_params` SET `param_value` = 'আপনার নোবিক্স যাচাই কোড {code}। কোডটি কাউকে জানাবেন না।'
WHERE `param_code` = 'reve.sms.code_message'
  AND `param_value` = 'আপনার টাইনিবট যাচাই কোড {code}। কোডটি কাউকে জানাবেন না।';
