const GITHUB_USER = 'ddark-il';
const ROW_H = 220;
const GAP = 4;
const MAX_PER_POST_THUMBS = 24;

let PhotoSwipeLightbox = null;

document.getElementById('year').textContent = new Date().getFullYear();
document.getElementById('ghLink').href = `https://github.com/${GITHUB_USER}`;
document.getElementById('profileAvatar').src = `https://github.com/${GITHUB_USER}.png`;

// ---------- Tabs ----------

document.querySelectorAll('[data-go-timeline]').forEach(el => {
    el.addEventListener('click', (ev) => {
        ev.preventDefault();
        document.querySelector('.nav-item[data-target="timelineSection"]')?.click();
    });
});

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        document.querySelectorAll('main .section').forEach(s => s.classList.add('hidden'));
        document.getElementById(item.dataset.target).classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});

// ---------- Timeline ----------

async function loadPosts() {
    const posts = await fetch('photos/posts.json').then(r => r.ok ? r.json() : []);
    // Honor blocked_photos — filter out hidden photos from each post.
    let blocked = {};
    try { blocked = await fetch('config/blocked_photos.json').then(r => r.ok ? r.json() : {}); } catch {}
    const isBlocked = (src, file) => (blocked[src] || []).includes(file);
    return posts
        .map(p => ({ ...p, photos: p.photos.filter(x => !isBlocked(x.src, x.file)) }))
        .filter(p => p.photos.length > 0);
}

function yearOf(date) {
    return date === 'undated' ? 'undated' : date.slice(0, 4);
}

