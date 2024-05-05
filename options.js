function saveOptions() {
  var model = document.getElementById("gpt-model").value;
  chrome.storage.sync.set(
    {
      model: model,
    },
    function () {
      var status = document.getElementById("status");
      status.textContent = "Options saved.";
      setTimeout(function () {
        status.textContent = "";
      }, 500);
    }
  );
}

const restoreOptions = () => {
  chrome.storage.sync.get({ model: "gpt-4" }, (items) => {
    document.getElementById("gpt-model").value = items.model;
  });
};

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("OpenAIAPIKeyForm");
  chrome.storage.sync.get("apiKey", function (data) {
    document.getElementById("apiKey").value = data.apiKey || "";
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const apiKey = document.getElementById("apiKey").value;
    chrome.storage.sync.set({ openaiApiKey: apiKey }, function () {
      var status = document.getElementById("status");
      status.textContent = "Options saved.";
      setTimeout(function () {
        status.textContent = "";
      }, 500);
    });
  });
});

document.addEventListener("DOMContentLoaded", restoreOptions);
document.getElementById("save").addEventListener("click", saveOptions);
