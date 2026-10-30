
"use strict";

/*
  CHECK W RABY — FRONT-END PROTOTYPE

  Features:
  - Intro loading animation
  - Topic-based claim suggestions
  - Three source discovery links
  - Claim selection and management
  - Source selection and status workflow
  - Review notes, dashboard, history, and report export

  IMPORTANT:
  This version uses search URLs and browser storage.
  It does not access live search results, inspect web pages, or use an AI API.
  Source selection records a prototype assessment, not independently proven truth.
*/

const $ = (selector) => document.querySelector(selector);

const introScreen = $("#introScreen");
const app = $("#app");
const chatMessages = $("#chatMessages");
const claimsList = $("#claimsList");
const sourceList = $("#sourceList");
const answerInput = $("#answerInput");
const claimInput = $("#claimInput");
const topicSearch = $("#topicSearch");
const sourceNotes = $("#sourceNotes");

const STORAGE_KEY = "checkWRabySessions_v1";

let claims = [];
let selectedClaimId = null;
let currentTopic = "";
let chatHistory = [];
let toastTimer;

const sourceTemplates = [
  {
    title: "Google Scholar",
    type: "Academic research",
    description:
      "Find academic papers, journal articles, and research relevant to this claim.",
    buildUrl: (query) =>
      "https://scholar.google.com/scholar?q=" + encodeURIComponent(query)
  },
  {
    title: "Google Fact Check Explorer",
    type: "Fact-checking",
    description:
      "Search for existing fact-checking articles and previously assessed claims.",
    buildUrl: (query) =>
      "https://toolbox.google.com/factcheck/explorer/search/" +
      encodeURIComponent(query)
  },
  {
    title: "Google Search",
    type: "News and reference sources",
    description:
      "Find reports, official publications, and other sources to compare against the claim.",
    buildUrl: (query) =>
      "https://www.google.com/search?q=" + encodeURIComponent(query)
  }
];


// --------------------------------------------------
// INTRO ANIMATION
// --------------------------------------------------

window.addEventListener("load", () => {
  setTimeout(() => {
    introScreen.classList.add("hidden");
    app.classList.remove("hidden");

    addChatMessage(
      "assistant",
      "Welcome to Veyra AI! Please log in or create an account to access your verification workspace."
    );

    // Check the user's login status.
    if (window.veyraAuth) {
      window.veyraAuth.getCurrentUser()
        .then((user) => {
          const authSection = document.getElementById("auth-section");

          if (authSection) {
            authSection.style.display = "block";
          }

          if (user) {
            console.log("User is logged in:", user.email);
          }
        })
        .catch((error) => {
          console.error("Authentication check failed:", error);
        });
    }
  }, 3000);
});

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function createId() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character];
  });
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

function getSelectedClaim() {
  return claims.find((claim) => claim.id === selectedClaimId) || null;
}

function getStatusLabel(status) {
  const labels = {
    pending: "Pending",
    verified: "Verified · Recorded",
    unverified: "Unverified",
    disputed: "Disputed"
  };

  return labels[status] || "Pending";
}

