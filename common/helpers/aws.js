const AWS = require('aws-sdk');

const configCredential = require('../../server/config/env-service');

const s3 = new AWS.S3({
  apiVersion: 'lastest',
  region: 'ap-southeast-1',
  credentials: configCredential.awsCredentials,
});

function uploadToS3(Bucket, Key, Body, ContentType, ContentEncoding, ACL) {
  const params = {
    ACL: 'authenticated-read',
    Bucket,
    Key,
    Body,
    ContentType,
  };
  if (ContentEncoding) params.ContentEncoding = ContentEncoding;
  if (ACL) params.ACL = ACL;
  return s3.putObject(params).promise();
}

module.exports = {
  s3,
  uploadToS3,
};
