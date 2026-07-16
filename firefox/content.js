(() => {
    const CONTAINER_ID = "seek-skip-container";
    const DORMANT_GRACE_MS = 600;
    const PENDING_TTL_MS = 3 * 60 * 1000;

    const VENICE_DEFAULTS = {
        enabled: true,
        url: "https://venice.ai/chat/agent",
        autoSubmit: true
    };

    function normalizeHost(hostname) {
        return hostname.toLowerCase().replace(/^www\./, "");
    }

    function loadEngines() {
        return new Promise(resolve => {
            chrome.storage.sync.get(["engines"], data => {
                resolve(Array.isArray(data.engines) ? data.engines : []);
            });
        });
    }

    function loadVeniceSettings() {
        return new Promise(resolve => {
            chrome.storage.sync.get(["veniceSettings"], data => {
                resolve({ ...VENICE_DEFAULTS, ...(data.veniceSettings || {}) });
            });
        });
    }

    function findCurrentEngine(engines) {
        const currentHost = normalizeHost(window.location.hostname);
        return engines.find(engine => {
            try {
                return normalizeHost(new URL(engine.url).hostname) === currentHost;
            } catch {
                return false;
            }
        });
    }

    function getQuery(engine) {
        const params = new URLSearchParams(window.location.search);
        const query = params.get(engine.param);
        return query && query.trim() ? query : null;
    }

    function buildSearchUrl(engine, query) {
        const url = new URL(engine.url);
        url.searchParams.set(engine.param, query);
        return url.toString();
    }

    function faviconUrl(pageUrl) {
        // Firefox has no equivalent of Chromium's local _favicon API, so ask
        // the engine's own origin for its icon — still no third-party
        // icon service involved. Buttons fall back to text-only on error.
        try {
            return new URL("/favicon.ico", pageUrl).toString();
        } catch {
            return "";
        }
    }

    function removeSwitcher() {
        document.getElementById(CONTAINER_ID)?.remove();
    }

    function armDormant(container) {
        setTimeout(() => {
            const onMove = event => {
                if (!container.isConnected) {
                    document.removeEventListener("mousemove", onMove);
                    return;
                }
                if (container.contains(event.target)) return;
                container.classList.add("dormant");
                document.removeEventListener("mousemove", onMove);
            };
            document.addEventListener("mousemove", onMove, { passive: true });
        }, DORMANT_GRACE_MS);
    }

    /* ---------- Ask Venice: open tab + hand off the query ---------- */

    function askVenice(query, veniceSettings) {
        chrome.storage.local.set(
            { venicePending: { query, ts: Date.now() } },
            () => window.open(veniceSettings.url, "_blank")
        );
    }

    async function createSwitcher(engines, currentEngine, query) {
        removeSwitcher();

        const container = document.createElement("div");
        container.id = CONTAINER_ID;
        container.className = "switcher-container";

        for (const engine of engines) {
            if (engine.url === currentEngine.url) continue;

            const button = document.createElement("button");
            button.type = "button";
            button.className = "switcher-button";
            button.title = `Search "${query}" on ${engine.name}`;

            const label = document.createElement("span");
            label.textContent = engine.name;

            const iconSrc = faviconUrl(engine.url);
            if (iconSrc) {
                const icon = document.createElement("img");
                icon.className = "switcher-icon";
                icon.alt = "";
                icon.src = iconSrc;
                icon.addEventListener("error", () => icon.remove());
                button.appendChild(icon);
            }
            button.appendChild(label);
            button.addEventListener("click", () => {
                window.location.href = buildSearchUrl(engine, query);
            });
            container.appendChild(button);
        }

        const veniceSettings = await loadVeniceSettings();
        if (veniceSettings.enabled) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "switcher-button";
            button.title = `Send "${query}" to Venice`;

            const label = document.createElement("span");
            label.textContent = "Venice";

            const iconSrc = faviconUrl(veniceSettings.url);
            if (iconSrc) {
                const icon = document.createElement("img");
                icon.className = "switcher-icon";
                icon.alt = "";
                icon.src = iconSrc;
                icon.addEventListener("error", () => icon.remove());
                button.appendChild(icon);
            }
            button.appendChild(label);
            button.addEventListener("click", () => askVenice(query, veniceSettings));
            container.appendChild(button);
        }

        if (!container.childElementCount) return;

        const close = document.createElement("button");
        close.type = "button";
        close.className = "switcher-close";
        close.textContent = "\u00d7";
        close.title = "Hide until next search";
        close.addEventListener("click", removeSwitcher);
        container.appendChild(close);

        document.body.appendChild(container);
        requestAnimationFrame(() => container.classList.add("visible"));
        armDormant(container);
    }

    async function run() {
        const engines = await loadEngines();
        if (!engines.length) return;

        const currentEngine = findCurrentEngine(engines);
        if (!currentEngine) return;

        const query = getQuery(currentEngine);
        if (!query) {
            removeSwitcher();
            return;
        }

        await createSwitcher(engines, currentEngine, query);
    }

    /* ---------- Venice side: consume pending query, type it in ---------- */

    const DEBUG_TAG = "[Seek Skip]";

    function getPendingQuery() {
        return new Promise(resolve => {
            chrome.storage.local.get(["venicePending"], data => {
                const pending = data.venicePending;
                if (!pending?.query || Date.now() - (pending.ts || 0) > PENDING_TTL_MS) {
                    resolve(null);
                    return;
                }
                resolve(pending.query);
            });
        });
    }

    function clearPendingQuery() {
        chrome.storage.local.remove("venicePending");
    }

    function isUsableInput(el) {
        if (el.disabled || el.readOnly) return false;
        if (typeof el.checkVisibility === "function") {
            return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
        }
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function queryAllDeep(selector, root) {
        const out = [...root.querySelectorAll(selector)];
        for (const el of root.querySelectorAll("*")) {
            if (el.shadowRoot) out.push(...queryAllDeep(selector, el.shadowRoot));
        }
        return out;
    }

    function findComposer() {
        const selector = 'textarea, div[contenteditable="true"], [role="textbox"]';
        let candidates = [...document.querySelectorAll(selector)].filter(isUsableInput);
        if (!candidates.length) {
            // Fall back to piercing shadow DOM, in case the app uses web components.
            candidates = queryAllDeep(selector, document).filter(isUsableInput);
        }
        // Chat composers sit at the bottom of the viewport; pick the lowest one.
        candidates.sort(
            (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top
        );
        return candidates[candidates.length - 1] || null;
    }

    function waitForComposer(timeoutMs = 30000, intervalMs = 300) {
        return new Promise(resolve => {
            const started = Date.now();
            const timer = setInterval(() => {
                const el = findComposer();
                if (el) {
                    clearInterval(timer);
                    resolve(el);
                } else if (Date.now() - started > timeoutMs) {
                    clearInterval(timer);
                    resolve(null);
                }
            }, intervalMs);
        });
    }

    function composerText(el) {
        return (el.value ?? el.textContent ?? "").trim();
    }

    function insertText(el, text) {
        el.focus();
        el.click?.();
        if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
            const proto =
                el.tagName === "TEXTAREA"
                    ? HTMLTextAreaElement.prototype
                    : HTMLInputElement.prototype;
            Object.getOwnPropertyDescriptor(proto, "value").set.call(el, text);
            el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
            return composerText(el).length > 0;
        }

        // contenteditable / rich editors: try execCommand first...
        const selection = window.getSelection();
        selection.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(el);
        selection.addRange(range);
        document.execCommand("insertText", false, text);
        if (composerText(el).length > 0) return true;

        // ...then a beforeinput/input pair, which ProseMirror-style editors honor.
        el.dispatchEvent(
            new InputEvent("beforeinput", {
                bubbles: true,
                composed: true,
                cancelable: true,
                inputType: "insertText",
                data: text
            })
        );
        if (composerText(el).length > 0) return true;

        // Last resort: set content directly and announce it.
        el.textContent = text;
        el.dispatchEvent(
            new InputEvent("input", {
                bubbles: true,
                composed: true,
                inputType: "insertText",
                data: text
            })
        );
        return composerText(el).length > 0;
    }

    function attemptSubmit(el) {
        const keyInit = {
            bubbles: true,
            cancelable: true,
            composed: true,
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13
        };
        el.dispatchEvent(new KeyboardEvent("keydown", keyInit));
        el.dispatchEvent(new KeyboardEvent("keypress", keyInit));
        el.dispatchEvent(new KeyboardEvent("keyup", keyInit));

        setTimeout(() => {
            if (!composerText(el)) return; // Enter worked
            const button = document.querySelector(
                'button[type="submit"], button[aria-label*="send" i], button[data-testid*="send" i]'
            );
            if (button && !button.disabled) {
                console.info(DEBUG_TAG, "Enter didn't send; clicking send button.");
                button.click();
            } else {
                console.info(DEBUG_TAG, "Couldn't auto-send; query is pre-filled.");
            }
        }, 600);
    }

    async function handleVenicePage() {
        const query = await getPendingQuery();
        if (!query) return;

        console.info(DEBUG_TAG, "Pending query found, waiting for chat composer\u2026");
        const composer = await waitForComposer();
        if (!composer) {
            console.warn(DEBUG_TAG, "No chat composer appeared within 30s; leaving query pending for the next venice.ai page load.");
            return;
        }

        console.info(DEBUG_TAG, "Composer found:", composer.tagName, composer.className);
        const inserted = insertText(composer, query);
        if (!inserted) {
            console.warn(DEBUG_TAG, "Could not insert text into the composer; leaving query pending.");
            return;
        }

        // Only consume the query once it has actually landed, so an
        // intermediate page (redirect, login) doesn't eat it.
        clearPendingQuery();

        const settings = await loadVeniceSettings();
        if (settings.autoSubmit) {
            setTimeout(() => attemptSubmit(composer), 300);
        }
    }

    /* ---------- dispatch ---------- */

    const host = normalizeHost(window.location.hostname);
    if (host === "venice.ai" || host.endsWith(".venice.ai")) {
        handleVenicePage();
    } else {
        run();

        let lastUrl = location.href;
        new MutationObserver(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                run();
            }
        }).observe(document.documentElement, { childList: true, subtree: true });

        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === "sync" && (changes.engines || changes.veniceSettings)) run();
        });
    }
})();
