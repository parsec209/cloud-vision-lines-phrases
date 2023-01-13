const fs = require('fs');
const getAnnotationFormats = require('../index');

const files = [
  [{ annotations: 'GIF.json', originalFilename: 'GIF.GIF' }],
  [{ annotations: 'PDF_image.json', originalFilename: 'PDF_image.pdf' }],
  [{ annotations: 'PDF_searchable.json', originalFilename: 'PDF_searchable.pdf' }],
  [{ annotations: 'blank.json', originalFilename: 'blank.tiff' }],
  [{ annotations: 'TIF.json', originalFilename: 'TIF.tif' }],
  [{ annotations: 'TIFF.json', originalFilename: 'TIFF.tiff' }],
];

describe('getting annotation formats', () => {
  const getTestData = (fileData) => {
    const batchFileAnnotationBuffer = fs.readFileSync(`${__dirname}/batchFileAnnotations/${fileData.annotations}`);
    const batchFileAnnotation = JSON.parse(batchFileAnnotationBuffer);
    const expectedAnnotationsBuffer = fs.readFileSync(`${__dirname}/formattedAnnotations/${fileData.annotations}`);
    const expectedAnnotations = JSON.parse(expectedAnnotationsBuffer);
    const { originalFilename } = fileData;
    const testData = { batchFileAnnotation, expectedAnnotations, originalFilename };
    return testData;
  };
  test.each(files)('confirms JSON response is identical to its associated seed file', async (fileData) => {
    const { batchFileAnnotation, expectedAnnotations, originalFilename } = getTestData(fileData);
    const receivedAnnotation = await getAnnotationFormats(batchFileAnnotation, originalFilename);
    expect(receivedAnnotation).toStrictEqual(expectedAnnotations);
  });
});
