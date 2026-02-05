# ClipStruct

一个智能文本结构分析和格式化工具，帮助用户快速整理和结构化复制的文本内容。

## 功能特性

- 📋 **智能文本分析**：自动识别文本结构，提取标题、段落、列表等元素
- 🎨 **格式化输出**：将分析后的文本转换为整洁的结构化格式
- 💾 **历史记录**：保存用户的分析历史，方便后续查看和使用
- 🔧 **自定义设置**：允许用户根据需要调整分析和格式化选项
- 📁 **多格式支持**：支持多种文本格式的分析和处理

## 安装

### 从源码构建

1. 克隆仓库
   ```bash
   git clone https://github.com/heavennytl/ClipStruct.git
   cd ClipStruct
   ```

2. 安装依赖
   ```bash
   npm install
   ```

3. 构建项目
   ```bash
   npm run build
   ```

## 使用方法

### 作为浏览器扩展使用

1. 打开浏览器的扩展管理页面
2. 启用"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择项目的`dist`目录
5. 在浏览器中使用扩展图标启动ClipStruct

### 开发模式

1. 启动开发服务器
   ```bash
   npm run dev
   ```

2. 按照上述步骤加载扩展，使用`dist`目录

## 项目结构

```
ClipStruct/
├── src/                # 源代码目录
│   ├── background/     # 后台脚本
│   ├── common/         # 通用工具和常量
│   ├── content/        # 内容脚本
│   └── popup/          # 弹出窗口
├── dist/               # 构建输出目录
├── public/             # 静态资源
├── __tests__/          # 测试文件
├── package.json        # 项目配置
├── vite.config.js      # Vite配置
└── README.md           # 项目说明
```

## 技术栈

- **前端框架**：React
- **构建工具**：Vite
- **测试框架**：Jest
- **浏览器扩展**：Chrome Extension API

## 测试

运行测试套件：

```bash
npm test
```

## 贡献

欢迎提交 Issue 和 Pull Request 来帮助改进这个项目！

## 许可证

MIT License

## 联系方式

- 项目地址：https://github.com/heavennytl/ClipStruct
