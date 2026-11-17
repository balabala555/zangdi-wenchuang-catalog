# 本地品牌水印字体

Noto Sans CJK SC Light，SIL Open Font License 1.1，授权文件见 OFL.txt。源文件：
https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Light.otf

本项目保留字体名称与版权信息，裁剪为基本汉字、ASCII、中文标点及全角字符，保存为 WOFF2。处理时使用 fontkit 将字形转为 SVG 路径，再由 sharp / 官方 WASM 渲染；Windows 不需要安装中文字体。字体不通过网页加载，仅用于本地图片构建。罕见字符不在子集中时会明确报错，不会静默生成方框字。

字体的下载、裁剪已在开发阶段完成；用户无需安装 Python、fontTools 或重新下载字体。没有付费 API 或字体订阅。

文件 SHA-256：b6b0eea57fb2ae6165feaee46d2b247a2178df8e3b0d7f13d31dc4428ec84fc1
