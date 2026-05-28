# 黄金价格换算器

一个简洁的静态网页工具，用于在「美元/盎司」和「人民币/克」之间换算黄金价格。

## 功能

- 支持「美元/盎司 → 人民币/克」
- 支持「人民币/克 → 美元/盎司」
- 自动获取 USD/CNY 汇率
- 自动汇率获取失败时，显示手动汇率输入
- 输入价格后实时换算
- 无需后端、无需登录、无需 API Key
- 适配桌面和手机屏幕

## 换算公式

```text
1 金衡盎司 = 31.1034768 克

人民币/克 = 美元/盎司 × USD/CNY 汇率 ÷ 31.1034768

美元/盎司 = 人民币/克 × 31.1034768 ÷ USD/CNY 汇率
```

## 文件结构

```text
.
├── index.html
├── styles.css
├── app.js
└── README.md
```

## 本地使用

直接用浏览器打开 `index.html` 即可。

如果浏览器限制本地文件的网络请求，可以启动一个本地静态服务：

```bash
python3 -m http.server 8000
```

然后访问：

```text
http://localhost:8000/index.html
```

## 发布到 GitHub Pages

1. 新建 GitHub 仓库，例如 `gold-converter`。
2. 将 `index.html`、`styles.css`、`app.js` 和 `README.md` 上传到仓库根目录。
3. 打开仓库的 `Settings`。
4. 进入 `Pages`。
5. 在 `Build and deployment` 中选择：
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
6. 保存后等待部署完成。

部署完成后，访问地址通常是：

```text
https://你的用户名.github.io/gold-converter/
```

## 汇率说明

页面会自动尝试获取 USD/CNY 汇率。若公共汇率接口不可用、网络受限或浏览器拦截请求，页面会显示手动汇率输入框。

自动汇率仅用于便捷换算，不构成交易、投资或报价依据。

## 技术栈

- HTML
- CSS
- JavaScript

## License

MIT
