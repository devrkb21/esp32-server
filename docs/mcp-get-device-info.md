# How to Get Device Information with MCP

This guide shows you how to get device information using an MCP method.

Step 1: Customize your `agent-base-prompt.txt` file

Copy the contents of `agent-base-prompt.txt` from the `xiaozhi-server` directory into your `data` directory and rename it to `.agent-base-prompt.txt`.

Step 2: Edit `data/.agent-base-prompt.txt`

Find the `<context>` tag and add the following line inside it:

```text
- **Device ID:** {{device_id}}
```

After adding it, the `<context>` section in `data/.agent-base-prompt.txt` should look roughly like this:

```text
<context>
[Important! The following information is provided in real time and does not need to be queried through tools. Use it directly:]
- **Device ID:** {{device_id}}
- **Current time:** {{current_time}}
- **Today’s date:** {{today_date}} ({{today_weekday}})
- **Today’s lunar date:** {{lunar_date}}
- **User’s city:** {{local_address}}
- **Local 7-day weather:** {{weather_info}}
</context>
```

Step 3: Edit `data/.config.yaml`

Find the `agent-base-prompt` configuration. The original content is:

```yaml
prompt_template: agent-base-prompt.txt
```

Change it to:

```yaml
prompt_template: data/.agent-base-prompt.txt
```

Step 4: Restart your `xiaozhi-server` service.

Step 5: Add a parameter named `device_id` to your MCP method.

- Type: `string`
- Description: `Device ID`

Step 6: Wake Xiaozhi again and call the MCP method to verify that it can retrieve the `Device ID`.
