(() => {
  const DATA = window.LC_DATA;
  const ROOT = document.getElementById("app");
  const STUDENT_STORE = "lcquest-student-id-" + DATA.id;
  let studentId = (localStorage.getItem(STUDENT_STORE) || "").trim();
  const STORE = "lcquest-progress-" + DATA.id;
  const GAME_ENABLED = false;
  const MISSION_NAMES = [
    "接收案件","確認交易關係","押匯路徑","匯票倒數","裝運路線","貨物與條件","單據檢查","附加條件","終極任務"
  ];
  const MISSION_DESCRIPTIONS = [
    "讀取電文標頭與信用狀基本資料",
    "確認申請人、受益人與信用狀特徵",
    "核對信用狀金額及可辦理押匯方式",
    "辨認遠期匯票期限與付款人",
    "安排裝運，核對港口與日期",
    "對照貨物描述及貿易條件",
    "逐份核對發票、提單、保險及裝箱單",
    "檢查附加條款、提示期限與費用",
    "完成付款與寄送流程的最後判斷"
  ];
  const defaultProgress = () => ({mastery:{}, wrongIds:[], streak:{}, unitDone:{}, unitRecent:{}, missions:{}, unlocked:1});
  let progress = loadProgress();
  let page = studentId ? "home" : "student";
  let editingStudentId = false;
  let quiz = null;
  let activeUnit = 1;
  let lastBasicSource = "units";
  let advanceTimer = null;

  function loadProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || "{}");
      const merged = Object.assign(defaultProgress(), saved);
      if (!Array.isArray(saved.wrongIds)) {
        merged.wrongIds = DATA.basic.concat(DATA.game).filter(q => (saved.mastery?.[q.id]?.wrong || 0) > 0).map(q => q.id);
      }
      return merged;
    }
    catch { return defaultProgress(); }
  }
  function saveProgress() { localStorage.setItem(STORE, JSON.stringify(progress)); }
  function masteryStatus(id) {
    const item = progress.mastery[id];
    if (!item) return "red";
    return item.status || "red";
  }
  function updateMastery(question, correct) {
    const old = progress.mastery[question.id] || {correct:0,wrong:0,streak:0,status:"red"};
    if (correct) {
      old.correct += 1; old.streak += 1;
      old.status = old.streak >= 3 ? "green" : "yellow";
    } else {
      old.wrong += 1; old.streak = 0; old.status = "red";
    }
    progress.mastery[question.id] = old;
    const wrongIds = new Set(progress.wrongIds || []);
    if (correct) wrongIds.delete(question.id); else wrongIds.add(question.id);
    progress.wrongIds = [...wrongIds];
    saveProgress();
  }
  function esc(value) {
    return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  }
  function setPage(next) {
    if (next === "missions" && !GAME_ENABLED) return showToast("闖關遊戲目前暫停開放。");
    page = next; render(); window.scrollTo({top:0,behavior:"smooth"});
  }
  function home() { quiz = null; setPage(studentId ? "home" : "student"); }
  function unitQuestions(unit) {
    return DATA.basic.filter(q => q.unit === unit).sort((a, b) => Number(a.prompt.startsWith("整句翻譯｜")) - Number(b.prompt.startsWith("整句翻譯｜")));
  }
  function gameQuestions(mission) { return DATA.game.filter(q => q.mission === mission); }
  function correctZh(q) { return q.options[q.answer]; }

  function render() {
    if (page === "student") return renderStudent();
    if (page === "home") return renderHome();
    if (page === "basic") return renderBasic();
    if (page === "words") return renderWords();
    if (page === "missions") return renderMissions();
    if (page === "quiz") return renderQuiz();
    if (page === "result") return renderResult();
  }

  function renderStudent() {
    ROOT.innerHTML = `
      <section class="result-card" style="max-width:580px;margin:32px auto;text-align:left">
        <div class="eyebrow">STUDENT SIGN IN</div>
        <h2 style="text-align:left">${editingStudentId ? "修改學號" : "首次使用／補登學號"}</h2>
        <p style="text-align:left">${editingStudentId ? "修改後，這台裝置原有的練習紀錄會完整保留。請確認學號與實際作答學生相符。" : "請輸入學號。原本在這台裝置完成的練習紀錄會保留，無須重新練習。"}</p>
        <form id="studentForm" style="display:grid;gap:14px;margin-top:22px">
          <label for="studentNumber">學生學號</label>
          <input id="studentNumber" name="studentNumber" autocomplete="off" inputmode="numeric" maxlength="20" required value="${esc(studentId)}" placeholder="請輸入學號" style="padding:14px;font-size:18px;border-radius:10px;border:1px solid #b6c5c6;color:#152b33;background:white">
          <button class="primary-button" type="submit">${editingStudentId ? "儲存修改" : "確認學號，開始練習 →"}</button>
          ${editingStudentId ? '<button class="outline-button" type="button" id="cancelStudentEdit">取消修改</button>' : ""}
        </form>
      </section>`;
    ROOT.querySelector("#studentForm").onsubmit = e => {
      e.preventDefault();
      const id = ROOT.querySelector("#studentNumber").value.trim();
      if (!/^[A-Za-z0-9_-]{1,20}$/.test(id)) return showToast("請輸入 1–20 位英數字學號（可包含 - 或 _）。");
      try { localStorage.setItem(STUDENT_STORE,id); }
      catch { return showToast("無法儲存學號，請確認瀏覽器允許網站儲存資料。"); }
      studentId = id;
      editingStudentId = false;
      setPage("home");
    };
    const cancel = ROOT.querySelector("#cancelStudentEdit");
    if (cancel) cancel.onclick = () => { editingStudentId = false; setPage("home"); };
  }

  function renderHome() {
    ROOT.innerHTML = `
      <section class="hero">
        <div class="hero-copy">
          <div class="eyebrow">DOCUMENTARY CREDIT TRAINING</div>
          <h1>讀懂信用狀，<br><em>開始你的任務。</em></h1>
          <p class="hero-sub">從關鍵詞到實際審查，使用同一份信用狀案例練習。答題進度會保存在這台裝置。</p>
        </div>
        <aside class="case-panel">
          <div class="case-panel-top"><span class="case-tag">ACTIVE CASE / 01</span><span class="case-index">MT700 · 40A–78</span></div>
          <div><div class="case-title">${esc(DATA.title)}</div><div class="case-sub">${esc(DATA.subtitle)}</div></div>
          <div class="case-stats"><span class="case-stat"><b>${esc(DATA.creditNo)}</b>信用狀號碼</span><span class="case-stat"><b>${esc(DATA.amount)}</b>金額</span></div>
        </aside>
      </section>
      <div class="home-note"><span><strong>學號：${esc(studentId)}</strong>（此裝置成績）</span> <button class="outline-button" data-edit-student type="button">修改學號</button></div>
      <div class="section-head"><div><h2>選擇訓練模式</h2><p>先用單元練習熟悉詞語與 LC 條款。</p></div></div>
      <section class="mode-grid">
        <button class="mode-card" data-action="basic">
          <div class="mode-top"><span class="mode-num">PART 01 / FOUNDATION</span><span class="mode-icon">⌕</span></div>
          <h3>基礎練習</h3><p>四選一傳統刷題。八大單元從欄位名稱、關鍵詞片語，一路練到完整條款。</p>
          <div class="mode-bottom"><span class="mode-meta">${DATA.basic.length} 題 · 八大單元 · 詞語熟悉度</span><span class="mode-arrow">↗</span></div>
        </button>
        <button class="mode-card game" data-action="missions" ${GAME_ENABLED?"":"disabled"}>
          <div class="mode-top"><span class="mode-num">PART 02 / FIELD MISSIONS</span><span class="mode-icon">✦</span></div>
          <h3>闖關遊戲</h3><p>${GAME_ENABLED?"扮演新進審單員，依任務閱讀 LC 資料、核對條件，逐步完成案件。":"目前暫停開放，題目仍在檢核中。"}</p>
          <div class="mode-bottom"><span class="mode-meta">${GAME_ENABLED?`${DATA.game.length} 題 · 八道主線＋終極任務`:"暫停開放"}</span><span class="mode-arrow">${GAME_ENABLED?"↗":"⏸"}</span></div>
        </button>
      </section>
      <div class="home-note"><span class="note-icon">i</span><span>本版是單一 LC 案例原型；切換其他 LC 時，題目需依該份原文另行編寫。</span></div>`;
    ROOT.querySelectorAll("[data-action]").forEach(btn => btn.addEventListener("click", () => setPage(btn.dataset.action)));
    ROOT.querySelector("[data-edit-student]").onclick = () => { editingStudentId = true; setPage("student"); };
  }

  function renderBasic() {
    const counts = DATA.units.map(unit => ({...unit,count:unitQuestions(unit.id).length}));
    ROOT.innerHTML = `
      <div class="view-head">
        <div><button class="back-link" data-back>← 回首頁</button><div class="eyebrow">PART 01 / FOUNDATION</div><h1>基礎練習</h1><p>完成一個單元後，再查看本單元所有答案與詳解。</p></div>
        <span class="header-chip">${DATA.basic.length} 題</span>
      </div>
      <div class="toolbar">
        <button class="primary-button" data-start-all>開始全部單元　↗</button>
        <button class="soft-button" data-words>單字與片語列表</button>
        <button class="outline-button" data-wrong>錯題加強${getWrongQuestions().length?`（${getWrongQuestions().length}）`:""}</button>
      </div>
      <div class="home-note"><span><strong>學號：${esc(studentId)}</strong>　｜　八單元成績（本裝置紀錄）</span> <button class="outline-button" data-edit-student type="button">修改學號</button></div>
      <div class="unit-grid">${counts.map(u => {
        const done = progress.unitDone[u.id] || 0;
        const recent = progress.unitRecent?.[u.id];
        const translationCount = unitQuestions(u.id).filter(q => q.prompt.startsWith("整句翻譯｜")).length;
        const translationLabel = translationCount ? ` · 含整句翻譯 ${translationCount} 題` : "";
        const recentDate = recent ? new Date(recent.completedAt).toLocaleDateString("zh-TW") : "";
        return `<div class="unit-entry">
          <button class="unit-card" data-unit="${u.id}">
            <span class="unit-number" style="background:${u.color}">${u.icon}</span>
            <span class="unit-text"><b>${esc(u.name)}</b><small>${done ? "已完成 "+done+" 次練習" : "點選開始本單元"}${translationLabel}</small></span>
            <span class="unit-count">${u.count} 題　›</span>
          </button>
          <button class="unit-score-button" data-latest="${u.id}" ${recent?"":"disabled"}><span>近一次成績${recent?` · ${recentDate}`:""}</span><b>${recent?`${recent.correct}/${recent.total} · ${recent.score}%`:"尚未練習"}</b></button>
        </div>`;
      }).join("")}</div>`;
    ROOT.querySelector("[data-back]").onclick = home;
    ROOT.querySelector("[data-edit-student]").onclick = () => { editingStudentId = true; setPage("student"); };
    ROOT.querySelector("[data-start-all]").onclick = () => startQuiz("basic", DATA.units.flatMap(unit => unitQuestions(unit.id)), "全部單元");
    ROOT.querySelector("[data-words]").onclick = () => setPage("words");
    ROOT.querySelector("[data-wrong]").onclick = () => {
      startWrongPractice("basic");
    };
    ROOT.querySelectorAll("[data-unit]").forEach(btn => btn.onclick = () => {
      activeUnit = Number(btn.dataset.unit);
      startQuiz("basic", unitQuestions(activeUnit), DATA.units[activeUnit-1].name, activeUnit);
    });
    ROOT.querySelectorAll("[data-latest]").forEach(btn => btn.onclick = () => showLatestUnit(Number(btn.dataset.latest)));
  }

  function renderWords() {
    const qlist = DATA.basic.filter(q => !q.prompt.includes(" ") || q.prompt.length < 75);
    const unitOptions = DATA.units.map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join("");
    ROOT.innerHTML = `
      <div class="view-head">
        <div><button class="back-link" data-back>← 回基礎練習</button><div class="eyebrow">WORD BANK / MASTERY</div><h1>詞語情報庫</h1><p>紅色待複習、黃色練習中、綠色已熟悉。可自行調整狀態。</p></div>
        <span class="header-chip">${qlist.length} 個項目</span>
      </div>
      <div class="wordlist-wrap">
        <div class="wordlist-toolbar"><select id="wordUnit"><option value="all">全部單元</option>${unitOptions}</select><input id="wordSearch" type="search" placeholder="搜尋英文詞語或片語…" aria-label="搜尋詞語"></div>
        <div id="wordRows"></div>
      </div>`;
    ROOT.querySelector("[data-back]").onclick = () => setPage("basic");
    const select = document.getElementById("wordUnit");
    const search = document.getElementById("wordSearch");
    const paint = () => {
      const unit = select.value;
      const needle = search.value.trim().toLowerCase();
      const filtered = qlist.filter(q => (unit === "all" || q.unit === Number(unit)) && (!needle || q.prompt.toLowerCase().includes(needle)));
      const rows = filtered.map(q => {
        const status = masteryStatus(q.id);
        const statusName = status === "green" ? "已熟悉" : status === "yellow" ? "練習中" : "待複習";
        return `<div class="word-row"><span class="mastery-dot ${status}"></span><span class="word-en">${esc(q.prompt)}</span><span class="word-zh">${esc(correctZh(q))}</span><select class="mastery-select" data-mastery="${q.id}" aria-label="熟悉度：${esc(q.prompt)}"><option value="red" ${status==="red"?"selected":""}>🔴 待複習</option><option value="yellow" ${status==="yellow"?"selected":""}>🟡 練習中</option><option value="green" ${status==="green"?"selected":""}>🟢 已熟悉</option></select></div>`;
      }).join("");
      document.getElementById("wordRows").innerHTML = rows || `<div class="empty-state">找不到符合條件的詞語。</div>`;
      ROOT.querySelectorAll("[data-mastery]").forEach(el => el.onchange = () => {
        const item = progress.mastery[el.dataset.mastery] || {correct:0,wrong:0,streak:0};
        item.status = el.value; progress.mastery[el.dataset.mastery] = item; saveProgress();
        el.parentElement.querySelector(".mastery-dot").className = "mastery-dot "+el.value;
      });
    };
    select.onchange = paint; search.oninput = paint; paint();
  }

  function renderMissions() {
    const missionIds = [1,2,3,4,5,6,7,8,"boss"];
    const names = ["接收案件","確認交易關係","押匯路徑","匯票倒數","裝運路線","貨物與條件","單據檢查","附加條件","終極任務"];
    const descs = MISSION_DESCRIPTIONS;
    const total = DATA.game.length;
    ROOT.innerHTML = `
      <div class="view-head">
        <div><button class="back-link" data-back>← 回首頁</button><div class="eyebrow">PART 02 / FIELD MISSIONS</div><h1>闖關遊戲</h1><p>你是新進審單員。完成任務，逐步解鎖這份 LC 的案件檔案。</p></div>
        <span class="header-chip">${total} 道任務題</span>
      </div>
      <div class="mission-map">${missionIds.map((id,i) => {
        const qs = gameQuestions(id);
        const key = String(id);
        const done = progress.missions[key];
        const locked = id === "boss" ? progress.unlocked < 9 : Number(id) > progress.unlocked;
        const stars = done?.stars || 0;
        return `<button class="mission-card" data-mission="${key}" ${locked?"disabled":""}>
          <span class="mission-symbol">${locked?"🔒":id==="boss"?"★":String(id).padStart(2,"0")}</span>
          <span class="mission-copy"><b>${esc(names[i])}</b><small>${esc(descs[i])} · ${qs.length} 題</small></span>
          <span class="mission-state">${locked?"未解鎖":stars?"★".repeat(stars)+"☆".repeat(3-stars):"›"}</span>
        </button>`;
      }).join("")}</div>
      <div class="mission-footer"><b>任務規則：</b>每題四選一，不限時。答對累積審查星；完成主線任務可解鎖下一關。答錯會顯示提示與原則，任務可以重試。</div>`;
    ROOT.querySelector("[data-back]").onclick = home;
    ROOT.querySelectorAll("[data-mission]:not(:disabled)").forEach(btn => btn.onclick = () => {
      const id = btn.dataset.mission === "boss" ? "boss" : Number(btn.dataset.mission);
      const title = names[missionIds.indexOf(id)];
      startQuiz("game", gameQuestions(id), title, id);
    });
    const wrongButton = document.createElement("button");
    wrongButton.className = "outline-button";
    wrongButton.textContent = "錯題練習";
    wrongButton.style.marginTop = "16px";
    wrongButton.onclick = () => startWrongPractice("missions");
    ROOT.querySelector(".mission-footer").before(wrongButton);
  }

  function startWrongPractice(from) {
    const wrong = getWrongQuestions();
    if (!wrong.length) return showToast("目前還沒有答錯題，先完成幾題練習吧。");
    startQuiz("wrong", wrong, "錯題加強");
    quiz.from = from;
  }

  function getWrongQuestions() {
    const source = GAME_ENABLED ? DATA.basic.concat(DATA.game) : DATA.basic;
    return source.filter(q => (progress.wrongIds || []).includes(q.id));
  }

  function startQuiz(mode, questions, title, group) {
    if (advanceTimer) clearTimeout(advanceTimer);
    if (!questions.length) return showToast("這個題組目前沒有題目。");
    quiz = {mode,questions:questions.map(q => ({...q,displayOptions:shuffle(q.options.map((text,original)=>({text,original})))})),title,group,index:0,selected:null,correct:0,answers:[],from:mode==="game"?"missions":"basic"};
    setPage("quiz");
  }

  function shuffle(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function renderQuiz() {
    const q = quiz.questions[quiz.index];
    const total = quiz.questions.length;
    const percent = Math.round((quiz.index/total)*100);
    const isGame = quiz.mode === "game" || (quiz.mode === "wrong" && quiz.questions.some(item => item.mission));
    const prefix = quiz.mode === "wrong" ? "錯題練習" : isGame ? "任務中" : "基礎練習";
    const isTranslation = q.prompt.startsWith("整句翻譯｜");
    const correctIndex = q.displayOptions.findIndex(option => option.original === q.answer);
    const isCorrect = quiz.selected !== null && quiz.selected === correctIndex;
    ROOT.innerHTML = `
      <div class="quiz-shell">
        <div class="view-head">
          <div><button class="back-link" data-exit>← 離開練習</button><div class="eyebrow">${prefix} / ${esc(quiz.title)}</div><h1>${esc(quiz.title)}</h1></div>
          <span class="header-chip">${quiz.index+1} / ${total}</span>
        </div>
        <div class="quiz-topline"><span>${isGame?"任務進度":"單元進度"}</span><span>${quiz.correct} 題答對</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
        <section class="question-card">
          <span class="question-label">${isTranslation?"整句翻譯題":isGame?"案件判讀":"詞語與條款"} · ${esc(DATA.units[(q.unit || 1)-1]?.name || "")}</span>
          <div class="question-text">${esc(q.prompt)}</div>
          <div class="choice-list">${q.displayOptions.map((option,i) => {
            let stateClass = "";
            if (quiz.selected !== null) {
              if (i === correctIndex) stateClass = "correct";
              else if (i === quiz.selected) stateClass = "incorrect";
              else stateClass = "muted";
            }
            return `<button class="choice ${stateClass}" data-choice="${i}" ${quiz.selected!==null?"disabled":""}><span class="choice-key">${String.fromCharCode(65+i)}</span><span>${esc(option.text)}</span></button>`;
          }).join("")}</div>
          <div class="quiz-actions"><span class="small-hint">選出最符合信用狀條款的一項。</span></div>
        </section>
      </div>`;
    ROOT.querySelector("[data-exit]").onclick = () => {
      if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null; }
      setPage(quiz.from);
    };
    ROOT.querySelectorAll("[data-choice]").forEach(btn => btn.onclick = () => {
      if (quiz.selected !== null) return;
      quiz.selected = Number(btn.dataset.choice);
      const chosenCorrect = q.displayOptions[quiz.selected].original === q.answer;
      quiz.answers[quiz.index] = {selected:q.displayOptions[quiz.selected].original,correct:chosenCorrect};
      if (chosenCorrect) quiz.correct += 1;
      updateMastery(q, chosenCorrect);
      advanceTimer = setTimeout(advance, 0);
    });
  }

  function advance() {
    if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null; }
    if (quiz.index + 1 < quiz.questions.length) {
      quiz.index += 1; quiz.selected = null; renderQuiz(); window.scrollTo({top:0,behavior:"smooth"}); return;
    }
    finishQuiz();
  }

  function finishQuiz() {
    if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null; }
    const total = quiz.questions.length;
    const accuracy = quiz.correct / total;
    quiz.review = quiz.questions.map((q,index) => {
      const response = quiz.answers[index];
      return {id:q.id,unit:q.unit,prompt:q.prompt,selected:response?q.options[response.selected]:"未作答",correctAnswer:q.options[q.answer],isCorrect:!!response?.correct,explain:q.explain||("正確答案："+correctZh(q))};
    });
    if (quiz.mode === "basic") {
      const byUnit = new Map();
      quiz.review.forEach(item => {
        const list = byUnit.get(item.unit) || [];
        list.push(item); byUnit.set(item.unit,list);
      });
      for (const [unit,review] of byUnit) {
        const correct = review.filter(item=>item.isCorrect).length;
        progress.unitDone[unit] = (progress.unitDone[unit] || 0) + 1;
        progress.unitRecent[unit] = {correct,total:review.length,score:Math.round(correct/review.length*100),completedAt:new Date().toISOString(),review};
      }
      saveProgress();
    }
    let stars = 0;
    if (quiz.mode === "game") {
      stars = accuracy >= .99 ? 3 : accuracy >= .8 ? 2 : accuracy >= .5 ? 1 : 0;
      const key = String(quiz.group);
      const old = progress.missions[key] || {stars:0,attempts:0};
      old.stars = Math.max(old.stars, stars); old.attempts += 1; old.lastAccuracy = accuracy;
      progress.missions[key] = old;
      if (accuracy >= .5 && typeof quiz.group === "number" && quiz.group === progress.unlocked && progress.unlocked < 8) progress.unlocked += 1;
      if (accuracy >= .5 && quiz.group === 8) progress.unlocked = 9;
      saveProgress();
    }
    quiz.result = {total,accuracy,stars};
    setPage("result");
  }

  function renderResult() {
    const r = quiz.result;
    const isGame = quiz.mode === "game";
    const isRecent = quiz.mode === "recent";
    const missedCount = (quiz.review||[]).filter(item=>!item.isCorrect).length;
    const badge = isGame ? (r.stars ? "★" : "↻") : "✓";
    const title = isRecent ? "單元近一次成績" : isGame ? (r.stars ? "任務完成！" : "再試一次") : "練習完成";
    const message = isGame
      ? (r.stars ? "你完成了案件檢查。答對率達 50% 可解鎖下一項任務。" : "本次未取得星星，回到任務再挑戰一次，答案與解說仍可查看。")
      : isRecent ? "以下顯示該單元最近一次作答紀錄與所有詳解。"
      : quiz.mode === "wrong" ? "錯題已重新判定；答對的題目會從錯題清單移除，答錯的會保留。"
      : "題目已完成。答錯的詞語會標記為待複習，可到詞語情報庫查看。";
    ROOT.innerHTML = `
      <section class="result-card">
        <div class="result-badge">${badge}</div><div class="eyebrow" style="justify-content:center;color:#cde0d8">${isGame?"MISSION REPORT":"PRACTICE REPORT"}</div>
        <p style="font-weight:700">學號：${esc(studentId)}</p>
        <h2>${title}</h2><p>${esc(quiz.title)} · ${quiz.correct} / ${r.total} 題答對</p>
        <div class="result-score">${Math.round(r.accuracy*100)}%</div>
        <p>${isGame?(r.stars?"本關獲得 "+"★".repeat(r.stars)+"☆".repeat(3-r.stars):"尚未取得星星"):quiz.mode==="wrong"?"錯題加強完成。":"答對題目會累積熟悉度；錯題可集中加強複習。"}<br>${esc(message)}</p>
        <div class="review-list"><h3>本次題目與詳解</h3>${renderReviewList(quiz.review||[])}</div>
        <div class="result-actions">
          ${isRecent?"":`<button class="primary-button" data-retry>再練一次</button>${missedCount?`<button class="soft-button" data-strengthen>錯題加強（${missedCount}）</button>`:""}`}
          <button class="outline-button" data-return>${isGame?"回任務地圖":"回基礎練習"}</button>
        </div>
      </section>`;
    const retry = ROOT.querySelector("[data-retry]");
    if (retry) retry.onclick = () => {
      const from = quiz.from;
      startQuiz(quiz.mode, quiz.questions, quiz.title, quiz.group);
      quiz.from = from;
    };
    const strengthen = ROOT.querySelector("[data-strengthen]");
    if (strengthen) strengthen.onclick = () => {
      const from = quiz.from;
      const missed = new Set((quiz.review||[]).filter(item=>!item.isCorrect).map(item=>item.id));
      const list = DATA.basic.concat(DATA.game).filter(q=>missed.has(q.id));
      startQuiz("wrong",list,"錯題加強"); quiz.from=from;
    };
    ROOT.querySelector("[data-return]").onclick = () => setPage(quiz.from);
  }

  function renderReviewList(items) {
    return items.map((item,index)=>`<article class="review-item ${item.isCorrect?"was-correct":"was-wrong"}">
      <div class="review-item-head"><b>${index+1}. ${item.isCorrect?"答對":"答錯"}</b><span>${esc(DATA.units[(item.unit||1)-1]?.name||"")}</span></div>
      <div class="review-prompt">${esc(item.prompt)}</div>
      <div class="review-answer"><span>你的答案</span><b>${esc(item.selected)}</b></div>
      <div class="review-answer"><span>正確答案</span><b>${esc(item.correctAnswer)}</b></div>
      <p>${esc(item.explain)}</p>
    </article>`).join("");
  }

  function showLatestUnit(unit) {
    const recent = progress.unitRecent?.[unit];
    if (!recent) return showToast("這個單元還沒有練習成績。");
    quiz={mode:"recent",title:DATA.units[unit-1].name,group:unit,from:"basic",review:recent.review||[],result:{total:recent.total,accuracy:recent.score/100,stars:0},correct:recent.correct};
    setPage("result");
  }

  function showToast(message) {
    const existing = document.querySelector(".toast"); if (existing) existing.remove();
    const node = document.createElement("div"); node.className="toast"; node.textContent=message; document.body.appendChild(node);
    setTimeout(()=>node.remove(),2600);
  }

  document.getElementById("homeButton").onclick = home;
  document.getElementById("brandHome").onclick = home;
  render();
})();
