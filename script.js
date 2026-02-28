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