function normalizeQuery(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function buildSearchQuery(claim) {
  return normalizeQuery(claim.text);
}

// --------------------------------------------------
// CHAT
// --------------------------------------------------

function addChatMessage(role, text) {
  const message = document.createElement("div");
  message.className =
    role === "user"
      ? "message user-message"
      : "message assistant-message";

  if (role === "assistant") {
    const avatar = document.createElement("img");
    avatar.src = "logo (2).png";
    avatar.alt = "Raby";
    message.appendChild(avatar);
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  bubble.appendChild(paragraph);

  message.appendChild(bubble);
  chatMessages.appendChild(message);

  chatMessages.scrollTop = chatMessages.scrollHeight;

  chatHistory.push({
    role,
    text,
    timestamp: new Date().toISOString()
  });
}

function handleChatMessage(rawMessage) {
  const message = normalizeQuery(rawMessage);

  if (!message) return;

  addChatMessage("user", message);

  const lower = message.toLowerCase();

  if (
    lower.includes("suggest claims") ||
    lower.includes("generate claims") ||
    lower.includes("corruption") ||
    lower.includes("claims about")
  ) {
    const topic =
      lower.includes("corruption")
        ? "corruption in the Philippines"
        : currentTopic || message;

    suggestClaimsForTopic(topic);
    return;
  }

  if (
    lower.includes("credible source") ||
    lower.includes("academic source") ||
    lower.includes("find source")
  ) {
    addChatMessage(
      "assistant",
      "Start with Google Scholar for academic research, Google Fact Check Explorer for existing fact-checks, and official government or institutional websites for primary documents. Select a claim in your workspace to see the source suggestions."
    );

    if (selectedClaimId) {
      renderSources();
    }

    return;
  }

  if (
    lower.includes("how to verify") ||
    lower.includes("verify a claim") ||
    lower.includes("verification")
  ) {
    addChatMessage(
      "assistant",
      "Check whether the source directly supports the exact statement. Examine the author, publication date, original evidence, and possible conflicts with other reliable sources. Record your notes, then select an appropriate status. Choosing a link alone cannot establish that a claim is true."
    );
    return;
  }

  if (
    lower.includes("disputed") ||
    lower.includes("conflicting evidence")
  ) {
    addChatMessage(
      "assistant",
      "Mark a claim as disputed when credible sources disagree or the available evidence conflicts. Keep the competing references and explain the disagreement in your review notes."
    );
    return;
  }

  if (
    lower.includes("unverified") ||
    lower.includes("not verified")
  ) {
    addChatMessage(
      "assistant",
      "A claim should remain unverified when the sources reviewed do not provide enough evidence to support it. You can still attach references and document what remains uncertain."
    );
    return;
  }

  if (
    lower.includes("help") ||
    lower.includes("what can you do")
  ) {
    addChatMessage(
      "assistant",
      "I can help you organize claims, find source-search links, record references, save notes, and prepare a verification report. This demo uses predefined guidance rather than a connected AI model."
    );
    return;
  }

  addChatMessage(
    "assistant",
    "I can help you investigate that. Search the topic above or add the statement to your workspace. I'll provide source-search links so you can examine the evidence. For a conversational AI that understands arbitrary questions and evaluates live sources, connect an AI and search API."
  );
}

$("#chatForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const input = $("#chatInput");
  const message = input.value;

  input.value = "";
  handleChatMessage(message);
});

document.querySelectorAll(".prompt-btn").forEach((button) => {
  button.addEventListener("click", () => {
    handleChatMessage(button.dataset.prompt);
  });
});

$("#clearChatBtn").addEventListener("click", () => {
  chatMessages.replaceChildren();
  chatHistory = [];

  addChatMessage(
    "assistant",
    "Chat cleared! What would you like to investigate next?"
  );
});

// --------------------------------------------------
// TOPIC SEARCH AND SUGGESTED CLAIMS
// --------------------------------------------------

$("#topicSearchForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const topic = normalizeQuery(topicSearch.value);

  if (!topic) {
    showToast("Enter a topic to investigate.");
    topicSearch.focus();
    return;
  }

  currentTopic = topic;

  addChatMessage(
    "user",
    "Help me investigate: " + topic
  );

  suggestClaimsForTopic(topic);
});

document.querySelectorAll(".topic-chip").forEach((button) => {
  button.addEventListener("click", () => {
    topicSearch.value = button.dataset.topic;
    $("#topicSearchForm").requestSubmit();
  });
});

