const COS = require("./cos");
const CDN = require("./cdn");
const { readConfig, collectLocalFiles } = require("./utils");

async function main() {
  // 读取配置
  const config = readConfig(
    new Set([
      "clean",
      "local_path",
      "remote_path",
      ...COS.getInput(),
      ...CDN.getInput(),
    ])
  );
  const cosInstance = new COS(config);
  // 读取所有文件
  const localFiles = await collectLocalFiles(config.local_path);
  await cosInstance.process(localFiles);
  const cdnInstance = new CDN(config);
  await cdnInstance.process(localFiles);
}

main();
