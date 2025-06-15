const core = require('@actions/core');
const COS_SDK = require("cos-nodejs-sdk-v5");
const fs = require("fs/promises");
const path = require("path");
const { crc64 } = require("crc64-ecma");
const { normalizeObjectKey } = require("./utils");

const FILE_EXISTS = Symbol();
const HEAD_FAILED = Symbol();

async function hashFile(filePath) {
  const fileBuffer = await fs.readFile(filePath);
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
  remoteFiles = undefined;

  constructor(inputs) {
    const opt = {
      UseAccelerate: inputs.cos_accelerate === "true",
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
    this.remotePath = inputs.remote_path || '';
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
    const fileKey = normalizeObjectKey(this.remotePath + '/' + p);
    const localPath = path.join(this.localPath, p);

    const doUpload = () => this.uploadFile(fileKey, localPath);

    core.debug(`[cos] [checkFileAndUpload] ${p} key: ${fileKey}`);
    // do not check
    if (this.replace === 'true') {
      return doUpload();
    }
    // has listed bucket
    if (typeof this.remoteFiles !== 'undefined') {
      if (typeof this.remoteFiles[p] === 'undefined') {
        // new file, skip head operator
        core.debug(`[cos] [checkFileAndUpload] ${p} is new file`);
        return doUpload();
      } else {
        // check file size is match
        const fileInfo = await fs.stat(localPath);
        core.debug(`[cos] [checkFileAndUpload] ${p} size is: local ${fileInfo.size} remote ${this.remoteFiles[p].Size}`);
        if (String(fileInfo.size) !== String(this.remoteFiles[p].Size)) {
          return doUpload();
        }
      }
    }
    let info = {};
    try {
      info = await this.headObject(fileKey);
    } catch (e) {
      if (e.code === '404') {
        core.debug(`[cos] [checkFileAndUpload] ${p} head return 404`);
        // file not exists, continue upload
        return doUpload();
      } else {
        // head failed, do not upload
        return HEAD_FAILED;
      }
    }
    // check crc64ecma
    if (this.replace === 'crc64ecma') {
      const exist = info.headers['x-cos-hash-crc64ecma'];
      const cur = await hashFile(localPath);
      core.debug(`[cos] [checkFileAndUpload] ${p} crc64ecma is: local ${cur} remote ${exist}`);
      if (exist === cur) {
        return FILE_EXISTS;
      } else {
        return doUpload();
      }
    }
    // file exists, do not upload
    return FILE_EXISTS;
  }

  deleteFile(p) {
    return new Promise((resolve, reject) => {
      this.cos.deleteObject(
        {
          Bucket: this.bucket,
          Region: this.region,
          Key: normalizeObjectKey(this.remotePath + '/' + p),
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
          Prefix: normalizeObjectKey(this.remotePath),
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
      if (res === FILE_EXISTS) {
        result = 'skiped: file exists';
      } else if (res === HEAD_FAILED) {
        result = 'skiped: head failed';
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
    let data = {};
    let nextMarker = null;

    if (typeof this.remoteFiles === 'undefined') {
      this.remoteFiles = {};
    }

    do {
      data = await this.listFiles(nextMarker);
      for (const e of data.Contents) {
        const p = normalizeObjectKey(e.Key.substring(this.remotePath.length));
        this.remoteFiles[p] = e;
      }
      nextMarker = data.NextMarker;
    } while (data.IsTruncated === "true");

    if (core.isDebug()) {
      core.debug(`[cos] [collectRemoteFiles] keys: ${Object.keys(this.remoteFiles).join(',')}`);
    }

    return this.remoteFiles;
  }

  findDeletedFiles(localFiles) {
    const deletedFiles = new Set();
    if (typeof this.remoteFiles === 'undefined') {
      return deletedFiles;
    }
    const remoteFiles = Object.keys(this.remoteFiles);
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
      const displayPath = normalizeObjectKey(this.remotePath + '/' + file);
      console.log(`>> [${index}/${size}, ${percent}%] cleaned ${displayPath}`);
    }
  }

  async process(localFiles) {
    if (this.clean || this.replace !== 'true') {
      console.log(`[cos] collecting remote files`);
      this.remoteFiles = await this.collectRemoteFiles();
    }
    console.log(`[cos] ${localFiles.size} files to be uploaded`);
    let changedFiles = localFiles;
    try {
      changedFiles = await this.uploadFiles(localFiles);
    } catch (e) {
      console.error('upload failed: ', e);
      process.exit(-1);
    }
    let cleanedFilesCount = 0;
    if (this.clean) {
      const deletedFiles = this.findDeletedFiles(localFiles);
      if (deletedFiles.size > 0) {
        console.log(`[cos] ${deletedFiles.size} files to be cleaned`);
      }
      await this.cleanDeleteFiles(deletedFiles);
      cleanedFilesCount = deletedFiles.size;
    }
    let cleanedFilesMessage = "";
    if (cleanedFilesCount > 0) {
      cleanedFilesMessage = `, cleaned ${cleanedFilesCount} files`;
    }
    console.log(`[cos] uploaded ${changedFiles.length} files${cleanedFilesMessage}`);
    return changedFiles;
  }
}

module.exports = COS;