function suggestClaimsForTopic(topic) {
  currentTopic = normalizeQuery(topic);
  topicSearch.value = currentTopic;

  const normalized = currentTopic.toLowerCase();

  let suggestions;

  if (
    normalized.includes("corruption") ||
    normalized.includes("government")
  ) {
    suggestions = [
      `What official reports or audit findings document corruption-related allegations involving ${currentTopic}?`,
      `What evidence do credible news organizations and official records provide about ${currentTopic}?`,
      `Have independent investigations or published fact-checks examined specific claims about ${currentTopic}?`
    ];
  } else if (
    normalized.includes("climate") ||
    normalized.includes("environment")
  ) {
    suggestions = [
      `What scientific studies provide evidence about ${currentTopic}?`,
      `What do official scientific assessments report about ${currentTopic}?`,
      `Do independent research organizations agree on the evidence related to ${currentTopic}?`
    ];
  } else if (
    normalized.includes("health") ||
    normalized.includes("medical")
  ) {
    suggestions = [
      `What do published medical studies say about ${currentTopic}?`,
      `What guidance do recognized public health authorities provide about ${currentTopic}?`,
      `Have reputable fact-checking organizations investigated claims about ${currentTopic}?`
    ];
  } else {
    suggestions = [
      `What reliable research supports claims about ${currentTopic}?`,
      `What official reports or primary sources document ${currentTopic}?`,
      `What independent sources confirm or challenge statements about ${currentTopic}?`
    ];
  }

  const added = [];

  suggestions.forEach((text) => {
    const exists = claims.some(
      (claim) => claim.text.toLowerCase() === text.toLowerCase()
    );

    if (!exists) {
      const claim = {
        id: createId(),
        text,
        status: "pending",
        source: null,
        notes: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      claims.push(claim);
      added.push(claim);
    }
  });

  if (added.length > 0) {
    selectedClaimId = added[0].id;
  }

  renderClaims();
  renderSources();
  updateDashboard();

  addChatMessage(
    "assistant",
    `I've prepared ${suggestions.length} claim prompts for "${currentTopic}". These are questions to investigate, not established facts. Select one in your workspace to explore source links.`
  );

  showToast("Topic prompts prepared.");
}

// --------------------------------------------------
// CLAIM ORGANIZATION
// --------------------------------------------------

function addClaim(text) {
  const normalized = normalizeQuery(text);

  if (!normalized) {
    showToast("Enter a claim first.");
    return;
  }

  const duplicate = claims.find(
    (claim) => claim.text.toLowerCase() === normalized.toLowerCase()
  );

  if (duplicate) {
    selectedClaimId = duplicate.id;
    renderClaims();
    renderSources();
    showToast("This claim is already in your workspace.");
    return;
  }

  const claim = {
    id: createId(),
    text: normalized,
    status: "pending",
    source: null,
    notes: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  claims.push(claim);
  selectedClaimId = claim.id;

  renderClaims();
  renderSources();
  updateDashboard();

  showToast("Claim added.");
}

$("#addClaimBtn").addEventListener("click", () => {
  addClaim(claimInput.value);
  claimInput.value = "";
});

$("#extractBtn").addEventListener("click", () => {
  const text = normalizeQuery(answerInput.value);

  if (!text) {
    showToast("Paste an AI-generated answer first.");
    answerInput.focus();
    return;
  }

  /*
    Basic sentence splitting for this demo.
    Complex text may require a proper sentence tokenizer or AI API.
  */

  const statements = text
    .replace(/\r/g, "\n")
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 12);

  if (!statements.length) {
    showToast("No suitable statements found.");
    return;
  }

  let addedCount = 0;

  statements.forEach((statement) => {
    const before = claims.length;
    addClaimSilently(statement);

    if (claims.length > before) {
      addedCount++;
    }
  });

  if (!selectedClaimId && claims.length) {
    selectedClaimId = claims[0].id;
  }

  renderClaims();
  renderSources();
  updateDashboard();

  addChatMessage(
    "assistant",
    `I've organized the pasted text into ${statements.length} possible statements. ${addedCount} new claims were added. Please review each statement and edit any that were split incorrectly.`
  );

  showToast(`${addedCount} claims organized.`);
});

function addClaimSilently(text) {
  const normalized = normalizeQuery(text);

  if (!normalized) return;

  const exists = claims.some(
    (claim) => claim.text.toLowerCase() === normalized.toLowerCase()
  );

  if (exists) return;

  claims.push({
    id: createId(),
    text: normalized,
    status: "pending",
    source: null,
    notes: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  if (!selectedClaimId) {
    selectedClaimId = claims[claims.length - 1].id;
  }
}

function selectClaim(id) {
  selectedClaimId = id;

  const claim = getSelectedClaim();

  if (claim) {
    sourceNotes.value = claim.notes || "";
  }

  renderClaims();
  renderSources();
}

$("#claimFilter").addEventListener("change", renderClaims);

function renderClaims() {
  const filter = $("#claimFilter").value;

  const visibleClaims = claims.filter((claim) => {
    return filter === "all" || claim.status === filter;
  });

  $("#claimCountBadge").textContent = claims.length;

  if (!visibleClaims.length) {
    claimsList.innerHTML = `
      <div class="empty-state">
        <span>✦</span>
        <h3>No claims found</h3>
        <p>Add a claim or select another filter.</p>
      </div>
    `;
    return;
  }

  claimsList.innerHTML = visibleClaims.map((claim, index) => {
    const selected = claim.id === selectedClaimId;
    const statusClass = `status-${claim.status}`;

    return `
      <article class="claim-card ${selected ? "selected" : ""}">
        <div class="claim-topline">
          <span class="claim-number">
            CLAIM ${String(index + 1).padStart(2, "0")}
          </span>
          <span class="status-badge ${statusClass}">
            ${escapeHTML(getStatusLabel(claim.status))}
          </span>
        </div>

        <p class="claim-text">${escapeHTML(claim.text)}</p>

        ${
          claim.source
            ? `<div class="claim-notes-preview">
                Selected source: ${escapeHTML(claim.source.title)}
              </div>`
            : ""
        }

        ${
          claim.notes
            ? `<div class="claim-notes-preview">
                Notes: ${escapeHTML(claim.notes)}
              </div>`
            : ""
        }

        <div class="claim-actions">
          <button
            type="button"
            class="select-claim-btn"
            data-action="select"
            data-id="${claim.id}">
            Find Sources
          </button>

          <button
            type="button"
            data-action="edit"
            data-id="${claim.id}">
            Edit
          </button>

          <button
            type="button"
            data-action="status"
            data-status="pending"
            data-id="${claim.id}">
            Pending
          </button>

          <button
            type="button"
            data-action="status"
            data-status="verified"
            data-id="${claim.id}">
            Mark Verified
          </button>

          <button
            type="button"
            data-action="status"
            data-status="unverified"
            data-id="${claim.id}">
            Unverified
          </button>

          <button
            type="button"
            data-action="status"
            data-status="disputed"
            data-id="${claim.id}">
            Disputed
          </button>

          <button
            type="button"
            data-action="delete"
            data-id="${claim.id}">
            Delete
          </button>
        </div>
      </article>
    `;
  }).join("");
}

claimsList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");

  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;
  const claim = claims.find((item) => item.id === id);

  if (!claim) return;

  if (action === "select") {
    selectClaim(id);
    showToast("Claim selected. Review the source suggestions.");
  }

  if (action === "edit") {
    const revised = window.prompt(
      "Edit claim:",
      claim.text
    );

    if (revised === null) return;

    const normalized = normalizeQuery(revised);

    if (!normalized) {
      showToast("A claim cannot be empty.");
      return;
    }

    claim.text = normalized;
    claim.status = "pending";
    claim.source = null;
    claim.updatedAt = new Date().toISOString();

    selectClaim(id);
    updateDashboard();

    showToast("Claim updated. Its previous assessment was reset.");
  }

  if (action === "status") {
    const status = button.dataset.status;

    if (status === "verified" && !claim.source) {
      showToast("Review and select a source before recording verification.");
      selectClaim(id);
      return;
    }

    claim.status = status;
    claim.updatedAt = new Date().toISOString();

    renderClaims();
    updateDashboard();

    showToast("Claim status updated.");
  }

  if (action === "delete") {
    if (!window.confirm("Delete this claim?")) return;

    claims = claims.filter((item) => item.id !== id);

    if (selectedClaimId === id) {
      selectedClaimId = claims[0]?.id || null;
    }

    renderClaims();
    renderSources();
    updateDashboard();

    showToast("Claim deleted.");
  }
});

// --------------------------------------------------
// SOURCE SUGGESTIONS
// --------------------------------------------------

function renderSources() {
  const claim = getSelectedClaim();

  if (!claim) {
    $("#selectedClaimText").textContent =
      "Choose a claim from your workspace to find relevant sources.";

    sourceList.innerHTML = `
      <div class="source-placeholder">
        <span>⌕</span>
        <p>Your three suggested source links will appear here.</p>
      </div>
    `;

    sourceNotes.value = "";
    return;
  }

  $("#selectedClaimText").textContent = claim.text;
  sourceNotes.value = claim.notes || "";

  const query = buildSearchQuery(claim);

  sourceList.innerHTML = sourceTemplates.map((source, index) => {
    const url = source.buildUrl(query);

    const isChosen =
      claim.source && claim.source.title === source.title;

    return `
      <article class="source-card">
        <span class="source-type">
          ${escapeHTML(source.type)}
        </span>

        <h4>${escapeHTML(source.title)}</h4>

        <p>${escapeHTML(source.description)}</p>

        <span class="source-domain">
          ${escapeHTML(new URL(url).hostname)}
        </span>

        <div class="source-buttons">
          <a
            class="find-source-btn"
            href="${escapeHTML(url)}"
            target="_blank"
            rel="noopener noreferrer">
            Find Source ↗
          </a>

          <button
            type="button"
            class="choose-source-btn"
            data-source-index="${index}"
            ${isChosen ? "disabled" : ""}>
            ${isChosen ? "✓ Selected" : "Choose This Link"}
          </button>
        </div>
      </article>
    `;
  }).join("");
}

sourceList.addEventListener("click", (event) => {
  const button = event.target.closest(
    "button[data-source-index]"
  );

  if (!button) return;

  const claim = getSelectedClaim();

  if (!claim) {
    showToast("Select a claim first.");
    return;
  }

  const index = Number(button.dataset.sourceIndex);
  const template = sourceTemplates[index];

  if (!template) return;

  const url = template.buildUrl(buildSearchQuery(claim));

  /*
    This records a selected reference.
    A production version must fetch and evaluate actual source content.
  */

  claim.source = {
    title: template.title,
    type: template.type,
    url,
    selectedAt: new Date().toISOString()
  };

  claim.status = "pending";
  claim.updatedAt = new Date().toISOString();

  renderClaims();
  renderSources();
  updateDashboard();

  addChatMessage(
    "assistant",
    `You've selected ${template.title} as a reference for your claim. The reference has been recorded. Please open it, inspect the actual evidence, and write your findings in the review notes before assigning a final verification status.`
  );

  showToast("Reference selected. Review its evidence.");
});

// --------------------------------------------------
// REVIEW NOTES
// --------------------------------------------------

$("#saveNotesBtn").addEventListener("click", () => {
  const claim = getSelectedClaim();

  if (!claim) {
    showToast("Select a claim before saving notes.");
    return;
  }

  claim.notes = normalizeQuery(sourceNotes.value);
  claim.updatedAt = new Date().toISOString();

  renderClaims();

  showToast("Review notes saved.");
});

// --------------------------------------------------
// DASHBOARD
// --------------------------------------------------

function updateDashboard() {
  const total = claims.length;

  const reviewed = claims.filter(
    (claim) => Boolean(claim.source)
  ).length;

  const verified = claims.filter(
    (claim) => claim.status === "verified"
  ).length;

  const pending = claims.filter(
    (claim) =>
      claim.status === "pending" ||
      claim.status === "unverified" ||
      claim.status === "disputed"
  ).length;

  $("#totalClaims").textContent = total;
  $("#reviewedClaims").textContent = reviewed;
  $("#verifiedClaims").textContent = verified;
  $("#pendingClaims").textContent = pending;
}

// --------------------------------------------------
// SESSION STORAGE AND HISTORY
// --------------------------------------------------

function getSessions() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const sessions = stored ? JSON.parse(stored) : [];

    return Array.isArray(sessions) ? sessions : [];
  } catch (error) {
    console.error("Could not read session history:", error);
    return [];
  }
}

