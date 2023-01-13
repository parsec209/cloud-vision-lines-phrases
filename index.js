const getBatchFileAnnotationWordList = (batchFileAnnotation) => {
  const wordList = { pages: [] };
  batchFileAnnotation.forEach((response) => {
    const wordListPage = { width: null, height: null, words: [] };
    const { fullTextAnnotation } = response;
    // fullTextAnnotation will be null for a document page with no text.
    if (fullTextAnnotation) {
      fullTextAnnotation.pages.forEach((page) => {
        wordListPage.width = page.width;
        wordListPage.height = page.height;
        page.blocks.forEach((block) => {
          block.paragraphs.forEach((paragraph) => {
            paragraph.words.forEach((word) => {
              wordListPage.words.push(word);
            });
          });
        });
      });
    }
    wordList.pages.push(wordListPage);
  });
  return wordList;
};

const comparePositionOfTwoWords = (annotationWordVerticesA, annotationWordVerticesB) => {
  /* eslint-disable comma-spacing */
  const [{ x: xTopLeftA, y: yTopLeftA }, , { y: yBottomRightA }, ,] = annotationWordVerticesA;
  const [{ x: xTopLeftB, y: yTopLeftB }, , { y: yBottomRightB }, ,] = annotationWordVerticesB;
  const wordAMidpoint = (yTopLeftA + yBottomRightA) / 2;
  if (yBottomRightB > wordAMidpoint) {
    if (yTopLeftB < wordAMidpoint) {
      if (xTopLeftA - xTopLeftB < 0) {
        return { isSameLine: true, sortValue: -1 };
      }
      return { isSameLine: true, sortValue: 1 };
    }
    return { isSameLine: false, sortValue: -1 };
  }
  return { isSameLine: false, sortValue: 1 };
};

const sortBatchFileAnnotationWordList = (wordList) => {
  const firstWord = wordList.pages[0].words[0];
  // Only sort if there is text in file.
  if (firstWord) {
    const vertexType = firstWord.boundingBox.vertices.length ? 'vertices' : 'normalizedVertices';
    wordList.pages.forEach((page) => {
      page.words.sort((a, b) => {
        const verticesA = a.boundingBox[vertexType];
        const verticesB = b.boundingBox[vertexType];
        const { sortValue } = comparePositionOfTwoWords(verticesA, verticesB);
        return sortValue;
      });
    });
  }
};

const getLineWordTemplate = () => {
  const wordTemplate = {
    symbols: [],
    boundingBox: {
      vertices: [],
      normalizedVertices: [],
    },
    text: '',
  };
  for (let i = 0; i < 4; i++) { // eslint-disable-line no-plusplus
    wordTemplate.boundingBox.vertices.push({ x: [], y: [] });
    wordTemplate.boundingBox.normalizedVertices.push({ x: [], y: [] });
  }
  return wordTemplate;
};

const getLineWords = (annotationWords, pageWidth, pageHeight) => {
  let lineWord = getLineWordTemplate();
  const lineWords = [lineWord];
  // Two annotation words that have no space between them are merged into a single line word.
  annotationWords.forEach((word, i) => {
    lineWord.text += word.symbols.map((symbol) => symbol.text).join('');
    lineWord.symbols.push(...word.symbols);
    const vertexType = word.boundingBox.vertices.length ? 'vertices' : 'normalizedVertices';
    const wordVertices = word.boundingBox[vertexType];
    const lineWordVertices = lineWord.boundingBox[vertexType];

    wordVertices.forEach((vertex, j) => {
      lineWordVertices[j].x.push(vertex.x);
      lineWordVertices[j].y.push(vertex.y);
    });

    const lastSymbol = word.symbols[word.symbols.length - 1];
    const space = lastSymbol.property && lastSymbol.property.detectedBreak;
    if (space) {
      // These calculations ensure a line word's bounding box will always be rectangle.
      lineWordVertices[0].x = Math.min(...lineWordVertices[0].x, ...lineWordVertices[3].x);
      lineWordVertices[0].y = Math.min(...lineWordVertices[0].y, ...lineWordVertices[1].y);

      lineWordVertices[2].x = Math.max(...lineWordVertices[1].x, ...lineWordVertices[2].x);
      lineWordVertices[2].y = Math.max(...lineWordVertices[2].y, ...lineWordVertices[3].y);

      lineWordVertices[1].x = lineWordVertices[2].x;
      lineWordVertices[1].y = lineWordVertices[0].y;

      lineWordVertices[3].x = lineWordVertices[0].x;
      lineWordVertices[3].y = lineWordVertices[2].y;

      if (vertexType === 'normalizedVertices') {
        lineWord.boundingBox.vertices = lineWordVertices.map((vertex) => ({ x: vertex.x * pageWidth, y: vertex.y * pageHeight }));
      } else {
        lineWord.boundingBox.normalizedVertices = lineWordVertices.map((vertex) => ({ x: vertex.x / pageWidth, y: vertex.y / pageHeight }));
      }
      if (annotationWords[i + 1]) {
        lineWord = getLineWordTemplate();
        lineWords.push(lineWord);
      }
    }
  });
  return lineWords;
};

