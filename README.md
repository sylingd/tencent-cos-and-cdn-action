# Tencent Cloud COS and CDN action

该 Action 可以将文件上传到腾讯云 COS，并同时刷新腾讯云 CDN 缓存（支持普通 CDN 或 EdgeOne CDN）。

This action can upload files to tencent cloud COS, and flush CDN cache (support regular CDN and EdgeOne CDN).

## 输入

- secret_id(**必填**): 腾讯云 secret id，请使用加密环境变量
- secret_key(**必填**): 腾讯云 secret key，请使用加密环境变量
- session_token: 腾讯云临时密钥的 session token，可通过其他 actions 获取后传入
- cos_bucket(**必填**): COS 存储桶名称
- cos_region(**必填**): COS 存储桶区域
- cos_accelerate: 设为`true`以使用加速域名进行上传（此选项与 CDN 无关）。默认为`false`
- cos_init_options: 将会原样传给`new COS`的选项，JSON格式。[官方文档](https://cloud.tencent.com/document/product/436/8629)
- cos_put_options: 将会原样传给`uploadFile`的选项，JSON格式。[官方文档](https://cloud.tencent.com/document/product/436/64980)
- cos_replace_file: 是否替换已经存在的文件，可选：`true`替换、`false`不替换、`crc64ecma`通过crc64ecma对比，替换有变更的文件。默认为`true`
- cdn_type: CDN 类型，可选普通CDN（`cdn`）或 EdgeOne CDN（`eo`）。默认为`cdn`
- cdn_prefix: 若你使用腾讯云 CDN 或 EdgeOne，此处填写 CDN 的 URL 前缀。若为空，则不刷新 CDN 缓存
- cdn_wait_flush: 是否等待 CDN 刷新完成。默认为`false`
- eo_zone: 若你使用腾讯云 EdgeOne，此处填写 EdgeOne 的 Zone ID。若为空，则不刷新 CDN 缓存
- local_path(**必填**): 将要上传到 COS 的本地路径。可为文件夹或单个文件
- remote_path(**必填**): 将文件上传到 COS 的指定路径
- clean: 设为`true`将会清除 COS 上不存在于本地的文件。默认为 false

> 如果`cos_replace_file`不为`true`，会增加一次请求，腾讯云可能会收取相应费用。但开启后同名文件不会重复上传，可减少上行流量。建议每次文件变更较少时开启。

## Inputs

- secret_id(**Required**): Tencent Cloud secret id. Should be referred to a encrypted environment variable
- secret_key(**Required**): Tencent Cloud secret key. Should be referred to a encrypted environment variable
- session_token: Tencent Cloud session token for temporary key, may get from other actions
- cos_bucket(**Required**): COS bucket name
- cos_region(**Required**): COS bucket region
- cos_accelerate: Set to `true` for using accelerate domain to upload files (this input is not independent of the CDN). Default is false
- cos_init_options: The options that will be passed to `new COS` as is, in JSON format.[official documentation](https://www.tencentcloud.com/document/product/436/7749)
- cos_put_options: The options that will be passed to `uploadFile` as is, in JSON format. [official documentation](https://www.tencentcloud.com/document/product/436/43871)
- cdn_type: CDN type, you can choose regular CDN (`cdn`) or EdgeOne CDN (`eo`). Default is `cdn`
- cdn_prefix: CDN url prefix if you are using Tencent Cloud CDN or Tencent Cloud EdgeOne. If is empty, this action will not flush CDN cache.
- cos_replace_file: Whether to replace the existing file, optional: `true` replace, `false` not replace, `crc64ecma` replace the changed file through crc64ecma comparison. Default is `true`
- cdn_wait_flush: Whether to wait for CDN refresh to complete. Defaults is `false`
- eo_zone: The Zone ID if you are using Tencent Cloud EdgeOne. If is empty, this action will not flush CDN cache.
- local_path(**Required**): Local path to be uploaded to COS. Directory or file is allowed
- remote_path(**Required**): COS path to put the local files in on COS
- clean: Set to `true` for cleaning files on COS path which are not existed in local path. Default is false

> If `cos_replace_file` is not `true`, an additional request will be made and Tencent Cloud may charge a corresponding fee. However, after it is enabled, files with the same name will not be uploaded repeatedly, which can reduce upstream traffic. It is recommended to enable it when there are few file changes each time.

## Demo

例如，当文件结构为：

For example, when the file structure is:

```
+ upload_folder
  - a.js
```

下列命令将会上传文件`upload_folder/a.js`至`bucket-12345678/scripts/a.js`，并刷新 CDN 缓存`https://cdn.example.com/demo/scripts/a.js`

The following command will upload the file `upload_folder/a.js` to `bucket-12345678/scripts/a.js` and refresh the CDN cache `https://cdn.example.com/demo/scripts/a.js`

```
- name: Tencent COS and CDN
  uses: sylingd/tencent-cos-and-cdn-action@latest
  with:
    secret_id: YOUR_SECRET_ID
    secret_key: YOUR_SECRET_KEY
    session_token: YOUR_TOKEN
    cos_bucket: bucket-12345678
    cos_region: ap-shanghai
    cos_accelerate: false
    cos_init_options: '{"CopyChunkParallelLimit":10}'
    cos_put_options: '{"StorageClass":"MAZ_STANDARD"}'
    cos_replace_file: true
    cdn_wait_flush: false
    cdn_type: eo
    cdn_prefix: https://cdn.example.com/demo/
    eo_zone: zone-123456789
    local_path: upload_folder
    remote_path: /scripts
    clean: false
```

更多示例可参考[test分支](https://github.com/sylingd/tencent-cos-and-cdn-action/tree/test)

For more examples, please refer to the [test branch](https://github.com/sylingd/tencent-cos-and-cdn-action/tree/test)

## 使用临时密钥 Using temporary key

当[使用临时密钥](https://cloud.tencent.com/document/product/1312/48195)时，需要授权**所有**你要用到的功能权限：

| 功能 | 权限 |
| --- | --- |
| 基础功能 | `cos:PutObject` `cos:DeleteObject` `cos:GetBucket` `cos:HeadObject` |
| 普通 CDN | `cdn:PurgePathCache` `cdn:PurgeUrlsCache` |
| EdgeOne CDN | `teo:CreatePurgeTask` |
| 分块上传（有大文件的时候需要） | `cos:InitiateMultipartUpload` `cos:ListMultipartUploads` `cos:ListParts` `cos:UploadPart` `cos:CompleteMultipartUpload` |

When [using a temporary key](https://www.tencentcloud.com/document/product/1150/49452), you need to authorize **all** the function permissions you want to use:

| Function | Permission |
| --- | --- |
| Basic functions | `cos:PutObject` `cos:DeleteObject` `cos:GetBucket` `cos:HeadObject` |
| Normal CDN | `cdn:PurgePathCache` `cdn:PurgeUrlsCache` |
| EdgeOne CDN | `teo:CreatePurgeTask` |
| Multi-part upload (required for large files) | `cos:InitiateMultipartUpload` `cos:ListMultipartUploads` `cos:ListParts` `cos:UploadPart` `cos:CompleteMultipartUpload` |
