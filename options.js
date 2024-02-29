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

document.addEventListener("DOMContentLoaded", restoreOptions);
document.getElementById("save").addEventListener("click", saveOptions);
