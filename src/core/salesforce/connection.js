const jsforce = require("jsforce");

/**
 * Salesforceに接続する
 * @param {Object} credentials - 認証情報 { username, password, securityToken, loginUrl }
 * @returns {Promise<Object>} jsforce接続オブジェクト
 */
async function connect(credentials) {
  console.log("🔌 Salesforce接続中...");

  const conn = new jsforce.Connection({
    loginUrl: credentials.loginUrl || "https://login.salesforce.com",
  });

  await conn.login(
    credentials.username,
    credentials.password + credentials.securityToken
  );

  console.log("✓ 接続成功\n");

  return conn;
}

/**
 * 全オブジェクトリストを取得
 * @param {Object} conn - Salesforce接続オブジェクト
 * @returns {Promise<Array>} オブジェクト情報の配列
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
 * オブジェクトの詳細情報を取得
 * @param {Object} conn - Salesforce接続オブジェクト
 * @param {string} objectApiName - オブジェクトAPI名
 * @returns {Promise<Object>} Describe結果
 */
async function describeObject(conn, objectApiName) {
  console.log(`📥 ${objectApiName} のメタデータ取得中...`);
  const describeResult = await conn.sobject(objectApiName).describe();
  console.log(`✓ 項目数: ${describeResult.fields.length}件`);
  return describeResult;
}

module.exports = {
  connect,
  getAllObjects,
  describeObject,
};
