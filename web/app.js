const messages = document.getElementById("messages");
const composer = document.getElementById("composer");
const input = document.getElementById("messageInput");
const authGate = document.getElementById("authGate");
const appShell = document.getElementById("appShell");
const authForm = document.getElementById("authForm");
const authStatus = document.getElementById("authStatus");
const authPassword = document.getElementById("authPassword");
const adultConfirmRow = document.getElementById("adultConfirmRow");
const adultConfirmed = document.getElementById("adultConfirmed");
const authSubmit = document.getElementById("authSubmit");

const API_BASE_URL =
  window.SOL_API_BASE_URL ||
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:8080"
    : "https://api.guigamusic.com.br");

const STORAGE_KEY_PREFIX = "sol_active_character_";

const labels = {
  sol: "Sol AI ♛",
  luna: "Luna ☾",
  maya: "Maia ☀",
  valentina: "Valentina ♥",
  jade: "Jade ♣"
};

const companionMeta = {
  sol: {
    title: "Sol",
    subtitle: "A dona",
    label: "Sol AI ♛",
    mainImage: "assets/sol.png",
    thumb: "assets/sol_thumb.png"
  },
  luna: {
    title: "Luna",
    subtitle: "A misteriosa",
    label: "Luna ☾",
    mainImage: "assets/luna.png",
    thumb: "assets/luna.png"
  },
  maya: {
    title: "Maia",
    subtitle: "A provocante",
    label: "Maia ☀",
    mainImage: "assets/maya.png",
    thumb: "assets/maya.png"
  },
  valentina: {
    title: "Valentina",
    subtitle: "A intensa",
    label: "Valentina ♥",
    mainImage: "assets/valentina.png",
    thumb: "assets/valentina.png"
  },
  jade: {
    title: "Jade",
    subtitle: "A elegante",
    label: "Jade ♣",
    mainImage: "assets/jade.png",
    thumb: "assets/jade.png"
  }
};

let activeCharacter = "sol";
let enviando = false;
let currentUser = null;
let authMode = "login";
let historyLoadVersion = 0;

function setAuthMode(mode) {
  authMode = mode === "register" ? "register" : "login";
  document.querySelectorAll(".auth-mode").forEach((button) => {
    const selected = button.dataset.authMode === authMode;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  document.getElementById("authTitle").textContent =
    authMode === "register" ? "Crie sua conta" : "Entre na sua conta";
  authSubmit.textContent = authMode === "register" ? "Criar conta" : "Entrar";
  adultConfirmRow.hidden = authMode !== "register";
  authPassword.autocomplete = authMode === "register" ? "new-password" : "current-password";
  authStatus.textContent = "";
}

function showAuthGate(message = "") {
  currentUser = null;
  historyLoadVersion += 1;
  appShell.hidden = true;
  authGate.hidden = false;
  authStatus.textContent = message;
  input.value = "";
}

async function loadHistoryFromServer(characterKey) {
  if (!currentUser) return;
  const requestVersion = ++historyLoadVersion;
  messages.innerHTML = "";
  addMessage("Carregando conversa...", "assistant", characterKey);

  try {
    const query = new URLSearchParams({ companion: characterKey });
    const response = await fetch(`${API_BASE_URL}/api/chat/history?${query}`, {
      credentials: "include"
    });

    if (response.status === 401) {
      showAuthGate("Sua sessão expirou. Entre novamente.");
      return;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (requestVersion !== historyLoadVersion || characterKey !== activeCharacter) return;
    messages.innerHTML = "";
    (data.messages || []).forEach((item) => {
      if (item && item.role && typeof item.content === "string") {
        addMessage(item.content, item.role, characterKey);
      }
    });
    if (!data.messages?.length) {
      addMessage("Oi... estou aqui com você.", "assistant", characterKey);
    }
  } catch (error) {
    console.error("Erro ao carregar conversa:", error);
    if (requestVersion === historyLoadVersion) {
      messages.innerHTML = "";
      addMessage("Não consegui carregar esta conversa agora.", "assistant", characterKey);
    }
  }
}

function showAuthenticatedApp(user) {
  currentUser = user;
  authGate.hidden = true;
  appShell.hidden = false;
  const emailNode = document.getElementById("accountEmail");
  const avatarNode = document.querySelector(".user-avatar");
  emailNode.textContent = user.email;
  avatarNode.textContent = user.email.slice(0, 1).toUpperCase();
  const storageKey = `${STORAGE_KEY_PREFIX}${encodeURIComponent(user.email)}`;
  activeCharacter = localStorage.getItem(storageKey) || "sol";
  setActiveCharacter(activeCharacter);
}

async function initializeAuthentication() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      credentials: "include"
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.authenticated && data.user) {
      showAuthenticatedApp(data.user);
    } else {
      showAuthGate();
    }
  } catch (error) {
    console.error("Erro ao verificar sessão:", error);
    showAuthGate("Não foi possível conectar ao serviço. Tente novamente.");
  }
}

document.querySelectorAll(".auth-mode").forEach((button) => {
  button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    email: document.getElementById("authEmail").value.trim(),
    password: authPassword.value,
    adult_confirmed: authMode === "register" && adultConfirmed.checked
  };

  if (authMode === "register" && !payload.adult_confirmed) {
    authStatus.textContent = "Confirme que você tem 18 anos ou mais.";
    return;
  }

  authSubmit.disabled = true;
  authStatus.textContent = "";
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/${authMode}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      authStatus.textContent = data.error || "Não foi possível entrar.";
      return;
    }
    authForm.reset();
    showAuthenticatedApp(data.user);
  } catch (error) {
    console.error("Erro de autenticação:", error);
    authStatus.textContent = "Não foi possível conectar ao serviço.";
  } finally {
    authSubmit.disabled = false;
  }
});