function saveSession(silent = false) {
  const sessions = getSessions();

  const session = {
    id: createId(),
    title: currentTopic || "Verification Session",
    savedAt: new Date().toISOString(),
    claims: JSON.parse(JSON.stringify(claims))
  };

  sessions.unshift(session);

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(sessions.slice(0, 30))
    );

    if (!silent) {
      showToast("Session saved in this browser.");
    }
  } catch (error) {
    console.error("Could not save session:", error);
    showToast("Unable to save. Browser storage may be full.");
  }
}

$("#saveBtn").addEventListener("click", () => {
  saveSession();
});

function openHistory() {
  const modal = $("#historyModal");
  const historyList = $("#historyList");
  const sessions = getSessions();

  if (!sessions.length) {
    historyList.innerHTML = `
      <div class="empty-state">
        <span>◷</span>
        <h3>No saved sessions yet</h3>
        <p>Save a session to revisit your claims and recorded assessments.</p>
      </div>
    `;
  } else {
    historyList.innerHTML = sessions.map((session) => {
      const count = Array.isArray(session.claims)
        ? session.claims.length
        : 0;

      return `
        <article class="history-item">
          <strong>${escapeHTML(session.title)}</strong>
          <p>
            ${count} claims ·
            ${escapeHTML(new Date(session.savedAt).toLocaleString())}
          </p>

          <button
            type="button"
            class="gold-btn"
            data-history-action="load"
            data-id="${session.id}">
            Open Session
          </button>

          <button
            type="button"
            class="outline-btn"
            data-history-action="delete"
            data-id="${session.id}">
            Delete
          </button>
        </article>
      `;
    }).join("");
  }

  modal.classList.remove("hidden");
}

