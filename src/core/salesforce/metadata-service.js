const cache = require("../utils/cache");

/**
 * カスタム項目と標準項目のメタデータを取得（履歴管理と説明）
 * @param {Object} conn - Salesforce接続オブジェクト
 * @param {string} objectApiName - オブジェクトAPI名
 * @param {Array} fields - フィールド配列
 * @returns {Promise<Object>} フィールド名をキーとしたメタデータのマップ
 */
async function getFieldMetadata(conn, objectApiName, fields) {
  const metadataMap = {};

  console.log(`📝 項目のメタデータ（履歴管理・説明）を取得中...`);

  try {
    // 1. CustomObjectメタデータを取得（標準項目の履歴管理情報を含む可能性がある）
    let objectMetadata = null;
    try {
      objectMetadata = await conn.metadata.read("CustomObject", objectApiName);

      // 配列で返される場合があるので、最初の要素を取得
      if (Array.isArray(objectMetadata)) {
        objectMetadata = objectMetadata[0];
      }

      // CustomObjectメタデータから標準項目の履歴管理情報を取得
      if (objectMetadata && objectMetadata.fields) {
        const objectFields = Array.isArray(objectMetadata.fields)
          ? objectMetadata.fields
          : [objectMetadata.fields];

        objectFields.forEach((fieldMeta) => {
          if (fieldMeta && fieldMeta.fullName) {
            metadataMap[fieldMeta.fullName] = {
              trackHistory: fieldMeta.trackHistory === true,
              description: fieldMeta.description || "",
            };
          }
        });

        console.log(
          `✓ CustomObjectから${objectFields.length}件の項目メタデータを取得`
        );
      }
    } catch (error) {
      console.warn(
        `⚠️  CustomObjectメタデータの取得に失敗: ${error.message}`
      );
    }

    // 2. カスタム項目のメタデータを個別に取得（より詳細な情報を上書き）
    const customFields = fields.filter((field) => field.custom);

    if (customFields.length > 0) {
      const fieldFullNames = customFields.map(
        (field) => `${objectApiName}.${field.name}`
      );

      // 一度に取得できる最大数は10件なので、バッチ処理
      const batchSize = 10;
      for (let i = 0; i < fieldFullNames.length; i += batchSize) {
        const batch = fieldFullNames.slice(i, i + batchSize);

        try {
          const metadata = await conn.metadata.read("CustomField", batch);

          // 単一の結果の場合は配列でラップ
          const metadataArray = Array.isArray(metadata) ? metadata : [metadata];

          metadataArray.forEach((fieldMeta) => {
            if (fieldMeta && fieldMeta.fullName) {
              // fullNameから項目名を抽出（ObjectName.FieldName形式）
              const fieldName = fieldMeta.fullName.split(".").pop();
              metadataMap[fieldName] = {
                trackHistory: fieldMeta.trackHistory === true,
                description: fieldMeta.description || "",
              };
            }
          });
        } catch (error) {
          // 一部のフィールド（地理位置情報の緯度・経度など）は取得できないことがある
          // このエラーは想定内で、処理は正常に継続される
          console.log(
            `ℹ️  一部のカスタム項目メタデータを取得できませんでした（想定内の動作）`
          );
          console.log(`   理由: ${error.message}`);
          console.log(`   対象: ${batch.join(", ")}`);
          console.log(
            `   ※地理位置情報の緯度・経度フィールドなどは取得できません`
          );
          console.log(`   ※履歴管理・説明は空欄で出力されます\n`);
        }
      }

      console.log(
        `✓ カスタム項目${customFields.length}件のメタデータを取得`
      );
    }

    console.log(`✓ メタデータ取得完了\n`);
  } catch (error) {
    console.warn(`⚠️  メタデータの取得に失敗: ${error.message}`);
    console.warn(`   （履歴管理・説明列は空欄で出力されます）\n`);
  }

  return metadataMap;
}

/**
 * 参照先オブジェクトのラベルを取得してキャッシュする
 * @param {Object} conn - Salesforce接続オブジェクト
 * @param {Array} fields - フィールド配列
 * @returns {Promise<void>}
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
      cache.setObjectLabel(objName, objDescribe.label);
    } catch (error) {
      // エラーが発生した場合はAPI名をそのまま使用
      console.warn(`⚠️  ${objName} のDescribeに失敗: ${error.message}`);
      cache.setObjectLabel(objName, objName);
    }
  }

  console.log(`✓ 参照先オブジェクトラベル取得完了\n`);
}

module.exports = {
  getFieldMetadata,
  cacheReferenceObjectLabels,
};
