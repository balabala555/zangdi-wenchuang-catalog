# zangdi-wenchuang-catalog
藏地文创线上选物册｜面向微信私域顾客的文创商品展示、分类浏览、款式选择及图片选购清单系统。

## 第一版原型：山间来信

使用原生 JavaScript ES Modules、响应式 CSS 和 Node.js 静态服务，无第三方运行依赖。需要 Node.js 20 或以上。

```sh
cd /workspace/zangdi-wenchuang-catalog
npm run dev
```

服务监听 `0.0.0.0:3000`。本机打开 `http://localhost:3000`；云端通过工作区的端口转发功能打开 3000 端口。可用 `PORT=8080 npm run dev` 更换端口。手机可访问同一局域网的电脑 IP 加端口，或部署后的 HTTPS 地址。

```sh
npm test
```

首页支持分类和搜索；商品详情支持款式与数量选择；清单按商品与款式合并，保存在当前浏览器 localStorage，支持调整数量、移除、复制文字和导出 PNG 图片。清单不是订单，不接入支付、库存或后台。微信内下载与剪贴板受浏览器限制，提供文字选择、截图作为备用方式。清除浏览器数据会清空清单。

## 文件结构

- `index.html`：首页和弹窗入口
- `src/style.css`：手机优先适配的米灰 / 亚麻色样式
- `src/data.js`：演示商品、价格、分类、款式及图片路径
- `src/cart.js`：清单数据校验、合计与分享文本
- `src/app.js`：页面交互和图片清单导出
- `public/images/`：后续真实商品图片；旧示意 SVG 保留但页面不再引用
- `server.js`：开发静态服务；正式部署可使用静态托管
- `tests/cart.test.js`：清单和商品数据基础测试

## 上传真实商品图片

1. 将 JPG / PNG / WebP 图片放入 `public/images/`，建议英文文件名，例如 `mountain-bracelet.webp`。建议宽 1000–1400 像素、主体居中，单张尽量小于 500KB；首页按接近正方形裁切。
2. 在 `src/data.js` 中找到商品，将 `image` 改为 `public/images/mountain-bracelet.webp`，同步修改名称、材质、尺寸、价格与 `variants`。保持 `id` 稳定以保留现有清单关联。
3. 刷新页面检查商品卡片、详情和导出清单的图片。提交代码与图片后部署即可更新。这一版使用仓库文件管理图片，尚无后台上传入口，也没有每款独立图片。
4. 首页目前也是文字占位区域。获得真实封面后，在 `index.html` 的 `.hero-art` 中替换占位内容，使用 `./public/images/实际文件名.webp`。上线前核实商品信息、调整演示提示。

请使用自有或已获授权的商品图片。图片使用本站路径可避免跨域导致图片清单导出失败。正式上线前建议增加管理后台、真实库存、店主联系方式及隐私说明，并在 iOS / Android 微信内进行真机验证。


## 预览与资源加载排查

- 开发入口通过 `npm run dev` 启动，转发 **3000** 端口；使用转发后网站的 `/`，不要把源码 HTML 粘贴到会过滤样式和脚本的可视化编辑器。
- 兼容预览入口为该网站的 `/preview.html`。它内嵌全部 CSS 和 JavaScript，不需要额外请求样式、模块或演示图片。
- `npm run build` 生成 `dist/index.html` 单文件预览，可下载后在普通浏览器打开。部分托管浏览器禁止 `file://`：这是浏览器策略，可改用上述 HTTP 入口。此单文件包含当前空图片占位；未来添加真实图片后，应连同图片目录一起通过 HTTP 部署。
- 部署在子目录时保留末尾 `/`，例如 `/catalog/`。若代理保留前缀，运行 `BASE_PATH=/catalog npm run dev`；若代理去掉前缀则无需该变量。HTML 资源路径已改为相对路径。
- 当前所有商品的 `image` 为 `null`：卡片、详情、清单和导出图片均显示“图片待上传”，不请求不存在的图片。后续填入真实图片路径后，加载失败仍会回退占位。
- `npm test` 检查清单逻辑、资源状态码/MIME、子目录加载及单文件生成。浏览器另验证了 320、390、768、1440 像素布局及主要交互。尚未完成微信 iOS / Android 真机验证。

“可视化内部发生错误”属于预览宿主提示，不能单凭该提示判断网页代码有错。当前环境没有生成公网预览 URL 的接口；本地 HTTP 验证成功不等于公网或可视化工具预览成功。

## 下载到 Windows / Microsoft Edge

1. 刷新正在运行的网页预览，滚动到页面最底部，点击 **下载离线网页 ↓**。
2. 下载文件名为 `zangdi-catalog.html`；默认在 Windows 的“下载”文件夹，可按 Edge 的 `Ctrl+J` 查找。
3. 右键文件 → 打开方式 → Microsoft Edge，或者在 Edge 中按 `Ctrl+O` 选择该文件。
4. 文件已经内嵌 UTF-8 编码、CSS、商品数据及脚本，无需安装 Node.js，也不需要伴随的 CSS / JS 文件；当前商品图片为空占位，因此没有外部图片依赖。浏览器禁止本地存储时，当前会话可使用清单，但关闭后可能不保留。

服务的 `/download.html` 返回 `Content-Disposition: attachment; filename="zangdi-catalog.html"`，下载内容与 `dist/index.html` 相同。普通入口 `/` 和兼容入口 `/preview.html` 都提供下载链接，导出的文件不包含依赖服务器的下载链接。

如果嵌入预览禁止下载：将网页预览通过工作区已有的“在浏览器中打开”功能打开到独立标签页后，再点击页底下载；如果没有这个功能，可在能打开的 HTTP `/preview.html` 页面中用 Edge `Ctrl+S`，保存类型选“网页，仅 HTML”，文件名填 `zangdi-catalog.html`。不要将普通开发入口 `/` 只保存 HTML，否则会缺失外部资源。

聊天中的 `/workspace/...` 链接是工作区文件定位链接，不是附件下载地址。当前没有可上传聊天附件的工具。也可从工作区文件树（若提供下载菜单）获取 `dist/index.html`，或在本地完整项目中运行 `npm run build` 后获取同名文件。Windows Edge 真机不在当前环境中，下载与离线内容已通过 Chromium 自动化验证；本环境的托管浏览器禁止直接访问 `file://`，这不代表普通 Windows Edge 不能打开 HTML。