$("#historyBtn").addEventListener("click", openHistory);

$("#closeHistoryBtn").addEventListener("click", () => {
  $("#historyModal").classList.add("hidden");
});

$("#closeHistoryBottom").addEventListener("click", () => {
  $("#historyModal").classList.add("hidden");
});

$("#historyModal").addEventListener("click", (event) => {
  if (event.target === $("#historyModal")) {
    $("#historyModal").classList.add("hidden");
  }
});

$("#historyList").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-history-action]");

  if (!button) return;

  const sessions = getSessions();
  const session = sessions.find(
    (item) => item.id === button.dataset.id
  );

  if (!session) return;

  if (button.dataset.historyAction === "load") {
    if (!window.confirm(
      "Open this session? Your current unsaved changes will be replaced."
    )) return;

    claims = Array.isArray(session.claims)
      ? session.claims
      : [];

    currentTopic = session.title || "";
    selectedClaimId = claims[0]?.id || null;

    $("#claimFilter").value = "all";
    topicSearch.value = currentTopic;

    renderClaims();
    renderSources();
    updateDashboard();

    $("#historyModal").classList.add("hidden");

    addChatMessage(
      "assistant",
      `Your saved session "${currentTopic}" has been restored. Review the existing claims, references, and notes.`
    );

    showToast("Session restored.");
  }

  if (button.dataset.historyAction === "delete") {
    if (!window.confirm("Delete this saved session?")) return;

    const remaining = sessions.filter(
      (item) => item.id !== session.id
    );

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(remaining)
    );

    openHistory();
    showToast("Saved session deleted.");
  }
});

