# Serverless Web Publisher to S3/CloudFront

In this example WebProducer is deployed as an AWS Lambda function and triggered by a webhook from a headless CMS. The built artefacts are streamed to an S3 bucket behind CloudFront and then the CloudFront cache is invalidated.
