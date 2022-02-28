# Tencent Cloud COS and CDN action

This action can upload files to tencent cloud COS, and flush CDN cache.

## Inputs

- secret_id(**Required**): Tencent cloud secret id. Should be referred to a encrypted environment variable
- secret_key(**Required**): Tencent cloud secret key. Should be referred to a encrypted environment variable
- cos_bucket(**Required**): COS bucket name
- cos_region(**Required**): COS bucket region
- cos_accelerate: Set to `true` for using accelerate domain to upload files. Default is false
- cdn_prefix: CDN url prefix if you are using Tencent cloud CDN. If is empty, this action will not flush CDN cache.
- local_path(**Required**): Local path to be uploaded to COS. Directory or file is allowed
- remote_path(**Required**): COS path to put the local files in on COS
- clean: Set to true for cleaning files on COS path which are not existed in local path. Default is false
