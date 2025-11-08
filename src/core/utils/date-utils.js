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

module.exports = {
  getDateString,
};
