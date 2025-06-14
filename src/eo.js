const EO_SDK = require("tencentcloud-sdk-nodejs/tencentcloud/services/teo");
const path = require("path");

const Client = EO_SDK.teo.v20220901.Client;

class EO {
  static getInput() {
    return ["secret_id", "secret_key", "session_token", "remote_path", "cdn_prefix", "clean", "eo_zone"];
  }

  constructor(inputs) {
    if (!inputs.cdn_prefix || !inputs.eo_zone) {
      return;
    }

    const clientConfig = {
      credential: {
        secretId: inputs.secret_id,
        secretKey: inputs.secret_key,
      },
    };

    if (inputs.session_token) {
      clientConfig.credential.token = inputs.session_token;
    }

    this.client = new Client(clientConfig);
    this.zoneId = inputs.eo_zone;
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
    return this.client.CreatePurgeTask({
      ZoneId: this.zoneId,
      Type: 'purge_prefix',
      Targets: [this.createUrl()],
    });
  }

  purgeUrls(urls) {
    return this.client.CreatePurgeTask({
      ZoneId: this.zoneId,
      Type: 'purge_url',
      Targets: urls,
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

module.exports = EO;
