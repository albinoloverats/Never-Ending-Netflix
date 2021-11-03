let options = {};
chrome.runtime.onMessage.addListener(onMessage);

const MAX_TRIES_DISABLE_AUTO_PREVIEW = 5;
const MAX_TRIES_MONITOR_SKIP = 10;

function onMessage(message, sender, sendResponse) {
  if (message.action === 'optionsChanged') {
    options = message.options;
  }
}

$(_ => {
  loadOptions(receivedOptions => {
    options = receivedOptions;
    // It's a react app, so anytime they navigate away or to another title, we need to rehide/do all our options
    $('.main-header').on('click', '*', function () {
      startHelper();
    });
    startHelper();
  });
});

function startMonitoringForSelectors(selectors, numTries) {
  /*Mutation observer for skippable elements*/
  const monitor = new MutationObserver(_ => {
    let selector = selectors.join(', ');
    let elems = document.querySelectorAll(selector);
    for (const elem of elems) {
      let attribute = elem.getAttribute("aria-label");
      // If the "Watch Credits" option is selected, it'll click "Watch Credits". The button does not disappear, though,
      // and keeps getting pressed. We need to check if it has credits in it's aria, and remove the button if so
      if (attribute && attribute.indexOf("credits") !== -1) {
        elem.remove();
      } else if (attribute === "Skip Intro") {

        doClick(elem).then(_ => {
          doGetPlayButton();
        });

        function doClick(n) {
          return new Promise(function (resolve) {
            resolve(n.firstChild.click());
          });
        }

        function doGetPlayButton() {
          let evt = document.createEvent('Event');
          evt.initEvent('playEvent', true, false);
          // fire the event
          document.dispatchEvent(evt);
        }
      } else {
        elem.click();
      }
    }
    if (options.disableAutoPlayOnBrowse) {
      disableAutoPreview();
    }
  });

  let reactEntry = document.getElementById("appMountPoint");
  if (reactEntry) {
    /*Start monitoring at react's entry point*/
    monitor.observe(reactEntry, {
      attributes: false, // Don't monitor attribute changes
      childList: true, //Monitor direct child elements (anything observable) changes
      subtree: true // Monitor all descendants
    });
  } else {
    if (numTries > MAX_TRIES_MONITOR_SKIP) {
      return;
    }
    numTries++;
    setTimeout(_ => {
      startMonitoringForSelectors(selectors, numTries);
    }, 100 * numTries);
  }
}

function startHelper() {
  let selectors = [];

  if (options.skipTitleSequence) {
    enableSkipTitleSequence(selectors);
  }

  if (options.autoPlayNext) {
    enableAutoPlayNext(selectors);
  }

  if (options.skipStillHere) {
    /* Skip if still watching*/
    enableSkipStillHere(selectors);
  }

  if (options.hideDisliked) {
    hideDisliked();
  }

  if (options.watchCredits) {
    watchCredits(selectors);
  }

  if (options.disableAutoPlayOnBrowse) {
    let numTries = 0;
    disableAutoPreview(numTries);
  }

  startMonitoringForSelectors(selectors, 0);
}

function disableAutoPreview(numTries) {
  let billboard = document.querySelector('.billboard-row');
  if (billboard) {
    billboard.remove();
  } else {
    if (numTries > MAX_TRIES_DISABLE_AUTO_PREVIEW) {
      return;
    }
    setTimeout(_ => {
      numTries++;
      disableAutoPreview(numTries);
    }, numTries * 150);
  }
}

function enableAutoPlayNext(selectors) {
  /*Pulls all classes that start with "Watch Next" */
  selectors.push(".WatchNext-autoplay"); // Unknown if other international have localized class names
  selectors.push('.WatchNext-still-hover-container');
  selectors.push(".nfa-bot-6-em.nfa-right-5-em a:last-child");
  selectors.push('[aria-label^="Next episode"]');
}

function enableSkipTitleSequence(selectors) {
  /*Skip title sequence*/
  selectors.push('[aria-label="Skip Intro"]'); // American version will have this text, most reliable
  selectors.push('.skip-credits > a'); // Also include first descendant of skip-credits, in case it's international?
}

function enableSkipStillHere(selectors) {
  selectors.push('.postplay-button');
  selectors.push('.continue-playing');
  selectors.push('.player-postplay-still-hover-container');
  selectors.push('[data-uia="interrupt-autoplay-continue"]');
}

function watchCredits(selectors) {
  selectors.push('[aria-label^="Watch credits"]');
}

function hideDisliked() {
  const monitor = new MutationObserver(_ => {
    if (window.location.pathname === "/search") {
      // Don't hide cards on search page, you might actually be searching for a disliked title
      return;
    }
    let disliked = document.getElementsByClassName("is-disliked");
    for (let card of disliked) {
      hideSliderItem(card);
    }
  });
  let mainCardView = document.getElementsByClassName("lolomo");
  if (mainCardView.length) {
    /*Start monitoring at react's entry point*/
    monitor.observe(mainCardView[0], {
      attributes: false, // Don't monitor attribute changes
      childList: true, // Monitor direct child elements (anything observable) changes
      subtree: true, // Monitor all descendants
      characterData: false // monitor direct text changes
    });
  }

}

function hideSliderItem(elem) {
  let parent = elem.closest(".slider-item");
  if (parent) {
    parent.style.display = "none";
  }
}
