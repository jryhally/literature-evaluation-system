const WIKI_API = "https://zh.wikipedia.org/w/api.php";

const dimensions = [
  {
    key: "artistry",
    name: "文学艺术性",
    weight: 0.18,
    description: "语言风格、象征系统、审美密度与文本完成度。",
    keywords: ["语言", "文体", "风格", "诗意", "象征", "叙述", "结构", "艺术", "美学", "意识流", "魔幻现实主义"]
  },
  {
    key: "thought",
    name: "思想与人文深度",
    weight: 0.18,
    description: "是否触及人的处境、伦理困境、社会历史经验与精神问题。",
    keywords: ["人性", "社会", "历史", "战争", "命运", "自由", "苦难", "伦理", "政治", "殖民", "现代性", "存在"]
  },
  {
    key: "originality",
    name: "原创性与创新",
    weight: 0.14,
    description: "题材、形式、视角和叙事技术上的开创性。",
    keywords: ["创新", "开创", "实验", "先锋", "首部", "代表作", "里程碑", "独特", "突破", "新颖"]
  },
  {
    key: "structure",
    name: "结构与叙事完成度",
    weight: 0.14,
    description: "人物、情节、节奏、结构组织和整体控制力。",
    keywords: ["小说", "长篇", "短篇", "人物", "情节", "叙事", "结构", "家族", "史诗", "章节"]
  },
  {
    key: "influence",
    name: "文化影响力",
    weight: 0.16,
    description: "作品传播、经典化、获奖、改编和文学史位置。",
    keywords: ["经典", "影响", "获奖", "诺贝尔", "茅盾文学奖", "布克奖", "普利策", "改编", "翻译", "世界文学", "重要"]
  },
  {
    key: "universality",
    name: "普遍性与跨文化性",
    weight: 0.10,
    description: "是否越过地域与时代，呈现可被广泛理解的人类经验。",
    keywords: ["世界", "国际", "翻译", "人类", "普遍", "全球", "多国", "跨文化", "流传", "世纪"]
  },
  {
    key: "difficulty",
    name: "阅读难度",
    weight: 0.10,
    description: "语言、结构、思想密度造成的阅读挑战。分数越高，代表越难读。",
    keywords: ["意识流", "哲学", "复杂", "隐喻", "象征", "实验", "现代主义", "多线", "晦涩", "长篇"]
  }
];

const awardSignals = ["诺贝尔文学奖", "茅盾文学奖", "布克奖", "普利策奖", "龚古尔奖", "雨果奖", "星云奖", "芥川奖", "直木奖"];
const classicSignals = ["经典", "代表作", "重要作品", "世界文学", "文学史", "改编", "翻译", "影响深远"];
const beginnerFriendlySignals = ["短篇", "散文", "随笔", "儿童文学", "通俗", "幽默", "爱情", "成长", "现实主义", "故事"];
const heavyReadingSignals = ["意识流", "现代主义", "哲学", "实验", "复杂", "晦涩", "长篇", "史诗", "多线", "象征主义"];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let currentCandidates = [];

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function escapeHTML(value = "") {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

async function searchWikipediaCandidates(query, limit = 5) {
  const searchURL = new URL(WIKI_API);
  searchURL.search = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    format: "json",
    origin: "*",
    srlimit: String(limit)
  });

  const searchResponse = await fetch(searchURL);
  if (!searchResponse.ok) throw new Error("百科搜索失败");
  const searchData = await searchResponse.json();
  const pages = searchData.query?.search || [];
  return pages.map((page) => ({
    pageid: page.pageid,
    title: page.title,
    snippet: page.snippet?.replace(/<[^>]*>/g, "") || ""
  }));
}

async function searchWikipedia(query) {
  const pages = await searchWikipediaCandidates(query, 1);
  const page = pages[0];
  if (!page) return null;
  return fetchWikipediaPage(page.pageid, page);
}

