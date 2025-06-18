# Tencent Cloud COS and CDN action

该 Action 可以将文件上传到腾讯云 COS，并同时刷新腾讯云 CDN 缓存（支持普通 CDN 或 EdgeOne CDN）。

This action can upload files to tencent cloud COS, and flush CDN cache (support regular CDN and EdgeOne CDN).

## 输入

- `secret_id`(**必填**): 腾讯云 secret id，请使用加密环境变量
- `secret_key`(**必填**): 腾讯云 secret key，请使用加密环境变量
- `session_token`: 腾讯云临时密钥的 session token，可通过其他 actions 获取后传入
- `cos_bucket`(**必填**): COS 存储桶名称
- `cos_region`(**必填**): COS 存储桶区域
- `cos_accelerate`: 设为`true`以使用加速域名进行上传（此选项与 CDN 无关）。默认为`false`
- `cos_init_options`: 将会原样传给`new COS`的选项，JSON格式。[官方文档](https://cloud.tencent.com/document/product/436/8629)
- `cos_put_options`: 将会原样传给`uploadFile`的选项，JSON格式。[官方文档](https://cloud.tencent.com/document/product/436/64980)
- `cos_replace_file`: 是否替换同名文件，默认为`true`
  - `true` 全部替换（适合每次文件变更非常多的场景）
  - `false` 全部不替换（适合每次文件变更较少且名称中带有 hash 的场景）
  - `size` 替换大小不一致的文件
  - `crc64ecma` 通过crc64ecma对比，替换有变更的文件（适合文件数量较多的场景）
  - `false`、`size`、`crc64ecma`可以在一定程度上减少写请求。
- `cdn_type`: CDN 类型，可选普通CDN（`cdn`）或 EdgeOne CDN（`eo`）。默认为`cdn`
- `cdn_prefix`: 若你使用腾讯云 CDN 或 EdgeOne，此处填写 CDN 的 URL 前缀。若为空，则不刷新 CDN 缓存
- `cdn_wait_flush`: 是否等待 CDN 刷新完成。默认为`false`
- `eo_zone`: 若你使用腾讯云 EdgeOne，此处填写 EdgeOne 的 Zone ID。若为空，则不刷新 CDN 缓存
- `local_path`(**必填**): 将要上传到 COS 的本地路径。可为文件夹或单个文件
- `remote_path`: 将文件上传到 COS 的指定路径。默认为`(空字符串)`
- `clean`: 设为`true`将会清除 COS 上不存在于本地的文件，会增加少量读请求和相应的删除（写）请求。默认为`false`
  - 该功能仅会清空`remote_path`下的文件。

> 如果`cos_replace_file`不为`true`，或开启`clean`，增加读请求次数为：Bucket 下 Object 数 / 1000次，例如 Bucket 下前缀为`remote_path`的文件有 3100 个，则增加读请求次数 4 次。
>
> 如果`cos_replace_file`为`crc64ecma`，对每个已经存在且大小相同的文件都会增加一次读请求，腾讯云可能会收取相应费用。

## Inputs

- `secret_id`(**Required**): Tencent Cloud secret id. Should be referred to a encrypted environment variable
- `secret_key`(**Required**): Tencent Cloud secret key. Should be referred to a encrypted environment variable
- `session_token`: Tencent Cloud session token for temporary key, may get from other actions
- `cos_bucket`(**Required**): COS bucket name
- `cos_region`(**Required**): COS bucket region
- `cos_accelerate`: Set to `true` for using accelerate domain to upload files (this input is not independent of the CDN). Default is false
- `cos_init_options`: The options that will be passed to `new COS` as is, in JSON format.[official documentation](https://www.tencentcloud.com/document/product/436/7749)
- `cos_put_options`: The options that will be passed to `uploadFile` as is, in JSON format. [official documentation](https://www.tencentcloud.com/document/product/436/43871)
- `cdn_type`: CDN type, you can choose regular CDN (`cdn`) or EdgeOne CDN (`eo`). Default is `cdn`
- `cdn_prefix`: CDN url prefix if you are using Tencent Cloud CDN or Tencent Cloud EdgeOne. If is empty, this action will not flush CDN cache.
- `cos_replace_file`: Whether to replace files with the same name. Default is `true`
  - `true` Replace all (suitable for scenarios where a lot of files change each time)
  - `false` Do not replace all (suitable for scenarios where a few files change each time and the file name contains hash)
  - `crc64ecma` Replace changed files through crc64ecma comparison (suitable for scenarios with a large number of files)
  - `false` or `crc64ecma` can reduce write requests to some extent.
- `cdn_wait_flush`: Whether to wait for CDN refresh to complete. Default is `false`
- `eo_zone`: The Zone ID if you are using Tencent Cloud EdgeOne. If is empty, this action will not flush CDN cache.
- `local_path`(**Required**): Local path to be uploaded to COS. Directory or file is allowed
- `remote_path`: COS path to put the local files in on COS. Default is `(empty string)`
- `clean`: Set to `true` for cleaning files on COS path which are not existed in local path. Default is `false`
  - This function will only clear the files under `remote_path`.

> If `cos_replace_file` is not `true`, or `clean` is turned on, the number of read requests is increased by: number of objects in the bucket / 1000 times. For example, if there are 3100 files with the prefix `remote_path` in the bucket, the number of read requests is increased by 4 times.
>
> If `cos_replace_file` is `crc64ecma`, a read request will be added for each existing file of the same size, and Tencent Cloud may charge corresponding fees.

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
    remote_path: scripts
    clean: false
```

更多示例可参考[test分支](https://github.com/sylingd/tencent-cos-and-cdn-action/tree/test)

For more examples, please refer to the [test branch](https://github.com/sylingd/tencent-cos-and-cdn-action/tree/test)

## 功能说明

### 文件重复检查 File duplication check

当`cos_replace_file`使用`crc64ecma`时，将会获取服务端计算的 CRC64 值，并与本地文件对比；若相同，则跳过上传。（存在极少数 Hash 碰撞的可能性）

[服务端计算说明](https://cloud.tencent.com/document/product/436/40334)


When `cos_replace_file` uses `crc64ecma`, the CRC64 value calculated by the server will be obtained and compared with the local file; if they are the same, the upload will be skipped. (There is a very small possibility of hash collision)

[Server calculation instructions](https://www.tencentcloud.com/document/product/436/34078)

### 分片上传 Multi-part upload

默认情况下，将对大文件（>1m）进行分片上传。可以通过`SliceSize`设置分片上传阈值，通过`AsyncLimit`设置分片并发上传量；如：

By default, large files (>1M) will be uploaded in multiple parts. You can set the multi-part upload threshold through `SliceSize`, and set the multi-part concurrent upload limit through `AsyncLimit`; for example:

```
cos_put_options: '{"SliceSize":1048576,"AsyncLimit":3}'
```

### 并发上传 Concurrent uploads

可以通过`cos_init_options`设置`FileParallelLimit`打开并发上传功能。例如：

You can enable concurrent uploads by setting `FileParallelLimit` in `cos_init_options`. For example:

```
cos_init_options: '{"FileParallelLimit":3}'

```

### 使用临时密钥 Using temporary key

当[使用临时密钥](https://cloud.tencent.com/document/product/1312/48195)时，需要授权**所有**你要用到的功能权限：

| 功能 | 权限 |
| --- | --- |
| 基础功能 | `cos:PutObject` `cos:DeleteObject` `cos:GetBucket` `cos:HeadObject` |
| 普通 CDN | `cdn:PurgePathCache` `cdn:PurgeUrlsCache` `cdn:DescribePurgeTasks` |
| EdgeOne CDN | `teo:CreatePurgeTask` `teo:DescribePurgeTasks` |
| 分块上传（有大文件的时候需要） | `cos:InitiateMultipartUpload` `cos:ListMultipartUploads` `cos:ListParts` `cos:UploadPart` `cos:CompleteMultipartUpload` |

When [using a temporary key](https://www.tencentcloud.com/document/product/1150/49452), you need to authorize **all** the function permissions you want to use:

| Function | Permission |
| --- | --- |
| Basic functions | `cos:PutObject` `cos:DeleteObject` `cos:GetBucket` `cos:HeadObject` |
| Normal CDN | `cdn:PurgePathCache` `cdn:PurgeUrlsCache` `cdn:DescribePurgeTasks` |
| EdgeOne CDN | `teo:CreatePurgeTask` `teo:DescribePurgeTasks` |
| Multi-part upload (required for large files) | `cos:InitiateMultipartUpload` `cos:ListMultipartUploads` `cos:ListParts` `cos:UploadPart` `cos:CompleteMultipartUpload` |
