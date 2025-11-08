/**
 * オブジェクトラベルのキャッシュ管理
 */

let objectLabelCache = {};

/**
 * オブジェクトラベルをキャッシュに設定
 * @param {string} objectName - オブジェクトAPI名
 * @param {string} label - オブジェクトラベル
 */
function setObjectLabel(objectName, label) {
  objectLabelCache[objectName] = label;
}

/**
 * キャッシュからオブジェクトラベルを取得
 * @param {string} objectName - オブジェクトAPI名
 * @returns {string|null} オブジェクトラベル（存在しない場合はnull）
 */
function getObjectLabel(objectName) {
  return objectLabelCache[objectName] || null;
}

/**
 * キャッシュをクリア
 */
function clearCache() {
  objectLabelCache = {};
}

/**
 * すべてのキャッシュデータを取得
 * @returns {Object} キャッシュオブジェクト
 */
function getAllCache() {
  return { ...objectLabelCache };
}

module.exports = {
  setObjectLabel,
  getObjectLabel,
  clearCache,
  getAllCache,
};
