# Web Search Plugin Guide

## Overview

The `web_search` plugin supports searching the web in real time during conversations and returning results. It supports two search providers: Metaso and Tavily. You can choose either one based on your needs.

## API Key Guide

We currently support `Metaso Search` and `Tavily Search`.
- Tavily Search: 1,000 free requests per month.
- Metaso Search: provides high-quality domestic data sources.

## How to get an API key

### Option 1: Metaso Search

- Visit [Metaso Search API](https://metaso.cn/search-api/api-keys), register, and sign in
- On the API key management page, click "Create new Key"
- Copy the generated API key (it starts with `mk-`); this is the required configuration value

### Option 2: Tavily Search

- Visit [Tavily Console](https://app.tavily.com/home), register, and sign in
- Create an API key in the console
- Copy the generated API key (it starts with `tvly-`); this is the required configuration value

## Configuration

### Option 1. Use the control panel deployment (recommended)

- Log in to the control panel
- Open the "Role Configuration" page and select the agent you want to configure
- Click the "Edit Features" button, then find the "Web Search" plugin in the parameter configuration area on the right
- Enable "Web Search"
- Set the search provider (`metaso` or `tavily`) and fill in the corresponding API key
- Save the configuration, then save the agent configuration

### Option 2. Single-module xiaozhi-server deployment

Configure the following in `data/.config.yaml`:

- Set the search provider in `provider`; valid values are `metaso` or `tavily`
- Put the obtained API key in `api_key`

```yaml
plugins:
  web_search:
    provider: "metaso"
    api_key: "your-api-key"
```

If you want to customize the number of returned results and the tool description, you can also set `max_results` and `description`:

```yaml
plugins:
  web_search:
    provider: "metaso"
    description: "A web search tool. Use this tool when the user explicitly needs web search."
    max_results: 5
    api_key: "your-api-key"
```

Also make sure `web_search` is enabled in the `functions` list:

```yaml
plugins:
  functions:
    - web_search
```

After the configuration is complete, restart the service for it to take effect.
