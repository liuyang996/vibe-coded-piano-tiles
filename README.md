# 🎹 别踩白块 · Piano Tiles

> 一个用 **vibe coding（AI 辅助编程）** 从零做出来的原生 HTML5 小游戏。
> 玩法一句话：点击黑色方块得分，别踩到白的，也别让方块溜走！

**[👉 在线试玩](https://YOUR_USERNAME.github.io/vibe-coded-piano-tiles/)**（发布后替换链接）

---

## 🎮 玩法

1. 黑色方块从顶部往下落
2. 点击 / 触摸黑色方块得分（每一列会发出不同音高，连起来是一段 C 大调琶音）
3. 点错白块、或漏掉黑块 → 游戏结束
4. 速度会随得分越来越快，挑战你的手速！

**操作方式**：鼠标点击 / 手机触控 / 键盘 `1-4` 或 `A S D F`

## ✨ 功能特性

- ✅ 速度随得分递增，越玩越刺激
- ✅ 最高分本地保存（localStorage），随时回来挑战
- ✅ 连击 Combo 提示
- ✅ 音效用 **Web Audio** 实时合成，零音频文件
- ✅ 点击碎裂粒子特效
- ✅ 手机 / 电脑全端适配

## 🛠 技术栈

| 项 | 说明 |
|----|------|
| 语言 | 原生 HTML / CSS / JavaScript |
| 渲染 | Canvas 2D |
| 音频 | Web Audio API（实时合成）|
| 依赖 | **零依赖、零构建** |
| 部署 | GitHub Pages（静态托管）|

## 🚀 本地运行

项目是纯静态文件，无需安装任何东西：

```bash
# 方式一：直接用浏览器打开
open index.html        # macOS
start index.html       # Windows

# 方式二：起个本地静态服务（可选）
npx serve .
```


## 📁 项目结构

```
vibe-coded-piano-tiles/
├── index.html    # 页面结构
├── style.css     # 全部样式
├── game.js       # 游戏逻辑（Canvas + Web Audio）
├── README.md     # 本文件
└── LICENSE       # MIT
```

## 📄 License

[MIT](LICENSE)
