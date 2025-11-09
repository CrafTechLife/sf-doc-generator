/**
 * 日付文字列取得（ファイル名用）
 * @returns {string} YYYYMMDD形式（日本時間）
 */
function getDateString() {
  // 日本時間（JST: UTC+9）で日付を取得
  const now = new Date();
  const jstDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));

  const year = jstDate.getFullYear();
  const month = String(jstDate.getMonth() + 1).padStart(2, "0");
  const day = String(jstDate.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

module.exports = {
  getDateString,
};
