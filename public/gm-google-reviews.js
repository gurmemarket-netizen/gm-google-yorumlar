/*! GurmeMarket Google yorumları – kendi kendine güncellenen vitrin
 * Kullanım (IdeaSoft tema / ek kod alanı):
 *   <script src="https://KULLANICI.github.io/gm-google-yorumlar/gm-google-reviews.js" defer></script>
 * Sayfada nereye konursa orada görünür:
 *   <div id="gm-google-reviews"></div>      → büyük yorum bölümü (ana sayfa)
 *   <div class="gm-google-badge"></div>     → küçük puan rozeti (ürün sayfası, sepet vb.)
 * Yüzen rozet (sol alt) varsayılan olarak açıktır; kapatmak için script etiketine data-float="0" ekleyin.
 */
(function () {
  'use strict';
  var me = document.currentScript;
  var SRC = (me && me.getAttribute('data-src')) || (me ? me.src.replace(/[^/]*$/, 'reviews.json') : 'reviews.json');
  var FLOAT = !me || me.getAttribute('data-float') !== '0';
  var AYLAR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

  var C = {
    ink: '#3b2a1a', soft: '#7a5a3a', line: '#eadfce', bg: '#fbf7f0', card: '#ffffff',
    star: '#f5b301', accent: '#2f6b2f', accentInk: '#ffffff'
  };

  var G_ICON = '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 2.9-2.2 5.4-4.7 7.1l7.6 5.9c4.4-4.1 6.9-10.1 6.9-17.5z"/><path fill="#FBBC05" d="M10.6 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l8-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.2 0-11.5-4.2-13.4-9.9l-8 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function stars(n, size) {
    var out = '', full = Math.round(n * 2) / 2;
    for (var i = 1; i <= 5; i++) {
      var fill = full >= i ? 1 : (full >= i - 0.5 ? 0.5 : 0);
      out += '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" aria-hidden="true"><defs><linearGradient id="g' + i + fill + '"><stop offset="' + (fill * 100) + '%" stop-color="' + C.star + '"/><stop offset="' + (fill * 100) + '%" stop-color="#d9d2c5"/></linearGradient></defs><path fill="url(#g' + i + fill + ')" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>';
    }
    return '<span class="st" role="img" aria-label="5 üzerinden ' + String(n).replace('.', ',') + ' yıldız">' + out + '</span>';
  }
  function puan(n) { return Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
  function adet(n) { return Number(n).toLocaleString('tr-TR'); }
  function tarih(r) {
    if (r.relative && !r.approxDate) return r.relative;
    var d = new Date(r.publishTime);
    return isNaN(d) ? '' : AYLAR[d.getMonth()] + ' ' + d.getFullYear();
  }
  function initial(name) { return (String(name || '?').trim()[0] || '?').toLocaleUpperCase('tr'); }

  var CSS = [
    ':host{all:initial;display:block;font-family:inherit;color:' + C.ink + '}',
    '*{box-sizing:border-box;font-family:inherit}',
    'a{color:inherit}',
    '.st{display:inline-flex;gap:1px;vertical-align:middle}',
    '.wrap{background:' + C.bg + ';border:1px solid ' + C.line + ';border-radius:20px;padding:28px 24px;margin:24px 0}',
    '.head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:18px;margin-bottom:20px}',
    '.score{display:flex;align-items:center;gap:16px}',
    '.big{font-size:56px;line-height:1;font-weight:800;letter-spacing:-1px}',
    '.meta{display:flex;flex-direction:column;gap:6px}',
    '.ttl{font-size:20px;font-weight:700;display:flex;align-items:center;gap:8px}',
    '.sub{font-size:14px;color:' + C.soft + '}',
    '.btns{display:flex;flex-wrap:wrap;gap:10px}',
    '.btn{display:inline-flex;align-items:center;gap:8px;padding:11px 16px;border-radius:999px;font-size:14px;font-weight:700;text-decoration:none;border:1px solid ' + C.line + ';background:#fff;color:' + C.ink + '}',
    '.btn.p{background:' + C.accent + ';border-color:' + C.accent + ';color:' + C.accentInk + '}',
    '.btn:hover{filter:brightness(.96)}',
    '.rail{position:relative}',
    '.track{display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;padding:4px 2px 12px;scrollbar-width:thin}',
    '.card{flex:0 0 300px;scroll-snap-align:start;background:' + C.card + ';border:1px solid ' + C.line + ';border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:10px}',
    '.who{display:flex;align-items:center;gap:10px}',
    '.av{width:40px;height:40px;border-radius:50%;flex:none;background:#efe4d3;color:' + C.ink + ';display:flex;align-items:center;justify-content:center;font-weight:800;overflow:hidden}',
    '.av img{width:100%;height:100%;object-fit:cover}',
    '.nm{font-weight:700;font-size:15px;line-height:1.2}',
    '.dt{font-size:12px;color:' + C.soft + '}',
    '.row{display:flex;align-items:center;justify-content:space-between}',
    '.tx{font-size:14.5px;line-height:1.55;margin:0;display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden}',
    '.card.open .tx{display:block}',
    '.more{background:none;border:0;padding:0;color:' + C.accent + ';font-weight:700;font-size:13px;cursor:pointer;align-self:flex-start}',
    '.nav{position:absolute;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:50%;border:1px solid ' + C.line + ';background:#fff;color:' + C.ink + ';font-size:20px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.08)}',
    '.nav.l{left:-14px}.nav.r{right:-14px}',
    '.foot{font-size:12px;color:' + C.soft + ';margin-top:6px;display:flex;align-items:center;gap:6px}',
    '@media (max-width:640px){.wrap{padding:20px 14px;border-radius:16px}.big{font-size:44px}.card{flex-basis:82%}.nav{display:none}.btn{flex:1;justify-content:center}}',
    /* rozet */
    '.bdg{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;background:#fff;border:1px solid ' + C.line + ';text-decoration:none;color:' + C.ink + ';font-size:14px;line-height:1}',
    '.bdg b{font-size:16px}',
    '.bdg .c{color:' + C.soft + '}',
    '.flt{position:fixed;left:16px;bottom:16px;z-index:9998;box-shadow:0 4px 16px rgba(0,0,0,.14)}',
    '.flt .x{border:0;background:none;color:' + C.soft + ';font-size:16px;cursor:pointer;padding:0 0 0 4px;line-height:1}',
    '@media (max-width:640px){.flt{bottom:84px;left:12px;font-size:13px}}'
  ].join('');

  function mount(el) {
    var root = el.shadowRoot || el.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>' + CSS + '</style>';
    return root;
  }

  function section(el, d) {
    var p = d.place, root = mount(el);
    var cards = d.reviews.map(function (r) {
      var av = r.photo ? '<img src="' + esc(r.photo) + '" alt="" loading="lazy" referrerpolicy="no-referrer" data-i="' + esc(initial(r.author)) + '">' : esc(initial(r.author));
      var name = r.authorUri ? '<a href="' + esc(r.authorUri) + '" target="_blank" rel="noopener nofollow" style="text-decoration:none">' + esc(r.author) + '</a>' : esc(r.author);
      return '<article class="card"><div class="row"><div class="who"><div class="av">' + av + '</div><div><div class="nm">' + name + '</div><div class="dt">' + esc(tarih(r)) + '</div></div></div>' + G_ICON + '</div>' +
        stars(r.rating, 16) + '<p class="tx">' + esc(r.text) + '</p>' +
        (r.text.length > 220 ? '<button class="more" type="button">Devamını oku</button>' : '') + '</article>';
    }).join('');
    var box = document.createElement('section');
    box.className = 'wrap';
    box.setAttribute('aria-label', 'Google müşteri yorumları');
    box.innerHTML =
      '<div class="head"><div class="score"><div class="big">' + puan(p.rating) + '</div><div class="meta">' +
      '<div class="ttl">' + G_ICON + ' Google’da müşterilerimiz ne diyor?</div>' +
      '<div>' + stars(p.rating, 22) + '</div>' +
      '<div class="sub">' + adet(p.count) + ' Google yorumuna göre ortalama puan</div></div></div>' +
      '<div class="btns"><a class="btn p" href="' + esc(p.mapsUri) + '" target="_blank" rel="noopener">Tüm yorumları Google’da okuyun</a>' +
      '<a class="btn" href="' + esc(p.writeReviewUri || p.mapsUri) + '" target="_blank" rel="noopener">Siz de yorum yazın</a></div></div>' +
      '<div class="rail"><button class="nav l" type="button" aria-label="Önceki yorumlar">‹</button><div class="track">' + cards + '</div><button class="nav r" type="button" aria-label="Sonraki yorumlar">›</button></div>' +
      '<div class="foot">' + G_ICON + ' Yorumlar Google Haritalar’daki işletme profilimizden otomatik olarak alınır.</div>';
    root.appendChild(box);
    box.querySelectorAll('.av img').forEach(function (im) {
      function fallback() { var p = im.parentNode; if (p) p.textContent = im.getAttribute('data-i'); }
      im.addEventListener('error', fallback);
      if (im.complete && !im.naturalWidth) fallback();
    });
    var track = box.querySelector('.track');
    box.querySelector('.l').onclick = function () { track.scrollBy({ left: -track.clientWidth * 0.9, behavior: 'smooth' }); };
    box.querySelector('.r').onclick = function () { track.scrollBy({ left: track.clientWidth * 0.9, behavior: 'smooth' }); };
    box.querySelectorAll('.more').forEach(function (b) {
      b.onclick = function () { var c = b.closest('.card'); c.classList.toggle('open'); b.textContent = c.classList.contains('open') ? 'Daha az göster' : 'Devamını oku'; };
    });
  }

  function badge(el, d, floating) {
    var p = d.place, root = mount(el);
    var href = document.getElementById('gm-google-reviews') ? '#gm-google-reviews' : p.mapsUri;
    var a = document.createElement('a');
    a.className = 'bdg' + (floating ? ' flt' : '');
    a.href = href;
    if (href.charAt(0) !== '#') { a.target = '_blank'; a.rel = 'noopener'; }
    a.setAttribute('aria-label', 'Google’da ' + puan(p.rating) + ' puan, ' + adet(p.count) + ' yorum');
    a.innerHTML = G_ICON + '<b>' + puan(p.rating) + '</b>' + stars(p.rating, 15) + '<span class="c">' + adet(p.count) + ' yorum</span>' +
      (floating ? '<button class="x" type="button" aria-label="Kapat">×</button>' : '');
    root.appendChild(a);
    if (floating) a.querySelector('.x').onclick = function (e) {
      e.preventDefault(); e.stopPropagation(); el.remove();
      try { sessionStorage.setItem('gmBadgeClosed', '1'); } catch (x) {}
    };
  }

  function run(d) {
    if (!d || !d.place || !d.place.rating) return;
    d.reviews = (d.reviews || []).filter(function (r) { return r.text && r.rating >= 4; });
    var s = document.getElementById('gm-google-reviews');
    if (s && d.reviews.length) section(s, d);
    document.querySelectorAll('.gm-google-badge').forEach(function (b) { badge(b, d, false); });
    var closed = false;
    try { closed = sessionStorage.getItem('gmBadgeClosed') === '1'; } catch (x) {}
    if (FLOAT && !closed && !document.querySelector('[data-gm-float]')) {
      var f = document.createElement('div');
      f.setAttribute('data-gm-float', '');
      document.body.appendChild(f);
      badge(f, d, true);
    }
  }

  function start() {
    fetch(SRC, { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(run).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
