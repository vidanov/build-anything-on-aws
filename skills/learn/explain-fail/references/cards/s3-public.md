# Card: s3-public

Rule: no bucket is public. CloudFront reads the bucket through Origin Access Control.
Why: a public bucket is the most common AWS data leak. Block Public Access stops a later policy or ACL from opening it by mistake.
Gate: guard secure-defaults `s3_block_public_access`, cdk-nag AwsSolutions-S2.
Fix: `blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL`; serve through `origins.S3BucketOrigin.withOriginAccessControl(bucket)`.
WA: SEC03 manage permissions.
Check yourself: why can the browser still load the site if the bucket is private?
