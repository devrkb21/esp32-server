-- Parameters the start-up seeder created before it gave new rows type 1 were saved as type 0,
-- which the Parameters page does not list (it shows type 1 only), so admins could not edit them.
-- Everything but generated private keys becomes visible again.
UPDATE `sys_params` SET `param_type` = 1
WHERE `param_type` = 0
  AND `param_code` NOT LIKE '%private_key';
