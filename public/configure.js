(() => {
  "use strict";
  const form = document.querySelector("#config-form");
  const country = document.querySelector("#country");
  const list = document.querySelector("#providers");
  const status = document.querySelector("#provider-status");
  const search = document.querySelector("#provider-search");
  const output = document.querySelector("#manifest-url");
  const install = document.querySelector("#install-link");
  const validation = document.querySelector("#validation");
  let providers = [];

  const selectedRows = () => [...list.children].filter((row) => row.querySelector("input").checked);
  const encode = (value) => {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  };
  const config = () => {
    const selected = selectedRows().map((row) => Number(row.dataset.id));
    const checked = (name) => form.elements[name].checked;
    return {
      v: 1,
      country: country.value.toUpperCase(),
      providers: selected,
      providerOrder: selected,
      selectedFirst: checked("selectedFirst"),
      showSubscription: checked("showSubscription"),
      showFree: checked("showFree"),
      showAds: checked("showAds"),
      showTvEverywhere: checked("showTvEverywhere"),
      showRent: checked("showRent"),
      showPurchase: checked("showPurchase"),
      showUnselected: checked("showUnselected"),
      hideInvalidLinks: checked("hideInvalidLinks"),
      collapseDuplicates: checked("collapseDuplicates"),
      allowSeriesFallback: checked("allowSeriesFallback"),
      showSeriesFallback: checked("showSeriesFallback"),
      showPrices: checked("showPrices"),
    };
  };
  const update = () => {
    if (!/^[A-Za-z]{2}$/.test(country.value)) {
      validation.textContent = "Enter a valid two-letter country code.";
      output.value = "";
      return;
    }
    validation.textContent = "";
    const url = `${location.origin}/c/${encode(config())}/manifest.json`;
    output.value = url;
    install.href = url.replace(/^https?:\/\//, "stremio://");
  };
  const move = (row, direction) => {
    const target = direction < 0 ? row.previousElementSibling : row.nextElementSibling;
    if (target) list.insertBefore(direction < 0 ? row : target, direction < 0 ? target : row);
    update();
    row.querySelector("input").focus();
  };
  const render = () => {
    list.replaceChildren();
    providers.forEach((provider) => {
      const row = document.createElement("li");
      row.className = "provider";
      row.dataset.id = String(provider.id);
      row.dataset.name = provider.name.toLowerCase();
      if (provider.logoUrl) {
        const img = document.createElement("img");
        img.src = provider.logoUrl;
        img.alt = "";
        img.loading = "lazy";
        img.referrerPolicy = "no-referrer";
        row.append(img);
      } else {
        const blank = document.createElement("span");
        blank.textContent = provider.name.slice(0, 1);
        blank.setAttribute("aria-hidden", "true");
        row.append(blank);
      }
      const wrap = document.createElement("div");
      wrap.className = "provider-name";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.id = `provider-${provider.id}`;
      const label = document.createElement("label");
      label.htmlFor = box.id;
      label.textContent = provider.name;
      wrap.append(box, label);
      row.append(wrap);
      const controls = document.createElement("div");
      controls.className = "move-buttons";
      [
        ["↑", "Move up", -1],
        ["↓", "Move down", 1],
      ].forEach(([text, labelText, direction]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "small secondary";
        button.textContent = text;
        button.setAttribute("aria-label", `${labelText} ${provider.name}`);
        button.addEventListener("click", () => move(row, direction));
        controls.append(button);
      });
      row.append(controls);
      box.addEventListener("change", update);
      list.append(row);
    });
    update();
  };
  const load = async () => {
    status.textContent = "Loading providers…";
    try {
      const response = await fetch(
        `/api/providers?country=${encodeURIComponent(country.value.toUpperCase())}`,
      );
      if (!response.ok) throw new Error("request failed");
      const data = await response.json();
      providers = data.providers;
      status.textContent = providers.length
        ? `${providers.length} providers · ${data.source === "watchmode" ? "Live catalog" : "Fallback catalog"}`
        : "No provider data for this region.";
      render();
    } catch {
      status.textContent = "Provider catalog is temporarily unavailable.";
      providers = [];
      render();
    }
  };
  let countryTimer;
  country.addEventListener("input", () => {
    country.value = country.value.toUpperCase();
    clearTimeout(countryTimer);
    countryTimer = setTimeout(load, 350);
    update();
  });
  form.addEventListener("change", update);
  search.addEventListener("input", () => {
    const query = search.value.toLowerCase().trim();
    [...list.children].forEach((row) => {
      row.hidden = !row.dataset.name.includes(query);
    });
  });
  document.querySelector("#select-visible").addEventListener("click", () => {
    [...list.children]
      .filter((row) => !row.hidden)
      .forEach((row) => {
        row.querySelector("input").checked = true;
      });
    update();
  });
  document.querySelector("#clear-selected").addEventListener("click", () => {
    [...list.children].forEach((row) => {
      row.querySelector("input").checked = false;
    });
    update();
  });
  document.querySelector("#copy-manifest").addEventListener("click", async () => {
    if (output.value) await navigator.clipboard.writeText(output.value);
  });
  load();
})();