function formatDay(date) {
    if (date === 'undated') return 'Undated';
    const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return date;
    const [_, y, mo, d] = m;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${parseInt(d, 10)} ${months[+mo - 1]} ${y}`;
}

async function renderTimeline() {
    const stream = document.getElementById('timelineStream');
    const rail = document.getElementById('rail');
    const posts = await loadPosts();
    if (!posts.length) {
        stream.innerHTML = '<div class="loading">No posts yet. Run Sync from the admin app.</div>';
        return;
    }

    // Build rail from years.
    const years = new Map();
    for (const p of posts) {
        const y = yearOf(p.date);
        years.set(y, (years.get(y) || 0) + 1);
    }
    rail.innerHTML = '';
    const ul = document.createElement('ul');
    for (const [y, count] of years.entries()) {
        const li = document.createElement('li');
        li.dataset.year = y;
        li.innerHTML = `${y === 'undated' ? 'Undated' : y}<span class="rail-count">${count}</span>`;
        li.addEventListener('click', () => {
            document.querySelector(`.year-block[data-year="${y}"]`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        ul.appendChild(li);
    }
    rail.appendChild(ul);

    stream.innerHTML = '';
    let currentYear = null;
    let yearPostsEl = null;
    for (const post of posts) {
        const y = yearOf(post.date);
        if (y !== currentYear) {
            currentYear = y;
            const block = document.createElement('section');
            block.className = 'year-block';
            block.dataset.year = y;
            block.innerHTML = `
                <div class="year-divider"><h2>${y === 'undated' ? 'Undated' : y}</h2></div>
                <div class="posts"></div>
            `;
            stream.appendChild(block);
            yearPostsEl = block.querySelector('.posts');
        }
        yearPostsEl.appendChild(renderPost(post));
    }

    // Scrollspy
    const railItems = Array.from(rail.querySelectorAll('li'));
    const byYear = Object.fromEntries(railItems.map(li => [li.dataset.year, li]));
    const obs = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                railItems.forEach(li => li.classList.remove('active'));
                byYear[entry.target.dataset.year]?.classList.add('active');
            }
        }
    }, { rootMargin: '-30% 0px -60% 0px' });
    stream.querySelectorAll('.year-block').forEach(b => obs.observe(b));
}

function renderPost(post) {
    const el = document.createElement('article');
    el.className = 'post' + (post.photos.length === 1 ? ' solo' : '');
    el.dataset.id = post.id;
    el.innerHTML = `
        <header class="post-head">
            <span class="day">${formatDay(post.date)}</span>
            <span class="title">${post.title}</span>
            <span class="n">${post.photos.length} ${post.photos.length === 1 ? 'photo' : 'photos'}</span>
        </header>
        <div class="post-wall"></div>
        <footer class="post-foot">
            <span class="cat">${post.category}</span>
        </footer>
    `;
    const wall = el.querySelector('.post-wall');
    // ResizeObserver handles first layout + viewport changes (orientation, resize).
    // Debounced so rapid resize doesn't thrash.
    let t = 0, lastWidth = -1;
    const ro = new ResizeObserver(entries => {
        const w = Math.floor(entries[0].contentRect.width);
        if (w === lastWidth) return;
        lastWidth = w;
        clearTimeout(t);
        t = setTimeout(() => renderWall(wall, post, w), 50);
    });
    ro.observe(wall);
    return el;
}

function renderWall(container, post, width) {
    container.innerHTML = '';
    // Tighten target row height on narrow viewports so rows don't overflow
    // with one oversize photo.
    const cw = Math.max(1, width || container.clientWidth || 700);
    const rowH = cw < 520 ? Math.max(120, Math.floor(cw * 0.6)) : ROW_H;
    const photos = post.photos;
    const shown = photos.slice(0, MAX_PER_POST_THUMBS);
    let row = [], r = 0;
    const flush = (stretch) => {
        const gap = GAP * (row.length - 1);
        const h = stretch ? Math.min(440, (cw - gap) / r) : rowH;
        const el = document.createElement('div');
        el.className = 'pw-row';
        for (const p of row) {
            const w = (p.w / p.h) * h;
            const item = document.createElement('div');
            item.className = 'pw-item';
            item.style.width = w + 'px';
            item.style.height = h + 'px';
            const img = new Image();
            img.src = `photos/${p.src}/thumb/${p.file}`;
            img.loading = 'lazy';
            item.appendChild(img);
            item.addEventListener('click', () => openPostLightbox(post, photos.indexOf(p)));
            el.appendChild(item);
        }
        container.appendChild(el);
    };
    for (const p of shown) {
        r += p.w / p.h; row.push(p);
        if ((cw - GAP * (row.length - 1)) / r < rowH) { flush(true); row = []; r = 0; }
    }
    // On narrow viewports, force the last row to stretch too — otherwise a
    // single very-wide photo on the last row would exceed cw.
    if (row.length) flush(cw < 520);

    if (photos.length > shown.length) {
        const more = document.createElement('div');
        more.className = 'pw-more';
        more.textContent = `+${photos.length - shown.length} more photos →`;
        more.addEventListener('click', () => openPostLightbox(post, shown.length));
        container.appendChild(more);
    }
}

function buildCaption(post, p) {
    const bits = [];
    if (p.taken) bits.push(p.taken.split(' ')[0].replace(/:/g, '-'));
    if (p.camera) bits.push(p.camera);
    if (p.lens) bits.push(p.lens);
    const exp = [p.focal, p.fstop, p.shutter, p.iso ? `ISO ${p.iso}` : null].filter(Boolean);
    if (exp.length) bits.push(exp.join(' · '));
    return `<strong>${post.title}</strong>${bits.length ? ' — ' + bits.join(' · ') : ''}`;
}

async function openPostLightbox(post, startIndex) {
    if (!PhotoSwipeLightbox) {
        const mod = await import('https://cdn.jsdelivr.net/npm/photoswipe@5.4.4/dist/photoswipe-lightbox.esm.js');
        PhotoSwipeLightbox = mod.default;
    }
    const dataSource = post.photos.map(p => ({
        src: `photos/${p.src}/full/${p.file}`,
        width: p.w, height: p.h, alt: post.title,
        caption: buildCaption(post, p),
    }));
    const lb = new PhotoSwipeLightbox({
        dataSource,
        pswpModule: () => import('https://cdn.jsdelivr.net/npm/photoswipe@5.4.4/dist/photoswipe.esm.js'),
    });
    lb.on('uiRegister', () => {
        lb.pswp.ui.registerElement({
            name: 'caption', order: 9, isButton: false, appendTo: 'root', html: '',
            onInit: (el, pswp) => {
                el.style.cssText = 'position:absolute;left:0;right:0;bottom:0;padding:14px 18px;color:#ddd;font:13px/1.4 Inter,sans-serif;text-align:center;background:linear-gradient(transparent,rgba(0,0,0,.7));pointer-events:none;';
                const update = () => { el.innerHTML = pswp.currSlide?.data?.caption || ''; };
                pswp.on('change', update); update();
            },
        });
    });
    lb.init();
    lb.loadAndOpen(Math.max(0, startIndex));
}

// ---------- Repos ----------

async function loadRepos() {
    const root = document.getElementById('repos');
    try {
        const r = await fetch(`https://api.github.com/users/${GITHUB_USER}/repos?sort=updated&per_page=12`);
        if (!r.ok) throw new Error(r.status);
        const repos = (await r.json()).filter(x => !x.fork);
        if (!repos.length) {
            root.innerHTML = `<p class="hint">No public repos. <a href="https://github.com/${GITHUB_USER}" target="_blank">Visit GitHub →</a></p>`;
            return;
        }
        root.innerHTML = '';
        for (const repo of repos) {
            const homepage = (repo.homepage || '').trim();
            const card = document.createElement('div');
            card.className = 'repo';
            card.innerHTML = `
                <a class="name" href="${repo.html_url}" target="_blank" rel="noopener">${repo.name}</a>
                <div class="desc">${repo.description || ''}</div>
                <div class="meta">
                    ${repo.language ? `<span>${repo.language}</span>` : ''}
                    ${repo.stargazers_count ? `<span>★ ${repo.stargazers_count}</span>` : ''}
                </div>
                <div class="links">
                    <a href="${repo.html_url}" target="_blank" rel="noopener">Source ↗</a>
                    ${homepage ? `<a href="${homepage}" target="_blank" rel="noopener" class="live">Live ↗</a>` : ''}
                </div>
            `;
            root.appendChild(card);
        }
    } catch (e) {
        root.innerHTML = `<p class="hint">Couldn't load repos (${e.message}).</p>`;
    }
}

// ---------- Boot ----------

(async () => {
    await renderTimeline();
    loadRepos();
})();
