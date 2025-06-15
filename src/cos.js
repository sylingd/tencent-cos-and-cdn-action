const COS_SDK = require("cos-nodejs-sdk-v5");
const fs = require("fs");
const path = require("path");

class COS {
  static getInput() {
    return [
      "secret_id",
      "secret_key",
      "session_token",
      "cos_accelerate",
      "put_options",
      "cos_bucket",
      "cos_region",
      "local_path",
      "remote_path",
      "clean",
    ];
  }

  putOptions = {};

  constructor(inputs) {
    const opt = {
      Domain:
        inputs.cos_accelerate === "true"
          ? "{Bucket}.cos.accelerate.myqcloud.com"
          : undefined,
    };
    // Read other options
    try {
      const res = JSON.parse(inputs.cos_init_options);
      if (typeof res === 'object') {
        Object.keys(res).forEach(k => {
          opt[k] = res[k];
        });
      }
    } catch (e) {
      // ignore
    }
    if (inputs.session_token) {
      opt.getAuthorization = (options, callback) => {
        const time = Math.floor(Date.now() / 1000);
        callback({
          TmpSecretId: inputs.secret_id,
          TmpSecretKey: inputs.secret_key,
          SecurityToken: inputs.session_token,
          StartTime: time,
          // Simulation expiration time
          ExpiredTime: time + 24 * 3600,
        });
      };
    } else {
      opt.SecretId = inputs.secret_id;
      opt.SecretKey = inputs.secret_key;
    }

    this.cos = new COS_SDK(opt);
    this.bucket = inputs.cos_bucket;
    this.region = inputs.cos_region;
    this.localPath = inputs.local_path;
    this.remotePath = inputs.remote_path;
    this.clean = inputs.clean === "true";
    try {
      const res = JSON.parse(inputs.cos_put_options);
      if (typeof res === 'object') {
        this.putOptions = res;
      }
    } catch (e) {
      // ignore
    }
    console.log('Put options:', this.putOptions, inputs.cos_put_options)
  }

  uploadFile(p) {
    return new Promise((resolve, reject) => {
      this.cos.putObject(
        {
          StorageClass: "STANDARD",
          ...this.putOptions,
          Bucket: this.bucket,
          Region: this.region,
          Key: path.join(this.remotePath, p),
          Body: fs.createReadStream(path.join(this.localPath, p)),
        },
        function (err, data) {
          if (err) {
            return reject(err);
          } else {
            return resolve(data);
          }
        }
      );
    });
  }

  deleteFile(p) {
    return new Promise((resolve, reject) => {
      this.cos.deleteObject(
        {
          Bucket: this.bucket,
          Region: this.region,
          Key: path.join(this.remotePath, p),
        },
        function (err, data) {
          if (err) {
            return reject(err);
          } else {
            return resolve(data);
          }
        }
      );
    });
  }

  listFiles(nextMarker) {
    return new Promise((resolve, reject) => {
      this.cos.getBucket(
        {
          Bucket: this.bucket,
          Region: this.region,
          Prefix: this.remotePath,
          NextMarker: nextMarker,
        },
        function (err, data) {
          if (err) {
            return reject(err);
          } else {
            return resolve(data);
          }
        }
      );
    });
  }

  async uploadFiles(localFiles) {
    const size = localFiles.size;
    let index = 0;
    let percent = 0;
    for (const file of localFiles) {
      await this.uploadFile(file);
      index++;
      percent = parseInt((index / size) * 100);
      console.log(
        `>> [${index}/${size}, ${percent}%] uploaded ${path.join(
          this.localPath,
          file
        )}`
      );
    }
  }

  async collectRemoteFiles() {
    const files = new Set();
    let data = {};
    let nextMarker = null;

    do {
      data = await this.listFiles(nextMarker);
      for (const e of data.Contents) {
        let p = e.Key.substring(this.remotePath.length);
        while (p[0]) {
          p = p.substring(1);
        }
        files.add(p);
      }
      nextMarker = data.NextMarker;
    } while (data.IsTruncated === "true");

    return files;
  }

  findDeletedFiles(localFiles, remoteFiles) {
    const deletedFiles = new Set();
    for (const file of remoteFiles) {
      if (!localFiles.has(file)) {
        deletedFiles.add(file);
      }
    }
    return deletedFiles;
  }

  async cleanDeleteFiles(deleteFiles) {
    const size = deleteFiles.size;
    let index = 0;
    let percent = 0;
    for (const file of deleteFiles) {
      await this.deleteFile(file);
      index++;
      percent = parseInt((index / size) * 100);
      console.log(
        `>> [${index}/${size}, ${percent}%] cleaned ${path.join(
          cos.remotePath,
          file
        )}`
      );
    }
  }

  async process(localFiles) {
    console.log(localFiles.size, "files to be uploaded");
    try {
      await this.uploadFiles(localFiles);
    } catch (e) {
      console.error('upload failed: ', e);
      process.exit(-1);
    }
    let cleanedFilesCount = 0;
    if (this.clean) {
      const remoteFiles = await this.collectRemoteFiles();
      const deletedFiles = this.findDeletedFiles(localFiles, remoteFiles);
      if (deletedFiles.size > 0) {
        console.log(`${deletedFiles.size} files to be cleaned`);
      }
      await this.cleanDeleteFiles(deletedFiles);
      cleanedFilesCount = deletedFiles.size;
    }
    let cleanedFilesMessage = "";
    if (cleanedFilesCount > 0) {
      cleanedFilesMessage = `, cleaned ${cleanedFilesCount} files`;
    }
    console.log(`uploaded ${localFiles.size} files${cleanedFilesMessage}`);
  }
}

module.exports = COS;
