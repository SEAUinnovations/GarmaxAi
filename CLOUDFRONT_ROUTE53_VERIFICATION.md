# CloudFront & Route53 Configuration Checklist

## Changes Made

### 1. CloudFront Distribution Updates
- ✅ Upgraded from OAI to OAC (Origin Access Control)
- ✅ Added alternate domain names: `garmaxai.com` AND `www.garmaxai.com`
- ✅ Certificate attached for HTTPS
- ✅ IPv6 enabled

### 2. Route53 DNS Records
- ✅ Fixed A record (removed invalid TTL parameter)
- ✅ Added AAAA record for IPv6 support  
- ✅ Added www.garmaxai.com A record
- ✅ Added www.garmaxai.com AAAA record for IPv6

### 3. S3 Bucket Policy
- ✅ OAC bucket policy script created
- ✅ Integrated into CI/CD pipeline

## Post-Deployment Verification

After deploying these changes, verify the following in AWS Console:

### CloudFront Distribution
1. Go to CloudFront → Distributions
2. Find the production distribution
3. Check **Alternate Domain Names (CNAMEs)**:
   - Should include: `garmaxai.com`
   - Should include: `www.garmaxai.com`
4. Check **Origin** settings:
   - Should show "Origin access control" (not "Origin access identity")
   - OAC name should be visible

### Route53 Hosted Zone
1. Go to Route53 → Hosted zones → garmaxai.com
2. Verify these records exist:
   - `garmaxai.com` A record → Alias to CloudFront
   - `garmaxai.com` AAAA record → Alias to CloudFront  
   - `www.garmaxai.com` A record → Alias to CloudFront
   - `www.garmaxai.com` AAAA record → Alias to CloudFront

### SSL Certificate
1. Go to ACM (Certificate Manager) → Certificates
2. Verify certificate `arn:aws:acm:us-east-1:920792187297:certificate/afaf817e-cc40-49d6-9d67-c877b5a008ad`
3. Check **Domain names**:
   - Should include: `garmaxai.com`
   - Should include: `www.garmaxai.com`
   - Status should be "Issued"

### S3 Bucket Policy
1. Go to S3 → Buckets → garmaxai-frontend-prod (or similar)
2. Check **Permissions** → **Bucket Policy**
3. Should contain:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Sid": "AllowCloudFrontServicePrincipalReadOnly",
       "Effect": "Allow",
       "Principal": { "Service": "cloudfront.amazonaws.com" },
       "Action": "s3:GetObject",
       "Resource": "arn:aws:s3:::BUCKET_NAME/*",
       "Condition": {
         "StringEquals": {
           "AWS:SourceArn": "arn:aws:cloudfront::920792187297:distribution/DISTRIBUTION_ID"
         }
       }
     }]
   }
   ```

## Manual Fix (if needed immediately)

If garmaxai.com is still not accessible after deployment:

```bash
# 1. Update S3 bucket policy for OAC
cd /Users/supremeod/Repos/GarmaxAi
STAGE=prod AWS_REGION=us-east-1 ./scripts/update-oac-bucket-policy.sh

# 2. Verify CloudFront has alternate domains
aws cloudfront get-distribution \
  --id $(aws cloudformation describe-stacks \
    --stack-name GarmaxAi-Frontend-prod \
    --query "Stacks[0].Outputs[?OutputKey=='FrontendDistributionId'].OutputValue" \
    --output text) \
  --query "Distribution.DistributionConfig.Aliases.Items"

# Should output: ["garmaxai.com", "www.garmaxai.com"]
```

## Testing

After deployment, test these URLs:
- ✅ https://garmaxai.com
- ✅ https://www.garmaxai.com  
- ✅ http://garmaxai.com (should redirect to HTTPS)
- ✅ http://www.garmaxai.com (should redirect to HTTPS)

All should load the application successfully.
