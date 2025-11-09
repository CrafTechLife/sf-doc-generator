const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");
const { getJapaneseFieldType } = require("../../formatters/field-type-formatter");
const { formatPicklistValues } = require("../../formatters/picklist-formatter");
const { getDateString } = require("../../core/utils/date-utils");

/**
 * Excelワークブック生成クラス
 */
class ExcelBuilder {
  constructor(config, objectApiName, describeResult, fieldMetadataMap) {
    this.config = config;
    this.objectApiName = objectApiName;
    this.describeResult = describeResult;
    this.fieldMetadataMap = fieldMetadataMap;
  }

  /**
   * Excelファイルを生成
   * @returns {Promise<string>} 出力ファイルパス
   */
  async build() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SF Doc Generator";
    workbook.created = new Date();

    // オブジェクト定義シート作成
    const objDefSheet = workbook.addWorksheet("オブジェクト定義");
    this.createObjectDefinitionSheet(objDefSheet);

    // 項目定義シート作成
    const fieldSheet = workbook.addWorksheet("項目定義");
    this.createFieldDefinitionSheet(fieldSheet);

    // ファイル保存
    return await this.saveWorkbook(workbook);
  }

  /**
   * オブジェクト定義シート作成
   * @param {ExcelJS.Worksheet} sheet - ワークシート
   */
  createObjectDefinitionSheet(sheet) {
    // 列幅設定
    sheet.getColumn(1).width = 30; // 項目名
    sheet.getColumn(2).width = 50; // 値

    // データ定義（表示順）
    const objectInfo = [
      { label: "オブジェクトAPI名", value: this.describeResult.name || "" },
      { label: "オブジェクトラベル", value: this.describeResult.label || "" },
      { label: "複数形ラベル", value: this.describeResult.labelPlural || "" },
      {
        label: "作成可能",
        value: this.describeResult.createable ? "○" : "-",
      },
      {
        label: "更新可能",
        value: this.describeResult.updateable ? "○" : "-",
      },
      {
        label: "削除可能",
        value: this.describeResult.deletable ? "○" : "-",
      },
      {
        label: "検索可能",
        value: this.describeResult.searchable ? "○" : "-",
      },
      {
        label: "取得可能",
        value: this.describeResult.queryable ? "○" : "-",
      },
      {
        label: "カスタムオブジェクト",
        value: this.describeResult.custom ? "○" : "-",
      },
      {
        label: "フィード有効化",
        value: this.describeResult.feedEnabled ? "○" : "-",
      },
      {
        label: "項目数",
        value: this.describeResult.fields ? this.describeResult.fields.length : 0,
      },
      {
        label: "レコードタイプ数",
        value: this.describeResult.recordTypeInfos
          ? this.describeResult.recordTypeInfos.length
          : 0,
      },
    ];

    // ヘッダー行追加
    const headers = ["項目名", "値"];
    const headerRow = sheet.addRow(headers);

    // ヘッダーのスタイル
    headers.forEach((_, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.font = {
        bold: true,
        color: { argb: "FFFFFFFF" },
        size: 11,
        name: "Meiryo UI",
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF70AD47" }, // 緑背景
      };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
      };
    });
    headerRow.height = 20;

    // データ行追加
    objectInfo.forEach((info) => {
      const row = sheet.addRow([info.label, info.value]);
      row.font = { name: "Meiryo UI", size: 10 };
      row.alignment = { vertical: "middle" };

      // 項目名列を太字に
      row.getCell(1).font = { name: "Meiryo UI", size: 10, bold: true };
      row.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE2EFDA" }, // 薄い緑
      };
    });

    // 全行にボーダー追加
    for (let i = 1; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      for (let j = 1; j <= headers.length; j++) {
        row.getCell(j).border = {
          top: { style: "thin", color: { argb: "FFD9D9D9" } },
          bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
          left: { style: "thin", color: { argb: "FFD9D9D9" } },
          right: { style: "thin", color: { argb: "FFD9D9D9" } },
        };
      }
    }

    // ヘッダー行を固定＆目盛り線を非表示
    sheet.views = [{ state: "frozen", ySplit: 1, showGridLines: false }];
  }

  /**
   * 項目定義シート作成
   * @param {ExcelJS.Worksheet} sheet - ワークシート
   */
  createFieldDefinitionSheet(sheet) {
    // ヘッダー行作成
    const headers = this.config.columns.map((col) => col.header);
    const headerRow = sheet.addRow(headers);

    // ヘッダーのスタイル
    this.config.columns.forEach((_, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.font = {
        bold: true,
        color: { argb: "FFFFFFFF" },
        size: this.config.font?.headerSize || 11,
        name: this.config.font?.name || "Meiryo UI",
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" }, // 青背景
      };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
      };
    });
    headerRow.height = 20;

    // 列幅設定
    this.config.columns.forEach((col, idx) => {
      sheet.getColumn(idx + 1).width = col.width;
    });

    // データ行追加
    this.describeResult.fields.forEach((field, index) => {
      const row = this.buildFieldRow(field, index);
      const addedRow = sheet.addRow(row);
      this.applyFieldRowStyle(addedRow);
    });

    // 全データ行にボーダー追加
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      for (let j = 1; j <= this.config.columns.length; j++) {
        row.getCell(j).border = {
          top: { style: "thin", color: { argb: "FFD9D9D9" } },
          bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
          left: { style: "thin", color: { argb: "FFD9D9D9" } },
          right: { style: "thin", color: { argb: "FFD9D9D9" } },
        };
      }
    }

    // ヘッダー行と先頭2列を固定＆目盛り線を非表示
    sheet.views = [
      { state: "frozen", ySplit: 1, xSplit: 2, showGridLines: false },
    ];

    // オートフィルター有効化
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: this.config.columns.length },
    };
  }

  /**
   * フィールドのデータ行を構築
   * @param {Object} field - フィールド情報
   * @param {number} index - インデックス
   * @returns {Array} 行データ
   */
  buildFieldRow(field, index) {
    return this.config.columns.map((col) => {
      // 行番号の処理
      if (col.source === "rowNumber") {
        return index + 1;
      }

      // ラベルの処理
      if (col.source === "label") {
        return field.label || field.name || "";
      }

      // API参照名の処理
      if (col.source === "fullName") {
        return field.name || "";
      }

      // データ型の処理
      if (col.source === "type") {
        return getJapaneseFieldType(field);
      }

      // 項目タイプの判定
      if (col.source === "fieldType") {
        return field.custom ? "カスタム" : "標準";
      }

      // 選択リスト値の処理
      if (col.source === "picklistValues") {
        if (field.type === "picklist" || field.type === "multipicklist") {
          if (field.picklistValues && field.picklistValues.length > 0) {
            return formatPicklistValues(
              field.picklistValues,
              this.config.picklistFormat
            );
          }
        }
        return "";
      }

      // 数式の処理
      if (col.source === "formula") {
        if (field.calculated && field.calculatedFormula) {
          return field.calculatedFormula;
        }
        return "";
      }

      // 説明の処理
      if (col.source === "description") {
        const metadata = this.fieldMetadataMap[field.name];
        if (metadata && metadata.description) {
          return metadata.description;
        }
        return field.description || "";
      }

      // ヘルプ内容の処理
      if (col.source === "inlineHelpText") {
        return field.inlineHelpText || "";
      }

      // 桁数の処理
      if (col.source === "length") {
        if (
          field.type === "id" ||
          field.type === "reference" ||
          field.type === "picklist" ||
          field.type === "multipicklist" ||
          field.type === "percent" ||
          field.type === "email" ||
          (field.calculated && field.type === "percent")
        ) {
          return "";
        }
        return field.length || field.precision || "";
      }

      let value = field[col.source];

      // 特定のboolean項目は trueの場合のみ○を表示、それ以外は空白
      if (
        col.source === "required" ||
        col.source === "externalId" ||
        col.source === "trackHistory"
      ) {
        // nillableがfalseの場合は必須
        if (col.source === "required") {
          return field.nillable === false ? "○" : "";
        }

        // 履歴管理の処理
        if (col.source === "trackHistory") {
          const metadata = this.fieldMetadataMap[field.name];
          if (metadata && metadata.trackHistory === true) {
            return "○";
          }
          return "";
        }

        if (value === true) {
          return "○";
        }
        return "";
      }

      // その他のboolean を ○/- に変換
      if (typeof value === "boolean") {
        return value ? "○" : "-";
      }

      // undefined/null は空文字に
      return value || "";
    });
  }

  /**
   * フィールド行のスタイルを適用
   * @param {ExcelJS.Row} row - 行オブジェクト
   */
  applyFieldRowStyle(row) {
    this.config.columns.forEach((col, idx) => {
      const cell = row.getCell(idx + 1);

      // フォント設定
      cell.font = {
        name: this.config.font?.name || "Meiryo UI",
        size: this.config.font?.size || 10,
      };

      // 選択リスト値、数式、説明、ヘルプ内容の列は折り返し表示
      if (
        col.source === "picklistValues" ||
        col.source === "formula" ||
        col.source === "description" ||
        col.source === "inlineHelpText"
      ) {
        cell.alignment = {
          wrapText: true,
          vertical: "top",
        };
      }

      // 必須、外部ID、履歴管理の列は中央揃え
      if (
        col.source === "required" ||
        col.source === "externalId" ||
        col.source === "trackHistory"
      ) {
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
        };
      }
    });
  }

  /**
   * ワークブックをファイルに保存
   * @param {ExcelJS.Workbook} workbook - ワークブック
   * @returns {Promise<string>} 出力ファイルパス
   */
  async saveWorkbook(workbook) {
    const outputDir = path.join(__dirname, "../../../output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(
      outputDir,
      `${this.objectApiName}_定義書_${getDateString()}.xlsx`
    );

    await workbook.xlsx.writeFile(outputPath);

    return outputPath;
  }
}

module.exports = ExcelBuilder;
