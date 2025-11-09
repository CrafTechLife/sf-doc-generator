const inquirer = require("inquirer");
const autocomplete = require("inquirer-autocomplete-prompt");

// autocompleteプラグインを登録
inquirer.registerPrompt("autocomplete", autocomplete);

/**
 * 対話式でオブジェクトを選択
 * @param {Array} objects - オブジェクト情報の配列
 * @returns {Promise<Array>} 選択されたオブジェクトAPI名の配列
 */
async function selectObjectsInteractively(objects) {
  console.log("📝 処理対象のオブジェクトを選択してください\n");

  // ステップ1: カスタム/標準/すべてのフィルタ選択
  const filterAnswer = await inquirer.prompt([
    {
      type: "list",
      name: "filter",
      message: "オブジェクトの種類でフィルタ:",
      choices: [
        { name: "すべてのオブジェクト", value: "all" },
        { name: "カスタムオブジェクトのみ", value: "custom" },
        { name: "標準オブジェクトのみ", value: "standard" },
      ],
      default: "all",
    },
  ]);

  // フィルタ適用
  let filteredObjects = objects;
  if (filterAnswer.filter === "custom") {
    filteredObjects = objects.filter((obj) => obj.custom);
  } else if (filterAnswer.filter === "standard") {
    filteredObjects = objects.filter((obj) => !obj.custom);
  }

  console.log(`\n✓ ${filteredObjects.length}件のオブジェクトが対象です\n`);

  // ステップ2: 検索可能なオブジェクト選択
  const selectedObjects = [];

  // 検索関数
  const searchObjects = (answers, input = "") => {
    return new Promise((resolve) => {
      const searchTerm = (input || "").toLowerCase();
      const filtered = filteredObjects.filter((obj) => {
        const displayName = obj.displayName.toLowerCase();
        const name = obj.name.toLowerCase();
        const label = obj.label.toLowerCase();
        return (
          displayName.includes(searchTerm) ||
          name.includes(searchTerm) ||
          label.includes(searchTerm)
        );
      });

      const choices = [
        new inquirer.Separator("=== 選択を完了する場合は以下を選択 ==="),
        { name: "✅ 選択完了（これまでの選択を確定）", value: "__DONE__" },
        new inquirer.Separator(
          `=== オブジェクト一覧 (${filtered.length}件) ===`
        ),
        ...filtered.map((obj) => ({
          name: `${obj.displayName}${selectedObjects.includes(obj.name) ? " ✓" : ""}`,
          value: obj.name,
        })),
      ];

      resolve(choices);
    });
  };

  // オブジェクトを1つずつ選択
  while (true) {
    console.log(`\n現在の選択: ${selectedObjects.length}個`);
    if (selectedObjects.length > 0) {
      console.log(`  ${selectedObjects.join(", ")}`);
    }

    const answer = await inquirer.prompt([
      {
        type: "autocomplete",
        name: "object",
        message: "オブジェクトを検索して選択（入力で絞り込み）:",
        source: searchObjects,
        pageSize: 15,
        emptyText: "該当するオブジェクトが見つかりません",
      },
    ]);

    if (answer.object === "__DONE__") {
      if (selectedObjects.length < 1) {
        console.log("\n⚠️  少なくとも1つのオブジェクトを選択してください");
        continue;
      }
      break;
    }

    // 選択をトグル（既に選択されていたら削除、そうでなければ追加）
    const index = selectedObjects.indexOf(answer.object);
    if (index > -1) {
      selectedObjects.splice(index, 1);
      console.log(`\n❌ ${answer.object} を選択から除外しました`);
    } else {
      selectedObjects.push(answer.object);
      console.log(`\n✅ ${answer.object} を選択しました`);
    }
  }

  return selectedObjects;
}

module.exports = {
  selectObjectsInteractively,
};
