// 必要なパッケージを読み込む（require）
const ExcelJS = require("exceljs");
const jsforce = require("jsforce");
const yaml = require("js-yaml");
const fs = require("fs"); // ファイル操作
const path = require("path"); // パス操作

// 環境変数を.envファイルから読み込む
require("dotenv").config();

/**
 * メイン処理
 * async/await を使って非同期処理を同期的に書く
 */
async function generateDoc() {
  try {
    console.log("📋 Salesforce設計書生成開始...\n");

    // ===== 1. 設定ファイル読み込み =====
    console.log("⚙️  設定ファイル読み込み中...");
    const configPath = path.join(__dirname, "config.yaml");
    const configFile = fs.readFileSync(configPath, "utf8");
    const config = yaml.load(configFile);
    console.log(`✓ 対象オブジェクト: ${config.target.objectApiName}\n`);

    // ===== 2. Salesforce接続 =====
    console.log("🔌 Salesforce接続中...");
    const conn = new jsforce.Connection({
      loginUrl: "https://login.salesforce.com", // Sandboxの場合は test.salesforce.com
    });

    await conn.login(
      process.env.SF_USERNAME,
      process.env.SF_PASSWORD + process.env.SF_SECURITY_TOKEN
    );
    console.log("✓ 接続成功\n");

    // ===== 3. メタデータ取得 =====
    console.log("📥 メタデータ取得中...");
    const metadata = await conn.metadata.read(
      "CustomObject",
      config.target.objectApiName
    );

    // デバッグ用: メタデータをJSONで保存
    fs.writeFileSync(
      "./debug-metadata.json",
      JSON.stringify(metadata, null, 2)
    );

    console.log(`✓ 項目数: ${metadata.fields.length}件\n`);

    // ===== 4. Excel生成 =====
    console.log("📊 Excel生成中...");

    // Workbook作成
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SF Doc Generator";
    workbook.created = new Date();

    // --- オブジェクト定義シート作成 ---
    const objDefSheet = workbook.addWorksheet("オブジェクト定義");
    createObjectDefinitionSheet(objDefSheet, metadata);

    // --- 項目定義シート作成 ---
    const sheet = workbook.addWorksheet("項目定義");

    // --- ヘッダー行作成 ---
    const headers = config.columns.map((col) => col.header);
    const headerRow = sheet.addRow(headers);

    // ヘッダーのスタイル（ヘッダ文字列がある箇所のみ塗りつぶし）
    config.columns.forEach((_, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.font = {
        bold: true,
        color: { argb: "FFFFFFFF" }, // 白文字
        size: config.font?.headerSize || 11,
        name: config.font?.name || "Meiryo UI",
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
    config.columns.forEach((col, idx) => {
      sheet.getColumn(idx + 1).width = col.width;
    });

    // --- データ行追加 ---
    metadata.fields.forEach((field, index) => {
      const row = config.columns.map((col) => {
        // 行番号の処理
        if (col.source === "rowNumber") {
          return index + 1;
        }

        // ラベルの処理（labelがない場合はfullNameを使用）
        if (col.source === "label") {
          return field.label || field.fullName || "";
        }

        // 項目タイプの判定
        if (col.source === "fieldType") {
          return field.fullName.endsWith("__c") ? "カスタム" : "標準";
        }

        // 選択リスト値の処理
        if (col.source === "picklistValues") {
          if (field.type === "Picklist" || field.type === "MultiselectPicklist") {
            if (field.valueSet && field.valueSet.valueSetDefinition) {
              const values = field.valueSet.valueSetDefinition.value;
              if (values && values.length > 0) {
                return values
                  .map((v) => {
                    const label = v.label || v.fullName;
                    const fullName = v.fullName;

                    // 表示形式に応じて出力を切り替え
                    switch (config.picklistFormat) {
                      case "label":
                        return label;
                      case "fullName":
                        return fullName;
                      case "both":
                      default:
                        return `${label}（${fullName}）`;
                    }
                  })
                  .join("\n");
              }
            }
          }
          return "";
        }

        let value = field[col.source];

        // 特定のboolean項目は trueの場合のみ○を表示、それ以外は空白
        if (
          col.source === "required" ||
          col.source === "externalId" ||
          col.source === "trackFeedHistory"
        ) {
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

      const addedRow = sheet.addRow(row);

      // 各セルのスタイル設定
      config.columns.forEach((col, idx) => {
        const cell = addedRow.getCell(idx + 1);

        // フォント設定
        cell.font = {
          name: config.font?.name || "Meiryo UI",
          size: config.font?.size || 10,
        };

        // 選択リスト値の列は折り返し表示
        if (col.source === "picklistValues") {
          cell.alignment = {
            wrapText: true,
            vertical: "top",
          };
        }

        // 必須、外部ID、履歴管理の列は中央揃え
        if (
          col.source === "required" ||
          col.source === "externalId" ||
          col.source === "trackFeedHistory"
        ) {
          cell.alignment = {
            horizontal: "center",
            vertical: "middle",
          };
        }
      });
    });

    // 全データ行にボーダー追加（縦線・横線両方）
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      for (let j = 1; j <= config.columns.length; j++) {
        row.getCell(j).border = {
          top: { style: "thin", color: { argb: "FFD9D9D9" } },
          bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
          left: { style: "thin", color: { argb: "FFD9D9D9" } },
          right: { style: "thin", color: { argb: "FFD9D9D9" } },
        };
      }
    }

    // ヘッダー行と先頭2列を固定（スクロール時も見える）＆目盛り線を非表示
    sheet.views = [
      { state: "frozen", ySplit: 1, xSplit: 2, showGridLines: false },
    ];

    // オートフィルター有効化
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: config.columns.length },
    };

    // ===== 5. ファイル保存 =====
    const outputDir = path.join(__dirname, "output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    const outputPath = path.join(
      outputDir,
      `${config.target.objectApiName}_定義書_${getDateString()}.xlsx`
    );

    await workbook.xlsx.writeFile(outputPath);

    console.log("✓ Excel生成完了\n");
    console.log(`📁 出力先: ${outputPath}`);
    console.log("\n✨ 処理完了！");
  } catch (error) {
    console.error("❌ エラーが発生しました:", error.message);
    console.error(error);
    process.exit(1);
  }
}

/**
 * オブジェクト定義シート作成
 * @param {ExcelJS.Worksheet} sheet - ワークシート
 * @param {Object} metadata - オブジェクトメタデータ
 */
function createObjectDefinitionSheet(sheet, metadata) {
  // 列幅設定
  sheet.getColumn(1).width = 30; // 項目名
  sheet.getColumn(2).width = 50; // 値

  // データ定義（表示順）
  const objectInfo = [
    { label: "オブジェクトAPI名", value: metadata.fullName || "" },
    { label: "オブジェクトラベル", value: metadata.label || "" },
    { label: "複数形ラベル", value: metadata.pluralLabel || "" },
    { label: "共有モデル", value: metadata.sharingModel || "" },
    {
      label: "外部共有モデル",
      value: metadata.externalSharingModel || "",
    },
    {
      label: "フィード有効化",
      value: metadata.enableFeeds ? "○" : "-",
    },
    {
      label: "履歴管理",
      value: metadata.enableHistory ? "○" : "-",
    },
    {
      label: "検索強化",
      value: metadata.enableEnhancedLookup ? "○" : "-",
    },
    {
      label: "レポート有効化",
      value: metadata.enableReports ? "○" : "-",
    },
    {
      label: "活動有効化",
      value: metadata.enableActivities ? "○" : "-",
    },
    {
      label: "一括API有効化",
      value: metadata.enableBulkApi ? "○" : "-",
    },
    {
      label: "ストリーミングAPI有効化",
      value: metadata.enableStreamingApi ? "○" : "-",
    },
    {
      label: "検索有効化",
      value: metadata.enableSearch ? "○" : "-",
    },
    { label: "項目数", value: metadata.fields ? metadata.fields.length : 0 },
    {
      label: "リストビュー数",
      value: metadata.listViews ? metadata.listViews.length : 0,
    },
    {
      label: "レコードタイプ数",
      value: metadata.recordTypes ? metadata.recordTypes.length : 0,
    },
    {
      label: "入力規則数",
      value: metadata.validationRules ? metadata.validationRules.length : 0,
    },
  ];

  // ヘッダー行追加
  const headerRow = sheet.addRow(["項目名", "値"]);
  headerRow.font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
    size: 11,
    name: "Meiryo UI",
  };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF70AD47" }, // 緑背景
  };
  headerRow.alignment = {
    horizontal: "center",
    vertical: "middle",
  };
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

    // ボーダー追加
    row.border = {
      top: { style: "thin", color: { argb: "FFD9D9D9" } },
      bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
      left: { style: "thin", color: { argb: "FFD9D9D9" } },
      right: { style: "thin", color: { argb: "FFD9D9D9" } },
    };
  });

  // ヘッダー行を固定＆目盛り線を非表示
  sheet.views = [{ state: "frozen", ySplit: 1, showGridLines: false }];
}

/**
 * 日付文字列取得（ファイル名用）
 * @returns {string} YYYYMMDD形式
 */
function getDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

// スクリプト実行
generateDoc();
