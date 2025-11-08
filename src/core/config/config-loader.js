const yaml = require("js-yaml");
const fs = require("fs");
const path = require("path");

/**
 * 設定ファイルを読み込む
 * @param {string} configName - 設定ファイル名（例: 'object-field'）
 * @returns {Object} 設定オブジェクト
 */
function loadConfig(configName = "object-field") {
  const configPath = path.join(
    __dirname,
    "../../../config",
    `${configName}.yaml`
  );

  if (!fs.existsSync(configPath)) {
    throw new Error(`設定ファイルが見つかりません: ${configPath}`);
  }

  const configFile = fs.readFileSync(configPath, "utf8");
  return yaml.load(configFile);
}

/**
 * 環境変数を読み込む
 */
function loadEnv() {
  require("dotenv").config();

  const required = ["SF_USERNAME", "SF_PASSWORD", "SF_SECURITY_TOKEN"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `必要な環境変数が設定されていません: ${missing.join(", ")}`
    );
  }

  return {
    username: process.env.SF_USERNAME,
    password: process.env.SF_PASSWORD,
    securityToken: process.env.SF_SECURITY_TOKEN,
    loginUrl: process.env.SF_LOGIN_URL || "https://login.salesforce.com",
  };
}

module.exports = {
  loadConfig,
  loadEnv,
};
