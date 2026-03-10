const textExtractionService = require('../textExtractionService');

// stub mammoth to avoid pulling in the real library during tests and to allow
// us to assert that the correct type of data is provided.
jest.mock('mammoth', () => ({
  extractRawText: jest.fn(({ buffer }) => {
    // echo back the type for assertions
    return Promise.resolve({ value: `got-${Buffer.isBuffer(buffer) ? 'buffer' : typeof buffer}` });
  })
}));

describe('textExtractionService', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('converts a plain object (serialized Buffer) to a real Buffer before
calling mammoth', async () => {
    const fake = { type: 'Buffer', data: [0x50, 0x4b, 0x03, 0x04] }; // start of a zip
    const result = await textExtractionService.extractText({
      buffer: fake,
      fileType: 'docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    expect(result).toContain('got-buffer');
    const mammoth = require('mammoth');
    expect(mammoth.extractRawText).toHaveBeenCalled();
    const arg = mammoth.extractRawText.mock.calls[0][0];
    expect(Buffer.isBuffer(arg.buffer)).toBe(true);
  });

  it('accepts an ArrayBuffer/Uint8Array and treats it as buffer', async () => {
    const uint = new Uint8Array([0x50, 0x4b]);
    const result = await textExtractionService.extractText({
      buffer: uint,
      fileType: 'docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
    expect(result).toContain('got-buffer');
    const mammoth = require('mammoth');
    const arg = mammoth.extractRawText.mock.calls[0][0];
    expect(Buffer.isBuffer(arg.buffer)).toBe(true);
  });
});