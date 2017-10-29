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

/* global elasticlunr */

const queryInput = document.getElementById('query');
// Search for products whenever query input text changes
queryInput.oninput = doSearch;

const SEARCH_OPTIONS = {
  fields: {
    t: {boost: 10},
    s: {boost: 1}
  },
  bool: 'OR',
  expand: true // true: do not require whole-word matches only
};

var index;
var matches;

const INDEX_FILE = 'data/index.json';

if (navigator.serviceWorker) {
  navigator.serviceWorker.register('sw.js').catch(function(error) {
    console.error('Unable to register service worker.', error);
  });
}

// Get index data and load index
console.log('Fetching index...');
console.time('Fetch index');
fetch(INDEX_FILE).then(response => {
  return response.json();
}).then(json => {
  console.timeEnd('Fetch index');
  // elasticlunr.clearStopWords = function() {
  //   elasticlunr.stopWordFilter.stopWords = {};
  // };
  console.log('Loading index...');
  console.time('Load index');
  index = elasticlunr.Index.load(json);
  console.timeEnd('Load index');
  queryInput.disabled = false;
  queryInput.focus();
});

// Search for products whenever query input text changes
queryInput.oninput = doSearch;

function doSearch() {
  const query = queryInput.value;
  if (query.length < 2) {
    return;
  }

  console.time('Do search');
  matches = window.matches = index.search(query, SEARCH_OPTIONS);
  console.clear();
  console.log('matches', matches);
  console.timeEnd('Do search');
}

