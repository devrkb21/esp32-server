/* TinyBot companion web app: plain JS, no build step, no external resources. */
(function () {
  "use strict";

  var API = "/companion/v1";
  var REFRESH_MS = 10000;
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { if (v === null || v === "") localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  };

  var state = {
    devices: [],
    deviceId: LS.get("tb_device", ""),
    dev: null,          // full device detail
    route: "home",
    editing: false,     // a form or sheet is open: background refresh must not re-render
    timer: null
  };

  // ---------------------------------------------------------------- helpers
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === "class") el.className = v;
        else if (k === "text") el.textContent = v;
        else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
        else if (k === "value") el.value = v;
        else if (k === "checked") el.checked = !!v;
        else el.setAttribute(k, v === true ? "" : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(el, c); }); return; }
    el.appendChild(typeof child === "object" ? child : document.createTextNode(String(child)));
  }
  function $(id) { return document.getElementById(id); }

  var BN_DIGITS = "০১২৩৪৫৬৭৮৯";
  function bn(n) { return String(n).replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; }); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function ago(ts) {
    if (!ts) return "কখনো না";
    var s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
    if (s < 60) return "এইমাত্র";
    if (s < 3600) return bn(Math.floor(s / 60)) + " মিনিট আগে";
    if (s < 86400) return bn(Math.floor(s / 3600)) + " ঘণ্টা আগে";
    return bn(Math.floor(s / 86400)) + " দিন আগে";
  }
  function clock(ts) {
    var d = new Date(ts * 1000);
    return pad(d.getHours()) + ":" + pad(d.getMinutes()) + " " + pad(d.getDate()) + "/" + pad(d.getMonth() + 1);
  }

  var toastTimer = null;
  function toast(msg, isError) {
    var t = $("toast");
    t.textContent = msg;
    t.className = isError ? "error" : "";
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, isError ? 4500 : 2200);
  }

  function api(method, path, body) {
    var headers = { "Accept": "application/json" };
    var token = LS.get("tb_token", "");
    if (token) headers["Authorization"] = "Bearer " + token;
    var opts = { method: method, headers: headers, cache: "no-store" };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    return fetch(API + path, opts).then(function (resp) {
      return resp.json().catch(function () { return {}; }).then(function (data) {
        if (resp.status === 401) {
          var err = new Error("টোকেন ভুল বা দেওয়া হয়নি (Settings দেখুন)");
          err.status = 401;
          throw err;
        }
        if (!resp.ok) throw new Error(data.error || ("HTTP " + resp.status));
        return data;
      });
    });
  }
  function devPath(suffix) { return "/devices/" + encodeURIComponent(state.deviceId) + (suffix || ""); }

  function saveConfig(patch, okMsg) {
    return api("PUT", devPath("/config"), patch).then(function (dev) {
      state.dev = dev;
      toast(okMsg || "সেভ হয়েছে ✓");
      return dev;
    }).catch(function (e) { toast(e.message, true); throw e; });
  }
  function sendCommand(type, arg, okMsg) {
    return api("POST", devPath("/commands"), { type: type, arg: arg || "" }).then(function (c) {
      toast(okMsg || "পাঠানো হয়েছে, রোবট কিছুক্ষণের মধ্যে শুরু করবে");
      return c;
    }).catch(function (e) { toast(e.message, true); });
  }

  // form widgets
  function toggle(labelText, checked, onchange) {
    var input = h("input", { type: "checkbox", checked: checked, onchange: function () { onchange(input.checked); } });
    return h("label", { class: "toggle-row" }, h("span", { text: labelText }), h("span", { class: "switch" }, input, h("i")));
  }
  function field(labelText, input, hint) {
    return h("label", { class: "field" }, h("span", { text: labelText }), input, hint ? h("div", { class: "hint", text: hint }) : null);
  }

  var DAY_NAMES = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"]; // bit 0 = Sunday
  function dayChips(mask, onchange) {
    var wrap = h("div", { class: "chips" });
    function render() {
      wrap.textContent = "";
      DAY_NAMES.forEach(function (name, i) {
        var on = (mask >> i) & 1;
        wrap.appendChild(h("button", {
          type: "button", class: "chip" + (on ? " on" : ""), "aria-pressed": on ? "true" : "false",
          onclick: function () { mask ^= (1 << i); render(); onchange(mask); }
        }, name));
      });
      [["প্রতিদিন", 127], ["রবি–বৃহঃ", 31], ["শুক্র–শনি", 96]].forEach(function (p) {
        wrap.appendChild(h("button", {
          type: "button", class: "chip" + (mask === p[1] ? " on" : ""),
          onclick: function () { mask = p[1]; render(); onchange(mask); }
        }, p[0]));
      });
    }
    render();
    return wrap;
  }
  function daysText(mask) {
    if (mask === 127) return "প্রতিদিন";
    if (mask === 31) return "রবি–বৃহস্পতি";
    if (mask === 96) return "শুক্র–শনি";
    if (!mask) return "একবার";
    return DAY_NAMES.filter(function (_, i) { return (mask >> i) & 1; }).join(", ");
  }

  function sheet(titleText, build) {
    state.editing = true;
    var backdrop;
    function close() {
      state.editing = false;
      if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) { if (e.key === "Escape") close(); }
    var box = h("div", { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": titleText }, h("h2", { text: titleText }));
    build(box, close);
    backdrop = h("div", { class: "sheet-backdrop", onclick: function (e) { if (e.target === backdrop) close(); } }, box);
    document.body.appendChild(backdrop);
    document.addEventListener("keydown", onKey);
    var first = box.querySelector("input, textarea, select");
    if (first && window.matchMedia("(pointer: fine)").matches) first.focus();
    return close;
  }

  function confirmBox(text, onYes) {
    sheet(text, function (box, close) {
      box.appendChild(h("div", { class: "actions" },
        h("button", { class: "btn secondary", type: "button", onclick: close }, "না"),
        h("button", { class: "btn danger", type: "button", onclick: function () { close(); onYes(); } }, "হ্যাঁ, মুছে দাও")));
    });
  }

  var ASCII_HINT = "শুধু ইংরেজি অক্ষর (ASCII) — রোবটের স্ক্রিনে দেখাবে";
  var SAY_HINT = "রোবট এটা বাংলায় বলবে। {weather} = আজকের আবহাওয়া, {date} = তারিখ, {name} = নাম";
  function asciiOnly(s) { return (s || "").replace(/[^\x20-\x7e]/g, "").slice(0, 24); }

  // ---------------------------------------------------------------- routing
  var ROUTES = {
    home: { title: "TinyBot", render: renderHome },
    alarms: { title: "অ্যালার্ম", render: renderAlarms },
    reminders: { title: "রিমাইন্ডার", render: renderReminders },
    prayer: { title: "নামাজের সময়", render: renderPrayer },
    focus: { title: "ফোকাস টাইমার", render: renderFocus },
    messages: { title: "মেসেজ", render: renderMessages },
    night: { title: "রাত ও যত্ন", render: renderNight },
    actions: { title: "কাজ করাও", render: renderActions },
    settings: { title: "সেটিংস", render: renderSettings }
  };

  function go(route) { location.hash = "#/" + route; }

  function onRoute() {
    var r = (location.hash || "").replace(/^#\/?/, "") || "home";
    if (!ROUTES[r]) r = "home";
    state.route = r;
    state.editing = false;
    $("back").hidden = r === "home";
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    var view = $("view");
    var route = ROUTES[state.route];
    var name = state.dev ? state.dev.name : "TinyBot";
    $("title").textContent = state.route === "home" ? name : route.title;
    var dot = $("status-dot");
    var online = state.dev && state.dev.online;
    dot.className = "dot" + (online ? " on" : "");
    dot.title = online ? "online" : "offline";
    view.textContent = "";
    if (state.route !== "settings" && !state.dev) {
      view.appendChild(renderNoDevice());
      return;
    }
    route.render(view);
  }

  function renderNoDevice() {
    var box = h("div", { class: "card center" });
    if (state.loadError) {
      box.appendChild(h("p", { text: state.loadError }));
      box.appendChild(h("button", { class: "btn", onclick: function () { go("settings"); } }, "Settings"));
    } else if (state.loaded) {
      box.appendChild(h("p", { text: "এখনো কোনো রোবট পাওয়া যায়নি।" }));
      box.appendChild(h("p", { class: "muted", text: "রোবট Wi-Fi তে যুক্ত হয়ে একবার সার্ভারের সাথে sync করলে এখানে দেখা যাবে।" }));
    } else {
      box.appendChild(h("p", { class: "muted", text: "লোড হচ্ছে…" }));
    }
    return box;
  }

  // ---------------------------------------------------------------- data
  function loadDevices() {
    return api("GET", "/devices").then(function (data) {
      state.devices = data.devices || [];
      state.loadError = "";
      state.loaded = true;
      if (!state.devices.some(function (d) { return d.id === state.deviceId; })) {
        state.deviceId = state.devices.length ? state.devices[0].id : "";
        LS.set("tb_device", state.deviceId);
      }
    });
  }
  function loadDevice() {
    if (!state.deviceId) { state.dev = null; return Promise.resolve(); }
    return api("GET", devPath()).then(function (dev) { state.dev = dev; });
  }
  function refresh(force) {
    return loadDevices().then(loadDevice).then(function () {
      if (force || !state.editing) {
        if (force || ["home", "messages", "actions"].indexOf(state.route) >= 0 || !state.rendered) {
          state.rendered = true;
          render();
        } else {
          // keep forms, only update the online dot
          $("status-dot").className = "dot" + (state.dev && state.dev.online ? " on" : "");
        }
      }
    }).catch(function (e) {
      state.loadError = e.message;
      state.loaded = true;
      if (!state.rendered || force) { state.rendered = true; render(); }
    });
  }
  function startTimer() {
    clearInterval(state.timer);
    state.timer = setInterval(function () { if (!document.hidden) refresh(false); }, REFRESH_MS);
  }

  // ---------------------------------------------------------------- home
  var EVENT_TEXT = {
    alarm_dismissed: "⏰ অ্যালার্ম বন্ধ করা হয়েছে",
    alarm_snoozed: "😴 অ্যালার্ম স্নুজ",
    alarm_missed: "⚠️ অ্যালার্ম মিস",
    reminder_done: "✅ রিমাইন্ডার সম্পন্ন",
    reminder_missed: "⚠️ রিমাইন্ডার মিস",
    prayer_reminded: "🕌 নামাজের কথা মনে করিয়েছে",
    pomodoro_done: "🍅 ফোকাস সেশন শেষ",
    game_score: "🎮 গেম স্কোর",
    streak: "🔥 স্ট্রিক",
    dropped: "😵 রোবট পড়ে গিয়েছিল!",
    lonely: "🥺 রোবট একা বোধ করছিল"
  };
  function eventLine(e) {
    var t = EVENT_TEXT[e.type] || e.type;
    if (e.type === "pomodoro_done") t += " (" + bn(e.value) + " রাউন্ড)";
    else if (e.type === "game_score") t += ": " + (e.id || "") + " " + bn(e.value);
    else if (e.type === "streak") t += ": " + bn(e.value) + " দিন";
    else if (e.id && e.type.indexOf("alarm") === 0) t += " " + findAlarmTime(e.id);
    return t;
  }
  function findAlarmTime(id) {
    var a = (state.dev.alarms || []).filter(function (x) { return x.id === id; })[0];
    return a ? a.time : "";
  }

  var MOOD_BN = { Happy: "খুশি 😊", Sad: "মন খারাপ 😢", Sleepy: "ঘুম ঘুম 😴", Bored: "বোর 😐", Excited: "উত্তেজিত 🤩", Angry: "রাগ 😠", Lonely: "একা 🥺", Love: "ভালোবাসা 🥰", Calm: "শান্ত 🙂" };
  var WEATHER_ICO = { clear: "☀️", partly: "⛅", cloudy: "☁️", fog: "🌫️", drizzle: "🌦️", rain: "🌧️", storm: "⛈️", snow: "❄️" };
  var PRAYER_BN = { fajr: "ফজর", sunrise: "সূর্যোদয়", dhuhr: "যোহর", asr: "আসর", maghrib: "মাগরিব", isha: "এশা" };
  var PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

  function nextPrayer(days) {
    if (!days || !days.length) return null;
    var now = new Date();
    var cur = pad(now.getHours()) + ":" + pad(now.getMinutes());
    var today = days[0];
    for (var i = 0; i < PRAYERS.length; i++) {
      if (today[PRAYERS[i]] > cur) return { key: PRAYERS[i], time: today[PRAYERS[i]] };
    }
    return days[1] ? { key: "fajr", time: days[1].fajr, tomorrow: true } : null;
  }

  function renderHome(view) {
    var d = state.dev;
    var s = d.stats || {};
    if (state.devices.length > 1) {
      var sel = h("select", {
        "aria-label": "রোবট বাছাই", onchange: function () {
          state.deviceId = sel.value; LS.set("tb_device", sel.value); state.dev = null; refresh(true);
        }
      });
      state.devices.forEach(function (x) {
        sel.appendChild(h("option", { value: x.id, selected: x.id === state.deviceId ? "selected" : null }, (x.online ? "🟢 " : "⚪ ") + x.name + " (" + x.id.slice(-5) + ")"));
      });
      view.appendChild(h("div", { class: "card" }, field("রোবট", sel)));
    }

    var status = h("div", { class: "card" },
      h("div", { class: "row spread" },
        h("div", { class: "grow" },
          h("div", { class: "big" }, d.online ? "অনলাইন" : "অফলাইন"),
          h("div", { class: "muted", text: "শেষ দেখা: " + ago(d.last_seen) + (s.state ? " · " + s.state : "") })),
        h("div", { class: "center" },
          h("div", { style: "font-size:34px" }, (MOOD_BN[s.mood] || "🙂").split(" ").pop()),
          h("div", { class: "small", text: s.mood ? (MOOD_BN[s.mood] || s.mood).replace(/\s\S+$/, "") : "" }))),
      s.bond_score !== undefined ? h("div", { style: "margin-top:10px" },
        h("div", { class: "row spread small" }, h("span", { text: "বন্ধুত্ব (bond) লেভেল " + bn(s.bond_level || 0) }), h("span", { text: bn(s.bond_score) + "/১০০" })),
        h("div", { class: "bar" }, h("i", { style: "width:" + Math.max(0, Math.min(100, s.bond_score)) + "%" }))) : null,
      h("div", { class: "stats", style: "margin-top:12px" },
        h("div", { class: "stat" }, h("b", { text: "🔥 " + bn(s.streak || 0) }), h("span", { text: "দিনের স্ট্রিক" })),
        h("div", { class: "stat" }, h("b", { text: "🍅 " + bn(s.pomodoros_today || 0) }), h("span", { text: "আজকের ফোকাস" })),
        h("div", { class: "stat" }, h("b", { text: s.volume !== undefined ? "🔊 " + bn(s.volume) : "🔊 –" }), h("span", { text: "ভলিউম" }))),
      s.high_scores && Object.keys(s.high_scores).length ? h("div", { class: "muted small", style: "margin-top:10px" },
        "🏆 হাই স্কোর: " + Object.keys(s.high_scores).map(function (k) {
          return k.replace("_ms", "") + " " + bn(s.high_scores[k]) + (k.indexOf("_ms") > 0 ? " ms" : "");
        }).join(" · ")) : null,
      s.fw ? h("div", { class: "muted small", style: "margin-top:6px" }, "fw " + s.fw + (s.ip ? " · " + s.ip : "") + (s.rssi ? " · Wi-Fi " + s.rssi + " dBm" : "")) : null);
    view.appendChild(status);

    var w = d.weather || {};
    var np = nextPrayer(d.prayer && d.prayer.days);
    var info = h("div", { class: "card row" },
      h("div", { class: "weather-ico" }, w.ok ? ((!w.is_day && w.kind === "clear") ? "🌙" : (WEATHER_ICO[w.kind] || "🌡️")) : "🌡️"),
      h("div", { class: "grow" },
        w.ok ? h("div", null, h("b", { text: bn(w.temp) + "°" }), " " + w.text + " · " + (w.city || "")) : h("div", { class: "muted", text: "আবহাওয়ার তথ্য এখনো আসেনি" }),
        w.ok ? h("div", { class: "muted small", text: "সর্বোচ্চ " + bn(w.hi) + "° · সর্বনিম্ন " + bn(w.lo) + "° · বৃষ্টি " + bn(w.rain_prob) + "%" }) : null,
        np && d.prayer.enabled ? h("div", { class: "small" }, "🕌 পরের নামাজ: " + PRAYER_BN[np.key] + " " + np.time + (np.tomorrow ? " (কাল)" : "")) : null));
    view.appendChild(info);

    var tiles = [
      ["alarms", "⏰", "অ্যালার্ম"], ["reminders", "💧", "রিমাইন্ডার"], ["prayer", "🕌", "নামাজ"],
      ["focus", "🍅", "ফোকাস"], ["messages", "💬", "মেসেজ"], ["night", "🌙", "রাত ও যত্ন"],
      ["actions", "🎈", "কাজ করাও"], ["settings", "⚙️", "সেটিংস"]
    ];
    view.appendChild(h("nav", { class: "grid" }, tiles.map(function (t) {
      return h("a", { class: "tile", href: "#/" + t[0] }, h("span", { class: "ico", "aria-hidden": "true" }, t[1]), t[2]);
    })));

    var ev = d.events || [];
    view.appendChild(h("div", { class: "card" }, h("h2", { text: "সাম্প্রতিক ঘটনা" }),
      ev.length ? h("ul", { class: "list" }, ev.slice(0, 12).map(function (e) {
        return h("li", null, h("span", { class: "grow", text: eventLine(e) }), h("span", { class: "muted small", text: ago(e.rx || e.ts) }));
      })) : h("div", { class: "empty", text: "এখনো কিছু ঘটেনি" })));
  }

  // ---------------------------------------------------------------- alarms
  function stripAlarm(a) {
    return { id: a.id, time: a.time, days: a.days, label: a.label, enabled: a.enabled, snooze_min: a.snooze_min, say: a.say || "" };
  }
  function renderAlarms(view) {
    var alarms = (state.dev.alarms || []).slice().sort(function (a, b) { return a.time < b.time ? -1 : 1; });
    var card = h("div", { class: "card" });
    if (!alarms.length) card.appendChild(h("div", { class: "empty", text: "কোনো অ্যালার্ম নেই" }));
    var ul = h("ul", { class: "list" });
    alarms.forEach(function (a) {
      var sw = h("input", {
        type: "checkbox", checked: a.enabled, "aria-label": "চালু/বন্ধ", onchange: function () {
          var list = state.dev.alarms.map(function (x) { var y = stripAlarm(x); if (y.id === a.id) y.enabled = sw.checked; return y; });
          saveConfig({ alarms: list }, sw.checked ? "অ্যালার্ম চালু" : "অ্যালার্ম বন্ধ").catch(function () { sw.checked = !sw.checked; });
        }
      });
      ul.appendChild(h("li", null,
        h("div", { class: "time", style: a.enabled ? "" : "opacity:.5" }, a.time),
        h("div", { class: "grow", style: "cursor:pointer", onclick: function () { editAlarm(a); } },
          h("div", { text: a.label || "Alarm" }),
          h("div", { class: "muted small", text: daysText(a.days) + (a.say ? " · 🔊 " + a.say : "") })),
        h("label", { class: "switch" }, sw, h("i"))));
    });
    card.appendChild(ul);
    view.appendChild(card);
    view.appendChild(h("button", { class: "btn block", onclick: function () { editAlarm(null); } }, "+ নতুন অ্যালার্ম"));
  }

  function editAlarm(a) {
    var isNew = !a;
    var cur = a ? stripAlarm(a) : { time: "06:30", days: 127, label: "Wake up", enabled: true, snooze_min: 5, say: "" };
    sheet(isNew ? "নতুন অ্যালার্ম" : "অ্যালার্ম বদলাও", function (box, close) {
      var time = h("input", { type: "time", value: cur.time, required: true });
      var label = h("input", { type: "text", value: cur.label, maxlength: 24, oninput: function () { var v = asciiOnly(label.value); if (v !== label.value) label.value = v; } });
      var say = h("textarea", { maxlength: 300, placeholder: "যেমন: শুভ সকাল {name}! {weather}" }, cur.say);
      var snooze = h("input", { type: "number", min: 0, max: 60, value: cur.snooze_min, inputmode: "numeric" });
      box.appendChild(field("সময়", time));
      box.appendChild(field("কোন দিন", dayChips(cur.days, function (m) { cur.days = m; })));
      box.appendChild(field("লেবেল (Label)", label, ASCII_HINT));
      box.appendChild(field("রোবট কী বলবে (ঐচ্ছিক)", say, SAY_HINT));
      box.appendChild(field("স্নুজ (মিনিট)", snooze));
      box.appendChild(toggle("চালু", cur.enabled, function (v) { cur.enabled = v; }));
      var save = h("button", {
        class: "btn", type: "button", onclick: function () {
          if (!time.value) { toast("সময় দাও", true); return; }
          cur.time = time.value.slice(0, 5); cur.label = label.value; cur.say = say.value; cur.snooze_min = +snooze.value || 0;
          var list = state.dev.alarms.map(stripAlarm);
          if (isNew) list.push(cur); else list = list.map(function (x) { return x.id === cur.id ? cur : x; });
          save.disabled = true;
          saveConfig({ alarms: list }).then(function () { close(); render(); }, function () { save.disabled = false; });
        }
      }, "সেভ");
      var actions = h("div", { class: "actions" }, h("button", { class: "btn secondary", type: "button", onclick: close }, "বাতিল"), save);
      if (!isNew) {
        actions.insertBefore(h("button", {
          class: "btn danger", type: "button", onclick: function () {
            close();
            confirmBox("এই অ্যালার্ম মুছে দেবে?", function () {
              saveConfig({ alarms: state.dev.alarms.filter(function (x) { return x.id !== cur.id; }).map(stripAlarm) }, "মুছে ফেলা হয়েছে").then(render);
            });
          }
        }, "মুছো"), actions.firstChild);
      }
      box.appendChild(actions);
    });
  }

  // ---------------------------------------------------------------- reminders
  function stripReminder(r) {
    var o = {};
    Object.keys(r).forEach(function (k) { if (k !== "say_audio") o[k] = r[k]; });
    return o;
  }
  var KIND_BN = { water: "💧 পানি", medicine: "💊 ওষুধ", custom: "📌 অন্যান্য" };
  function reminderWhen(r) {
    if (r.mode === "interval") return "প্রতি " + bn(r.every_min) + " মিনিট · " + r.from + "–" + r.to;
    return r.time + " · " + daysText(r.days);
  }
  function renderReminders(view) {
    var items = state.dev.reminders || [];
    var card = h("div", { class: "card" });
    if (!items.length) card.appendChild(h("div", { class: "empty", text: "কোনো রিমাইন্ডার নেই" }));
    var ul = h("ul", { class: "list" });
    items.forEach(function (r) {
      var sw = h("input", {
        type: "checkbox", checked: r.enabled, "aria-label": "চালু/বন্ধ", onchange: function () {
          var list = state.dev.reminders.map(function (x) { var y = stripReminder(x); if (y.id === r.id) y.enabled = sw.checked; return y; });
          saveConfig({ reminders: list }, sw.checked ? "চালু হয়েছে" : "বন্ধ হয়েছে").catch(function () { sw.checked = !sw.checked; });
        }
      });
      ul.appendChild(h("li", null,
        h("div", { class: "grow", style: "cursor:pointer", onclick: function () { editReminder(r, r.kind); } },
          h("div", null, KIND_BN[r.kind] + " ", h("span", { class: "muted small", text: r.label })),
          h("div", { class: "muted small", text: reminderWhen(r) })),
        h("label", { class: "switch" }, sw, h("i"))));
    });
    card.appendChild(ul);
    view.appendChild(card);
    view.appendChild(h("div", { class: "actions" },
      h("button", { class: "btn secondary", onclick: function () { editReminder(null, "water"); } }, "+ 💧 পানি"),
      h("button", { class: "btn secondary", onclick: function () { editReminder(null, "medicine"); } }, "+ 💊 ওষুধ"),
      h("button", { class: "btn secondary", onclick: function () { editReminder(null, "custom"); } }, "+ 📌 অন্যান্য")));
  }

  function editReminder(r, kind) {
    var isNew = !r;
    var defaults = {
      water: { kind: "water", label: "Drink water", mode: "interval", every_min: 60, from: "09:00", to: "21:00", say: "পানি খাওয়ার সময় হয়েছে! এক গ্লাস পানি খেয়ে নাও।" },
      medicine: { kind: "medicine", label: "Medicine", mode: "time", time: "21:00", say: "ওষুধ খাওয়ার সময় হয়েছে।" },
      custom: { kind: "custom", label: "Reminder", mode: "time", time: "17:00", say: "" }
    };
    var cur = r ? stripReminder(r) : Object.assign({ enabled: true, days: 127 }, defaults[kind]);
    sheet((isNew ? "নতুন " : "") + KIND_BN[cur.kind] + " রিমাইন্ডার", function (box, close) {
      var modeSel = h("select", null,
        h("option", { value: "interval", selected: cur.mode === "interval" ? "selected" : null }, "নির্দিষ্ট সময় পর পর (interval)"),
        h("option", { value: "time", selected: cur.mode === "time" ? "selected" : null }, "নির্দিষ্ট সময়ে (time)"));
      var every = h("input", { type: "number", min: 5, max: 720, value: cur.every_min || 60, inputmode: "numeric" });
      var from = h("input", { type: "time", value: cur.from || "09:00" });
      var to = h("input", { type: "time", value: cur.to || "21:00" });
      var time = h("input", { type: "time", value: cur.time || "21:00" });
      var label = h("input", { type: "text", value: cur.label, maxlength: 24, oninput: function () { var v = asciiOnly(label.value); if (v !== label.value) label.value = v; } });
      var say = h("textarea", { maxlength: 300 }, cur.say || "");
      var intervalBox = h("div", null, field("কত মিনিট পর পর", every), h("div", { class: "row" }, h("div", { class: "grow" }, field("থেকে", from)), h("div", { class: "grow" }, field("পর্যন্ত", to))));
      var timeBox = h("div", null, field("সময়", time));
      function sync() { intervalBox.className = modeSel.value === "interval" ? "" : "hidden"; timeBox.className = modeSel.value === "time" ? "" : "hidden"; }
      modeSel.addEventListener("change", sync);
      box.appendChild(field("ধরন", modeSel));
      box.appendChild(intervalBox);
      box.appendChild(timeBox);
      box.appendChild(field("কোন দিন", dayChips(cur.days, function (m) { cur.days = m; })));
      box.appendChild(field("লেবেল (Label)", label, ASCII_HINT));
      box.appendChild(field("রোবট কী বলবে", say, SAY_HINT));
      box.appendChild(toggle("চালু", cur.enabled, function (v) { cur.enabled = v; }));
      sync();
      var save = h("button", {
        class: "btn", type: "button", onclick: function () {
          cur.mode = modeSel.value; cur.label = label.value; cur.say = say.value;
          if (cur.mode === "interval") {
            cur.every_min = +every.value || 60; cur.from = from.value; cur.to = to.value; delete cur.time;
          } else {
            if (!time.value) { toast("সময় দাও", true); return; }
            cur.time = time.value.slice(0, 5); delete cur.every_min; delete cur.from; delete cur.to;
          }
          var list = state.dev.reminders.map(stripReminder);
          if (isNew) list.push(cur); else list = list.map(function (x) { return x.id === cur.id ? cur : x; });
          save.disabled = true;
          saveConfig({ reminders: list }).then(function () { close(); render(); }, function () { save.disabled = false; });
        }
      }, "সেভ");
      var actions = h("div", { class: "actions" }, h("button", { class: "btn secondary", type: "button", onclick: close }, "বাতিল"), save);
      if (!isNew) {
        actions.insertBefore(h("button", {
          class: "btn danger", type: "button", onclick: function () {
            close();
            confirmBox("এই রিমাইন্ডার মুছে দেবে?", function () {
              saveConfig({ reminders: state.dev.reminders.filter(function (x) { return x.id !== cur.id; }).map(stripReminder) }, "মুছে ফেলা হয়েছে").then(render);
            });
          }
        }, "মুছো"), actions.firstChild);
      }
      box.appendChild(actions);
    });
  }

  // ---------------------------------------------------------------- prayer
  function renderPrayer(view) {
    var p = state.dev.prayer || {};
    view.appendChild(h("div", { class: "card" },
      toggle("নামাজের সময় দেখাও (enable)", p.enabled, function (v) { saveConfig({ prayer: { enabled: v } }).then(render); }),
      toggle("সময় হলে মনে করিয়ে দাও (remind)", p.remind, function (v) { saveConfig({ prayer: { remind: v } }); })));

    if (p.enabled && p.days && p.days.length) {
      var np = nextPrayer(p.days);
      var table = h("table", { class: "times" }, h("tr", null, h("th", { text: "" }), h("th", { text: "আজ " + p.days[0].date.slice(5) }), p.days[1] ? h("th", { text: "কাল " + p.days[1].date.slice(5) }) : null));
      ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"].forEach(function (k) {
        table.appendChild(h("tr", { class: np && !np.tomorrow && np.key === k ? "next" : "" },
          h("td", { text: PRAYER_BN[k] }), h("td", { text: p.days[0][k] }), p.days[1] ? h("td", { text: p.days[1][k] }) : null));
      });
      view.appendChild(h("div", { class: "card" }, h("h2", { text: "🕌 " + (p.city || "") }), table,
        h("div", { class: "hint", text: "করাচি পদ্ধতি (ফজর/এশা ১৮°), হানাফি আসর — সার্ভারে হিসাব করা।" })));
    }

    var q = h("input", { type: "search", placeholder: "শহরের নাম (ইংরেজিতে), যেমন Sylhet", value: "" });
    var results = h("ul", { class: "list" });
    var sameWeather = h("input", { type: "checkbox", checked: true });
    function search() {
      var text = q.value.trim();
      if (text.length < 2) return;
      results.textContent = "";
      results.appendChild(h("li", { class: "muted", text: "খোঁজা হচ্ছে…" }));
      api("GET", "/geocode?q=" + encodeURIComponent(text)).then(function (data) {
        results.textContent = "";
        if (!data.results.length) results.appendChild(h("li", { class: "muted", text: "কিছু পাওয়া যায়নি" }));
        data.results.forEach(function (r) {
          results.appendChild(h("li", { style: "cursor:pointer", onclick: function () {
            var loc = { city: r.name, lat: r.lat, lon: r.lon };
            var patch = { prayer: loc };
            if (sameWeather.checked) patch.weather = loc;
            saveConfig(patch, r.name + " সেট হয়েছে").then(render);
          } }, h("div", { class: "grow" }, h("div", { text: r.name }), h("div", { class: "muted small", text: [r.admin1, r.country].filter(Boolean).join(", ") + " · " + (+r.lat).toFixed(2) + ", " + (+r.lon).toFixed(2) })), "›"));
        });
      }).catch(function (e) { results.textContent = ""; toast(e.message, true); });
    }
    q.addEventListener("keydown", function (e) { if (e.key === "Enter") search(); });
    q.addEventListener("focus", function () { state.editing = true; });
    q.addEventListener("blur", function () { state.editing = false; });
    view.appendChild(h("div", { class: "card" }, h("h2", { text: "শহর বদলাও" }),
      h("div", { class: "row" }, h("div", { class: "grow" }, q), h("button", { class: "btn", onclick: search }, "খোঁজো")),
      h("label", { class: "toggle-row" }, h("span", { text: "আবহাওয়ার জন্যও এই শহর" }), h("span", { class: "switch" }, sameWeather, h("i"))),
      results,
      h("div", { class: "hint", text: "আবহাওয়ার শহর এখন: " + ((state.dev.weather || {}).city || "–") })));
  }

  // ---------------------------------------------------------------- focus
  function renderFocus(view) {
    var p = Object.assign({}, state.dev.pomodoro);
    function num(key, min, max) {
      return h("input", { type: "number", min: min, max: max, value: p[key], inputmode: "numeric", onfocus: function () { state.editing = true; }, onchange: function (e) { p[key] = +e.target.value; } });
    }
    var work = num("work_min", 1, 120);
    view.appendChild(h("div", { class: "card" },
      h("h2", { text: "🍅 পোমোডোরো" }),
      h("div", { class: "row" }, h("div", { class: "grow" }, field("কাজ (মিনিট)", work)), h("div", { class: "grow" }, field("রাউন্ড", num("rounds", 1, 12)))),
      h("div", { class: "row" }, h("div", { class: "grow" }, field("ছোট বিরতি", num("short_break_min", 1, 60))), h("div", { class: "grow" }, field("লম্বা বিরতি", num("long_break_min", 1, 90)))),
      h("div", { class: "actions" },
        h("button", { class: "btn secondary", onclick: function () { state.editing = false; saveConfig({ pomodoro: p }); } }, "সেভ"),
        h("button", { class: "btn", onclick: function () { state.editing = false; sendCommand("pomodoro", String(+work.value || ""), "ফোকাস টাইমার শুরু হচ্ছে ▶"); } }, "▶ এখনই শুরু"))));
    view.appendChild(h("div", { class: "card muted small", text: "রোবট এক রাউন্ড কাজের পর ছোট বিরতি নেবে; " + bn(p.rounds) + " রাউন্ড পর লম্বা বিরতি। আজ শেষ হয়েছে: " + bn((state.dev.stats || {}).pomodoros_today || 0) + " টি।" }));
  }

  // ---------------------------------------------------------------- messages
  function messageStatus(m) {
    if (m.answer === "yes") return h("span", { class: "badge ok", text: "হ্যাঁ 👍" });
    if (m.answer === "no") return h("span", { class: "badge no", text: "না 👎" });
    if (m.answer === "seen") return h("span", { class: "badge ok", text: "দেখেছে ✓✓" });
    if (m.status === "delivered") return h("span", { class: "badge", text: "পৌঁছেছে ✓" });
    return h("span", { class: "badge warn", text: "অপেক্ষায় ⏳" });
  }
  function renderMessages(view) {
    var from = h("input", { type: "text", maxlength: 32, value: LS.get("tb_from", "Ammu"), placeholder: "Ammu" });
    var text = h("textarea", { maxlength: 300, placeholder: "যেমন: খেয়েছো?" });
    var ask = h("input", { type: "checkbox", checked: true });
    [from, text].forEach(function (el) {
      el.addEventListener("focus", function () { state.editing = true; });
      el.addEventListener("blur", function () { state.editing = !!text.value.trim(); });
    });
    var send = h("button", {
      class: "btn block", onclick: function () {
        if (!text.value.trim()) { toast("কিছু লেখো", true); return; }
        LS.set("tb_from", from.value.trim());
        send.disabled = true;
        api("POST", devPath("/messages"), { from: from.value.trim(), text: text.value.trim(), ask: ask.checked }).then(function () {
          toast("মেসেজ পাঠানো হয়েছে");
          state.editing = false;
          return refresh(true);
        }).catch(function (e) { toast(e.message, true); send.disabled = false; });
      }
    }, "পাঠাও ✉");
    view.appendChild(h("div", { class: "card" },
      field("কে পাঠাচ্ছে (From)", from, "নামটা ইংরেজিতে লিখলে রোবটের স্ক্রিনেও দেখাবে"),
      field("মেসেজ", text, "রোবট মেসেজটা বাংলায় পড়ে শোনাবে"),
      h("label", { class: "toggle-row" }, h("span", { text: "হ্যাঁ/না উত্তর চাও (ask yes/no)" }), h("span", { class: "switch" }, ask, h("i"))),
      send));

    var msgs = state.dev.messages || [];
    view.appendChild(h("div", { class: "card" }, h("h2", { text: "পাঠানো মেসেজ" }),
      msgs.length ? h("ul", { class: "list" }, msgs.map(function (m) {
        return h("li", null,
          h("div", { class: "grow" },
            h("div", { class: "msg-text", text: m.text }),
            h("div", { class: "muted small", text: (m.from ? m.from + " · " : "") + clock(m.ts) + (m.ask ? " · হ্যাঁ/না" : "") })),
          m.audio ? h("button", { class: "chip", "aria-label": "শুনুন", onclick: function () { new Audio(m.audio).play().catch(function () { toast("এই ব্রাউজারে Ogg চলে না", true); }); } }, "🔊") : null,
          messageStatus(m));
      })) : h("div", { class: "empty", text: "এখনো কোনো মেসেজ নেই" })));
  }

  // ---------------------------------------------------------------- night & care
  function renderNight(view) {
    var s = state.dev.settings;
    var n = s.night || {};
    var c = s.care || {};
    function nightPatch(k, v) { var o = {}; o[k] = v; return saveConfig({ settings: { night: o } }); }
    var start = h("input", { type: "time", value: n.start, onchange: function () { nightPatch("start", start.value); } });
    var end = h("input", { type: "time", value: n.end, onchange: function () { nightPatch("end", end.value); } });
    view.appendChild(h("div", { class: "card" }, h("h2", { text: "🌙 রাতের মোড" }),
      toggle("রাতের মোড চালু", n.enabled, function (v) { nightPatch("enabled", v); }),
      h("div", { class: "row" }, h("div", { class: "grow" }, field("শুরু", start)), h("div", { class: "grow" }, field("শেষ", end))),
      toggle("স্ক্রিন ঝাপসা করো (dim)", n.dim, function (v) { nightPatch("dim", v); }),
      toggle("ঘুমপাড়ানি গান (lullaby)", n.lullaby, function (v) { nightPatch("lullaby", v); }),
      toggle("নাইট লাইট (night light)", n.light, function (v) { nightPatch("light", v); })));

    var lonely = h("input", { type: "number", min: 10, max: 1440, value: c.lonely_after_min, inputmode: "numeric", onchange: function () {
      saveConfig({ settings: { care: { lonely_after_min: +lonely.value } } });
    } });
    view.appendChild(h("div", { class: "card" }, h("h2", { text: "💛 যত্ন (care)" }),
      toggle("কেউ অনেকক্ষণ না ছুঁলে মন খারাপ করবে", c.enabled, function (v) { saveConfig({ settings: { care: { enabled: v } } }); }),
      field("কত মিনিট পর একা লাগবে (lonely after)", lonely)));
  }

  // ---------------------------------------------------------------- actions
  function renderActions(view) {
    var topic = h("input", { type: "text", maxlength: 64, placeholder: "বিষয় (ঐচ্ছিক), যেমন: সাহসী বিড়াল" });
    topic.addEventListener("focus", function () { state.editing = true; });
    topic.addEventListener("blur", function () { state.editing = false; });
    view.appendChild(h("div", { class: "card" }, h("h2", { text: "📖 গল্প বলো" }), topic,
      h("button", { class: "btn block", style: "margin-top:10px", onclick: function () { sendCommand("story", topic.value.trim(), "রোবট গল্প বলবে 📖"); topic.value = ""; } }, "গল্প শুরু করো")));

    var acts = [
      ["lullaby", "", "🎶", "ঘুমপাড়ানি গান"], ["ring", "", "🔔", "রোবট খুঁজে দাও"], ["breathe", "", "🌬️", "শ্বাসের ব্যায়াম"],
      ["night_light", "on", "💡", "নাইট লাইট চালু"], ["night_light", "off", "🌑", "নাইট লাইট বন্ধ"]
    ];
    view.appendChild(h("div", { class: "grid" }, acts.map(function (a) {
      return h("button", { class: "tile", onclick: function () { sendCommand(a[0], a[1]); } }, h("span", { class: "ico", "aria-hidden": "true" }, a[2]), a[3]);
    })));

    var games = [["catch", "🍎", "ক্যাচ"], ["simon", "🎵", "সাইমন"], ["dice", "🎲", "ছক্কা"], ["reaction", "⚡", "রিঅ্যাকশন"]];
    view.appendChild(h("div", { class: "card" }, h("h2", { text: "🎮 খেলা" }),
      h("div", { class: "chips" }, games.map(function (g) {
        return h("button", { class: "chip", onclick: function () { sendCommand("game", g[0], g[2] + " খেলা শুরু হচ্ছে"); } }, g[1] + " " + g[2]);
      }))));

    var cmds = state.dev.commands || [];
    if (cmds.length) {
      view.appendChild(h("div", { class: "card" }, h("h2", { text: "সাম্প্রতিক কমান্ড" }),
        h("ul", { class: "list" }, cmds.slice(0, 8).map(function (c) {
          return h("li", null, h("span", { class: "grow", text: c.type + (c.arg ? " (" + c.arg + ")" : "") }),
            h("span", { class: "muted small", text: ago(c.ts) }),
            c.status === "done" ? h("span", { class: "badge ok", text: "হয়েছে ✓" }) : h("span", { class: "badge warn", text: "অপেক্ষায়" }));
        }))));
    }
  }

  // ---------------------------------------------------------------- settings
  function renderSettings(view) {
    var token = h("input", { type: "password", value: LS.get("tb_token", ""), autocomplete: "off", placeholder: "app_token" });
    view.appendChild(h("div", { class: "card" }, h("h2", { text: "🔑 সার্ভার টোকেন (Server token)" }),
      field("টোকেন", token, "সার্ভারের config এ companion.app_token দেওয়া থাকলে এখানে সেটা লেখো। শুধু এই ফোনেই সেভ থাকে।"),
      h("button", { class: "btn block", onclick: function () { LS.set("tb_token", token.value.trim()); toast("টোকেন সেভ হয়েছে"); refresh(true); } }, "সেভ")));

    if (!state.dev) {
      if (state.loadError) view.appendChild(h("div", { class: "card", text: state.loadError }));
      return;
    }
    var s = state.dev.settings;
    var name = h("input", { type: "text", maxlength: 32, value: state.dev.name });
    var owner = h("input", { type: "text", maxlength: 32, value: s.owner_name || "", placeholder: "যেমন: মিম" });
    view.appendChild(h("div", { class: "card" }, h("h2", { text: "🤖 রোবট" }),
      field("রোবটের নাম", name),
      field("মালিকের নাম", owner, "{name} লিখলে রোবট এই নামে ডাকবে"),
      h("button", { class: "btn block", onclick: function () { saveConfig({ name: name.value.trim() || "TinyBot", settings: { owner_name: owner.value.trim() } }); } }, "সেভ"),
      h("div", { class: "hint", text: "ID " + state.dev.id }) ));

    var auto = s.volume === null || s.volume === undefined;
    var vol = h("input", { type: "range", min: 0, max: 100, step: 5, value: auto ? ((state.dev.stats || {}).volume || 70) : s.volume, disabled: auto });
    var volText = h("b", { text: auto ? "রোবট নিজে ঠিক করবে" : bn(s.volume) });
    vol.addEventListener("input", function () { volText.textContent = bn(vol.value); });
    vol.addEventListener("change", function () { saveConfig({ settings: { volume: +vol.value } }, "ভলিউম " + bn(vol.value)); });
    view.appendChild(h("div", { class: "card" }, h("h2", { text: "🔊 শব্দ" }),
      h("div", { class: "row spread" }, h("span", { text: "ভলিউম" }), volText), vol,
      toggle("ফোন থেকে ভলিউম ঠিক করো", !auto, function (v) {
        vol.disabled = !v;
        saveConfig({ settings: { volume: v ? +vol.value : null } }).then(render);
      }),
      toggle("ছোট ছোট আওয়াজ (sounds)", s.sounds, function (v) { saveConfig({ settings: { sounds: v } }); })));

    view.appendChild(h("div", { class: "card" },
      h("button", { class: "btn danger block", onclick: function () {
        confirmBox("এই রোবটকে তালিকা থেকে সরাবে? (আবার sync করলে নতুন করে আসবে)", function () {
          api("DELETE", devPath()).then(function () { toast("সরানো হয়েছে"); state.dev = null; state.deviceId = ""; LS.set("tb_device", ""); go("home"); refresh(true); })
            .catch(function (e) { toast(e.message, true); });
        });
      } }, "রোবট সরাও (forget)")));
    view.appendChild(h("p", { class: "muted small center", text: "TinyBot companion · Nobix Industries" }));
  }

  // ---------------------------------------------------------------- boot
  $("back").addEventListener("click", function () { go("home"); });
  window.addEventListener("hashchange", onRoute);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(false); });
  onRoute();
  refresh(true);
  startTimer();

  // Service workers need a secure context (https or localhost); on plain LAN http the app still
  // works and can be added to the home screen, just without offline caching
  if ("serviceWorker" in navigator && window.isSecureContext) {
    navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(function () { /* optional */ });
  }
})();
