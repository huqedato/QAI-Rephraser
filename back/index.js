import ExpiryMap from "expiry-map";
import { v4 as uuidv4 } from "uuid";
import { fetchSSE } from "./fetch-sse.js";
import { initPrompt } from "./prompt.js";

let ua = navigator.userAgent;
let browserName = ua.indexOf("Chrome") > -1 ? "Chrome" : "Firefox";
let CORE = browserName === "Chrome" ? chrome : browser;

const KEY_ACCESS_TOKEN = "accessToken";

let prompt = "";
let apiKey = "";

CORE.storage.sync.get(["prompt", "apiKey"], function (items) {
  if (items && items.prompt) {
    prompt = items.prompt;
  } else {
    prompt = initPrompt;
  }
  if (items && items.apiKey) {
    apiKey = items.apiKey;
  }
});

const cache = new ExpiryMap(10 * 1000);

async function getAccessToken() {
  if (cache.get(KEY_ACCESS_TOKEN)) {
    return cache.get(KEY_ACCESS_TOKEN);
  }
  const resp = await fetch("https://chat.openai.com/api/auth/session")
    .then((r) => r.json())
    .catch(() => ({}));
  if (!resp.accessToken) {
    throw new Error("UNAUTHORIZED");
  }
  cache.set(KEY_ACCESS_TOKEN, resp.accessToken);
  return resp.accessToken;
}

async function getConversationId() {
  const accessToken = await getAccessToken();
  const resp = await fetch(
    "https://chat.openai.com/backend-api/conversations?offset=0&limit=1",
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )
    .then((r) => r.json())
    .catch(() => ({}));
  if (resp?.items?.length === 1) {
    return resp.items[0].id;
  }
  return "";
}

