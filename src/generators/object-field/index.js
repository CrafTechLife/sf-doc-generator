const BaseGenerator = require("../base-generator");
const connection = require("../../core/salesforce/connection");
const metadataService = require("../../core/salesforce/metadata-service");
const cache = require("../../core/utils/cache");
const ExcelBuilder = require("./excel-builder");

/**
 * オブジェクト・項目設計書ジェネレーター
 */
class ObjectFieldGenerator extends BaseGenerator {
  constructor(conn, config, objectApiName) {
    super(conn, config);
    this.objectApiName = objectApiName;
  }

  /**
   * データ収集
   * @returns {Promise<Object>} 収集した生データ
   */
  async collectData() {
    console.log(`\n📥 ${this.objectApiName} のメタデータ取得中...`);

    // オブジェクトのDescribe取得
    const describeResult = await connection.describeObject(
      this.conn,
      this.objectApiName
    );

    // 項目のメタデータ（履歴管理・説明）を取得
    const fieldMetadataMap = await metadataService.getFieldMetadata(
      this.conn,
      this.objectApiName,
      describeResult.fields
    );

    // 参照先オブジェクトのラベルをキャッシュ
    await metadataService.cacheReferenceObjectLabels(
      this.conn,
      describeResult.fields
    );

    return {
      describeResult,
      fieldMetadataMap,
    };
  }

  /**
   * データ整形
   * @param {Object} rawData - 生データ
   * @returns {Promise<Object>} 整形されたデータ
   */
  async formatData(rawData) {
    // このジェネレーターでは整形処理はExcelBuilderで行うため、
    // ここでは生データをそのまま返す
    return rawData;
  }

  /**
   * エクスポート
   * @param {Object} formattedData - 整形されたデータ
   * @returns {Promise<string>} 出力ファイルパス
   */
  async export(formattedData) {
    console.log(`📊 ${this.objectApiName} のExcel生成中...`);

    const excelBuilder = new ExcelBuilder(
      this.config,
      this.objectApiName,
      formattedData.describeResult,
      formattedData.fieldMetadataMap
    );

    const outputPath = await excelBuilder.build();

    console.log(`✓ ${this.objectApiName} のExcel生成完了`);
    console.log(`📁 出力先: ${outputPath}`);

    return outputPath;
  }
}

/**
 * 複数オブジェクトの設計書を生成
 * @param {Object} conn - Salesforce接続オブジェクト
 * @param {Array} objectApiNames - オブジェクトAPI名の配列
 * @param {Object} config - 設定オブジェクト
 * @returns {Promise<Array>} 出力ファイルパスの配列
 */
async function generateForObjects(conn, objectApiNames, config) {
  const outputPaths = [];

  for (const objectApiName of objectApiNames) {
    // オブジェクトごとにキャッシュをクリア
    cache.clearCache();

    const generator = new ObjectFieldGenerator(conn, config, objectApiName);
    const outputPath = await generator.generate();
    outputPaths.push(outputPath);
  }

  return outputPaths;
}

module.exports = {
  ObjectFieldGenerator,
  generateForObjects,
};
