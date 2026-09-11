# Voice Box Theme Customization

## Project Overview

This directory contains packaged static files from the [xiaozhi-assets-generator](https://github.com/xinnan-tech/xiaozhi-assets-generator) project, used for online customization and generation of voice box themes. Users can configure wake words, fonts, emojis, and chat backgrounds through this tool, and export an `assets.bin` file.

## Directory Structure

```
generator/
├── assets/              # Built asset files
│   ├── ft_render-ByO_jG18.js
│   ├── index-CYcyz9xb.js
│   └── index-NXxBVrod.css
├── static/              # Static resource directory
│   ├── charsets/        # Character set files
│   │   ├── deepseek.txt
│   │   ├── gb2312.txt
│   │   ├── latin1.txt
│   │   └── qwen18409.txt
│   ├── fonts/           # Font resources
│   │   ├── font_noto_qwen_14_1.bin
│   │   ├── font_noto_qwen_16_4.bin
│   │   ├── font_noto_qwen_20_4.bin
│   │   ├── font_noto_qwen_30_4.bin
│   │   ├── font_puhui_deepseek_14_1.bin
│   │   ├── font_puhui_deepseek_16_4.bin
│   │   ├── font_puhui_deepseek_20_4.bin
│   │   ├── font_puhui_deepseek_30_4.bin
│   │   ├── noto_qwen.ttf
│   │   └── puhui_deepseek.ttf
│   ├── multinet_model/  # Custom wake word models
│   │   ├── fst/
│   │   ├── mn6_cn/
│   │   ├── mn6_en/
│   │   ├── mn7_cn/
│   │   └── mn7_en/
│   ├── twemoji32/       # 32x32 emoji images
│   ├── twemoji64/       # 64x64 emoji images
│   ├── wakenet_model/   # Preset wake word models
│   └── README.md        # Static resources description
├── index.html           # Main page
└── README.md            # Documentation
```

## Main Features

### 1. Chip and Screen Configuration
- Supports multiple chip models: ESP32-S3, ESP32-C3, ESP32-P4, ESP32-C6
- Flexible screen resolution settings
- Supports RGB565 color format

### 2. Wake Word Configuration
- **Preset Wake Words**: Based on WakeNet models supported by different chips
- **Custom Wake Words**: Supports Chinese and English command words, configurable threshold and timeout

### 3. Font Configuration
- Preset fonts: Alibaba PuHuiTi, Noto Qwen, etc.
- Supports uploading custom TTF/WOFF font files
- Configurable font size and color bit depth (bpp)

### 4. Emoji Collection
- 21 basic emoji presets (32x32 and 64x64 sizes)
- Supports custom emoji uploads

### 5. Chat Background
- Light/dark mode switching
- Configurable solid color or image background
- Automatically adapts to screen resolution

## Usage

1. Open `index.html` via web server
2. Select chip model and screen configuration
3. Configure theme elements across tabs
4. Click generate button to review asset manifest
5. Confirm and download `assets.bin` file

## Technical Notes

- Built static assets are located in `assets/` directory
- Original models and resources are in `static/` directory
- Supports offline usage without external dependencies

## Considerations

- Designed for offline usage with all resources included
- Generated `assets.bin` file is used with voice box hardware
- Respect file format and size limits when customizing resources