async function fetchWikipediaPage(pageid, fallback = {}) {
  const extractURL = new URL(WIKI_API);
  extractURL.search = new URLSearchParams({
    action: "query",
    prop: "extracts|categories|pageprops",
    exintro: "1",
    explaintext: "1",
    cllimit: "20",
    pageids: String(pageid),
    format: "json",
    origin: "*"
  });

  const extractResponse = await fetch(extractURL);
  if (!extractResponse.ok) throw new Error("百科摘要获取失败");
  const extractData = await extractResponse.json();
  const detail = extractData.query?.pages?.[pageid];
  if (!detail) return null;

  return {
    pageid,
    title: detail.title,
    extract: detail.extract || fallback.snippet || "",
    source: `https://zh.wikipedia.org/?curid=${pageid}`,
    categories: (detail.categories || []).map((item) => item.title.replace(/^Category:/, ""))
  };
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((item) => {
    if (!item?.pageid || seen.has(item.pageid)) return false;
    seen.add(item.pageid);
    return true;
  });
}

async function findWorkCandidates(title, author) {
  const queries = [
    `${title} ${author} 文学作品`,
    `${title} ${author}`,
    `${title} 小说`,
    `${title} 文学作品`,
    title
  ];

  const results = await Promise.allSettled(queries.map((query) => searchWikipediaCandidates(query, 5)));
  const candidates = dedupeCandidates(results.flatMap((result) => result.status === "fulfilled" ? result.value : []));
  const scored = candidates.map((candidate) => {
    const haystack = `${candidate.title} ${candidate.snippet}`;
    const exactTitle = candidate.title === title;
    const titleInTitle = candidate.title.includes(title) || title.includes(candidate.title);
    const titleInSnippet = candidate.snippet.includes(title);
    const authorHit = author && haystack.includes(author);
    const literaryHit = /小说|文学|作品|长篇|短篇|诗|戏剧|散文|作家|改编/.test(haystack);
    return {
      ...candidate,
      matchScore:
        (exactTitle ? 120 : 0) +
        (!exactTitle && titleInTitle ? 58 : 0) +
        (titleInSnippet ? 24 : 0) +
        (authorHit ? 28 : 0) +
        (literaryHit ? 14 : 0) +
        Math.max(0, 6 - Math.abs(candidate.title.length - title.length))
    };
  });

  const strongMatches = scored.filter((candidate) => candidate.matchScore >= 24);
  return (strongMatches.length ? strongMatches : scored)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 6);
}

async function fetchLiteraryContext(title, author) {
  const [work, authorInfo] = await Promise.allSettled([
    searchWikipedia(`${title} ${author} 文学作品`),
    searchWikipedia(`${author} 作家`)
  ]);

  return {
    work: work.status === "fulfilled" ? work.value : null,
    author: authorInfo.status === "fulfilled" ? authorInfo.value : null
  };
}

async function fetchLiteraryContextFromCandidate(candidate, author) {
  const [work, authorInfo] = await Promise.allSettled([
    fetchWikipediaPage(candidate.pageid, candidate),
    searchWikipedia(`${author} 作家`)
  ]);

  return {
    work: work.status === "fulfilled" ? work.value : null,
    author: authorInfo.status === "fulfilled" ? authorInfo.value : null
  };
}

function countMatches(text, keywords) {
  return keywords.reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0);
}

function scoreDimension(dimension, contextText, title, author) {
  const textLength = contextText.length;
  const base = 42;
  const keywordBoost = countMatches(contextText, dimension.keywords) * 7;
  const awardBoost = dimension.key === "influence" ? countMatches(contextText, awardSignals) * 8 : countMatches(contextText, awardSignals) * 2;
  const classicBoost = countMatches(contextText, classicSignals) * 4;
  const informationBoost = Math.min(18, Math.floor(textLength / 180));
  const titleAuthorBoost = title.length > 1 && author.length > 1 ? 4 : 0;
  const raw = base + keywordBoost + awardBoost + classicBoost + informationBoost + titleAuthorBoost;

  if (dimension.key === "difficulty") {
    const difficultyBase = 36 + Math.min(20, Math.floor(textLength / 240));
    return clamp(difficultyBase + keywordBoost + countMatches(contextText, ["长篇", "现代主义", "哲学", "复杂"]) * 4);
  }

  return clamp(raw);
}

