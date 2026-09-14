/* 发布新版本时，请更新此配置。 */
const portalConfig = {
  currentUrl: "./current/",
  releases: [
    {
      date: "2026-08-26",
      label: "2026年7月",
      url: "./versions/2026-08-26/",
      note: "2026年7月历史归档"
    },
    {
      date: "2026-08-17",
      label: "阿尔茨海默症特别版",
      url: "./versions/ad/",
      note: "阿尔茨海默症特别版历史归档"
    },
    {
      date: "2026-07-16",
      label: "2026年6月",
      url: "./versions/2026-07-16/",
      note: "2026年6月历史归档"
    }
  ]
};

const currentLink = document.querySelector("#current-dashboard-link");
const searchInput = document.querySelector("#release-search");
const releaseList = document.querySelector("#release-list");
const releaseCount = document.querySelector("#release-count");

currentLink.href = portalConfig.currentUrl;

function renderReleases(query = "") {
  const normalized = query.trim().toLowerCase();
  const matches = portalConfig.releases.filter((release) =>
    [release.date, release.label, release.note]
      .join(" ")
      .toLowerCase()
      .includes(normalized)
  );

  releaseList.replaceChildren();
  releaseCount.textContent = `${portalConfig.releases.length} 个版本`;

  if (!matches.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "未找到匹配的版本。请尝试输入年份、月份或版本关键字。";
    releaseList.append(empty);
    return;
  }

  matches.forEach((release) => {
    const link = document.createElement("a");
    link.className = "release-link";
    link.href = release.url;

    const icon = document.createElement("span");
    icon.className = "archive-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "▣";

    const copy = document.createElement("span");
    copy.className = "release-copy";
    const title = document.createElement("strong");
    title.textContent = release.label;
    const note = document.createElement("small");
    note.textContent = release.note;
    copy.append(title, note);

    const arrow = document.createElement("span");
    arrow.className = "release-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";

    link.append(icon, copy, arrow);
    releaseList.append(link);
  });
}

searchInput.addEventListener("input", (event) => renderReleases(event.target.value));
renderReleases();
