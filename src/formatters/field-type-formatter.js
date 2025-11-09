const cache = require("../core/utils/cache");

/**
 * データ型を日本語に変換
 * @param {Object} field - フィールド情報
 * @returns {string} 日本語のデータ型
 */
function getJapaneseFieldType(field) {
  const type = field.type;
  const calculated = field.calculated;
  const calculatedFormula = field.calculatedFormula;

  // 積み上げ集計（calculatedがtrueで、calculatedFormulaがnull）
  if (calculated && !calculatedFormula) {
    return "積み上げ集計";
  }

  // 数式項目（calculatedがtrueで、calculatedFormulaがある）
  if (calculated && calculatedFormula) {
    switch (type) {
      case "boolean":
        return "数式 (チェックボックス)";
      case "currency":
        return "数式 (通貨)";
      case "date":
        return "数式 (日付)";
      case "datetime":
        return "数式 (日付/時間)";
      case "double":
      case "int":
        return "数式 (数値)";
      case "percent":
        return "数式 (パーセント)";
      case "string":
      case "textarea":
        return "数式 (テキスト)";
      case "time":
        return "数式 (時間)";
      default:
        return "数式";
    }
  }

  // 参照関係
  if (type === "reference") {
    if (field.referenceTo && field.referenceTo.length > 0) {
      const refObject = field.referenceTo[0];
      // キャッシュからラベルを取得、なければAPI名を使用
      const refLabel = cache.getObjectLabel(refObject) || refObject;
      return `参照関係 (${refLabel})`;
    }
    return "参照関係";
  }

  // 数値型の詳細表示
  if (type === "double" || type === "int") {
    // soapTypeがxsd:intの場合は整数型として扱う
    if (field.soapType === "xsd:int") {
      return "数値 (0, 0)";
    }

    const precision = field.precision || 18;
    const scale = field.scale || 0;
    const integerDigits = precision - scale;
    return `数値 (${integerDigits}, ${scale})`;
  }

  // 地理位置情報
  if (type === "location") {
    return "地理位置情報";
  }

  // テキストエリアの種類を判別
  if (type === "textarea") {
    // リッチテキストエリア
    if (field.extraTypeInfo === "richtextarea") {
      return "リッチテキストエリア";
    }
    // ロングテキストエリア (通常は255文字超え、またはextraTypeInfoで判別)
    if (field.length > 255 && field.extraTypeInfo === "plaintextarea") {
      return "ロングテキストエリア";
    }
    // 通常のテキストエリア (255文字以下)
    return "テキストエリア";
  }

  // 基本的なデータ型のマッピング
  const typeMap = {
    string: "テキスト",
    encryptedstring: "テキスト(暗号化)",
    boolean: "チェックボックス",
    picklist: "選択リスト",
    multipicklist: "選択リスト (複数選択)",
    date: "日付",
    datetime: "日付/時間",
    time: "時間",
    currency: "通貨",
    percent: "パーセント",
    phone: "電話",
    email: "メール",
    url: "URL",
    id: "id",
    address: "住所",
  };

  return typeMap[type] || type;
}

module.exports = {
  getJapaneseFieldType,
};
