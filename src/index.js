const { loadConfig, loadEnv } = require("./core/config/config-loader");
const { connect, getAllObjects } = require("./core/salesforce/connection");
const { selectObjectsInteractively } = require("./core/ui/object-selector");
const { generateForObjects } = require("./generators/object-field");

/**
 * メイン処理
 */
async function main() {
  try {
    console.log("📋 Salesforce設計書生成開始...\n");

    // 1. 設定ファイル読み込み
    console.log("⚙️  設定ファイル読み込み中...");
    const config = loadConfig("object-field");

    // 2. 環境変数読み込み
    const credentials = loadEnv();

    // 3. Salesforce接続
    const conn = await connect(credentials);

    // 4. 対象オブジェクトの決定
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

    // 5. 各オブジェクトのExcel生成
    const outputPaths = await generateForObjects(conn, targetObjects, config);

    // 6. 完了メッセージ
    console.log("\n✨ すべての処理が完了しました！");
    console.log(`\n📊 生成されたファイル: ${outputPaths.length}件`);
    outputPaths.forEach((p) => console.log(`   - ${p}`));
  } catch (error) {
    console.error("❌ エラーが発生しました:", error.message);
    console.error(error);
    process.exit(1);
  }
}

// スクリプト実行
main();
