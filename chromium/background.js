const DEFAULT_ENGINES = [
    { name: "Google", url: "https://www.google.com/search", param: "q" },
    { name: "Yandex", url: "https://yandex.com/search/", param: "text" },
    { name: "Brave", url: "https://search.brave.com/search", param: "q" },
    { name: "Duckduckgo", url: "https://duckduckgo.com/", param: "q" },
    { name: "Claude", url: "https://claude.ai/new", param: "q" }
];

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get(["engines"], syncData => {
        if (Array.isArray(syncData.engines) && syncData.engines.length) return;
        chrome.storage.local.get(["engines"], localData => {
            const engines =
                Array.isArray(localData.engines) && localData.engines.length
                    ? localData.engines
                    : DEFAULT_ENGINES;
            chrome.storage.sync.set({ engines });
        });
    });

    // v2.2 stored a Venice API key for the (now removed) answer-panel
    // feature. Delete it — no reason to keep a credential we no longer use.
    chrome.storage.local.remove("veniceConfig");
});

chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage();
});