async function deleteConversation(conversationId) {
  const accessToken = await getAccessToken();
  const resp = await fetch(
    `https://chat.openai.com/backend-api/conversation/${conversationId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ is_visible: false }),
    }
  )
    .then((r) => r.json())
    .catch(() => ({}));
  if (resp?.success) {
    return true;
  }
  return false;
}

async function getSummary(question, callback) {
  const accessToken = await getAccessToken();
  const messageJson = {
    action: "next",
    messages: [
      {
        id: uuidv4(),
        author: {
          role: "user",
        },
        role: "user",
        content: {
          content_type: "text",
          parts: [question],
        },
      },
    ],
    //model: "text-davinci-002-render",
    model: "gpt-4",
    parent_message_id: uuidv4(),
  };
  await fetchSSE("https://chat.openai.com/backend-api/conversation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(messageJson),
    onMessage(message) {
      if (message === "[DONE]") {
        return;
      }
      try {
        const data = JSON.parse(message);
        const text = data.message?.content?.parts?.[0];
        if (text) {
          callback(text);
        }
      } catch (err) {
        console.log("sse message", message);
        console.log(`Error in onMessage: ${err}`);
      }
    },
    onError(err) {
      console.log(`Error in fetchSSE: ${err}`);
    },
  });
}

let preventInstance = {};
function executeScripts(tab) {
  const tabId = tab.id;
  // return if we've already created the summary for this website
  if (preventInstance[tabId]) return;

  preventInstance[tabId] = true;
  setTimeout(() => delete preventInstance[tabId], 10000);

  // Add a badge to signify the extension is in use
  CORE.action.setBadgeBackgroundColor({ color: [242, 38, 19, 230] });
  CORE.action.setBadgeText({ text: "GPT" });

  CORE.scripting.executeScript({
    target: { tabId },
    files: ["content.bundle.js"],
  });

  setTimeout(function () {
    CORE.action.setBadgeText({ text: "" });
  }, 1000);
}

// Load on clicking the extension icon
CORE.action.onClicked.addListener(async (...args) => {
  let tab = args[0];
  // Add request permission for "https://*.openai.com/"
  // Without this request permission, User should enable optional permission for "https://*.openai.com/"
  if (browserName === "Firefox") {
    CORE.permissions.request({
      origins: ["https://*.openai.com/"],
    });
  }
  executeScripts(...args);
});

// Listen for messages
CORE.runtime.onConnect.addListener((port) => {
  port.onMessage.addListener(async (request, sender, sendResponse) => {
    // console.debug("received msg ", request.content);
    try {
      const maxLength = 3000;
      const text = request.content;
      console.debug("Text:", text);
      const chunks = splitTextIntoChunks(text, maxLength);

      let currentSummary = "";
      for (const chunk of chunks) {
        const gptQuestion = prompt + `\n\n${chunk}`;
        let currentAnswer = "";
        await getSummary(gptQuestion, (answer) => {
          currentAnswer = answer;
          port.postMessage({
            answer: combineSummaries([currentSummary, answer]),
          });
        });
        await deleteConversation(await getConversationId());
        currentSummary =
          combineSummaries([currentSummary, currentAnswer]) + "\n\n";
      }
    } catch (err) {
      console.error(err);
      port.postMessage({ error: err.message });
      cache.delete(KEY_ACCESS_TOKEN);
    }
  });
});

function splitTextIntoChunks(text, maxLength) {
  const chunks = [];
  const words = text.split(/\s+/);
  let currentChunk = "";

  for (const word of words) {
    if (currentChunk.length + word.length + 1 <= maxLength) {
      currentChunk += (currentChunk ? " " : "") + word;
    } else {
      chunks.push(currentChunk);
      currentChunk = word;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function combineSummaries(summaries) {
  let combinedSummary = "";
  for (const summary of summaries) {
    combinedSummary += (combinedSummary ? " " : "") + summary;
  }

  return combinedSummary;
}





//
/// Business logic for the extension
//

chrome.runtime.onInstalled.addListener(function () {
  chrome.contextMenus.create({
    id: "QAIRephraser",
    title: "Rephrase with AI",
    contexts: ["selection"],
  });
});



chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId == "QAIRephraser") {
    let selectedText = info.selectionText;
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: QAIModal,
      args: [selectedText],
    });
  }
});


function QAIModal(text) {
  const modalContainer = document.createElement("div");
  modalContainer.id = "QAIModalContainer";
  modalContainer.style.cssText = `
    font-family: Arial, sans-serif;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 10000;
    background-color: rgba(0, 0, 0, 0.5); /* Semi-transparent background */
    display: flex;
    justify-content: center;
    align-items: center;
  `;


  const modalContent = document.createElement("div");
  modalContent.id = "QAIModalContent";
  modalContent.style.cssText = `
    padding: 0.8em;
    width: 50vw;
    height: auto;
    font-size: 16px;
    background-color: #0e131e;
    color: #ddd;
    overflow-y: auto; 
    box-sizing: border-box;
    position: relative;
  `;

  // Create the close button - not used.
  const closeButton = document.createElement("button");
  closeButton.innerText = "x";
  closeButton.style.cssText = `
    position: absolute;
    top: 7px;
    right: 7px;
    background-color: transparent;
    border: none;
    color: white;
    font-size: 15px;
    cursor: pointer;
  `;

  closeButton.onclick = function () {
    modalContainer.remove();
  };
  
  const modalInnerContent = document.createElement("div");
  modalInnerContent.style.cssText = `
    padding: 0.8em;
  `;

  modalInnerContent.ondblclick = () => {
    modalInnerContent.innerText = "Wating for AI...";
    port.postMessage({ content: text });
   
  };
  modalInnerContent.onclick = () => copyToClipboard();

  function copyToClipboard() {
    let text = modalInnerContent.innerText;
    (async () => await navigator.clipboard.writeText(text))();
  }

  modalInnerContent.innerHTML = "Wating for AI...";
  modalContent.appendChild(modalInnerContent);
  modalContainer.appendChild(modalContent);
  document.body.appendChild(modalContainer);

  function handleEscKey(event) {
    if (event.key === "Escape") {
      removeModal();
    }
  }

  function handleClickOutside(event) {
    if (!modalContent.contains(event.target)) {
      removeModal();
    }
  }

  window.addEventListener("keydown", handleEscKey);
  modalContainer.addEventListener("click", handleClickOutside);

  function removeModal() {
    copyToClipboard();
    modalContainer.remove();
    window.removeEventListener("keydown", handleEscKey);
    window.removeEventListener("click", handleClickOutside);
  }

  let ua = navigator.userAgent;
  let browserName = ua.indexOf("Chrome") > -1 ? "Chrome" : "Firefox";
  let CORE = browserName === "Chrome" ? chrome : browser;

  const port = CORE.runtime.connect();

  port.onMessage.addListener(function (msg) {
    if (msg.answer) {
      modalInnerContent.innerHTML = msg.answer;
    } else if (msg.error === "UNAUTHORIZED") {
      modalInnerContent.innerHTML =
        '<p>Please login at <a href="https://chat.openai.com" target="_blank">chat.openai.com</a></p>';
    } else {
      modalInnerContent.innerHTML =
        "<p>Failed to load response from ChatGPT</p>";
    }
  });
  port.postMessage({ content: text });

}

