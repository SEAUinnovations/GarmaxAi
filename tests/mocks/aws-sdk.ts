// Mock AWS SDK implementation for testing
export const mockS3 = {
  upload: jest.fn().mockResolvedValue({ 
    Location: 'https://mock-s3-url.com/image.jpg',
    ETag: '"mock-etag"',
    Bucket: 'test-bucket',
    Key: 'test-key'
  }),
  deleteObject: jest.fn().mockResolvedValue({}),
  getSignedUrl: jest.fn().mockResolvedValue('https://mock-presigned-url.com'),
  getObject: jest.fn().mockResolvedValue({
    Body: Buffer.from('mock file content'),
    ContentType: 'image/jpeg'
  }),
};

export const mockSES = {
  sendEmail: jest.fn().mockResolvedValue({ 
    MessageId: 'mock-message-id-' + Date.now()
  }),
  sendTemplatedEmail: jest.fn().mockResolvedValue({
    MessageId: 'mock-template-message-id-' + Date.now()
  }),
};

export const mockEventBridge = {
  putEvents: jest.fn().mockResolvedValue({
    Entries: [{ EventId: 'mock-event-id-' + Date.now() }],
    FailedEntryCount: 0
  }),
};

export const mockSQS = {
  sendMessage: jest.fn().mockResolvedValue({
    MessageId: 'mock-sqs-message-id-' + Date.now(),
    MD5OfBody: 'mock-md5-hash'
  }),
  receiveMessage: jest.fn().mockResolvedValue({
    Messages: []
  }),
  deleteMessage: jest.fn().mockResolvedValue({}),
};

export const mockRekognition = {
  detectFaces: jest.fn().mockResolvedValue({
    FaceDetails: [
      {
        BoundingBox: { Width: 0.5, Height: 0.7, Left: 0.25, Top: 0.15 },
        Confidence: 99.5,
        Landmarks: []
      }
    ]
  }),
  detectLabels: jest.fn().mockResolvedValue({
    Labels: [
      { Name: 'Person', Confidence: 99.0 },
      { Name: 'Clothing', Confidence: 95.0 }
    ]
  }),
};

export const mockSSM = {
  getParameter: jest.fn().mockResolvedValue({
    Parameter: {
      Name: '/test/parameter',
      Value: JSON.stringify({ test: 'value' }),
      Version: 1
    }
  }),
  putParameter: jest.fn().mockResolvedValue({
    Version: 2
  }),
};

export const mockDynamoDB = {
  getItem: jest.fn().mockResolvedValue({
    Item: {
      id: { S: 'test-id' },
      data: { S: 'test-data' }
    }
  }),
  putItem: jest.fn().mockResolvedValue({}),
  updateItem: jest.fn().mockResolvedValue({
    Attributes: {
      id: { S: 'test-id' },
      updatedAt: { S: new Date().toISOString() }
    }
  }),
  deleteItem: jest.fn().mockResolvedValue({}),
};

// Default export for compatibility
export default {
  S3: jest.fn(() => mockS3),
  SES: jest.fn(() => mockSES),
  EventBridge: jest.fn(() => mockEventBridge),
  SQS: jest.fn(() => mockSQS),
  Rekognition: jest.fn(() => mockRekognition),
  SSM: jest.fn(() => mockSSM),
  DynamoDB: jest.fn(() => mockDynamoDB),
};