/**
 * Сайт-приглашение на свадьбу.
 * — Скролл-анимации: блоки получают класс is-visible при появлении в зоне видимости.
 * — Обратный отсчёт до даты свадьбы (25.06.2026, 14:00).
 * — Форма подтверждения: отправка в Google Apps Script.
 */
(function () {
  "use strict";

  /* ——— Intersection Observer: появление блоков при скролле ——— */
  var observerOptions = {
    root: null,
    rootMargin: "0px 0px -15% 0px",
    threshold: 0.1
  };

  function addVisibleClass(entries, observer) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }

  var observer = new IntersectionObserver(addVisibleClass, observerOptions);
  [".block-invite", ".block-event", ".block-place"].forEach(function (sel) {
    var el = document.querySelector(sel);
    if (el) observer.observe(el);
  });

  /* ——— Фоновая музыка: autoplay muted + unmute after first interaction ——— */
  var MUSIC_STORAGE_KEY = "wedding_music_enabled";
  var bgMusic = document.getElementById("bg-music");
  var musicToggleBtn = document.getElementById("music-toggle-btn");
  var musicToggleIcon = document.getElementById("music-toggle-icon");
  var firstInteractionBound = false;
  var shouldPlayMusic = true;
  var hasUserUnlockedAudio = false;

  function loadMusicSourceIfNeeded() {
    if (!bgMusic) return;
    if (!bgMusic.getAttribute("src")) {
      var musicSrc = bgMusic.getAttribute("data-src");
      if (musicSrc) {
        bgMusic.setAttribute("src", musicSrc);
      }
    }
  }

  function readMusicPreference() {
    try {
      var stored = localStorage.getItem(MUSIC_STORAGE_KEY);
      if (stored === "true") return true;
      if (stored === "false") return false;
    } catch (error) {
      // localStorage может быть недоступен в приватном режиме
    }
    return null;
  }

  function saveMusicPreference(value) {
    try {
      localStorage.setItem(MUSIC_STORAGE_KEY, String(value));
    } catch (error) {
      // Игнорируем ошибку и продолжаем без сохранения
    }
  }

  function updateMusicToggleUI() {
    if (!musicToggleBtn || !musicToggleIcon) return;

    if (shouldPlayMusic) {
      musicToggleBtn.classList.remove("is-muted");
      musicToggleBtn.setAttribute("aria-label", "Выключить музыку");
      musicToggleBtn.setAttribute("title", "Выключить музыку");
      musicToggleIcon.textContent = "♪";
    } else {
      musicToggleBtn.classList.add("is-muted");
      musicToggleBtn.setAttribute("aria-label", "Включить музыку");
      musicToggleBtn.setAttribute("title", "Включить музыку");
      musicToggleIcon.textContent = "🔇";
    }
  }

  function playMutedAutostart() {
    if (!bgMusic) return;
    loadMusicSourceIfNeeded();
    bgMusic.muted = true;
    bgMusic.play().catch(function () {
      // Если autoplay заблокирован полностью, ждём действие пользователя
    });
  }

  function enableMusicWithSound() {
    if (!bgMusic) return;
    shouldPlayMusic = true;
    saveMusicPreference(true);
    updateMusicToggleUI();

    loadMusicSourceIfNeeded();
    bgMusic.muted = false;
    var playPromise = bgMusic.play();

    if (playPromise && typeof playPromise.then === "function") {
      return playPromise
        .then(function () {
          hasUserUnlockedAudio = true;
          return true;
        })
        .catch(function () {
          // В редких случаях браузер может отклонить play даже после действия.
          bgMusic.muted = true;
          playMutedAutostart();
          return false;
        });
    }

    hasUserUnlockedAudio = true;
    return Promise.resolve(true);
  }

  function disableMusic() {
    if (!bgMusic) return;
    shouldPlayMusic = false;
    saveMusicPreference(false);
    updateMusicToggleUI();
    bgMusic.pause();
  }

  function removeFirstInteractionListeners() {
    if (!firstInteractionBound) return;
    firstInteractionBound = false;
    ["touchstart", "scroll", "keydown"].forEach(function (eventName) {
      window.removeEventListener(eventName, handleFirstInteraction, true);
    });
  }

  function handleFirstInteraction(event) {
    // Если первый клик пришёлся по кнопке, не делаем автопереключение здесь:
    // кнопка обработает это сама без двойного toggle.
    if (event && musicToggleBtn && event.target && musicToggleBtn.contains(event.target)) {
      removeFirstInteractionListeners();
      return;
    }

    if (shouldPlayMusic) {
      enableMusicWithSound().then(function (started) {
        if (started || hasUserUnlockedAudio) {
          removeFirstInteractionListeners();
        }
      });
      return;
    }
    removeFirstInteractionListeners();
  }

  function bindFirstInteractionListeners() {
    if (firstInteractionBound) return;
    firstInteractionBound = true;
    ["touchstart", "scroll", "keydown"].forEach(function (eventName) {
      window.addEventListener(eventName, handleFirstInteraction, { capture: true, passive: true });
    });
  }

  if (bgMusic && musicToggleBtn) {
    var savedPreference = readMusicPreference();
    if (savedPreference === false) {
      shouldPlayMusic = false;
      bgMusic.muted = true;
    } else {
      // По умолчанию музыка включена: запускаем autoplay без звука.
      shouldPlayMusic = true;
      playMutedAutostart();
      // После первого действия пользователя снимаем mute автоматически.
      bindFirstInteractionListeners();
    }

    updateMusicToggleUI();

    musicToggleBtn.addEventListener("click", function () {
      // Первый тап по кнопке в состоянии muted должен включить звук сразу.
      if (shouldPlayMusic && bgMusic.muted) {
        enableMusicWithSound().then(function (started) {
          if (started || hasUserUnlockedAudio) {
            removeFirstInteractionListeners();
          }
        });
        return;
      }

      if (shouldPlayMusic) {
        disableMusic();
      } else {
        enableMusicWithSound();
      }
    });
  }

  /* ——— Форма подтверждения (блок 4) ——— */
  var FEEDBACK_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyrzSdPaWa2CkvJfVdSmN8LP6Kx094vFDasdq0m12TZ6GBAczoNkoFC__7cJuswrETdRw/exec";

  var formPlace = document.getElementById("block-place-form");
  var submitBtn = formPlace && formPlace.querySelector('button[type="submit"]');
  var msgSuccess = document.getElementById("block-place-success");
  var msgError = document.getElementById("block-place-error");

  if (formPlace && submitBtn && msgSuccess && msgError) {
    formPlace.addEventListener("submit", function (e) {
      e.preventDefault();
      msgSuccess.hidden = true;
      msgError.hidden = true;

      var nameInput = formPlace.querySelector('input[name="guestName"]');
      var attendInput = formPlace.querySelector('input[name="attend"]:checked');

      var name = nameInput ? nameInput.value.trim() : "";
      if (!name) {
        msgError.textContent = "Аты-жөніңізді енгізіңіз.";
        msgError.hidden = false;
        return;
      }
      if (!attendInput) {
        msgError.textContent = "«Тойға келесіз бе?» сұрағына жауап таңдаңыз.";
        msgError.hidden = false;
        return;
      }

      var answer = attendInput.value;

      submitBtn.disabled = true;
      msgSuccess.textContent = "Жіберілуде...";
      msgSuccess.hidden = false;

      var payload = JSON.stringify({ name: name, answer: answer });

      fetch(FEEDBACK_WEBHOOK_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json"
        },
        body: payload
      })
        .then(function () {
          msgSuccess.textContent = "Рақмет! Сіздің жауабыңыз жіберілді.";
          msgSuccess.hidden = false;
          msgError.hidden = true;
          formPlace.reset();
        })
        .catch(function () {
          msgError.textContent = "Жіберу кезінде қате. Қайта көріңіз.";
          msgError.hidden = false;
          msgSuccess.hidden = true;
        })
        .finally(function () {
          submitBtn.disabled = false;
        });
    });
  }

  /* ——— Обратный отсчёт до 25 июня 2026, 14:00 ——— */
  var elDays = document.getElementById("countdown-days");
  var elHours = document.getElementById("countdown-hours");
  var elMinutes = document.getElementById("countdown-minutes");
  var elSeconds = document.getElementById("countdown-seconds");
  if (!elDays || !elHours || !elMinutes || !elSeconds) return;

  var targetDate = new Date("2026-06-25T14:00:00");

  function formatTwo(num) {
    return num < 10 ? "0" + num : String(num);
  }

  function updateCountdown() {
    var now = new Date();
    var diff = targetDate - now;

    if (diff <= 0) {
      elDays.textContent = "0";
      elHours.textContent = "00";
      elMinutes.textContent = "00";
      elSeconds.textContent = "00";
      return;
    }

    var days = Math.floor(diff / (1000 * 60 * 60 * 24));
    var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    var seconds = Math.floor((diff % (1000 * 60)) / 1000);

    elDays.textContent = String(days);
    elHours.textContent = formatTwo(hours);
    elMinutes.textContent = formatTwo(minutes);
    elSeconds.textContent = formatTwo(seconds);
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);
})();
