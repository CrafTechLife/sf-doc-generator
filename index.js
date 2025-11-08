// 必要なパッケージを読み込む（require）
const ExcelJS = require("exceljs");
const jsforce = require("jsforce");
const yaml = require("js-yaml");
const fs = require("fs"); // ファイル操作
const path = require("path"); // パス操作
const inquirer = require("inquirer");
const autocomplete = require("inquirer-autocomplete-prompt");

// autocompleteプラグインを登録
inquirer.registerPrompt("autocomplete", autocomplete);

// 環境変数を.envファイルから読み込む
require("dotenv").config();

// オブジェクトラベルのキャッシュ（実行中にメモリ保持）
let objectLabelCache = {};

/**
 * Salesforceから全オブジェクトリストを取得
 * @param {Object} conn - Salesforce接続オブジェクト
 * @returns {Array} オブジェクト情報の配列
 */
async function getAllObjects(conn) {
  console.log("📋 利用可能なオブジェクト一覧を取得中...");

  const describeGlobal = await conn.describeGlobal();

  // 標準・カスタムオブジェクトを取得し、ラベル順にソート
  const objects = describeGlobal.sobjects
    .filter((obj) => {
      // 非表示オブジェクトや履歴・共有オブジェクトなどを除外
      return (
        !obj.name.endsWith("__History") &&
        !obj.name.endsWith("__Share") &&
        !obj.name.endsWith("__Feed") &&
        !obj.name.endsWith("__Tag") &&
        obj.queryable
      ); // クエリ可能なもののみ
    })
    .map((obj) => ({
      name: obj.name,
      label: obj.label,
      custom: obj.custom,
      displayName: `${obj.label} (${obj.name})`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "ja"));

  console.log(`✓ ${objects.length}件のオブジェクトが見つかりました\n`);

  return objects;
}

/**
 * 対話式でオブジェクトを選択
 * @param {Array} objects - オブジェクト情報の配列
 * @returns {Array} 選択されたオブジェクトAPI名の配列
 */
async function selectObjectsInteractively(objects) {
  console.log("📝 処理対象のオブジェクトを選択してください\n");

  // ステップ1: カスタム/標準/すべてのフィルタ選択
  const filterAnswer = await inquirer.prompt([
    {
      type: "list",
      name: "filter",
      message: "オブジェクトの種類でフィルタ:",
      choices: [
        { name: "すべてのオブジェクト", value: "all" },
        { name: "カスタムオブジェクトのみ", value: "custom" },
        { name: "標準オブジェクトのみ", value: "standard" },
      ],
      default: "all",
    },
  ]);

  // フィルタ適用
  let filteredObjects = objects;
  if (filterAnswer.filter === "custom") {
    filteredObjects = objects.filter((obj) => obj.custom);
  } else if (filterAnswer.filter === "standard") {
    filteredObjects = objects.filter((obj) => !obj.custom);
  }

  console.log(`\n✓ ${filteredObjects.length}件のオブジェクトが対象です\n`);

  // ステップ2: 検索可能なオブジェクト選択
  const selectedObjects = [];

  // 検索関数
  const searchObjects = (answers, input = "") => {
    return new Promise((resolve) => {
      const searchTerm = (input || "").toLowerCase();
      const filtered = filteredObjects.filter((obj) => {
        const displayName = obj.displayName.toLowerCase();
        const name = obj.name.toLowerCase();
        const label = obj.label.toLowerCase();
        return (
          displayName.includes(searchTerm) ||
          name.includes(searchTerm) ||
          label.includes(searchTerm)
        );
      });

      const choices = [
        new inquirer.Separator("=== 選択を完了する場合は以下を選択 ==="),
        { name: "✅ 選択完了（これまでの選択を確定）", value: "__DONE__" },
        new inquirer.Separator(
          `=== オブジェクト一覧 (${filtered.length}件) ===`
        ),
        ...filtered.map((obj) => ({
          name: `${obj.displayName}${selectedObjects.includes(obj.name) ? " ✓" : ""}`,
          value: obj.name,
        })),
      ];

      resolve(choices);
    });
  };

  // オブジェクトを1つずつ選択
  while (true) {
    console.log(`\n現在の選択: ${selectedObjects.length}個`);
    if (selectedObjects.length > 0) {
      console.log(`  ${selectedObjects.join(", ")}`);
    }

    const answer = await inquirer.prompt([
      {
        type: "autocomplete",
        name: "object",
        message: "オブジェクトを検索して選択（入力で絞り込み）:",
        source: searchObjects,
        pageSize: 15,
        emptyText: "該当するオブジェクトが見つかりません",
      },
    ]);

    if (answer.object === "__DONE__") {
      if (selectedObjects.length < 1) {
        console.log("\n⚠️  少なくとも1つのオブジェクトを選択してください");
        continue;
      }
      break;
    }

    // 選択をトグル（既に選択されていたら削除、そうでなければ追加）
    const index = selectedObjects.indexOf(answer.object);
    if (index > -1) {
      selectedObjects.splice(index, 1);
      console.log(`\n❌ ${answer.object} を選択から除外しました`);
    } else {
      selectedObjects.push(answer.object);
      console.log(`\n✅ ${answer.object} を選択しました`);
    }
  }

  return selectedObjects;
}

/**
 * 参照先オブジェクトのラベルを取得してキャッシュする
 * @param {Object} conn - Salesforce接続オブジェクト
 * @param {Array} fields - フィールド配列
 */
async function cacheReferenceObjectLabels(conn, fields) {
  // 参照項目から参照先オブジェクトのユニークリストを作成
  const referenceObjects = new Set();

  fields.forEach((field) => {
    if (
      field.type === "reference" &&
      field.referenceTo &&
      field.referenceTo.length > 0
    ) {
      field.referenceTo.forEach((objName) => {
        referenceObjects.add(objName);
      });
    }
  });

  if (referenceObjects.size === 0) {
    return;
  }

  console.log(
    `📝 参照先オブジェクト ${referenceObjects.size}件のラベルを取得中...`
  );

  // 各オブジェクトをDescribeしてラベルを取得
  for (const objName of referenceObjects) {
    try {
      const objDescribe = await conn.sobject(objName).describe();
      objectLabelCache[objName] = objDescribe.label;
    } catch (error) {
      // エラーが発生した場合はAPI名をそのまま使用
      console.warn(`⚠️  ${objName} のDescribeに失敗: ${error.message}`);
      objectLabelCache[objName] = objName;
    }
  }

  console.log(`✓ 参照先オブジェクトラベル取得完了\n`);
}

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
      const refLabel = objectLabelCache[refObject] || refObject;
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

/**
 * 単一オブジェクトのExcelファイルを生成
 * @param {Object} conn - Salesforce接続オブジェクト
 * @param {string} objectApiName - オブジェクトAPI名
 * @param {Object} config - 設定オブジェクト
 */
async function generateExcelForObject(conn, objectApiName, config) {
  console.log(`\n📥 ${objectApiName} のメタデータ取得中...`);

  // Describe APIを使用して全項目（標準項目含む）を取得
  const describeResult = await conn.sobject(objectApiName).describe();

  console.log(`✓ 項目数: ${describeResult.fields.length}件`);

  // 参照先オブジェクトのラベルをキャッシュ
  await cacheReferenceObjectLabels(conn, describeResult.fields);

  console.log(`📊 ${objectApiName} のExcel生成中...`);

  // Workbook作成
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SF Doc Generator";
  workbook.created = new Date();

  // --- オブジェクト定義シート作成 ---
  const objDefSheet = workbook.addWorksheet("オブジェクト定義");
  createObjectDefinitionSheet(objDefSheet, describeResult);

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
  describeResult.fields.forEach((field, index) => {
    const row = config.columns.map((col) => {
      // 行番号の処理
      if (col.source === "rowNumber") {
        return index + 1;
      }

      // ラベルの処理（labelがない場合はnameを使用）
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
            return field.picklistValues
              .map((v) => {
                const label = v.label || v.value;
                const value = v.value;

                // 表示形式に応じて出力を切り替え
                switch (config.picklistFormat) {
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
        }
        return "";
      }

      // 桁数の処理
      if (col.source === "length") {
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
        col.source === "trackHistory"
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

  // ===== ファイル保存 =====
  const outputDir = path.join(__dirname, "output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  const outputPath = path.join(
    outputDir,
    `${objectApiName}_定義書_${getDateString()}.xlsx`
  );

  await workbook.xlsx.writeFile(outputPath);

  console.log(`✓ ${objectApiName} のExcel生成完了`);
  console.log(`📁 出力先: ${outputPath}`);

  return outputPath;
}

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

    // ===== 3. 対象オブジェクトの決定 =====
    let targetObjects = [];

    if (
      config.target.objectApiNames &&
      config.target.objectApiNames.length > 0
    ) {
      // config.yamlで指定されている場合
      targetObjects = config.target.objectApiNames;
      console.log(
        `✓ 対象オブジェクト（config.yamlから）: ${targetObjects.join(", ")}\n`
      );
    } else {
      // 対話式で選択
      const allObjects = await getAllObjects(conn);
      targetObjects = await selectObjectsInteractively(allObjects);
      console.log(
        `\n✓ ${targetObjects.length}個のオブジェクトを選択しました\n`
      );
    }

    // ===== 4. 各オブジェクトのExcel生成 =====
    const outputPaths = [];

    for (const objectApiName of targetObjects) {
      // オブジェクトラベルキャッシュをリセット（オブジェクトごとに）
      objectLabelCache = {};

      const outputPath = await generateExcelForObject(
        conn,
        objectApiName,
        config
      );
      outputPaths.push(outputPath);
    }

    // ===== 5. 完了メッセージ =====
    console.log("\n✨ すべての処理が完了しました！");
    console.log(`\n📊 生成されたファイル: ${outputPaths.length}件`);
    outputPaths.forEach((p) => console.log(`   - ${p}`));
  } catch (error) {
    console.error("❌ エラーが発生しました:", error.message);
    console.error(error);
    process.exit(1);
  }
}

/**
 * オブジェクト定義シート作成
 * @param {ExcelJS.Worksheet} sheet - ワークシート
 * @param {Object} describeResult - Describe APIのレスポンス
 */
function createObjectDefinitionSheet(sheet, describeResult) {
  // 列幅設定
  sheet.getColumn(1).width = 30; // 項目名
  sheet.getColumn(2).width = 50; // 値

  // データ定義（表示順）
  const objectInfo = [
    { label: "オブジェクトAPI名", value: describeResult.name || "" },
    { label: "オブジェクトラベル", value: describeResult.label || "" },
    { label: "複数形ラベル", value: describeResult.labelPlural || "" },
    {
      label: "作成可能",
      value: describeResult.createable ? "○" : "-",
    },
    {
      label: "更新可能",
      value: describeResult.updateable ? "○" : "-",
    },
    {
      label: "削除可能",
      value: describeResult.deletable ? "○" : "-",
    },
    {
      label: "検索可能",
      value: describeResult.searchable ? "○" : "-",
    },
    {
      label: "取得可能",
      value: describeResult.queryable ? "○" : "-",
    },
    {
      label: "カスタムオブジェクト",
      value: describeResult.custom ? "○" : "-",
    },
    {
      label: "フィード有効化",
      value: describeResult.feedEnabled ? "○" : "-",
    },
    {
      label: "項目数",
      value: describeResult.fields ? describeResult.fields.length : 0,
    },
    {
      label: "レコードタイプ数",
      value: describeResult.recordTypeInfos
        ? describeResult.recordTypeInfos.length
        : 0,
    },
  ];

  // ヘッダー行追加
  const headers = ["項目名", "値"];
  const headerRow = sheet.addRow(headers);

  // ヘッダーのスタイル（ヘッダ文字列がある箇所のみ塗りつぶし）
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

  // ヘッダー行にボーダー追加
  for (let j = 1; j <= headers.length; j++) {
    headerRow.getCell(j).border = {
      top: { style: "thin", color: { argb: "FFD9D9D9" } },
      bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
      left: { style: "thin", color: { argb: "FFD9D9D9" } },
      right: { style: "thin", color: { argb: "FFD9D9D9" } },
    };
  }

  // 全データ行にボーダー追加
  for (let i = 2; i <= sheet.rowCount; i++) {
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
