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

## 商品相册与款式独立配图

保持原有 `id`、`variants`（款式名称列表）和价格字段不变。在 `src/data.js` 的商品对象中增加以下可选字段。下面仅为路径配置示例，文件并不存在，不要直接用于线上：

```js
image: null, // 旧字段仍兼容；没有 images 时使用它
images: [
  'public/images/p01/common-01.webp', // 第一张用于首页封面
  'public/images/p01/detail-01.jpg'
],
variants: ['赭红', '松绿', '暖金'],
variantImages: {
  '赭红': ['public/images/p01/red-01.webp', 'public/images/p01/red-02.jpg'],
  '松绿': ['public/images/p01/green-01.webp'],
  '暖金': []
}
```

1. 将自己拍摄或获得授权的真实实物照片放入 `public/images/商品ID/`，使用英文、数字和短横线文件名；支持 JPG/JPEG、PNG、WebP。不使用 AI 生成图或旧 SVG 示意图代替实物。
2. `images` 只放可通用于各款式的整体或细节照片。特定颜色、图案照片放入对应的 `variantImages`，键名必须与 `variants` 完全一致。数组顺序就是展示顺序。
3. 详情默认选择第一个款式，展示“该款式照片＋公共照片”（去重）。选择其他款式时回到它的第一张照片；不会改变数量。可点击缩略图、左右滑动大图或聚焦大图后使用左右方向键。
4. 款式无独立照片时只显示公共照片，标注“通用展示图”；两者都没有时显示占位。坏图同样显示占位，不借用其他款式照片。清单和 PNG 使用所选款式的第一张照片，没有时才使用公共照片。
5. 保留旧 `image`、旧款式字符串和 `shan-cart` 浏览器清单格式。请勿随意更改已有商品 ID 或款式名称，否则原有清单项会被当作失效数据移除。
6. 建议照片长边 1000–1400 像素、每张尽量小于 500KB，保证实物颜色和细节清晰。主图完整显示，避免裁切关键细节；PNG 缩略图保持原比例。微信内无法保存 PNG 时仍可复制文字或截图。
7. 执行 `npm test` 和 `npm run build` 后检查详情、清单及导出。当前演示商品没有上传真实照片，第一件演示商品配置了空相册和空款式照片，用于验证占位和兼容；其他商品保留旧格式。

离线说明：构建和下载的 HTML 内嵌代码，不内嵌商品照片。有实物照片后，需要把 `public/images/` 与 HTML 一起保留（相对路径不变），或通过完整 HTTP 网站访问；单独一个 HTML 文件不能携带这些照片。本次没有引入上传后台。

### 自动化验证

- `npm test`：清单、图片选择、缺图隔离、旧数据兼容、图片加载失败/超时、PNG 等比例绘图，以及根路径/子目录服务与单文件脚本语法检查。
- `npm run build`：更新 `dist/index.html`，包含新增相册模块。
- 可选浏览器回归：在已安装 Playwright 的环境执行 `node scripts/check-browser.mjs`。若它安装在项目外，可用 `PLAYWRIGHT_MODULE=/绝对路径/playwright/index.mjs node scripts/check-browser.mjs`；默认使用 `/usr/bin/chromium`，也可通过 `CHROMIUM_PATH` 指定浏览器。该检查在手机尺寸 Chromium 中使用临时网络测试数据验证相册、滑动、款式图、旧清单、金额及 PNG 下载，不会把测试图片写入商品目录。Playwright 不是网站运行依赖。

自动化浏览器验证不能替代 iOS / Android 微信真机验收。

## 首件真实商品：羊毛毡立体蘑菇手提包

商品 ID 为 `felt-mushroom-bag`，在“羊毛毡生活好物”分类，90 元/个。三款原图直接来自用户上传的 `001.zip`，没有裁切、调色或重新压缩：

| 上传文件 | 款式 | 项目文件 |
| --- | --- | --- |
| 01.jpg | 浅灰色 | public/images/felt-mushroom-bag/light-gray.jpg |
| 02.jpg | 浅薄荷绿 | public/images/felt-mushroom-bag/light-mint.jpg |
| 03.jpg | 亮蓝色 | public/images/felt-mushroom-bag/bright-blue.jpg |

该商品没有通用展示照片，`images` 为空，每款只展示自己的照片。可选 `coverImage` 只用于首页封面，不作为其他款式的备用照片；因此首页可以显示浅灰实物图，但浅薄荷绿、亮蓝色不会混入浅灰照片。`demo:false` 标记真实商品，`unit:'个'` 用于清单单位。原有六件演示商品保留。
