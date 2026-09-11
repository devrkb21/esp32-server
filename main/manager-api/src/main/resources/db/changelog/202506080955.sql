-- Enable wake-word acceleration in control panel
update `sys_params` set param_value = 'HelloXiaozhi;Hello Xiaozhi;Xiaoai Student;Hello Xiaoxin;Hello Xiaoxin;Xiaomei Student;Xiaolong Xiaolong;Meow Student;Xiaobin Xiaobin;Xiaobing Xiaobing;Hey hello there' where param_code = 'wakeup_words';
update `sys_params` set param_value = 'true' where param_code = 'enable_wakeup_words_response_cache';
