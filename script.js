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

  /* ——— Декоративные листья: полёт вправо с лёгким отклонением ——— */
  var LEAF_TOTAL_COUNT = 40;
  var LEAF_MIN_SIZE = 18;
  var LEAF_MAX_SIZE = 56;
  var LEAF_MIN_SPEED = 35; /* px/s */
  var LEAF_MAX_SPEED = 90; /* px/s */
  var LEAF_MIN_AMPLITUDE = 8;
  var LEAF_MAX_AMPLITUDE = 24;

  var leafImageSources = [
    "pictures/leafs/l1.png",
    "pictures/leafs/l2.png",
    "pictures/leafs/l3.png",
    "pictures/leafs/l4.png",
    "pictures/leafs/l5.png"
  ];
  var leafLayers = Array.prototype.slice.call(document.querySelectorAll(".leaf-layer"));
  var leaves = [];
  var leafAnimationId = 0;
  var lastLeafTimestamp = 0;
  var resizeTimer = 0;

  function randomRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function randomInt(min, max) {
    return Math.floor(randomRange(min, max + 1));
  }

  function distributeLeaves(totalCount, layers) {
    var heights = [];
    var totalHeight = 0;
    var baseCounts = [];
    var fractions = [];
    var remaining = totalCount;
    var i;

    for (i = 0; i < layers.length; i += 1) {
      var height = Math.max(layers[i].clientHeight, 1);
      heights.push(height);
      totalHeight += height;
    }

    for (i = 0; i < layers.length; i += 1) {
      var exactCount = totalCount * (heights[i] / totalHeight);
      var floorCount = Math.floor(exactCount);
      baseCounts.push(floorCount);
      fractions.push({ index: i, value: exactCount - floorCount });
      remaining -= floorCount;
    }

    fractions.sort(function (a, b) {
      return b.value - a.value;
    });

    for (i = 0; i < remaining; i += 1) {
      baseCounts[fractions[i % fractions.length].index] += 1;
    }

    return baseCounts;
  }

  function resetLeaf(leaf, startAnywhere) {
    var layerWidth = Math.max(leaf.layer.clientWidth, 1);
    var layerHeight = Math.max(leaf.layer.clientHeight, 1);
    leaf.size = randomRange(LEAF_MIN_SIZE, LEAF_MAX_SIZE);
    leaf.speed = randomRange(LEAF_MIN_SPEED, LEAF_MAX_SPEED);
    leaf.amplitude = randomRange(LEAF_MIN_AMPLITUDE, LEAF_MAX_AMPLITUDE);
    leaf.waveFrequency = randomRange(0.6, 1.3);
    leaf.phase = randomRange(0, Math.PI * 2);
    leaf.rotationBase = randomRange(-20, 20);
    leaf.rotationSpeed = randomRange(-8, 8);
    leaf.time = 0;
    leaf.baseY = randomRange(0, layerHeight);
    leaf.x = startAnywhere
      ? randomRange(-leaf.size, layerWidth + leaf.size)
      : randomRange(-leaf.size * 2, -leaf.size);

    leaf.el.style.setProperty("--leaf-size", leaf.size.toFixed(1) + "px");
    leaf.el.style.setProperty("--leaf-opacity", randomRange(0.62, 0.95).toFixed(2));
    leaf.el.style.transform = "translate3d(" + leaf.x + "px," + leaf.baseY + "px,0)";
  }

  function createLeaf(layer) {
    var leafEl = document.createElement("span");
    leafEl.className = "leaf";

    var imgEl = document.createElement("img");
    imgEl.src = leafImageSources[randomInt(0, leafImageSources.length - 1)];
    imgEl.alt = "";
    imgEl.loading = "lazy";

    leafEl.appendChild(imgEl);
    layer.appendChild(leafEl);

    var leaf = {
      layer: layer,
      el: leafEl,
      x: 0,
      baseY: 0,
      size: 0,
      speed: 0,
      amplitude: 0,
      waveFrequency: 0,
      phase: 0,
      rotationBase: 0,
      rotationSpeed: 0,
      time: 0
    };

    resetLeaf(leaf, true);
    return leaf;
  }

  function destroyLeaves() {
    if (leafAnimationId) {
      cancelAnimationFrame(leafAnimationId);
      leafAnimationId = 0;
    }
    leafLayers.forEach(function (layer) {
      layer.innerHTML = "";
    });
    leaves = [];
    lastLeafTimestamp = 0;
  }

  function animateLeaves(timestamp) {
    if (!lastLeafTimestamp) lastLeafTimestamp = timestamp;
    var delta = Math.min((timestamp - lastLeafTimestamp) / 1000, 0.05);
    lastLeafTimestamp = timestamp;

    leaves.forEach(function (leaf) {
      var layerWidth = Math.max(leaf.layer.clientWidth, 1);
      var layerHeight = Math.max(leaf.layer.clientHeight, 1);

      leaf.time += delta;
      leaf.x += leaf.speed * delta;

      if (leaf.x > layerWidth + leaf.size * 1.5) {
        resetLeaf(leaf, false);
      }

      var y = leaf.baseY + Math.sin(leaf.time * leaf.waveFrequency + leaf.phase) * leaf.amplitude;
      var rotation = leaf.rotationBase + Math.sin(leaf.time + leaf.phase) * 8 + leaf.rotationSpeed * leaf.time;

      if (y < -leaf.size) y = -leaf.size;
      if (y > layerHeight + leaf.size) y = layerHeight + leaf.size;

      leaf.el.style.transform =
        "translate3d(" +
        leaf.x.toFixed(2) +
        "px," +
        y.toFixed(2) +
        "px,0) rotate(" +
        rotation.toFixed(2) +
        "deg)";
    });

    leafAnimationId = requestAnimationFrame(animateLeaves);
  }

  function initLeaves() {
    if (!leafLayers.length) return;
    destroyLeaves();

    var countsByLayer = distributeLeaves(LEAF_TOTAL_COUNT, leafLayers);
    leafLayers.forEach(function (layer, layerIndex) {
      var count = countsByLayer[layerIndex];
      for (var i = 0; i < count; i += 1) {
        leaves.push(createLeaf(layer));
      }
    });

    leafAnimationId = requestAnimationFrame(animateLeaves);
  }

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    initLeaves();
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(initLeaves, 180);
    });
  }

  /* ——— Фоновая музыка (автозапуск + сохранение выбора) ——— */
  var MUSIC_STORAGE_KEY = "weddingMusicEnabled";
  var bgMusic = document.getElementById("bg-music");
  var musicToggleBtn = document.getElementById("music-toggle-btn");

  function getSavedMusicPreference() {
    return localStorage.getItem(MUSIC_STORAGE_KEY) === "true";
  }

  function saveMusicPreference(isEnabled) {
    localStorage.setItem(MUSIC_STORAGE_KEY, String(isEnabled));
  }

  function updateMusicButton(isPlaying) {
    if (!musicToggleBtn) return;
    musicToggleBtn.classList.toggle("is-playing", isPlaying);
    musicToggleBtn.setAttribute(
      "aria-label",
      isPlaying ? "Выключить музыку" : "Включить музыку"
    );
    musicToggleBtn.setAttribute(
      "title",
      isPlaying ? "Выключить музыку" : "Включить музыку"
    );
  }

  function playMusic() {
    if (!bgMusic) return Promise.reject(new Error("Audio element not found"));
    return bgMusic.play().then(function () {
      saveMusicPreference(true);
      updateMusicButton(true);
    });
  }

  function pauseMusic() {
    if (!bgMusic) return;
    bgMusic.pause();
    saveMusicPreference(false);
    updateMusicButton(false);
  }

  function enableMusicOnFirstInteraction() {
    function playOnInteraction() {
      if (!getSavedMusicPreference()) return;
      playMusic().catch(function () {
        /* Браузер может все еще блокировать звук — оставляем кнопку для ручного включения */
      });
    }

    document.addEventListener("click", playOnInteraction, { once: true });
    document.addEventListener("touchstart", playOnInteraction, { once: true });
  }

  if (bgMusic && musicToggleBtn) {
    updateMusicButton(!bgMusic.paused);

    if (getSavedMusicPreference()) {
      playMusic().catch(function () {
        /* Адаптация вашего кода: если автозапуск заблокирован, ждём первое взаимодействие */
        enableMusicOnFirstInteraction();
      });
    } else {
      updateMusicButton(false);
    }

    musicToggleBtn.addEventListener("click", function () {
      if (bgMusic.paused) {
        playMusic().catch(function () {
          updateMusicButton(false);
        });
      } else {
        pauseMusic();
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
