function qparam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function sanitizeName(name) {
  if (!name) return '';
  return name.replace(/[^a-zA-Z0-9_-]/g, '');
}

function formatPrice(val) {
  const num = Number(val);
  if (isNaN(num) || num === 0) return val || '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(num);
}

function normalizeValue(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

async function loadInfo(name) {
  try {
    const infoRes = await fetch(`listings/${name}/information.md`);
    if (!infoRes.ok) throw new Error('Listing metadata not found');
    const infoText = await infoRes.text();
    return parseInfoMarkdown(infoText);
  } catch (err) {
    console.error(err);
    return null;
  }
}

function parseInfoMarkdown(md) {
  const lines = md.split('\n');
  const obj = { details: '' };
  
  if (lines[0].trim() === '---') {
    let i = 1;
    for (; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '---') { i++; break; }
      
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const k = line.slice(0, colonIdx).trim().toLowerCase();
        const v = normalizeValue(line.slice(colonIdx + 1).trim());
        obj[k] = v;
      }
    }
    obj.details = lines.slice(i).join('\n').trim();
  } else {
    const detailLines = [];
    for (const l of lines) {
      const colonIdx = l.indexOf(':');
      if (colonIdx !== -1 && !obj.details) {
        const k = l.slice(0, colonIdx).trim().toLowerCase().replace(/ /g, '_');
        const v = normalizeValue(l.slice(colonIdx + 1).trim());
        obj[k] = v;
      } else {
        detailLines.push(l);
      }
    }
    obj.details = detailLines.join('\n').trim();
  }
  return obj;
}

function checkImageExists(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

async function loadImages(name) {
  const listingDir = `listings/${name}`;
  const mappingUrl = `${listingDir}/pictures.txt`;

  try {
    const mappingRes = await fetch(mappingUrl);
    if (mappingRes.ok) {
      const text = await mappingRes.text();
      const images = text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((relativePath) => `${listingDir}/${relativePath}`);

      if (images.length > 0) {
        return images;
      }
    }
  } catch (err) {
    console.warn('Failed to load picture mapping', err);
  }

  const candidateImages = [];
  candidateImages.push(`${listingDir}/pictures/main.png`);

  for (let i = 1; i <= 9; i++) {
    candidateImages.push(`${listingDir}/pictures/room${i}.png`);
  }

  const validImages = [];
  for (const src of candidateImages) {
    const exists = await checkImageExists(src);
    if (exists) {
      validImages.push(src);
    }
  }

  return validImages;
}

(async () => {
  const rawName = qparam('name');
  const name = sanitizeName(rawName);
  
  const contentEl = document.getElementById('listing-content');
  const errorEl = document.getElementById('listing-error');

  if (!name) {
    contentEl.style.display = 'none';
    errorEl.style.display = 'block';
    return;
  }

  const info = await loadInfo(name);
  if (!info) {
    contentEl.style.display = 'none';
    errorEl.style.display = 'block';
    return;
  }

  // Populate metadata fields
  const formattedTitle = name.replace(/_/g, ' ');
  document.getElementById('listing-title').textContent = formattedTitle;
  document.title = `${formattedTitle} — Maison Haussmann`;

  const rawSize = info.size || info['size_m2'] || '—';
  document.getElementById('listing-size').textContent = rawSize !== '—' && !rawSize.includes('m²') ? `${rawSize} m²` : rawSize;
  document.getElementById('listing-price').textContent = formatPrice(info.price);
  document.getElementById('listing-year').textContent = info.year || info.year_of_building || '—';
  document.getElementById('listing-address').textContent = info.address || 'Paris, France';
  document.getElementById('listing-details').textContent = info.details || 'Detailed description forthcoming for this private residence.';

  // Image Carousel setup
  const imgs = await loadImages(name);
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  const imgEl = document.getElementById('carousel-image');
  const counterEl = document.getElementById('carousel-counter');
  const captionEl = document.getElementById('carousel-caption');

  const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><rect width="100%" height="100%" fill="#f4efe6"/><rect x="30" y="30" width="740" height="440" fill="none" stroke="#c5a059" stroke-width="1"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="#1c1a17" font-family="Cinzel, serif" font-size="28" letter-spacing="2">MAISON HAUSSMANN</text><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#9e7b39" font-family="Montserrat, sans-serif" font-size="14" letter-spacing="3">IMAGE ARCHIVE UNAVAILABLE</text></svg>`;

  if (imgs.length === 0) {
    imgEl.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fallbackSvg)}`;
    counterEl.style.display = 'none';
    if (captionEl) captionEl.style.display = 'none';
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  let currentIndex = 0;
  // Helper function to extract a clean display name from image file path
  function getImageName(src) {
    const filename = src.split('/').pop().split('?')[0];
    return filename.replace(/\.[^/.]+$/, '');
  }

  // Update carousel function
  function updateCarousel() {
    const currentSrc = imgs[currentIndex];
    imgEl.src = currentSrc;
    counterEl.textContent = `${currentIndex + 1} / ${imgs.length}`;
    if (captionEl) {
      captionEl.textContent = getImageName(currentSrc);
    }
    prevBtn.disabled = imgs.length <= 1;
    nextBtn.disabled = imgs.length <= 1;
  }

  prevBtn.addEventListener('click', () => {
    currentIndex = (currentIndex - 1 + imgs.length) % imgs.length;
    updateCarousel();
  });

  nextBtn.addEventListener('click', () => {
    currentIndex = (currentIndex + 1) % imgs.length;
    updateCarousel();
  });

  updateCarousel();
})();