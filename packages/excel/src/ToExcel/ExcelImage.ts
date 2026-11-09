var getImagePosition = function (num: number, arr: number[]) {
  let index = 0;
  let minIndex;
  let maxIndex;
  for (let i = 0; i < arr.length; i++) {
    if (num < arr[i]) {
      index = i;
      break;
    }
  }

  if (index == 0) {
    minIndex = 0;
    maxIndex = 1;
    return Math.abs((num - 0) / (arr[maxIndex] - arr[minIndex])) + index;
  } else if (index == arr.length - 1) {
    minIndex = arr.length - 2;
    maxIndex = arr.length - 1;
  } else {
    minIndex = index - 1;
    maxIndex = index;
  }
  let min = arr[minIndex];
  let max = arr[maxIndex];
  let radio = Math.abs((num - min) / (max - min)) + index;
  return radio;
};

var setImages = function (table: any, worksheet: any, workbook: any) {
  const localTable = { ...table };
  let { images, visibledatacolumn, visibledatarow } = localTable;
  if (typeof images != "object") return;
  for (let key in images) {
    const myBase64Image = images[key].src;

    const item = images[key];
    // Charts (chartSpec) are exported by the chart feature; SVG and remote
    // images cannot be embedded as pictures.
    const mime = /^data:image\/(png|jpe?g|gif);base64,/i.exec(
      String(myBase64Image || "")
    );
    if (item?.chartSpec || !mime) continue;
    const imageId = workbook.addImage({
      buffer: Uint8Array.from(atob(myBase64Image.slice(mime[0].length)), (ch) =>
        ch.charCodeAt(0)
      ),
      extension: mime[1].toLowerCase().replace("jpg", "jpeg") as any,
    });

    if (!visibledatacolumn || !visibledatarow) {
      const defaultColWidth = localTable.defaultColWidth || 73;
      const defaultRowHeight = localTable.defaultRowHeight || 19;

      const rowCount = Math.max(localTable.data?.length || 0, 200);
      const colCount = Math.max(localTable.data?.[0]?.length || 0, 60);

      visibledatacolumn = [];
      visibledatarow = [];

      let lastVal = 0;
      for (let i = 0; i < rowCount; i++) {
        const rowHeight = localTable.config?.rowlen?.[i] || defaultRowHeight;
        const rowPosition = lastVal + rowHeight;

        visibledatarow.push(rowPosition);
        lastVal = rowPosition;
      }

      lastVal = 0;
      for (let i = 0; i < colCount; i++) {
        const colWidth = localTable.config?.columnlen?.[i] || defaultColWidth;
        const colPosition = lastVal + colWidth;

        visibledatacolumn.push(colPosition);
        lastVal = colPosition;
      }
    }

    const col_st = getImagePosition(item.left, visibledatacolumn);
    const row_st = getImagePosition(item.top, visibledatarow);

    // Preserve the image origin and aspect ratio; its far edge may land in a different cell.
    worksheet.addImage(imageId, {
      tl: { col: col_st, row: row_st },
      ext: { width: item.width, height: item.height },
    });
    // Preserve all four cell anchors, allowing the image aspect ratio to change.
    // const w_ed = item.default.left+item.default.width;
    // const h_ed = item.default.top+item.default.height;
    // const col_ed = getImagePosition(w_ed,visibledatacolumn);
    // const row_ed = getImagePosition(h_ed,visibledatarow);
    // worksheet.addImage(imageId, {
    //   tl: { col: col_st, row: row_st},
    //   br: { col: col_ed, row: row_ed},
    // });
  }
};

export { setImages };