function buildReasons(contextText, work, authorInfo, requestedAuthor = "") {
  const reasons = [];
  const awards = awardSignals.filter((signal) => contextText.includes(signal));
  const classics = classicSignals.filter((signal) => contextText.includes(signal));

  if (work?.extract) reasons.push(`已检索到作品介绍：${work.title}。`);
  if (authorInfo?.extract) reasons.push(`已检索到作者背景：${authorInfo.title}。`);
  if (requestedAuthor && work?.extract && !`${work.title} ${work.extract}`.includes(requestedAuthor)) {
    reasons.push(`注意：作品介绍中没有明显出现“${requestedAuthor}”，请确认作者是否匹配。`);
  }
  if (awards.length) reasons.push(`发现奖项信号：${awards.join("、")}。`);
  if (classics.length) reasons.push(`发现经典化/传播信号：${classics.join("、")}。`);
  if (contextText.length > 650) reasons.push("公开资料较丰富，评分置信度相对更高。");
  if (!reasons.length) reasons.push("公开资料较少，本次评分主要依据标题、作者和通用文学评价框架，置信度较低。");

  reasons.push("阅读难度不等于作品好坏；它只表示文本可能需要的阅读耐心和背景知识。");
  return reasons;
}

function getScore(scored, key) {
  return scored.find((item) => item.key === key)?.score || 0;
}

function buildReaderGuide(scored, contextText, title) {
  const difficulty = getScore(scored, "difficulty");
  const artistry = getScore(scored, "artistry");
  const thought = getScore(scored, "thought");
  const influence = getScore(scored, "influence");
  const structure = getScore(scored, "structure");
  const originality = getScore(scored, "originality");
  const friendlyHits = countMatches(contextText, beginnerFriendlySignals);
  const heavyHits = countMatches(contextText, heavyReadingSignals);

  const readerFit = clamp(Math.round(
    influence * 0.22 +
    structure * 0.18 +
    thought * 0.16 +
    artistry * 0.14 +
    originality * 0.10 +
    (100 - difficulty) * 0.16 +
    Math.min(10, friendlyHits * 3) -
    Math.min(8, heavyHits * 2)
  ));

  const verdict =
    readerFit >= 78 ? "很适合作为当前阶段的重点阅读" :
    readerFit >= 62 ? "值得读，但建议带着明确问题慢慢读" :
    readerFit >= 46 ? "可以放入书单，未必适合马上开始" :
    "更适合等阅读习惯稳定后再挑战";

  const advantages = [];
  if (artistry >= 72) advantages.push("文本艺术性强，适合体会语言、叙事和审美风格。");
  if (thought >= 72) advantages.push("思想和人文厚度较高，适合用来打开社会、历史或人性议题。");
  if (influence >= 72) advantages.push("文化影响力较强，读完后更容易接入文学史和公共讨论。");
  if (originality >= 72) advantages.push("形式或视角有明显创新，适合观察文学如何突破常规。");
  if (!advantages.length) advantages.push("它的价值需要在具体阅读体验中慢慢确认，建议先读开头 30 页试水。");

  const directions = [];
  if (difficulty >= 74) {
    directions.push("不要追求一次读懂，先抓人物、场景和反复出现的意象。");
    directions.push("建议搭配导读或书评，每次读 20–30 页，边读边记疑问。");
  } else if (difficulty >= 55) {
    directions.push("适合按章节推进，每读完一段做一句话总结。");
    directions.push("可以关注它如何处理人物关系和核心冲突。");
  } else {
    directions.push("适合直接开始读，用故事推进来建立阅读惯性。");
    directions.push("读完后再回头看主题和结构，不必一开始就分析太多。");
  }
  if (thought >= 70) directions.push("读的时候可以问：它到底在回应哪一种人生困境？");
  if (artistry >= 70) directions.push("可以摘录几段你觉得有质感的句子，训练对文字的敏感度。");

  const audience =
    difficulty >= 74 ? "适合：愿意慢读、能接受暂时困惑的人。" :
    readerFit >= 70 ? "适合：想建立阅读习惯，同时又想读经典的人。" :
    "适合：已经对该主题或作者有兴趣的人。";

  const warning =
    difficulty >= 78 ? `《${title}》可能不适合作为“重启阅读”的第一本，除非你对它特别有兴趣。` :
    difficulty >= 60 ? "阅读门槛中等，建议不要在很疲惫的时候硬啃。" :
    "阅读压力相对可控，适合用来培养持续阅读的节奏。";

  return {
    readerFit,
    verdict,
    advantages,
    directions,
    audience,
    warning
  };
}

