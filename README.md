# Salesforce設計書自動生成ツール

SalesforceオブジェクトのメタデータからExcel設計書を自動生成するNode.jsツールです。

## 機能

- Salesforceオブジェクトのメタデータを取得
- オブジェクト定義シートと項目定義シートを含むExcelファイルを生成
- カスタマイズ可能な列設定（YAML）
- 日本語対応の設計書テンプレート

## 必要要件

- Node.js v14以上
- Salesforceアカウント（ユーザー名、パスワード、セキュリティトークン）
- Python 3（SERENA MCP使用時）
- uv（Python パッケージマネージャー、SERENA MCP使用時）

## インストール

```bash
npm install
```

## 設定

### 1. 環境変数の設定

`.env.example` をコピーして `.env` ファイルを作成してください。

```bash
cp .env.example .env
```

`.env` ファイルに以下の情報を設定します：

```env
SF_USERNAME=your-salesforce-username
SF_PASSWORD=your-salesforce-password
SF_SECURITY_TOKEN=your-security-token
```

### 2. 対象オブジェクトの設定

`config.yaml` で対象オブジェクトと出力する列を設定します：

```yaml
target:
  objectApiName: Account  # 対象オブジェクトのAPI名

columns:
  - header: "項目API名"
    source: "fullName"
    width: 25
  - header: "項目ラベル"
    source: "label"
    width: 20
  # 必要に応じて列を追加・編集
```

## 使い方

```bash
npm start
```

実行すると、`output/` フォルダに以下の形式でExcelファイルが生成されます：

```
output/Account_定義書_20250108.xlsx
```

## 出力内容

生成されるExcelファイルには2つのシートが含まれます：

### 1. オブジェクト定義シート
- オブジェクトAPI名
- オブジェクトラベル
- 共有モデル
- 各種設定（履歴管理、検索有効化など）
- 項目数、リストビュー数などの統計情報

### 2. 項目定義シート
- 項目API名
- 項目ラベル
- データ型
- 必須フラグ
- 説明
- その他、`config.yaml` で設定した列

## SERENA MCP統合

このプロジェクトは[SERENA MCP](https://github.com/oraios/serena)と統合されており、Claude Codeを使った高度なコード分析と編集機能を利用できます。

### SERENA MCPとは

SERENA MCPは、セマンティックコード検索と編集機能を提供するMCPサーバーです。以下の機能を提供します：

- シンボルレベルのコード理解
- 多言語サポート（TypeScript、Python、Goなど）
- プロジェクト全体の高度な分析
- トークン効率の向上

### セットアップ

1. devcontainerを再ビルド（uvが自動的にインストールされます）
   ```bash
   # VS Codeのコマンドパレット (Cmd/Ctrl+Shift+P) から
   # "Dev Containers: Rebuild Container" を実行
   ```

2. Claude Codeが自動的に`.mcp.json`の設定を読み込みます

### 設定ファイル

[.mcp.json](.mcp.json) ファイルでSERENAの設定を管理しています。

## 開発

### ブランチ戦略

このプロジェクトではGitHub Flowを採用しています：

- `main` - 本番環境用（常にデプロイ可能な状態）
- `develop` - 開発統合ブランチ（開発はここから派生）
- `feature/*` - 機能開発ブランチ（例: `feature/add-validation-rules`）

### 開発フロー

1. `develop` ブランチから機能ブランチを作成
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. 開発・コミット
   ```bash
   git add .
   git commit -m "feat: 機能の説明"
   ```

3. プルリクエスト作成
   - `feature/*` → `develop` へのPRを作成
   - レビュー後にマージ

4. リリース時
   - `develop` → `main` へのPRを作成
   - マージ後にタグを作成

### ブランチ保護推奨設定（GitHub Settings）

#### `main` ブランチ
- Require a pull request before merging
- Require approvals (1人以上)
- Do not allow bypassing the above settings

#### `develop` ブランチ
- Require a pull request before merging（推奨）

## ライセンス

MIT

## 作成者

CrafTechLife
