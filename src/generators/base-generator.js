/**
 * 設計書ジェネレーターの抽象基底クラス
 * 将来的に他の設計書タイプを追加する際に継承する
 */
class BaseGenerator {
  constructor(conn, config) {
    this.conn = conn;
    this.config = config;
  }

  /**
   * データ収集（サブクラスで実装必須）
   * @returns {Promise<any>} 収集した生データ
   */
  async collectData() {
    throw new Error("collectData() must be implemented by subclass");
  }

  /**
   * データ整形（サブクラスで実装必須）
   * @param {any} rawData - 生データ
   * @returns {Promise<any>} 整形されたデータ
   */
  async formatData(rawData) {
    throw new Error("formatData() must be implemented by subclass");
  }

  /**
   * エクスポート（サブクラスで実装必須）
   * @param {any} formattedData - 整形されたデータ
   * @returns {Promise<string>} 出力ファイルパス
   */
  async export(formattedData) {
    throw new Error("export() must be implemented by subclass");
  }

  /**
   * テンプレートメソッド：設計書生成の全体フロー
   * @returns {Promise<string>} 出力ファイルパス
   */
  async generate() {
    const rawData = await this.collectData();
    const formattedData = await this.formatData(rawData);
    return await this.export(formattedData);
  }
}

module.exports = BaseGenerator;
