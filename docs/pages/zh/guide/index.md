# 快速上手

TinySheet 是适用于 React 的类 Excel 电子表格组件（FortuneSheet 的分支）。[在线演示](https://lofcz.github.io/tinysheet/)

## 安装

```sh
npm install @lofcz/tinysheet-react
```

需要 React 19.3+。

## 使用

```tsx
import { Workbook } from "@lofcz/tinysheet-react";
import "@lofcz/tinysheet-react/dist/index.css";

export default function App() {
  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <Workbook data={[{ name: "Sheet1" }]} />
    </div>
  );
}
```

容器需要有尺寸，表格会填满它。

## Excel 文件

```sh
npm install @lofcz/tinysheet-excel
```

导入与导出 `.xlsx`，包括图表、表格、数据透视表、批注与图片。

## 下一步

- [整体配置](./config.md)：`Workbook` 属性
- [工作表](./sheet.md) 与 [单元格](./cell.md)：数据模型
- [操作](./op.md)：用于存储与协同的 `onOp` / `applyOp`
- [API](./api.md)：工作簿 ref 方法
