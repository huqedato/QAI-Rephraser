import { modelRole } from "./prompt.js";

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
      args: [selectedText, modelRole],
    });
  }
});

function QAIModal(text, modelRole) {
  const modalContainer = document.createElement("div");
  modalContainer.id = "QAIModalContainer";
  modalContainer.style.cssText = `
    font-family: Dejavu Sans, Arial, Verdana, sans-serif;
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

  function getStorageData(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(keys, (items) => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        resolve(items);
      });
    });
  }

  async function queryOpenAI(prompt, modelRole) {
    let { openaiApiKey, model } = await getStorageData([
      "openaiApiKey",
      "model",
    ]);
    model = model || "gpt-3.5-turbo";
    console.log("Model: ", model, "API Key: ", openaiApiKey);

    const url = "https://api.openai.com/v1/chat/completions";
    const params = {
      prompt: prompt,
      temperature: 0.5,
    };

    if (!openaiApiKey) {
      alert("Please set your API Key in the options page.");
      return; // Exit if no API key
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: modelRole + ` You will deliver the output in JSON.`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
        temperature: params.temperature,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch from OpenAI: " + response.statusText);
    }

    return response.json();
  }

  queryOpenAI("Rephrase this text: " + text, modelRole)
    .then((response) => {
      const res = JSON.parse(response.choices[0].message.content);
      modalInnerContent.innerHTML = res[Object.keys(res)[0]];
    })
    .catch((error) => console.error("Error with OpenAI API:", error));
}
