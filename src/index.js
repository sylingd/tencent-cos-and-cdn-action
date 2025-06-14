const COS = require("./cos");
const CDN = require("./cdn");
const EO = require("./eo");
const { readConfig, collectLocalFiles } = require("./utils");

async function main() {
  // 读取配置
  const config = readConfig(
    new Set([
      "clean",
      "local_path",
      "remote_path",
      "cdn_type",
      ...COS.getInput(),
      ...CDN.getInput(),
      ...EO.getInput(),
    ])
  );
  const cosInstance = new COS(config);
  // 读取所有文件
  const localFiles = await collectLocalFiles(config.local_path);
  await cosInstance.process(localFiles);
  // 判断走EO还是走CDN
  if (cdn_type === 'eo') {
    const eoInstance = new EO(config);
    await eoInstance.process(localFiles);
  } else {
    const cdnInstance = new CDN(config);
    await cdnInstance.process(localFiles);
  }
}

main();
