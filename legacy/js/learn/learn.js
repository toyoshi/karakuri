/* ============================================================
   KARAKURI — 読み解き niceties
   - reading progress bar
   - sticky ToC current-section highlight
   - scroll reveal (mirrors the landing)
   No deps. No console noise.
   ============================================================ */
(function () {
  'use strict';

  // footer year
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ---- reading progress ----
  var bar = document.querySelector('.reading-progress');
  function updateProgress() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - doc.clientHeight;
    var pct = max > 0 ? (doc.scrollTop || window.scrollY) / max : 0;
    if (bar) bar.style.width = Math.max(0, Math.min(1, pct)) * 100 + '%';
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(function () { updateProgress(); ticking = false; });
    }
  }, { passive: true });
  updateProgress();

  // ---- ToC current-section highlight ----
  var links = Array.prototype.slice.call(document.querySelectorAll('.toc__list a'));
  var sections = links
    .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
    .filter(Boolean);

  if (sections.length && 'IntersectionObserver' in window) {
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var visible = new Set();
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) visible.add(e.target.id);
        else visible.delete(e.target.id);
      });
      // choose the topmost visible section in document order
      var current = null;
      for (var i = 0; i < sections.length; i++) {
        if (visible.has(sections[i].id)) { current = sections[i].id; break; }
      }
      if (!current) return;
      links.forEach(function (a) { a.classList.remove('is-current'); });
      if (byId[current]) byId[current].classList.add('is-current');
    }, { rootMargin: '-20% 0px -65% 0px', threshold: 0 });
    sections.forEach(function (s) { obs.observe(s); });
  }

  // ---- scroll reveal ----
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.1 });
    document.querySelectorAll('.concept, .read-closer').forEach(function (el) {
      el.classList.add('reveal');
      io.observe(el);
    });
  }
})();
