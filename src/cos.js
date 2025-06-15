const COS_SDK = require("cos-nodejs-sdk-v5");
const fs = require("fs");
const path = require("path");
const { crc64 } = require("crc64-ecma");

const SKIPED = Symbol();

async function hashFile(filePath) {
  const fileBuffer = await fs.promises.readFile(filePath);
  return crc64(fileBuffer).toString();
}

class COS {
  static getInput() {
    return [
      "secret_id",
      "secret_key",
      "session_token",
      "cos_accelerate",
      "cos_init_options",
      "cos_put_options",
      "cos_replace_file",
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
    this.replace = inputs.cos_replace_file || "true";
    this.clean = inputs.clean === "true";
    if (inputs.cos_put_options) {
      try {
          const res = JSON.parse(inputs.cos_put_options);
          if (typeof res === 'object') {
            this.putOptions = res;
          }
      } catch (e) {
        console.log('[cos] Parse put options failed:', e.message, inputs.cos_put_options);
        // ignore
      }
      console.log('[cos] Put options:', this.putOptions)
    }
  }

  uploadFile(key, file) {
    return new Promise((resolve, reject) => {
      this.cos.uploadFile(
        {
          StorageClass: "STANDARD",
          ...this.putOptions,
          Bucket: this.bucket,
          Region: this.region,
          Key: key,
          FilePath: file,
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

  headObject(key) {
    return new Promise((resolve, reject) => {
      this.cos.headObject(
        {
          Bucket: this.bucket,
          Region: this.region,
          Key: key,
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

  async checkFileAndUpload(p) {
    const fileKey = path.join(this.remotePath, p);
    const localPath = path.join(this.localPath, p);
    if (this.replace !== 'true') {
      try {
        const info = await this.headObject(fileKey);
        if (this.replace === 'crc64ecma') {
          const exist = info.headers['x-cos-hash-crc64ecma'];
          const cur = await hashFile(localPath);
          if (exist === cur) {
            return SKIPED;
          }
        }
      } catch (e) {
        if (e.code === '404') {
          // file not exists, continue upload
        } else {
          // head failed, do not upload
          return SKIPED;
        }
      }
    }
    return this.uploadFile(fileKey, localPath);
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
    const changedFiles = [];
    for (const file of localFiles) {
      index++;
      percent = parseInt((index / size) * 100);
      let result = 'uploaded';
      const res = await this.checkFileAndUpload(file);
      if (res === SKIPED) {
        result = 'skiped';
      } else {
        changedFiles.push(file);
      }
      console.log(
        `>> [${index}/${size}, ${percent}%] ${result} ${path.join(
          this.localPath,
          file
        )}`
      );
    }
    return changedFiles;
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
    let changedFiles = localFiles;
    try {
      changedFiles = await this.uploadFiles(localFiles);
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
    console.log(`uploaded ${changedFiles.size} files${cleanedFilesMessage}`);
    return changedFiles;
  }
}

module.exports = COS;