// --------------------------------------------------
// NEW SESSION
// --------------------------------------------------

$("#newSessionBtn").addEventListener("click", () => {
  if (
    claims.length &&
    !window.confirm(
      "Start a new session? Save your current work first if you need it later."
    )
  ) {
    return;
  }

  claims = [];
  selectedClaimId = null;
  currentTopic = "";
  chatHistory = [];

  topicSearch.value = "";
  answerInput.value = "";
  claimInput.value = "";
  sourceNotes.value = "";

  $("#claimFilter").value = "all";

  chatMessages.replaceChildren();

  renderClaims();
  renderSources();
  updateDashboard();

  addChatMessage(
    "assistant",
    "A fresh workspace is ready! Search a topic or paste an AI-generated answer to get started."
  );

  showToast("New session started.");
});

// --------------------------------------------------
// REPORT EXPORT
// --------------------------------------------------

$("#exportBtn").addEventListener("click", () => {
  if (!claims.length) {
    showToast("Add at least one claim before exporting.");
    return;
  }

  const report = [
    "CHECK W RABY",
    "AI ANSWER VERIFICATION REPORT",
    "================================",
    `Topic: ${currentTopic || "General verification"}`,
    `Exported: ${new Date().toLocaleString()}`,
    "",
    "IMPORTANT: Recorded statuses reflect the review documented",
    "in this prototype and are not an independent guarantee of truth.",
    ""
  ];

  claims.forEach((claim, index) => {
    report.push(`CLAIM ${index + 1}`);
    report.push(claim.text);
    report.push(`Status: ${getStatusLabel(claim.status)}`);
    report.push(
      `Selected source: ${claim.source?.title || "None"}`
    );
    report.push(
      `Source URL: ${claim.source?.url || "None"}`
    );
    report.push(`Review notes: ${claim.notes || "None"}`);
    report.push("--------------------------------");
    report.push("");
  });

  const blob = new Blob(
    [report.join("\n")],
    { type: "text/plain;charset=utf-8" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "check-w-raby-verification-report.txt";

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);

  showToast("Verification report exported.");
});

// --------------------------------------------------
// INITIALIZE
// --------------------------------------------------

renderClaims();
renderSources();
updateDashboard();