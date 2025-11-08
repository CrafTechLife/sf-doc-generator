/**
 * 選択リスト値をフォーマット
 * @param {Array} picklistValues - 選択リスト値の配列
 * @param {string} format - フォーマット形式 ('both' | 'label' | 'fullName')
 * @returns {string} フォーマットされた選択リスト値
 */
function formatPicklistValues(picklistValues, format = "both") {
  if (!picklistValues || picklistValues.length === 0) {
    return "";
  }

  return picklistValues
    .map((v) => {
      const label = v.label || v.value;
      const value = v.value;

      // 表示形式に応じて出力を切り替え
      switch (format) {
        case "label":
          return label;
        case "fullName":
          return value;
        case "both":
        default:
          // labelとvalueが同じ場合は重複表示を避ける
          return label === value ? label : `${label}（${value}）`;
      }
    })
    .join(";");
}

module.exports = {
  formatPicklistValues,
};
