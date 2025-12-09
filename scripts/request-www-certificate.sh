#!/bin/bash

# Script to request ACM certificate for garmaxai.com with www subdomain
# Run this script after configuring AWS credentials

set -e

echo "=== Requesting ACM Certificate for garmaxai.com + www.garmaxai.com ==="
echo ""

# Request certificate
CERT_ARN=$(aws acm request-certificate \
  --domain-name garmaxai.com \
  --subject-alternative-names www.garmaxai.com \
  --validation-method DNS \
  --region us-east-1 \
  --query 'CertificateArn' \
  --output text)

echo "✓ Certificate requested successfully!"
echo "Certificate ARN: $CERT_ARN"
echo ""

# Get certificate ID from ARN
CERT_ID=$(echo $CERT_ARN | sed 's/.*certificate\///')
echo "Certificate ID: $CERT_ID"
echo ""

# Wait a moment for DNS validation records to be generated
echo "Waiting for validation records to be generated..."
sleep 3

# Get validation CNAME records
echo "=== DNS Validation Records Required ==="
echo ""
aws acm describe-certificate \
  --certificate-arn "$CERT_ARN" \
  --region us-east-1 \
  --query 'Certificate.DomainValidationOptions[*].[DomainName,ResourceRecord.Name,ResourceRecord.Value]' \
  --output table

echo ""
echo "=== Next Steps ==="
echo "1. Add the CNAME records shown above to Route53 hosted zone 'garmaxai.com'"
echo "2. Wait for certificate validation (usually 5-30 minutes)"
echo "3. Update parameters/PROD.ts with the new certificate ID:"
echo "   AcmCert: { \"us-east-1\": { id: \"$CERT_ARN\" } }"
echo "4. Run: cd iac && STAGE=prod npx cdk deploy GarmaxAi-Frontend-prod"
echo ""
echo "To check certificate status:"
echo "aws acm describe-certificate --certificate-arn $CERT_ARN --region us-east-1 --query 'Certificate.Status'"