function evaluate(title, author, context) {
  const workText = context.work?.extract || "";
  const authorText = context.author?.extract || "";
  const categoryText = [...(context.work?.categories || []), ...(context.author?.categories || [])].join(" ");
  const contextText = `${title} ${author} ${workText} ${authorText} ${categoryText}`;

  const scored = dimensions.map((dimension) => ({
    ...dimension,
    score: scoreDimension(dimension, contextText, title, author)
  }));

  const total = Math.round(scored.reduce((sum, item) => sum + item.score * item.weight, 0));
  const infoSignals = [context.work?.extract, context.author?.extract].filter(Boolean).join("").length;
  const confidence = infoSignals > 900 ? "较高置信度" : infoSignals > 350 ? "中等置信度" : "低置信度";

  return {
    total,
    dimensions: scored,
    confidence,
    reasons: buildReasons(contextText, context.work, context.author, author),
    guide: buildReaderGuide(scored, contextText, title)
  };
}

function resetResults(message = "请先从候选作品中选择一本，再生成评价。") {
  $("#total-score").textContent = "--";
  $("#confidence").textContent = "等待确认作品";
  $("#reader-fit-score").textContent = "--";
  $("#reader-fit-copy").textContent = message;
  $("#dimension-list").innerHTML = `<div class="placeholder">${message}</div>`;
  $("#reason-list").innerHTML = `<li>${escapeHTML(message)}</li>`;
  $("#reading-guide").innerHTML = `<div class="placeholder">${message}</div>`;
}

function renderContext(title, author, context) {
  $("#work-heading").textContent = context.work?.title || title;
  $("#author-heading").textContent = context.author?.title || author;
  $("#work-description").textContent = context.work?.extract || "暂未检索到稳定的公开作品介绍。你可以检查作品名/作者名是否有别名，或后续接入更完整的数据源。";
  $("#author-description").textContent = context.author?.extract || "暂未检索到稳定的作者背景。当前评分会降低置信度。";
  $("#work-description").classList.toggle("empty-text", !context.work?.extract);
  $("#author-description").classList.toggle("empty-text", !context.author?.extract);

  const workSource = $("#work-source");
  const authorSource = $("#author-source");
  workSource.hidden = !context.work?.source;
  authorSource.hidden = !context.author?.source;
  if (context.work?.source) workSource.href = context.work.source;
  if (context.author?.source) authorSource.href = context.author.source;
}

