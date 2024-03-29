# cloud-vision-lines-phrases

Adds lines and phrases to the output generated by Google Cloud Vision's [small batch file annotation online](https://cloud.google.com/vision/docs/file-small-batch).

Within the generated object, the batch file annotation's words are sorted the same way you'd read text on a page (left to right across the page, then down to the next line). Closely-spaced words are grouped into phrases, and in turn, phrases within the same horizontal plane are grouped into lines. This output gives you additional flexibility with parsing the annotation, versus just using the out-of-the-box block formatting.

**Special note:** This package was not created by nor affiliated with Google; however, getting the desired result will require you
to setup and generate a batch file annotation from [@google-cloud/vision](https://www.npmjs.com/package/@google-cloud/vision).
The resulting batch file annotation will then be used as a parameter in the _cloud-vision-lines-phrases_ function.

To use custom parsers for retrieving text from this output, check out the [cloud-vision-lines-phrases-parser](https://www.npmjs.com/package/cloud-vision-lines-phrases-parser) package. There is also a demo UI in [CodeSandbox](https://githubbox.com/parsec209/cloud-vision-lines-phrases-parser-ui) that gives a visual representation of the generated output and allows the parsers to be tested out from the parsers package. Repo for the UI can be found [here](https://github.com/parsec209/cloud-vision-lines-phrases-parser-ui).

## Installation

```sh
$ npm install cloud-vision-lines-phrases
```

## Setup

Below is sample code borrowed from [Google's documentation](https://cloud.google.com/vision/docs/file-small-batch#storage-file). The batch file annotation
you return from this code will be used as one of the function paramaters shown in the [Use](#use) section. I have personally made a few modifications to the borrowed sample code, such as the function name, adding five parameters, and changing what the function returns.

```js
const { ImageAnnotatorClient } = require("@google-cloud/vision").v1;
const client = new ImageAnnotatorClient();

/**
 * @param {string} bucketName - Name of your Google Cloud Storage bucket
 * @param {string} bucketFilename - Full path to the file you will be scanning in the bucket
 * @param {string} bucketFileContentType - Accepted types: 'application/pdf', 'image/tiff', or 'image/gif'
 * @param {Array<number>} pagesToScan - [1, 2, etc.] Max five pages. First page starts at 1, Last page at -1
 * @param {string} language - To select English for instance, use 'en'
 * @returns {Array<Object>} - Batch file annotation (each document page is an object)
 */
const getBatchFileAnnotation = async (
  bucketName,
  bucketFilename,
  bucketFileContentType,
  pagesToScan,
  language
) => {
  const inputConfig = {
    mimeType: bucketFileContentType,
    gcsSource: {
      uri: `gs://${bucketName}/${bucketFilename}`,
    },
  };
  const features = [{ type: "DOCUMENT_TEXT_DETECTION" }];

  const fileRequest = {
    inputConfig: inputConfig,
    features: features,
    pages: pagesToScan,
    imageContext: {
      languageHints: [language],
    },
  };

  const request = {
    requests: [fileRequest],
  };

  const [result] = await client.batchAnnotateFiles(request);
  const { responses } = result.responses[0];
  return responses;
};
```

## Use

The _responses_ from the previous code is the batch file annotation, and you can read more about the objects contained within it [here](https://cloud.google.com/vision/docs/reference/rest/v1/AnnotateImageResponse). Just use this value as the first paramater in the _getAnnotationFormats_ function to get the desired object containing the lines and phrases:

```js
const getAnnotationFormats = require("cloud-vision-lines-phrases");

const batchFileAnnotation = await getBatchFileAnnotation(
  bucketName,
  bucketFilename,
  bucketFileContentType,
  pagesToScan,
  language
);
const bucketFileBasename =
  "(Optional) The original filename that was scanned in the bucket.";

const annotationFormats = getAnnotationFormats(
  batchFileAnnotation,
  bucketFileBasename
);
```

You can see example _annotationFormats_ [here](https://github.com/parsec209/cloud-vision-lines-phrases/tree/main/test/formattedAnnotations), as well as their original image files [here](https://github.com/parsec209/cloud-vision-lines-phrases/tree/main/test/originalFiles).  
The annotationFormats object includes Google's unaltered batch file annotation ("batchFileAnnotation"), the original filename of the scanned file ("filename"), the newly-generated line list ("lineList"), and a single string of the line list's text with new line characters separating each phrase ("lineListText").

## Examples

_annotationFormats_ object :

```js
{
  filename: 'filename.pdf',
  batchFileAnnotation: ['...'],
  lineList: {
    pages: ['...']
  },
  lineListText: 'phrase1\nphrase2\nphrase3\n etc...'
}

```

_lineList_ property from annotationFormats object:

```js
lineList: {
  pages: [
    {
      lines: [
        {
          phrases: [
            {
              boundingBox: {
                vertices: ['...'],
                normalizedVertices: ['...']
              },
              text: 'phraseText',
              words: [
                boundingBox: {
                  vertices: ['...'],
                  normalizedVertices: ['...']
                },
                text: 'wordText'
                symbols: [
                  property: null,
                  boundingBox: null,
                  text: 'symbolText',
                  confidence: 0.9
                ],
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

A _symbol_ is a single character, and these objects are not modified from those contained in the original batch file annotation.

A _word_ is a group of one or more symbols on the same horizontal plane that contain no spaces between them. In some cases, the batch file annotation will have multiple adjacent word objects with no spaces between them, particularly when the word itself is comprised of only one special character. However, within the line list, in the interest of consistency, if the symbols do not have a space between them they will always comprise the same word (regardless of the type of characters).

A _phrase_ is a group of one or more words on the same horizontal plane that contain no more than one space between them.

A _line_ contains all the phrases that exist on the same horizontal plane.

Note that both _vertices_ and _normalizedVertices_ are calculated for _phrases_ and _words_ (but not _symbols_) within the line list.

What constitutes a single space and a horizontal plane within an image file is not always an exact science; however, you will find that the output will suffice the vast majority of the time.
