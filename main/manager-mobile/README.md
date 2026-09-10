## Control Panel Mobile Edition (manager-mobile)
A cross-platform mobile admin app built with uni-app v3 + Vue 3 + Vite, supporting App (Android & iOS) and WeChat Mini Program.

### Platform compatibility

| H5 | iOS | Android | WeChat Mini Program |
| -- | --- | ------- | ------------------- |
| √  | √   | √       | √                   |

Note: different UI components may vary slightly in compatibility across platforms. Please refer to the corresponding UI library documentation.

### Development requirements
- Node >= 18
- pnpm >= 7.30 (the project recommends `pnpm@10.x`)
- Optional: HBuilderX (App debugging/building), WeChat Developer Tools (WeChat Mini Program)

### Quick start
1) Configure environment variables
   - Copy `env/.env.example` to `env/.env.development`
   - Adjust the configuration values as needed, especially `VITE_SERVER_BASEURL`, `VITE_UNI_APPID`, and `VITE_WX_APPID`

2) Install dependencies

```bash
pnpm i
```

3) Local development (hot reload)
- H5: `pnpm dev:h5`, then check the IP and port shown in the startup logs
- WeChat Mini Program: `pnpm dev:mp` or `pnpm dev:mp-weixin`, then import `dist/dev/mp-weixin` in WeChat Developer Tools
- App: import `manager-mobile` with HBuilderX, then follow the guide below to run it

### Environment variables and configuration
The project uses a custom `env` directory for environment files, following Vite naming conventions: `.env.development`, `.env.production`, etc.

Key variables (partial):
- VITE_APP_TITLE: application name (written into `manifest.config.ts`)
- VITE_UNI_APPID: uni-app appid (App)
- VITE_WX_APPID: WeChat Mini Program appid (mp-weixin)
- VITE_FALLBACK_LOCALE: default language, for example `zh-Hans`
- VITE_SERVER_BASEURL: server base URL for HTTP requests
- VITE_DELETE_CONSOLE: whether to remove console logs during build (`true`/`false`)
- VITE_SHOW_SOURCEMAP: whether to generate sourcemaps (disabled by default)
- VITE_LOGIN_URL: login page path for unauthenticated redirects (used by the route guard)

Example (`env/.env.development`):
```env
VITE_APP_TITLE=Xiaozhi
VITE_FALLBACK_LOCALE=zh-Hans
VITE_UNI_APPID=
VITE_WX_APPID=

VITE_SERVER_BASEURL=http://localhost:8080

VITE_DELETE_CONSOLE=false
VITE_SHOW_SOURCEMAP=false
VITE_LOGIN_URL=/pages/login/index
```

Note:
- `manifest.config.ts` reads the title, appid, language, and other settings from `env`.

### Important notes
⚠️ **Configuration you must change before deployment:**

1. **App ID settings**
   - `VITE_UNI_APPID`: create an app in the [DCloud Developer Center](https://dev.dcloud.net.cn/) and obtain an AppID
   - `VITE_WX_APPID`: register a mini program in the [WeChat Official Accounts Platform](https://mp.weixin.qq.com/) and obtain an AppID

2. **Server address**
   - `VITE_SERVER_BASEURL`: change it to your actual server address

3. **App information**
   - `VITE_APP_TITLE`: change it to your application name
   - Update icon assets such as `src/static/logo.png`

4. **Other settings**
   - Check the application configuration in `manifest.config.ts`
   - Adjust the tab bar configuration in `src/layouts/fg-tabbar/tabbarList.ts` if needed
