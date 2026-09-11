# get_news_from_newsnow Plugin News Source Configuration Guide

## Overview

The `get_news_from_newsnow` plugin supports dynamic news source configuration through the web admin interface, so you do not need to modify code. You can configure different news sources for each agent in the control panel.

## Configuration Methods

### 1. Configure in the Web Admin UI (recommended)

1. Log in to the control panel.
2. Open the **Role Configuration** page.
3. Select the agent you want to configure.
4. Click **Edit Functions**.
5. In the parameter section on the right, find the **NewsNow news aggregation** plugin.
6. Enter a semicolon-separated list of news source IDs in the **News Source Configuration** field (for example: `thepaper;baidu;cls`).

### 2. Configure in the config file

Add the following to `config.yaml`:

```yaml
plugins:
  get_news_from_newsnow:
    url: "https://newsnow.busiyi.world/api/s?id="
    news_sources: "thepaper;baidu;cls;weibo;douyin"
```

## News Source Format

News sources use lowercase IDs separated by semicolons:

```text
source_id1;source_id2;source_id3
```

### Example

```text
thepaper;baidu;cls;weibo;douyin;zhihu;36kr
```

## Supported News Sources

The plugin supports the following news source IDs:

- `thepaper` (The Paper)
- `baidu` (Baidu Hot Search)
- `cls` (Cailian Press)
- `weibo` (Weibo Hot Search)
- `douyin` (Douyin)
- `zhihu` (Zhihu Hot Topics)
- `36kr` (36Kr)
- `wallstreetcn` (Wallstreet CN)
- `ithome` (IT Home)
- `toutiao` (Toutiao)
- `hupu` (Hupu)
- `bilibili` (Bilibili Hot Search)
- `kuaishou` (Kuaishou)
- `xueqiu` (Xueqiu)
- `gelonghui` (Gelonghui)
- `fastbull` (FastBull)
- `jin10` (Jin10)
- `nowcoder` (NowCoder)
- `sspai` (SSPAI)
- `juejin` (Juejin)
- `ifeng` (iFeng)
- `chongbuluo` (Chongbuluo)
- `zaobao` (Lianhe Zaobao)
- `coolapk` (Coolapk)
- `pcbeta` (PCBETA)
- `cankaoxiaoxi` (Reference News)
- `sputnik` (Sputnik News)
- `tieba` (Baidu Tieba)
- `kaopu` (Kaopu News)
- `hackernews` (Hacker News)
- `github` (GitHub Trending)
- `producthunt` (Product Hunt)

## Default Configuration

If no news sources are configured, the plugin uses the following default value:

```text
thepaper;hackernews;github
```

## Usage

1. **Configure news sources**: Set source IDs in the web UI or config file, separated by semicolons.
2. **Call the plugin**: Users can say "read the news" or "get news".
3. **Specify a source**: Users can say "read The Paper news" or "get Baidu Hot Search".
4. **Get details**: Users can say "explain this news in detail".

## How It Works

1. The plugin accepts the configured news source IDs (for example, `thepaper`).
2. It maps the ID to the remote channel endpoint defined in `CHANNEL_MAP`.
3. It calls the API with that channel ID to fetch real-time news data.
4. It returns the formatted news content to the LLM.

## Notes

1. The configured source ID must match an ID in `CHANNEL_MAP`.
2. After changing the configuration in `config.yaml`, restart the service.
3. If an invalid source is provided, the plugin falls back to `thepaper`.
4. Separate multiple sources with an ASCII semicolon (`;`).
