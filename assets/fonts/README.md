# 本地品牌水印字体

Noto Sans CJK SC Light，SIL Open Font License 1.1，授权文件见 OFL.txt。源文件：
https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Light.otf

本项目保留字体名称与版权信息，裁剪为基本汉字、ASCII、中文标点及全角字符，保存为 WOFF2。处理时使用 fontkit 将字形转为 SVG 路径，再由 sharp / 官方 WASM 渲染；Windows 不需要安装中文字体。字体不通过网页加载，仅用于本地图片构建。罕见字符不在子集中时会明确报错，不会静默生成方框字。

字体的下载、裁剪已在开发阶段完成；用户无需安装 Python、fontTools 或重新下载字体。没有付费 API 或字体订阅。

文件 SHA-256：b6b0eea57fb2ae6165feaee46d2b247a2178df8e3b0d7f13d31dc4428ec84fc1


## V3 当前字体：Medium

商品图改用 Noto Sans CJK SC Medium（中等字重），沿用相同 OFL 1.1 授权与字符裁剪范围。旧 Light 字体保留用于历史风格对照测试。字体仅本地构建时解析，不会增加浏览器的字体下载。

官方源文件：
https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Medium.otf

Medium WOFF2 SHA-256：e80ff529568ec8782607611c01c06eb5c956dc1ee27bb5809ad12b12e0781090


## V4 宋体品牌标识

新增 Noto Serif CJK SC Regular，SIL OFL 1.1（同目录 OFL.txt），来自系统安装的官方 Noto Serif CJK 字体集合；上游：https://github.com/notofonts/noto-cjk/tree/main/Serif 。保留字体名称和版权信息，裁剪 ASCII、Latin-1（含副标题中间点）、基本汉字、中文标点和全角字符后保存为 WOFF2。仅本地构建使用，不随网页请求字体；免费开源，无需用户安装 Python 或系统中文字体。

SHA-256：fdd406fcc79dfe81231281e26605eeb6f28e2380660e5b92fae73af14c0480ab
