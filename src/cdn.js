const CDN_SDK = require("tencentcloud-sdk-nodejs/tencentcloud/services/cdn");
const path = require("path");

const Client = CDN_SDK.cdn.v20180606.Client;

class CDN {
  static getInput() {
    return ["secret_id", "secret_key", "remote_path", "cdn_prefix", "clean"];
  }

  constructor(inputs) {
    if (!inputs.cdn_prefix) {
      return;
    }

    const clientConfig = {
      credential: {
        secretId: inputs.secret_id,
        secretKey: inputs.secret_key,
      },
      profile: {
        language: "en-US",
      },
    };

    this.cdn = new Client(clientConfig);
    this.clean = inputs.clean === "true";
    this.cdnPrefix = inputs.cdn_prefix;
    this.remotePath = inputs.remote_path;

    if (this.cdnPrefix[this.cdnPrefix.length - 1] !== "/") {
      this.cdnPrefix += "/";
    }
  }

  createUrl(file = "") {
    let p = path.join(this.remotePath, file);
    if (p[0] === "/") {
      p = p.substr(1);
    }
    return this.cdnPrefix + p;
  }

  purgeAll() {
    return this.cdn.PurgePathCache({
      FlushType: "delete",
      Paths: [this.createUrl()],
    });
  }

  purgeUrls(urls) {
    return this.cdn.PurgeUrlsCache({
      Urls: urls,
    });
  }

  async process(localFiles) {
    if (!this.cdnPrefix) {
      return;
    }
    if (this.clean || localFiles.length > 200) {
      await this.purgeAll();
      console.log("Flush all CDN cache");
      return;
    }
    // 清空部分缓存
    await this.purgeUrls(
      Array.from(localFiles).map((it) => this.createUrl(it))
    );
    console.log(`Flush ${localFiles.size} CDN caches`);
  }
}

module.exports = CDN;
