const mz = require('mz/fs');
const recursive = require('recursive-readdir');

const {JSDOM} = require('jsdom');
const elasticlunr = require('elasticlunr');

const abbreviations = require('../config/filename-to-abbreviation.json');
const titles = require('../config/titles.json');

const PLAY_DIR = 'plays-ps';
const POEM_DIR = 'poems-ps';
const TEXTS_DIR = '../texts/';

const DOCS_FILE = '../client/data/docs.json';
const CREATE_DOCS_FILE = true;
const INDEX_FILE = '../client/data/index.json';
const DATALISTS_FILE = '../client/data/datalists.json';

var docs = [];
var docNum = 0;
var genders = {};
var numFilesToProcess = 0;
var speakers = [];

// Parse each XML file in the directories containing play and poem texts
recursive(TEXTS_DIR).then(filepaths => {
  filepaths = filepaths.filter(filename => {
    return filename.match(/.+xml/); // filter out .DS_Store, etc.
  });
  numFilesToProcess = filepaths.length;
  for (const filepath of filepaths) {
    addDocs(filepath);
  }
}).catch(error => console.error(`Error reading from ${TEXTS_DIR}:`, error));

function addDocs(filepath) {
  console.time('Parse texts');
  JSDOM.fromFile(filepath, {contentType: 'text/xml'})
    .then(dom => {
      const filename = filepath.split('/').pop();
      const document = dom.window.document;
      if (filepath.includes(PLAY_DIR)) {
        addPlay(filename, document);
      } else if (filepath.includes(POEM_DIR)) {
        addPoem(filename, document);
      } else {
        console.error(`Unexpected filepath ${filepath}`);
        return;
      }
      console.log(`${numFilesToProcess} files to process`);
      if (--numFilesToProcess === 0) {
        console.timeEnd('Parse texts');
        if (CREATE_DOCS_FILE) {
          writeFile(DOCS_FILE, JSON.stringify(docs));
          console.log(`Created docs file`);
        }
        console.time(`Index ${docs.length} docs`);
        createIndex(docs);
        createDatalists();
        console.timeEnd(`Index ${docs.length} docs`);
      }
    }).catch(error => {
      console.log(`Error creating DOM from ${filepath}`, error);
    });
}

function addPlay(filename, document) {
  addSpeakers(document);
  // getElementsByTagName is slightly faster than querySelector[All]
  const play = document.getElementsByTagName('play')[0];
  const playAbbreviation = abbreviations[filename];
  const acts = play.getElementsByTagName('act');
  for (let actIndex = 0; actIndex !== acts.length; ++actIndex) {
    const act = acts[actIndex];
    const scenes = act.getElementsByTagName('scene');
    for (let sceneIndex = 0; sceneIndex !== scenes.length; ++sceneIndex) {
      let lineIndex = 0;
      const scene = scenes[sceneIndex];
      const location = `${playAbbreviation}.${actIndex}.${sceneIndex}`;
      const sceneTitle = scene.getElementsByTagName('scenetitle')[0];
      // r signifies 'role', 't' signifies scene title (only one, so no index)
      addDoc(location, sceneTitle.textContent, {r: 't'});
      const stagedirs = scene.getElementsByTagName('stagedir');
      let stagedirIndex = 0; // index for finding stage direction within scene
      for (const stagedir of stagedirs) {
        // r signifies 'role', 's' signifies stage direction, i is index
        addDoc(location, stagedir.textContent, {r: 's', i: stagedirIndex++});
      }
      const speeches = scene.getElementsByTagName('speech');
      for (const speech of speeches) {
        const speaker = speech.getElementsByTagName('speaker')[0].
          getAttribute('long');
        const lines = speech.getElementsByTagName('line');
        // stage directions are added separately above, even if within a speech
        for (const line of lines) {
          addDoc(`${location}.${lineIndex++}`,
            fix(line.textContent), {s: speaker, g: genders[speaker]});
        }
      }
    }
  }
}

function addSpeakers(document) {
  const personas = document.getElementsByTagName('persona');
  for (const persona of personas) {
    let speaker = {};
    speaker.gender = persona.getAttribute('gender');
    const persname = persona.firstElementChild;
    speaker.name = persname.textContent;
    speakers.push(speaker);
    genders[speaker.name] = speaker.gender;
  }
}

function addPoem(filename, document) {
  const poemAbbreviation = abbreviations[filename];
  if (poemAbbreviation === 'Son') {
    // sonnet file includes multiple poems
    addSonnets(document);
  } else {
    addSinglePoem(document, poemAbbreviation);
  }
}

function addSinglePoem(document, poemAbbreviation) {
  const poembody = document.getElementsByTagName('poembody')[0];
  const lines = poembody.getElementsByTagName('line');
  for (let i = 0; i !== lines.length; ++i) {
    addDoc(`${poemAbbreviation}.${i}`, fix(lines[i].textContent));
  }
}

function addSonnets(document) {
  const sonnets = document.getElementsByTagName('sonnet');
  for (let i = 0; i !== sonnets.length; ++i) {
    const sonnet = sonnets[i];
    const lines = sonnet.getElementsByTagName('line');
    for (let j = 0; j !== lines.length; ++j) {
      addDoc(`Son.${i}.${j}`, lines[j].textContent);
    }
  }
}

// Each 'document' in the data store is a line from a play or poem
// or a stage direction or scene description
function addDoc(location, text, options) {
  let doc = {
    // n is the ID of the document: a number in base 36
    n: (docNum++).toString(36), // base 36 to minimise length/storage of n
    l: location,
    t: text
  };
  if (options) {
    for (const key in options) {
      doc[key] = options[key];
    }
  }
  docs.push(doc);
}

function createIndex() {
  const index = elasticlunr(function() {
    // this.addField('l'); // e.g. Ant.1.2.34
    // this.addField('s'); // speaker name
    this.addField('t'); // text of line, stage direction or scene title
    this.setRef('n'); // index of indexed item
    this.saveDocument(true); // include data with index
    for (let doc of docs) {
      this.addDoc(doc);
    }
  });
  writeFile(INDEX_FILE, JSON.stringify(index));
  // Optional: write sample docs file (for testing only)
  // const numDocs = 100;
  // const someDocs = docs.sort(function() {
  //   return 0.5 - Math.random();
  // }).slice(0, numDocs - 1);
  // writeFile(DOCS_FILE, JSON.stringify(someDocs));
}

function createDatalists() {
  const datalists = {
    titles: titles,
    speakers: speakers.sort()
  };
  writeFile(DATALISTS_FILE, JSON.stringify(datalists));
}

function writeFile(filepath, string) {
  mz.writeFile(filepath, string, error => {
    if(error) {
      return console.error(error);
    }
    console.log(`The file ${filepath} was saved!`);
  });
}

function fix(text) {
  return text.
    replace('&c', 'etc.').
    replace(/,--/g, ' — ').
    replace(/--/g, ' — ').
    replace(/, —/g, ' — ').
    replace(/'/g, '’'); // all straight single quotes should be apostrophes
}

// function toTitleCase(string) {
//   return string.toLowerCase().split(' ').map(function(item) {
//     return item.replace(item[0], item[0].toUpperCase());
//   }).join(' ');
// }
