# Tabbar Documentation

`tabbar` has 4 strategies:

- 0 `NO_TABBAR`: Single entry point, no tabbar at the bottom. Useful for standalone event pages.
- 1 `NATIVE_TABBAR`: Uses `switchTab` with caching.
  - Advantages: Native performance, fastest render, cached pages.
  - Disadvantages: Only supports 2 image sets for active/inactive states.
- 2 `CUSTOM_TABBAR_WITH_CACHE`: Uses `switchTab` with caching. Uses third-party UI library tabbar and hides native tabbar.
  - Advantages: Customizable SVG icons, font colors, animations with cache.
  - Disadvantages: May flicker slightly on first render.
- 3 `CUSTOM_TABBAR_WITHOUT_CACHE`: Uses `navigateTo` without caching.
  - Advantages: Highly customizable SVG icons and animations.
  - Disadvantages: No page caching, may flicker on first click.

> Note: Custom visual effects should be implemented by developer.