function renderScores(result) {
  $("#total-score").textContent = result.total;
  $("#confidence").textContent = `${result.confidence} · 非权威参考评分`;
  $("#reader-fit-score").textContent = result.guide.readerFit;
  $("#reader-fit-copy").textContent = result.guide.verdict;
  $("#reading-guide").innerHTML = `
    <section class="guide-block">
      <h3>优势</h3>
      <ul>${result.guide.advantages.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>
    </section>
    <section class="guide-block">
      <h3>阅读方向</h3>
      <ul>${result.guide.directions.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>
    </section>
    <section class="guide-block">
      <h3>适合人群</h3>
      <p>${escapeHTML(result.guide.audience)}</p>
    </section>
    <section class="guide-block">
      <h3>提醒</h3>
      <p>${escapeHTML(result.guide.warning)}</p>
    </section>
  `;
  $("#dimension-list").innerHTML = result.dimensions.map((item) => `
    <div class="dimension-row">
      <div class="dimension-head">
        <strong>${item.name}</strong>
        <span>${item.score}</span>
      </div>
      <div class="bar"><div style="width:${item.score}%"></div></div>
      <p class="dimension-note">${item.description}</p>
    </div>
  `).join("");

  $("#reason-list").innerHTML = result.reasons.map((reason) => `<li>${escapeHTML(reason)}</li>`).join("");
}

function renderCandidates(candidates, title, author) {
  currentCandidates = candidates;
  const card = $("#candidate-card");
  const list = $("#candidate-list");
  card.hidden = false;

  if (!candidates.length) {
    $("#candidate-hint").textContent = `没有找到与“${title} / ${author}”接近的公开条目。可以换一个译名、原名或只输入书名试试。`;
    list.innerHTML = "";
    resetResults("暂未找到候选作品，请换个书名或作者名再试。");
    return;
  }

  $("#candidate-hint").textContent = `我找到了 ${candidates.length} 个相似条目。请先点选你真正想评价的作品，避免书名/作者不配对导致误判。`;
  list.innerHTML = candidates.map((candidate, index) => `
    <button class="candidate-item" type="button" data-candidate-index="${index}">
      <span class="candidate-rank">${index + 1}</span>
      <span class="candidate-copy">
        <strong>${escapeHTML(candidate.title)}</strong>
        <small>${escapeHTML(candidate.snippet || "暂无摘要，点击后尝试读取详情。")}</small>
      </span>
      <span class="candidate-action">选择</span>
    </button>
  `).join("");

  $$("[data-candidate-index]").forEach((button) => {
    button.addEventListener("click", () => selectCandidate(Number(button.dataset.candidateIndex)));
  });

  resetResults("已找到候选，请先选择一本作品。");
}

async function selectCandidate(index) {
  const candidate = currentCandidates[index];
  const author = $("#author-name").value.trim();
  if (!candidate) return;

  $$("[data-candidate-index]").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.candidateIndex) === index);
  });

  const button = $("#evaluate-button");
  button.disabled = true;
  button.textContent = "生成评价…";

  try {
    const context = await fetchLiteraryContextFromCandidate(candidate, author);
    renderContext(candidate.title, author, context);
    renderScores(evaluate(candidate.title, author, context));
    showToast(`已选择《${candidate.title}》`);
  } catch (error) {
    console.error(error);
    showToast("读取候选详情失败，请换一个候选试试");
  } finally {
    button.disabled = false;
    button.textContent = "重新搜索";
  }
}

async function handleEvaluation(event) {
  event.preventDefault();
  const title = $("#work-title").value.trim();
  const author = $("#author-name").value.trim();
  if (!title || !author) return;

  const button = $("#evaluate-button");
  button.disabled = true;
  button.textContent = "评价中…";

  try {
    const candidates = await findWorkCandidates(title, author);
    renderCandidates(candidates, title, author);
    renderContext(title, author, { work: null, author: null });
  } catch (error) {
    console.error(error);
    renderCandidates([], title, author);
    renderContext(title, author, { work: null, author: null });
    showToast("资料检索失败，请换个书名或作者名再试");
  } finally {
    button.disabled = false;
    button.textContent = "重新搜索";
  }
}

$("#evaluation-form").addEventListener("submit", handleEvaluation);

if (location.protocol === "file:") {
  showToast("建议用本地服务器或 GitHub Pages 打开，浏览器直接打开文件可能无法检索资料");
}
