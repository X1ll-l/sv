(() => {
  "use strict";

  const LEVELS = [
    { code: "A1", name: "Начальный" },
    { code: "A2", name: "Элементарный" },
    { code: "B1", name: "Средний" },
    { code: "B2", name: "Выше среднего" },
    { code: "C1", name: "Продвинутый" },
    { code: "C2", name: "Высокий уровень" }
  ];

  const STORAGE_KEY = "swedish-learning:progress";

  let exercises = [];
  let state = {
    level: null,
    index: 0,
    variantIndex: 0,
    answer: [],   // id плашек в порядке ответа
    errors: 0,
    done: false,
    bad: false    // подсветка ошибки до следующего изменения ответа
  };

  // ---------- Прогресс (localStorage, без паролей и ключей) ----------
  function defaultProgress() {
    return { completed: [], attempts: 0, correct: 0, mistakes: 0, perEx: {} };
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultProgress();
      return { ...defaultProgress(), ...JSON.parse(raw) };
    } catch {
      return defaultProgress();
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      /* хранилище недоступно — работаем без сохранения */
    }
  }

  let progress = loadProgress();

  // ---------- Безопасный вывод (только textContent, без innerHTML) ----------
  function el(tag, props = {}, text) {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === "class") node.className = v;
      else node.setAttribute(k, v);
    });
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // ---------- Вспомогательные ----------
  // Случайный порядок (Фишера–Йетса), чтобы у каждого открывающего был свой порядок
  // Порядок внутри уровня: от простых к сложным (по числу слов).
  // Уровень делим на три части по длине; внутри каждой части порядок случайный.
  function levelOrder(list) {
    const len = e => (e.tiles || []).length;
    const sorted = [...list].sort((a, b) => len(a) - len(b));
    const third = Math.ceil(sorted.length / 3);
    return [
      ...shuffled(sorted.slice(0, third)),
      ...shuffled(sorted.slice(third, third * 2)),
      ...shuffled(sorted.slice(third * 2)),
    ];
  }

  function shuffled(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function visibleExercises() {
    if (state.order) return state.order;
    return state.level ? exercises.filter(e => e.level === state.level) : exercises;
  }

  function currentExercise() {
    return visibleExercises()[state.index];
  }

  function currentVariant(ex) {
    return ex.variants[state.variantIndex];
  }

  // Сколько слов нужно в ответе для текущей инструкции
  function requiredLength(ex) {
    return currentVariant(ex).correctAnswers[0].length;
  }

  function tileText(ex, id) {
    const t = ex.tiles.find(t => t.id === id);
    return t ? t.text : "?";
  }

  function matches(sequence, correctList) {
    return correctList.some(
      seq => seq.length === sequence.length && seq.every((id, i) => id === sequence[i])
    );
  }

  function setFeedback(text, kind = "") {
    if (!text) state.bad = false;
    const f = document.getElementById("feedback");
    f.textContent = text;
    f.className = "feedback" + (kind ? " " + kind : "");
  }

  function resetAttempt() {
    state.variantIndex = 0;
    state.answer = [];
    state.errors = 0;
    state.done = false;
    state.bad = false;
  }

  // ---------- Навигация ----------
  function showView(name) {
    document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === name));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function route() {
    const hash = location.hash.replace("#", "") || "home";
    if (hash === "builder") {
      showView("builder");
      renderExercise();
    } else if (hash === "stats") {
      showView("statsView");
      renderStats();
    } else if (hash === "levels") {
      showView("levels");
      renderLevels();
    } else {
      showView("home");
      renderHome();
    }
  }

  // ---------- Главный экран ----------
  function renderHome() {
    const total = exercises.length;
    const done = progress.completed.length;
    const stats = [
      { value: done, label: "упражнений пройдено" },
      { value: progress.correct, label: "верных ответов" },
      { value: progress.mistakes, label: "ошибок" },
      { value: total ? `${Math.round((done / total) * 100)}%` : "0%", label: "базы пройдено" }
    ];
    document.getElementById("stats").replaceChildren(...stats.map(s => {
      const card = el("div", { class: "stat" });
      card.append(el("b", {}, String(s.value)), el("span", {}, s.label));
      return card;
    }));

    // Кнопка сброса на главной странице (один раз)
    const home = document.getElementById("home");
    if (!home.querySelector(".reset-box")) home.append(buildResetBox());
  }

  // ---------- Уровни ----------
  function renderLevels() {
    const grid = document.getElementById("levelGrid");
    grid.replaceChildren(...LEVELS.map(lvl => {
      const count = exercises.filter(e => e.level === lvl.code).length;
      const doneCount = exercises.filter(
        e => e.level === lvl.code && progress.completed.includes(e.id)
      ).length;
      const btn = el("button", {
        class: "level-card",
        type: "button",
        ...(count ? {} : { disabled: "" })
      });
      btn.append(
        el("div", { class: "code" }, lvl.code),
        el("div", { class: "name" }, lvl.name),
        el("div", { class: "done" }, count
          ? `Пройдено ${doneCount} из ${count}`
          : "Упражнения скоро появятся")
      );
      btn.addEventListener("click", () => {
        if (!count) return;
        state.level = lvl.code;
        state.order = levelOrder(exercises.filter(e => e.level === lvl.code));
        state.index = 0;
        resetAttempt();
        location.hash = "builder";
      });
      return btn;
    }));
  }

  // ---------- Тренажёр ----------
  function renderExercise() {
    const list = visibleExercises();
    const ex = currentExercise();

    if (!ex) {
      document.getElementById("exLevel").textContent = state.level || "—";
      document.getElementById("exTopic").textContent = "";
      document.getElementById("exCounter").textContent = "";
      document.getElementById("instruction").textContent = "Упражнений для этого уровня пока нет.";
      ["variantSwitch", "answer", "tiles", "progress"].forEach(id =>
        document.getElementById(id).replaceChildren());
      document.getElementById("checkBtn").hidden = true;
      document.getElementById("resetBtn").hidden = true;
      document.getElementById("nextBtn").hidden = true;
      document.getElementById("explainBox").hidden = true;
      document.getElementById("translationBox").hidden = true;
      setFeedback("");
      return;
    }

    document.getElementById("translationBox").hidden = false;
    document.getElementById("checkBtn").hidden = false;
    document.getElementById("resetBtn").hidden = false;

    document.getElementById("exLevel").textContent = ex.level;
    document.getElementById("exTopic").textContent = ex.topic;
    document.getElementById("exCounter").textContent = `${state.index + 1} / ${list.length}`;
    document.getElementById("instruction").textContent = currentVariant(ex).instruction;

    renderVariantSwitch(ex);
    renderTranslation(ex);
    renderProgress(ex);
    renderAnswer(ex);
    renderTiles(ex);

    document.getElementById("explainBox").hidden = true;
    document.getElementById("nextBtn").hidden = !state.done;
    document.getElementById("resetBtn").disabled = state.done || state.answer.length === 0;
    updateCheckButton(ex);
  }

  function renderVariantSwitch(ex) {
    const box = document.getElementById("variantSwitch");
    box.replaceChildren();
    if (ex.variants.length < 2) return;
    ex.variants.forEach((v, i) => {
      const b = el("button", {
        type: "button",
        class: i === state.variantIndex ? "on" : ""
      }, v.instruction);
      b.addEventListener("click", () => {
        state.variantIndex = i;
        state.answer = [];
        state.errors = 0;
        state.done = false;
        setFeedback("");
        renderExercise();
      });
      box.append(b);
    });
  }

  function renderTranslation(ex) {
    const text = document.getElementById("translationText");
    const btn = document.getElementById("showTranslation");
    text.textContent = ex.translation;
    const autoShow = ["A1", "A2"].includes(ex.level);
    text.hidden = !autoShow;
    btn.hidden = autoShow;
    btn.textContent = "Показать перевод";
  }

  // Счётчик: точки и подпись «Добавлено N из M»
  function renderProgress(ex) {
    const need = requiredLength(ex);
    const have = state.answer.length;
    const box = document.getElementById("progress");
    box.replaceChildren();
    const dots = el("div", { class: "dots", "aria-hidden": "true" });
    for (let i = 0; i < need; i++) {
      dots.append(el("span", { class: "dot" + (i < have ? " filled" : "") }));
    }
    const label = have < need
      ? `Добавлено ${have} из ${need} слов`
      : `Все ${need} слов на месте — можно проверить`;
    box.append(dots, el("span", {}, label));
    box.classList.toggle("full", have === need);
  }

  // Поле ответа: слоты по числу нужных слов
  function renderAnswer(ex) {
    const need = requiredLength(ex);
    const box = document.getElementById("answer");
    box.replaceChildren();
    box.className = "answer" + (state.done ? " ok" : state.bad ? " bad" : "");

    for (let pos = 0; pos < need; pos++) {
      const id = state.answer[pos];
      if (id === undefined) {
        box.append(el("div", { class: "slot empty" }, String(pos + 1)));
      } else {
        let label = tileText(ex, id);
        if (pos === 0) label = label.charAt(0).toUpperCase() + label.slice(1);
        const btn = el("button", {
          type: "button",
          class: "slot filled",
          "data-pos": String(pos),
          title: "Нажмите, чтобы убрать слово"
        }, label);
        btn.disabled = state.done;
        btn.addEventListener("click", () => {
          if (state.done) return;
          state.answer.splice(pos, 1);
          setFeedback("");
          renderExercise();
        });
        box.append(btn);
      }
    }
  }

  // Плашки: пока слов ровно столько, сколько нужно, новые не добавляются
  function renderTiles(ex) {
    const need = requiredLength(ex);
    const full = state.answer.length >= need;
    const startId = currentVariant(ex).correctAnswers[0][0];
    const box = document.getElementById("tiles");
    box.replaceChildren();
    ex.tiles.forEach(tile => {
      const used = state.answer.includes(tile.id);
      const isStart = tile.id === startId;
      const text = isStart ? tile.text.charAt(0).toUpperCase() + tile.text.slice(1) : tile.text;
      const b = el("button", {
        type: "button",
        class: "tile" + (used ? " used" : "") + (isStart ? " start" : ""),
        "data-id": tile.id
      }, text);
      b.disabled = used || full || state.done;
      if (!b.disabled) {
        b.addEventListener("click", () => {
          state.answer.push(tile.id);
          setFeedback("");
          renderExercise();
        });
      }
      box.append(b);
    });
  }

  // «Проверить» активна только когда слоты заполнены полностью
  function updateCheckButton(ex) {
    const btn = document.getElementById("checkBtn");
    const need = requiredLength(ex);
    btn.disabled = state.done || state.answer.length !== need;
  }

  // ---------- Проверка ----------
  function check() {
    const ex = currentExercise();
    if (!ex || state.done) return;
    const variant = currentVariant(ex);
    const need = requiredLength(ex);
    const answerBox = document.getElementById("answer");

    if (state.answer.length !== need) {
      setFeedback(`Нужно ещё ${need - state.answer.length} слов.`, "hint");
      return;
    }

    progress.attempts += 1;
    trackEx(ex.id, "attempt");

    // Верно для текущей инструкции
    if (matches(state.answer, variant.correctAnswers)) {
      state.done = true;
      state.errors = 0;
      progress.correct += 1;
      if (!progress.completed.includes(ex.id)) progress.completed.push(ex.id);
      saveProgress();
      setFeedback("Верно.", "ok");
      renderExercise();
      return;
    }

    // Ошибка
    state.errors += 1;
    state.bad = true;
    progress.mistakes += 1;
    trackEx(ex.id, "mistake");
    saveProgress();

    // Правильно построено, но под другую инструкцию
    const otherIdx = ex.variants.findIndex((v, i) =>
      i !== state.variantIndex && matches(state.answer, v.correctAnswers)
    );
    if (otherIdx !== -1) {
      setFeedback("Порядок правильный, но не под эту инструкцию. Выберите другую инструкцию или переставьте слова.", "hint");
      renderExercise();
      return;
    }

    if (state.errors === 1) {
      setFeedback("Не совсем. Переставьте слова и попробуйте ещё раз.", "bad");
      renderExercise();
      showExplanation("Подсказка к правилу", variant.explanation);
      return;
    } else if (state.errors === 2) {
      const first = variant.correctAnswers[0][0];
      setFeedback(`Подсказка: первое слово — «${tileText(ex, first)}».`, "hint");
      renderExercise();
      return;
    } else {
      // Третья ошибка: правильный ответ и полное объяснение
      state.answer = [...variant.correctAnswers[0]];
      state.done = true;
      if (!progress.completed.includes(ex.id)) progress.completed.push(ex.id);
      saveProgress();
      state.bad = false;
      setFeedback("Правильный порядок показан в поле ответа.", "hint");
      renderExercise();
      showExplanation("Почему так", ex.explanation);
      return;
    }
    renderExercise();
  }

  function showExplanation(title, text) {
    const box = document.getElementById("explainBox");
    box.hidden = false;
    document.getElementById("explainTitle").textContent = title;
    document.getElementById("explainText").textContent = text;
  }

  // ---------- Переход ----------
  function nextExercise() {
    const list = visibleExercises();
    if (!list.length) return;
    const nextUndone = list.findIndex(
      (e, i) => i > state.index && !progress.completed.includes(e.id)
    );
    state.index = nextUndone !== -1 ? nextUndone : (state.index + 1) % list.length;
    resetAttempt();
    setFeedback("");
    renderExercise();
  }

  function continueLearning() {
    // Выбираем самый низкий уровень, где ещё есть непройденные упражнения
    const levelCodes = LEVELS.map(l => l.code);
    const pick = levelCodes.find(code =>
      exercises.some(e => e.level === code && !progress.completed.includes(e.id))
    ) || levelCodes.find(code => exercises.some(e => e.level === code));
    if (!pick) return;
    // Остаёмся внутри одного уровня: перемешиваем только его упражнения
    state.level = pick;
    state.order = levelOrder(exercises.filter(e => e.level === pick));
    const first = state.order.findIndex(e => !progress.completed.includes(e.id));
    state.index = first === -1 ? 0 : first;
    resetAttempt();
    location.hash = "builder";
  }

  // ---------- Статистика ----------
  function trackEx(id, kind) {
    if (!progress.perEx) progress.perEx = {};
    const rec = progress.perEx[id] || { attempts: 0, mistakes: 0 };
    if (kind === "attempt") rec.attempts += 1;
    if (kind === "mistake") rec.mistakes += 1;
    progress.perEx[id] = rec;
    saveProgress();
  }

  function renderStats() {
    const body = document.getElementById("statsBody");
    const total = exercises.length;
    const done = progress.completed.length;
    const accuracy = progress.attempts ? Math.round((progress.correct / progress.attempts) * 100) : 0;

    const summary = [
      { value: done + " из " + total, label: "упражнений пройдено" },
      { value: String(progress.attempts), label: "попыток всего" },
      { value: accuracy + "%", label: "верных с первой попытки" },
      { value: String(progress.mistakes), label: "ошибок всего" }
    ];
    const sumBox = el("div", { class: "stats" });
    summary.forEach(s => {
      const card = el("div", { class: "stat" });
      card.append(el("b", {}, s.value), el("span", {}, s.label));
      sumBox.append(card);
    });

    const levels = el("div", { class: "levels-progress" });
    LEVELS.forEach(lvl => {
      const list = exercises.filter(e => e.level === lvl.code);
      const doneCount = list.filter(e => progress.completed.includes(e.id)).length;
      const pct = list.length ? Math.round((doneCount / list.length) * 100) : 0;
      const row = el("div", { class: "lvl-row" });
      row.append(
        el("span", { class: "lvl-code" }, lvl.code),
        el("div", { class: "bar" }, ""),
        el("span", { class: "lvl-count" }, list.length ? doneCount + " / " + list.length : "нет упражнений")
      );
      row.querySelector(".bar").style.setProperty("--pct", pct + "%");
      levels.append(row);
    });

    const weak = Object.entries(progress.perEx || {})
      .filter(([, r]) => r.mistakes > 0)
      .sort((a, b) => b[1].mistakes - a[1].mistakes)
      .slice(0, 5);
    const weakBox = el("div", { class: "weak" });
    weakBox.append(el("h3", {}, "Чаще всего ошибаетесь"));
    if (!weak.length) {
      weakBox.append(el("p", { class: "muted" }, "Пока ошибок нет или ещё не было попыток."));
    } else {
      const ul = el("ul", { class: "weak-list" });
      weak.forEach(([id, r]) => {
        const ex = exercises.find(e => e.id === id);
        const label = ex ? ex.translation : id;
        ul.append(el("li", {}, label + " — ошибок: " + r.mistakes));
      });
      weakBox.append(ul);
    }

    body.replaceChildren(sumBox, el("h3", {}, "Прогресс по уровням"), levels, weakBox, buildResetBox());
  }

  // Сброс прогресса с подтверждением прямо на странице (confirm() в артефакте не работает)
  function buildResetBox() {
    const box = el("div", { class: "reset-box" });
    const ask = el("button", { class: "btn ghost small", type: "button" }, "Сбросить прогресс");
    const confirmRow = el("div", { class: "reset-confirm" });
    confirmRow.hidden = true;
    confirmRow.append(
      el("span", {}, "Удалить весь прогресс в этом браузере? Это нельзя отменить."),
      (() => {
        const yes = el("button", { class: "btn primary small", type: "button" }, "Да, сбросить");
        yes.addEventListener("click", resetProgress);
        return yes;
      })(),
      (() => {
        const no = el("button", { class: "btn ghost small", type: "button" }, "Отмена");
        no.addEventListener("click", () => { confirmRow.hidden = true; ask.hidden = false; });
        return no;
      })()
    );
    ask.addEventListener("click", () => { confirmRow.hidden = false; ask.hidden = true; });
    box.append(ask, confirmRow);
    return box;
  }

  function resetProgress() {
    progress = defaultProgress();
    document.querySelectorAll(".reset-box").forEach(n => n.remove());
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* хранилище недоступно */
    }
    setFeedback("");
    renderStats();
    renderHome();
  }

  // ---------- Запуск ----------
  function bindEvents() {
    document.getElementById("checkBtn").addEventListener("click", check);
    document.getElementById("nextBtn").addEventListener("click", nextExercise);
    document.getElementById("resetBtn").addEventListener("click", () => {
      if (state.done) return;
      state.answer = [];
      setFeedback("");
      renderExercise();
    });
    document.getElementById("continueBtn").addEventListener("click", continueLearning);
    document.getElementById("showTranslation").addEventListener("click", () => {
      document.getElementById("translationText").hidden = false;
      document.getElementById("showTranslation").hidden = true;
    });
    window.addEventListener("hashchange", route);
  }

  async function init() {
    bindEvents();
    try {
      const res = await fetch("exercises.json", { cache: "no-store" });
      const data = await res.json();
      exercises = (data.exercises || []).filter(e => e.status === "published");
    } catch {
      exercises = [];
    }
    route();
  }

  init();
})();
