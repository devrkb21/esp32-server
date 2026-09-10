# get_news_from_newsnow Plugin News Source Configuration Guide

## Overview

The `get_news_from_newsnow` plugin now supports dynamic news source configuration through the web admin interface, so you no longer need to modify code. You can configure different news sources for each agent in the control panel.

## Configuration Methods

### 1. Configure in the Web Admin UI (recommended)

1. Log in to the control panel.
2. Open the **Role Configuration** page.
3. Select the agent you want to configure.
4. Click **Edit Functions**.
5. In the parameter section on the right, find the **NewsNow news aggregation** plugin.
6. Enter a semicolon-separated list of Chinese news source names in the **News Source Configuration** field.

### 2. Configure in the config file

Add the following to `config.yaml`:

```yaml
plugins:
  get_news_from_newsnow:
    url: "https://newsnow.busiyi.world/api/s?id="
    news_sources: "澎湃新闻;百度热搜;财联社;微博;抖音"
```

## News Source Format

News sources use Chinese names separated by semicolons:

```text
ChineseName1;ChineseName2;ChineseName3
```

### Example

```text
澎湃新闻;百度热搜;财联社;微博;抖音;知乎;36氪
```

## Supported News Sources

The plugin supports the following Chinese news source names:

- 澎湃新闻
- 百度热搜
- 财联社
- 微博
- 抖音
- 知乎
- 36氪
- 华尔街见闻
- IT之家
- 今日头条
- 虎扑
- 哔哩哔哩
- 快手
- 雪球
- 格隆汇
- 法布财经
- 金十数据
- 牛客
- 少数派
- 稀土掘金
- 凤凰网
- 虫部落
- 联合早报
- 酷安
- 远景论坛
- 参考消息
- 卫星通讯社
- 百度贴吧
- 靠谱新闻
- And more...

## Default Configuration

If no news sources are configured, the plugin uses the following default value:

```text
澎湃新闻;百度热搜;财联社
```

## Usage

1. **Configure news sources**: Set the Chinese source names in the web UI or config file, separated by semicolons.
2. **Call the plugin**: Users can say "read the news" or "get news".
3. **Specify a source**: Users can say "read Pengpai News" or "get Baidu Hot Search".
4. **Get details**: Users can say "explain this news in detail".

## How It Works

1. The plugin accepts Chinese source names as input (for example, `澎湃新闻`).
2. It converts the configured Chinese name to the matching English ID (for example, `thepaper`).
3. It calls the API with that English ID to fetch news data.
4. It returns the news content to the user.

## Notes

1. The configured Chinese name must exactly match the name defined in `CHANNEL_MAP`.
2. After changing the configuration, restart the service or reload the configuration.
3. If a configured source is invalid, the plugin automatically falls back to the default sources.
4. Separate multiple sources with an English semicolon (`;`), not a Chinese semicolon (`；`).
