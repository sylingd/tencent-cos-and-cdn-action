const CDN_SDK = require("tencentcloud-sdk-nodejs/tencentcloud/services/cdn");
const EO_SDK = require("tencentcloud-sdk-nodejs/tencentcloud/services/teo");
const path = require("path");
const { sleep } = require("./utils");

const EO_Client = EO_SDK.teo.v20220901.Client;
const CDN_Client = CDN_SDK.cdn.v20180606.Client;

class CDN {
  static getInput() {
    return [
      "secret_id",
      "secret_key",
      "session_token",
      "remote_path",
      "cdn_type",
      "cdn_prefix",
      "clean",
      "eo_zone",
      "cdn_wait_flush"
    ];
  }

  type = 'cdn';
  client;

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

    if (inputs.session_token) {
      clientConfig.credential.token = inputs.session_token;
    }

    this.type = inputs.cdn_type || 'cdn';
    this.clean = inputs.clean === "true";
    this.waitFlush = inputs.cdn_wait_flush === 'true';
    this.cdnPrefix = inputs.cdn_prefix;
    this.remotePath = inputs.remote_path;

    if (this.cdnPrefix[this.cdnPrefix.length - 1] !== "/") {
      this.cdnPrefix += "/";
    }

    if (this.type === 'eo') {
      this.zoneId = inputs.eo_zone;
      this.client = new EO_Client(clientConfig);
    } else {
      this.client = new CDN_Client(clientConfig);
    }
  }

  createUrl(file = "") {
    let p = path.join(this.remotePath, file);
    if (p[0] === "/") {
      p = p.substr(1);
    }
    return this.cdnPrefix + p;
  }

  async purgeAll() {
    if (this.type === 'eo') {
      const { JobId } = this.client.CreatePurgeTask({
        ZoneId: this.zoneId,
        Type: 'purge_prefix',
        Targets: [this.createUrl()],
      });
      return JobId;
    }
    const { TaskId } = await this.client.PurgePathCache({
      FlushType: "delete",
      Paths: [this.createUrl()],
    });
    return TaskId;
  }

  async purgeUrls(urls) {
    if (this.type === 'eo') {
      const { JobId } = await this.client.CreatePurgeTask({
        ZoneId: this.zoneId,
        Type: 'purge_url',
        Targets: urls,
      });
      return JobId;
    }
    const { TaskId } = await this.client.PurgeUrlsCache({
      Urls: urls,
    });
    return TaskId;
  }

  async isTaskFinished(taskId) {
    if (this.type === 'eo') {
      const res = await this.client.DescribePurgeTasks({
        Filters: [
          {
            Name: "job-id",
            Values: [taskId]
          }
        ]
      });
      const task = res.Tasks[0];
      return task.Status !== 'processing';
    }
    // CDN
    const res = await this.client.DescribePurgeTasks({
      TaskId: taskId
    });
    const task = res.PurgeLogs[0];
    return task.Status !== 'process';
  }

  async process(changedFiles) {
    if (!this.cdnPrefix) {
      console.log('[cdn] no prefix, skip flush');
      return;
    }
    if (this.type === 'eo' && !this.zoneId) {
      console.log('[cdn] no eo_zone, skip flush');
      return;
    }
    if (changedFiles.length === 0) {
      console.log('[cdn] files not change, skip flush');
      return;
    }
    let taskId = undefined;
    if (this.clean || changedFiles.length > 200) {
      console.log('[cdn] flush all CDN cache');
      taskId = await this.purgeAll();
    } else {
      // 清空部分缓存
      console.log(`[cdn] flush ${changedFiles.size} CDN caches`);
      taskId = await this.purgeUrls(
        Array.from(changedFiles).map((it) => this.createUrl(it))
      );
    }
    console.log(`[cdn] task id: ${taskId}`);
    if (taskId && this.waitFlush) {
      console.log('[cdn] checking task status...');
      await sleep(3000);
      while (true) {
        const isFinish = await this.isTaskFinished(taskId);
        if (isFinish) {
          console.log('[cdn] flush finished');
          break;
        }
        await sleep(8000);
      }
    }
  }
}

module.exports = CDN;