const getPhraseTemplate = () => {
  const phraseTemplate = {
    words: [],
    boundingBox: {
      vertices: [],
      normalizedVertices: [],
    },
    text: '',
  };
  return phraseTemplate;
};

const isPhraseBreakBetweenWords = (lineWordVerticesA, lineWordVerticesB) => {
  const [{ y: yTopLeftA }, { x: xTopRightA }, , { y: yBottomLeftA }] = lineWordVerticesA;
  const [{ x: xTopLeftB }] = lineWordVerticesB;
  const space = xTopLeftB - xTopRightA;
  const wordAHeight = yBottomLeftA - yTopLeftA;
  if (space < wordAHeight) {
    return false;
  }
  return true;
};

const getPhraseBoundingBox = (lineWords, pageWidth, pageHeight) => {
  const xLeft = lineWords[0].boundingBox.vertices[0].x;
  const xRight = lineWords[lineWords.length - 1].boundingBox.vertices[1].x;
  const yTop = Math.min(...lineWords.map((word) => word.boundingBox.vertices[0].y));
  const yBottom = Math.max(...lineWords.map((word) => word.boundingBox.vertices[3].y));
  const vertices = [
    { x: xLeft, y: yTop },
    { x: xRight, y: yTop },
    { x: xRight, y: yBottom },
    { x: xLeft, y: yBottom },
  ];
  const normalizedVertices = vertices.map((vertex) => ({ x: vertex.x / pageWidth, y: vertex.y / pageHeight }));
  return { vertices, normalizedVertices };
};

const getPhrases = (lineWords, pageWidth, pageHeight) => {
  const phrases = [];
  let phrase = getPhraseTemplate();
  lineWords.forEach((word, i) => {
    phrase.words.push(word);
    phrase.text += word.text;
    const nextWord = lineWords[i + 1];
    if (nextWord
      && !isPhraseBreakBetweenWords(word.boundingBox.vertices, nextWord.boundingBox.vertices)) {
      phrase.text += ' ';
      return;
    }
    phrase.boundingBox = getPhraseBoundingBox(phrase.words, pageWidth, pageHeight);
    phrases.push(phrase);
    phrase = getPhraseTemplate();
  });
  return phrases;
};

const getLineList = (annotationWordList) => {
  const lineList = { pages: [] };
  annotationWordList.pages.forEach((wordListPage) => {
    const { width, height } = wordListPage;
    const lineListPage = { lines: [] };
    let sameLineWords = [];
    wordListPage.words.forEach((word, i) => {
      sameLineWords.push(word);
      const nextWord = wordListPage.words[i + 1];
      if (nextWord) {
        const vertexType = word.boundingBox.vertices.length ? 'vertices' : 'normalizedVertices';
        const currentVertices = word.boundingBox[vertexType];
        const nextVertices = nextWord.boundingBox[vertexType];
        const { isSameLine } = comparePositionOfTwoWords(currentVertices, nextVertices);
        if (isSameLine) {
          return;
        }
      }
      const lineWords = getLineWords(sameLineWords, width, height);
      const line = { phrases: getPhrases(lineWords, width, height) };
      lineListPage.lines.push(line);
      sameLineWords = [];
    });
    lineList.pages.push(lineListPage);
  });
  return lineList;
};

const getLineListText = (lineList) => {
  let text = '';
  lineList.pages.forEach((page) => {
    page.lines.forEach((line) => {
      line.phrases.forEach((phrase) => {
        text += `${phrase.text}\n`;
      });
    });
  });
  return text;
};

const getAnnotationFormats = (batchFileAnnotation, bucketFileBasename) => {
  const wordList = getBatchFileAnnotationWordList(batchFileAnnotation);
  sortBatchFileAnnotationWordList(wordList);
  const lineList = getLineList(wordList);
  const lineListText = getLineListText(lineList);
  const annotationFormats = {
    filename: bucketFileBasename,
    batchFileAnnotation,
    lineList,
    lineListText,
  };
  return annotationFormats;
};

module.exports = getAnnotationFormats;
