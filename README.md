# Tencent Cloud COS and CDN action

This action can upload files to tencent cloud COS, and flush CDN cache.

该 Action 可以将文件上传到腾讯云 COS，并同时刷新腾讯云 CDN 缓存。

## Inputs

- secret_id(**Required**): Tencent cloud secret id. Should be referred to a encrypted environment variable
- secret_key(**Required**): Tencent cloud secret key. Should be referred to a encrypted environment variable
- cos_bucket(**Required**): COS bucket name
- cos_region(**Required**): COS bucket region
- cos_accelerate: Set to `true` for using accelerate domain to upload files (this input is not independent of the CDN). Default is false
- cdn_prefix: CDN url prefix if you are using Tencent cloud CDN. If is empty, this action will not flush CDN cache.
- local_path(**Required**): Local path to be uploaded to COS. Directory or file is allowed
- remote_path(**Required**): COS path to put the local files in on COS
- clean: Set to `true` for cleaning files on COS path which are not existed in local path. Default is false

## 输入

- secret_id(**必填**): 腾讯云 secret id，请使用加密环境变量
- secret_key(**必填**): 腾讯云 secret key，请使用加密环境变量
- cos_bucket(**必填**): COS 存储桶名称
- cos_region(**必填**): COS 存储桶区域
- cos_accelerate: 设为`true`以使用加速域名进行上传（此选项与 CDN 无关）。默认为`false`
- cdn_prefix: 若你使用腾讯云 CDN，此处填写 CDN 的 URL 前缀。若为空，则不刷新 CDN 缓存
- local_path(**必填**): 将要上传到 COS 的本地路径。可为文件夹或单个文件
- remote_path(**必填**): 将文件上传到 COS 的指定路径
- clean: 设为`true`将会清除 COS 上不存在于本地的文件。默认为 false

## Demo

```
- name: Tencent COS and CDN
  uses: sylingd/tencent-cos-and-cdn-action@latest
  with:
    secret_id: YOUR_SECRET_ID
    secret_key: YOUR_SECRET_KEY
    cos_bucket: bucket-12345678
    cos_region: ap-shanghai
    cos_accelerate: false
    cdn_prefix: https://cdn.example.com/scripts/
    local_path: path/to/files
    remote_path: /scripts
    clean: false
```