document.getElementById("logoutButton").addEventListener("click", async () => {
  try {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
  } finally {
    showAuthGate();
    authPassword.value = "";
  }
});

function setActiveCharacter(name) {
  const key = companionMeta[name] ? name : "sol";
  activeCharacter = key;

  const meta = companionMeta[key];

  document.querySelectorAll(".companion, .right-card").forEach((card) => {
    const isActive = card.dataset.character === key;
    card.classList.toggle("active", isActive);
  });

  const profileTitle = document.querySelector(".profile-copy h1");
  const profileRole = document.querySelector(".profile-copy .role");
  const mainImage = document.querySelector(".profile-photo img");
  const chatName = document.getElementById("chatName");
  const chatIdentityImage = document.querySelector(".chat-identity img");

  if (profileTitle) profileTitle.innerHTML = `${meta.title} <span>♛</span>`;
  if (profileRole) profileRole.textContent = meta.subtitle;
  if (mainImage) mainImage.src = meta.mainImage;
  if (chatName) chatName.textContent = meta.label;
  if (chatIdentityImage) chatIdentityImage.src = meta.thumb;

  const composerInput = document.getElementById("messageInput");
  if (composerInput) {
    composerInput.placeholder = `Digite sua mensagem para ${meta.title}...`;
  }

  if (currentUser) {
    const storageKey = `${STORAGE_KEY_PREFIX}${encodeURIComponent(currentUser.email)}`;
    localStorage.setItem(storageKey, key);
    loadHistoryFromServer(key);
  }
}

function addMessage(text, role = "user", characterKey = activeCharacter) {
  const row = document.createElement("div");
  row.className = `msg ${role}`;

  if (role === "assistant") {
    const thumb = companionMeta[characterKey]?.thumb || "assets/sol_thumb.png";
    row.innerHTML = `
      <img src="${thumb}" alt="${companionMeta[characterKey]?.title || "Sol"}">
      <div>
        <div class="bubble"></div>
        <time>agora</time>
      </div>
    `;
  } else {
    row.innerHTML = `
      <div>
        <div class="bubble"></div>
        <time>agora ✓✓</time>
      </div>
    `;
  }

  row.querySelector(".bubble").textContent = text;
  messages.appendChild(row);
  messages.scrollTop = messages.scrollHeight;

  return row;
}

function addTyping() {
  const row = document.createElement("div");
  row.className = "msg assistant typing-message";

  const meta = companionMeta[activeCharacter] || companionMeta.sol;

  row.innerHTML = `
    <img src="${meta.thumb}" alt="${meta.title}">
    <div>
      <div class="bubble">${meta.title} está digitando...</div>
      <time>agora</time>
    </div>
  `;

  messages.appendChild(row);
  messages.scrollTop = messages.scrollHeight;

  return row;
}

async function sendMessage(text) {
  text = text.trim();

  if (!text || enviando) return;

  enviando = true;

  addMessage(text, "user", activeCharacter);
  rememberMessage(activeCharacter, "user", text);
  input.value = "";
  input.focus();

  const typing = addTyping();

  try {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: text,
        companion: activeCharacter
      })
    });

    if (!response.ok) {
      if (response.status === 401) {
        showAuthGate("Sua sessão expirou. Entre novamente.");
        return;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    typing.remove();

    if (data.resposta) {
      addMessage(data.resposta, "assistant", activeCharacter);
    } else if (data.error) {
      const message = `Erro: ${data.error}`;
      addMessage(message, "assistant", activeCharacter);
    } else {
      const message = "Estou aqui, Guiga.";
      addMessage(message, "assistant", activeCharacter);
    }

  } catch (erro) {
    typing.remove();

    console.error("Erro no chat:", erro);

    const message = `Não consegui falar com o servidor da ${companionMeta[activeCharacter]?.title || "Sol"} agora.`;
    addMessage(message, "assistant", activeCharacter);

  } finally {
    enviando = false;
    input.focus();
  }
}


/* =========================================================
   ENVIO DA MENSAGEM
   ========================================================= */

composer.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(input.value);
});


/* Enter envia a mensagem.
   Shift + Enter mantém o comportamento normal. */

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    composer.requestSubmit();
  }
});


/* =========================================================
   SELEÇÃO DAS PERSONAGENS
   ========================================================= */

document.querySelectorAll(".companion, .right-card").forEach(card => {

  card.addEventListener("click", () => {
    const name = card.dataset.character;
    setActiveCharacter(name);
  });

});


/* =========================================================
   NOVA CONVERSA
   ========================================================= */

const newChat = document.getElementById("newChat");

if (newChat) {

  newChat.addEventListener("click", () => {
    fetch(`${API_BASE_URL}/api/chat/clear`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companion: activeCharacter })
    }).then(async (response) => {
      if (response.status === 401) {
        showAuthGate("Sua sessão expirou. Entre novamente.");
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      messages.innerHTML = "";
      addMessage("Nova conversa iniciada. Estou aqui com você.", "assistant", activeCharacter);
      input.focus();
    }).catch((error) => {
      console.error("Erro ao iniciar conversa:", error);
      addMessage("Não consegui iniciar uma nova conversa agora.", "assistant", activeCharacter);
    });
  });

}


/* =========================================================
   MENU LATERAL
   ========================================================= */

document.querySelectorAll(".nav-item").forEach(item => {

  item.addEventListener("click", () => {

    document
      .querySelectorAll(".nav-item")
      .forEach(x => x.classList.remove("active"));

    item.classList.add("active");
  });

});


/* =========================================================
   FOCO AUTOMÁTICO
   ========================================================= */

window.addEventListener("load", () => {
  setAuthMode("login");
  initializeAuthentication();
});
