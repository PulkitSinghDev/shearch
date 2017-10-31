/*
Copyright 2017 Google Inc.

Licensed under the Apache License, Version 2.0 (the 'License');
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an 'AS IS' BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

'use strict';

/* global lunr */

const queryInput = document.getElementById('query');
// Search for products whenever query input text changes
queryInput.oninput = doSearch;
const resultsDiv = document.getElementById('results');

var docs;
var index;

const INDEX_AND_DOCS = 'data/index-and-docs.json';

// if (navigator.serviceWorker) {
//   navigator.serviceWorker.register('sw.js').catch(function(error) {
//     console.error('Unable to register service worker.', error);
//   });
// }

// Fetch and load index
console.log('Fetching index and docs...');
console.time('Fetch index and docs');
fetch(INDEX_AND_DOCS).then(response => {
  return response.json();
}).then(json => {
  console.timeEnd('Fetch index and docs');
  console.time('Load index');
  index = lunr.Index.load(json.index);
  docs = json.docs;
  console.timeEnd('Load index');
  queryInput.disabled = false;
  queryInput.focus();
});

// Search for products whenever query input text changes
queryInput.oninput = doSearch;

function doSearch() {
  resultsDiv.textContent = '';
  console.clear();
  const query = queryInput.value;
  if (query.length < 2) {
    return;
  }

  console.time('Do search');
  const matches = index.search(query);
  // matches is an array of items with refs (IDs) and scores
  if (matches.length > 0) {
    displayMatches(matches, query);
  }
  console.timeEnd('Do search');
}

function displayMatches(matches, query) {
  let results = [];
  for (const match of matches) {
    results.push(docs[match.ref]);
  }
  console.log(query);
  results.sort(function(x, y) {
    return x.t.includes(query) ? -1 : y.t.includes(query) ? 1 : 0;
  });
  for (const result of results) {
    addResult(result);
  }
}

function addResult(match) {
  const resultElement = document.createElement('div');
  resultElement.classList.add('match');
  resultElement.appendChild(document.createTextNode(match.t));
  resultElement.onclick = function() {
    console.log(match.id);
  };
  resultsDiv.appendChild(resultElement);
}

