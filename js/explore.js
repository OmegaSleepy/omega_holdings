function splitCsvLine(line){
  const res = [];
  let cur = '';
  let inQuotes = false;
  for(let i=0; i<line.length; i++){
    const ch = line[i];
    if(ch === '"'){
      if(inQuotes && line[i+1] === '"'){ cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if(ch === ',' && !inQuotes){
      res.push(cur); cur = '';
    } else { cur += ch; }
  }
  res.push(cur);
  return res.map(s=>s.replace(/^"|"$/g,'').replace(/""/g,'"'));
}

async function loadListings(){
  const res = await fetch('listings.csv');
  const text = await res.text();
  const lines = text.trim().split('\n').slice(1).filter(Boolean);
  const listings = lines.map(l=>{
    const parts = splitCsvLine(l);
    const [name, price, size, year_of_building, address] = parts;
    return {
      name,
      price,
      size,
      year: year_of_building,
      address
    };
  });
  return listings;
}

function formatPrice(val) {
  const num = Number(val);
  if (isNaN(num)) return val;
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(num);
}

function makeCard(item) {
  const div = document.createElement('div');
  div.className = 'card';

  const imgWrap = document.createElement('div');
  imgWrap.className = 'card-img-wrap';

  const img = document.createElement('img');
  img.src = `listings/${item.name}/pictures/main.png`;

  // Luxury Fallback SVG String
  const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="100%" height="100%" fill="#f4efe6"/><rect x="20" y="20" width="560" height="360" fill="none" stroke="#c5a059" stroke-width="1"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="#1c1a17" font-family="Cinzel, serif" font-size="22" letter-spacing="2">MAISON HAUSSMANN</text><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#9e7b39" font-family="Montserrat, sans-serif" font-size="12" letter-spacing="3">ARCHITECTURAL RESIDENCE</text></svg>`;

  img.onerror = () => {
    img.onerror = null; 
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fallbackSvg)}`;
  };

  imgWrap.appendChild(img);
  div.appendChild(imgWrap);

  const meta = document.createElement('div');
  meta.className = 'meta';
  const addr = item.address ? item.address : 'Paris, France';
  const formattedTitle = item.name.replace(/_/g, ' ');
  const displayPrice = formatPrice(item.price);

  meta.innerHTML = `
    <a href="listing.html?name=${encodeURIComponent(item.name)}">
      <h3>${formattedTitle}</h3>
    </a>
    <div class="card-details">${item.year} • ${item.size} m²</div>
    <div class="price">${displayPrice}</div>
    <div class="addr">${addr}</div>
  `;

  div.appendChild(meta);
  return div;
}

function applyFilters(data){
  const smin = Number(document.getElementById('filter-size-min').value || -Infinity);
  const smax = Number(document.getElementById('filter-size-max').value || Infinity);
  const pmin = Number(document.getElementById('filter-price-min').value || -Infinity);
  const pmax = Number(document.getElementById('filter-price-max').value || Infinity);
  const ymin = Number(document.getElementById('filter-year-min').value || -Infinity);
  const ymax = Number(document.getElementById('filter-year-max').value || Infinity);
  return data.filter(d=>{
    const size = Number(d.size || 0);
    const price = Number(d.price || 0);
    const year = Number(d.year || 0);
    return size >= smin && size <= smax && price >= pmin && price <= pmax && year >= ymin && year <= ymax;
  });
}

function sortData(data, mode){
  const [key, ord] = mode.split('_');
  const mapKey = key === 'price' ? 'price' : (key === 'size' ? 'size' : 'year');
  data.sort((a, b)=>{
    const va = Number(a[mapKey] || 0);
    const vb = Number(b[mapKey] || 0);
    return (va - vb) * (ord === 'asc' ? 1 : -1);
  });
}

function paginate(data, page, pageSize){
  const start = (page - 1) * pageSize;
  return data.slice(start, start + pageSize);
}

function renderPagination(total, page, pageSize, cb){
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const container = document.getElementById('pagination');
  container.innerHTML = '';

  const makeBtn = (n, label)=>{
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', ()=>cb(n));
    if(n === page) b.classList.add('active');
    return b;
  };

  if(page > 1) container.appendChild(makeBtn(page - 1, 'Prev'));
  for(let i = 1; i <= pages; i++) container.appendChild(makeBtn(i, i));
  if(page < pages) container.appendChild(makeBtn(page + 1, 'Next'));
}

(async ()=>{
  let data = await loadListings();
  const container = document.getElementById('listings');
  let currentPage = 1;
  let pageSize = Number(document.getElementById('page-size').value) || 6;

  function doRender(list){
    container.innerHTML = '';
    const pageData = paginate(list, currentPage, pageSize);
    pageData.forEach(it => container.appendChild(makeCard(it)));
    renderPagination(list.length, currentPage, pageSize, (p)=>{
      currentPage = p;
      doRender(list);
    });
  }

  // Initial setup & render
  const sortSelect = document.getElementById('sort');
  sortData(data, sortSelect.value);
  doRender(data);

  // Event Listeners
  document.getElementById('apply-filters').addEventListener('click', ()=>{
    const filtered = applyFilters(data);
    currentPage = 1;
    sortData(filtered, sortSelect.value);
    doRender(filtered);
  });

  document.getElementById('clear-filters').addEventListener('click', ()=>{
    document.querySelectorAll('.filter-panel input').forEach(i => i.value = '');
    currentPage = 1;
    sortData(data, sortSelect.value);
    doRender(data);
  });

  document.getElementById('sort').addEventListener('change', ()=>{
    const filtered = applyFilters(data);
    sortData(filtered, sortSelect.value);
    doRender(filtered);
  });

  document.getElementById('page-size').addEventListener('change', ()=>{
    pageSize = Number(document.getElementById('page-size').value);
    currentPage = 1;
    const filtered = applyFilters(data);
    doRender(filtered);
  });
})();