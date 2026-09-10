# Aliyun SMS Integration Guide

Log in to the Alibaba Cloud console and open the SMS Service page: https://dysms.console.aliyun.com/overview

## Step 1: Add a signature
![Step](images/alisms/sms-01.png)
![Step](images/alisms/sms-02.png)

After completing the steps above, you will obtain a signature. Add it to the following console parameter: `aliyun.sms.sign_name`

## Step 2: Add a template
![Step](images/alisms/sms-11.png)

After completing the steps above, you will obtain a template code. Add it to the following console parameter: `aliyun.sms.sms_code_template_code`

Note: the signature needs to wait 7 business days. SMS messages can only be sent after the carrier review is approved.

Note: the signature needs to wait 7 business days. SMS messages can only be sent after the carrier review is approved.

Note: the signature needs to wait 7 business days. SMS messages can only be sent after the carrier review is approved.

You can continue after the approval is completed.

## Step 3: Create an SMS account and grant permissions

Log in to the Alibaba Cloud console and open the Access Control page: https://ram.console.aliyun.com/overview?activeTab=overview

![Step](images/alisms/sms-21.png)
![Step](images/alisms/sms-22.png)
![Step](images/alisms/sms-23.png)
![Step](images/alisms/sms-24.png)
![Step](images/alisms/sms-25.png)

After completing the steps above, you will obtain `access_key_id` and `access_key_secret`. Add them to the following console parameters: `aliyun.sms.access_key_id` and `aliyun.sms.access_key_secret`

## Step 4: Enable mobile registration

1. After all of the above information has been filled in, you should see the following result. If not, one of the steps may have been missed.

![Step](images/alisms/sms-31.png)

2. Enable registration for non-admin users by setting `server.allow_user_register` to `true`.

3. Enable mobile registration by setting `server.enable_mobile_register` to `true`.

![Step](images/alisms/sms-32.png)