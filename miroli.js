document.addEventListener('DOMContentLoaded', async () => {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = {
        postsSection: document.getElementById('postsSection'),
        inspirersSection: document.getElementById('inspirersSection'),
        albumsSection: document.getElementById('albumsSection')
    };
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            Object.values(sections).forEach(s => s.classList.add('hidden'));
            item.classList.add('active');
            sections[item.dataset.target].classList.remove('hidden');
        });
    });
    
    try {
        const resp = await fetch('connect.json');
        if(!resp.ok) throw new Error('connect.json not found');
        const data = await resp.json();
        console.log('connect.json:', data);
        
        renderProfile(data);
        renderPosts(data);
        renderAlbums(data);
        await renderInspirers(data);
        
        // === Добавляем замену title страницы ===
        document.title = (data.name || 'NoName') + ' - Miroli';
        
        // === DYNAMIC FOOTER ===
        // For example: "© 2025 [Name]. All rights reserved. Powered by miroli.app"
        const footerEl = document.getElementById('dynamicFooter');
        if (footerEl && data.name) {
            footerEl.innerHTML = `&copy; 2025 ${data.name}. All rights reserved. Powered by <a href="https://miroli.app" target="_blank">Miroli</a>`;
        }
        
    } catch(err) {
        console.error('Error loading connect.json:', err);
    }
    
    setupUniversalModal();
    setupAlbumGridModal();
});

/* ========== Date Formatting ========== */
function formatDate(epoch) {
    if(!epoch) return '';
    const val = Number(epoch);
    if(isNaN(val) || val <= 0) return '';
    
    const d = new Date(val * 1000);
    if(isNaN(d.getTime())) return '';
    
    const months = ['Jan','Feb','Mar','Apr','May','Jun',
                    'Jul','Aug','Sep','Oct','Nov','Dec'];
    const day   = d.getDate();
    const month = months[d.getMonth()] || '';
    const year  = d.getFullYear();
    return `${day} ${month} ${year}`;
}

/* ========== Most Common Camera Model ========== */
function getMostCommonModel(photos) {
    if(!Array.isArray(photos) || photos.length === 0) return '—';
    const freq = {};
    for(let ph of photos) {
        const model = (ph.exif?.Model || '').trim();
        if(!model) continue;
        freq[model] = (freq[model] || 0) + 1;
    }
    const models = Object.keys(freq);
    if(models.length === 0) return '—';
    let bestModel = models[0];
    for(let m of models) {
        if(freq[m] > freq[bestModel]) {
            bestModel = m;
        }
    }
    return bestModel;
}

/* ========== Profile ========== */
function renderProfile(data) {
    const nameEl    = document.getElementById('profileName');
    const bioEl     = document.getElementById('profileBio');
    const avatarEl  = document.getElementById('profileAvatar');
    const inspCountEl = document.getElementById('inspirersCount');
    const pCountEl  = document.getElementById('postsCount');
    const albCountEl= document.getElementById('albumsCount');
    
    nameEl.textContent = data.name || 'NoName';
    bioEl.textContent  = data.bio  || '';
    if(data.profile_pic) {
        avatarEl.src = data.profile_pic;
    }
    
    // inspirers
    const ic = (data.friends && data.friends.length) || 0;
    inspCountEl.textContent = ic;
    
    // posts
    const pc = (data.posts && data.posts.length) || 0;
    pCountEl.textContent = pc;
    
    // albums
    const albSet = new Set();
    if(data.posts) {
        data.posts.forEach(p => {
            if(p.album) albSet.add(p.album);
        });
    }
    albCountEl.textContent = albSet.size;
    
    // profile link
    const profileLink = document.getElementById('profileLink');
    const copyBtn     = document.getElementById('copyProfileBtn');
    if(profileLink) {
        let url = window.location.href;
        url = url.replace(/\/[^\/?#]+\.(html?|php|aspx?|jsp)$/, "");
        profileLink.href = url;
        profileLink.textContent = url
        .replace(/^https?:\/\//,'')
        .replace(/\/$/,'');
        
        if(copyBtn) {
            copyBtn.addEventListener('click', async(e)=>{
                e.preventDefault();
                try {
                    await navigator.clipboard.writeText(profileLink.href);
                    alert('Copied: ' + profileLink.href);
                } catch(err) {
                    console.error('Copy error', err);
                }
            });
        }
    }
}

/* ========== My Posts ========== */
function renderPosts(data){
    const postsSection = document.getElementById('postsSection');
    postsSection.innerHTML = '';
    // Sort from newest to oldest
    const posts = (data.posts || []).slice().sort((a,b) => b.date - a.date);
    
    posts.forEach(post => {
        const article = document.createElement('article');
        article.className = 'post';
        
        // Title
        const titleDiv = document.createElement('div');
        titleDiv.className = 'post-title';
        titleDiv.textContent = post.title || 'Untitled';
        article.appendChild(titleDiv);
        
        // Date + model
        const dateStr   = formatDate(post.date);
        const bestModel = getMostCommonModel(post.photos);
        const metaDiv   = document.createElement('div');
        metaDiv.className = 'post-meta';
        metaDiv.textContent = dateStr + ' — ' + bestModel;
        article.appendChild(metaDiv);
        
        // Description
        if(post.description) {
            const descDiv = document.createElement('div');
            descDiv.className = 'post-content';
            descDiv.textContent = post.description;
            article.appendChild(descDiv);
        }
        
        // Photos
        if(post.photos && post.photos.length > 0) {
            const imagesArr = post.photos.map(ph => {
                const model = (ph.exif?.Model || '').trim();
                return {
                    src:     ph.path || '',
                    camera:  model || '',
                    iso:     ph.exif?.iso     || '',
                    shutter: ph.exif?.shutter || '',
                    fStop:   ph.exif?.fstop   || ''
                };
            });
            const wrapper = document.createElement('div');
            wrapper.className = 'post-images';
            wrapper.dataset.images = JSON.stringify(imagesArr);
            
            // first photo
            const img1 = document.createElement('img');
            img1.src = imagesArr[0].src;
            img1.style.objectFit = 'cover';
            wrapper.appendChild(img1);
            
            if(imagesArr.length > 1){
                const plus = document.createElement('div');
                plus.className = 'additional-count';
                plus.textContent = '+' + (imagesArr.length - 1);
                wrapper.appendChild(plus);
            }
            
            wrapper.addEventListener('click', ()=>{
                openUniversalModal(imagesArr, 0);
            });
            article.appendChild(wrapper);
        }
        
        postsSection.appendChild(article);
    });
}

/* ========== Albums ( + opening grid ) ========== */
function renderAlbums(data){
    const albumsContainer = document.getElementById('albumsContainer');
    albumsContainer.innerHTML = '';
    if(!data.posts) return;
    
    const albumMap = new Map();
    data.posts.forEach(p => {
        if(!p.album) return;
        if(!albumMap.has(p.album)) albumMap.set(p.album, []);
        albumMap.get(p.album).push(p);
    });
    
    for(const [albumName, arr] of albumMap.entries()) {
        let cover='';
        let totalPhotos=0;
        arr.forEach(pt => {
            totalPhotos += (pt.photos?.length || 0);
            if(!cover && pt.photos && pt.photos.length > 0){
                cover = pt.photos[0].path;
            }
        });
        const albDiv = document.createElement('div');
        albDiv.classList.add('album');
        
        if(cover) {
            const cImg = document.createElement('img');
            cImg.src = cover;
            albDiv.appendChild(cImg);
        }
        
        const ttl = document.createElement('div');
        ttl.className = 'album-title';
        ttl.textContent = albumName;
        albDiv.appendChild(ttl);
        
        const cDiv = document.createElement('div');
        cDiv.textContent= totalPhotos + ' photos';
        albDiv.appendChild(cDiv);
        
        albDiv.addEventListener('click', ()=>{
            let albumPhotos = [];
            arr.forEach(pt => {
                pt.photos.forEach(ph => {
                    albumPhotos.push(ph);
                });
            });
            openAlbumGrid(albumName, albumPhotos);
        });
        
        albumsContainer.appendChild(albDiv);
    }
}

/* ========== Album grid modal ========== */
let albumGridModal, albumGridClose, albumGridTitle, albumGridContainer;

function setupAlbumGridModal(){
    albumGridModal    = document.getElementById('albumGridModal');
    albumGridClose    = document.getElementById('albumGridClose');
    albumGridTitle    = document.getElementById('albumGridTitle');
    albumGridContainer= document.getElementById('albumGridContainer');
    
    albumGridClose.addEventListener('click', closeAlbumGrid);
    albumGridModal.addEventListener('click', (e)=>{
        if(e.target === albumGridModal) closeAlbumGrid();
    });
}

function openAlbumGrid(albumName, photos){
    albumGridTitle.textContent = 'Album "' + albumName + '"';
    albumGridContainer.innerHTML = '';
    
    photos.forEach((ph, idx) => {
        const thumb = document.createElement('img');
        thumb.src = ph.path || 'https://via.placeholder.com/300?text=NoPhoto';
        thumb.style.cursor = 'pointer';
        
        thumb.addEventListener('click', ()=>{
            closeAlbumGrid();
            const imagesArr = photos.map(photo => {
                const model = (photo.exif?.Model || '').trim();
                return {
                    src:     photo.path || '',
                    camera:  model || '',
                    iso:     photo.exif?.iso     || '',
                    shutter: photo.exif?.shutter || '',
                    fStop:   photo.exif?.fstop   || ''
                };
            });
            openUniversalModal(imagesArr, idx);
        });
        
        albumGridContainer.appendChild(thumb);
    });
    
    albumGridModal.classList.add('show');
}

function closeAlbumGrid(){
    albumGridModal.classList.remove('show');
}

/* ========== Inspirers ========== */
async function renderInspirers(data) {
    const inspirers = data.friends || [];
    const container = document.getElementById('inspirersContainer');
    container.innerHTML = '';
    
    const maxVisible = 5;
    const hiddenCount = inspirers.length - maxVisible;
    
    for (let i = 0; i < inspirers.length; i++){
        const insp = inspirers[i];
        const card = document.createElement('div');
        card.className = 'inspirer';
        if(i >= maxVisible){
            card.classList.add('hidden-inspirer');
        }
        
        const avDiv = document.createElement('div');
        avDiv.className = 'avatar';
        if(insp.photo){
            const fImg = document.createElement('img');
            fImg.src = insp.photo;
            if(insp.site){
                fImg.style.cursor = 'pointer';
                fImg.addEventListener('click',()=>{
                    window.open(insp.site,'_blank');
                });
            }
            avDiv.appendChild(fImg);
        }
        card.appendChild(avDiv);
        
        const nDiv = document.createElement('div');
        nDiv.className = 'inspirer-name';
        nDiv.textContent = insp.name || 'No Name';
        card.appendChild(nDiv);
        
        container.appendChild(card);
        
        // Loading inspirer's posts
        if(insp.site){
            try {
                const inspResp = await fetch(insp.site.replace(/\/$/,'') + '/connect.json');
                if(inspResp.ok){
                    const inspData = await inspResp.json();
                    renderInspirerPosts(inspData, insp.name);
                }
            }catch(e){
                console.log('Error loading the inspirer site:', insp.site, e);
            }
        }
    }
    
    if(hiddenCount > 0) {
        const plusCard = document.createElement('div');
        plusCard.className = 'inspirer inspirer-plus';
        plusCard.innerHTML = `
            <div class="avatar"><span>+${hiddenCount}</span></div>
            <div class="inspirer-name">more</div>
        `;
        plusCard.addEventListener('click', showAllInspirers);
        container.appendChild(plusCard);
    }
}

function showAllInspirers(){
    const hiddenEls = document.querySelectorAll('.hidden-inspirer');
    hiddenEls.forEach(el => el.classList.remove('hidden-inspirer'));
    const plusCard = document.querySelector('.inspirer-plus');
    if(plusCard) plusCard.remove();
}

/* Add inspirers' posts */
/* ========== Inspirers' Posts ========== */
function renderInspirerPosts(fData, inspirerName) {
    const inspCont = document.getElementById('inspirationsContainer');
    // Очищаем старое содержимое
    inspCont.innerHTML = '';
    
    // Сортируем от нового к старому
    const inspPosts = (fData.posts || []).slice().sort((a,b) => b.date - a.date);
    
    // Создаём div-контейнер, который станет grid
    const gridContainer = document.createElement('div');
    gridContainer.className = 'post-grid'; // класс для 2-колоночной сетки (см. CSS)
    
    inspPosts.forEach(post => {
        // Создаём div-обёртку для каждой «карточки»
        const div = document.createElement('div');
        div.className = 'inspiration-post';
        
        // Обложка (первая фото)
        let cover = '';
        if (post.photos && post.photos.length > 0) {
            cover = post.photos[0].path;
        }
        const img = document.createElement('img');
        img.className = 'inspiration-post-thumb';
        img.src = cover || 'https://via.placeholder.com/120?text=NoPhoto';
        div.appendChild(img);
        
        // Блок с информацией
        const infoDiv = document.createElement('div');
        infoDiv.className = 'inspiration-post-header';
        
        // Заголовок: "FriendName: PostTitle"
        const tDiv = document.createElement('div');
        tDiv.className = 'inspiration-post-title';
        tDiv.textContent = inspirerName + ': ' + (post.title || 'No Title');
        infoDiv.appendChild(tDiv);
        
        // "Date — Camera"
        const dateStr = formatDate(post.date);
        const bestModel = getMostCommonModel(post.photos);
        const meta = document.createElement('div');
        meta.className = 'inspiration-post-meta';
        meta.textContent = dateStr + ' — ' + bestModel;
        infoDiv.appendChild(meta);
        
        // Описание (если есть)
        if (post.description) {
            const cDiv = document.createElement('div');
            cDiv.className = 'inspiration-post-content';
            cDiv.textContent = post.description;
            infoDiv.appendChild(cDiv);
        }
        
        div.appendChild(infoDiv);
        
        // Клик по карточке => fullscreen modal
        if (post.photos && post.photos.length > 0) {
            const imagesArr = post.photos.map(ph => {
                const model = (ph.exif?.Model || '').trim();
                return {
                    src: ph.path || '',
                    camera: model || '',
                    iso: ph.exif?.iso || '',
                    shutter: ph.exif?.shutter || '',
                    fStop: ph.exif?.fstop || ''
                };
            });
            div.dataset.images = JSON.stringify(imagesArr);
            div.addEventListener('click', () => {
                openUniversalModal(imagesArr, 0);
            });
        }
        
        // Добавляем «карточку» в grid-контейнер
        gridContainer.appendChild(div);
    });
    
    // И только после цикла, вставляем gridContainer в основной контейнер
    inspCont.appendChild(gridContainer);
}

/* ========== UNIVERSAL MODAL FOR FULLSCREEN PHOTO VIEW ========== */
let currentImages = [], currentIndex = 0;
let universalWindow, universalClose, universalPrev, universalNext, universalImg, exifBlock, universalBackdrop;

function setupUniversalModal(){
    universalBackdrop = document.getElementById('universalBackdrop');
    universalWindow   = document.getElementById('universalWindow');
    universalClose    = document.getElementById('universalClose');
    universalPrev     = document.getElementById('universalPrev');
    universalNext     = document.getElementById('universalNext');
    universalImg      = document.getElementById('universalImg');
    exifBlock         = document.getElementById('exifBlock');
    
    universalClose.addEventListener('click', closeUniversalModal);
    universalPrev.addEventListener('click', prevUniversal);
    universalNext.addEventListener('click', nextUniversal);
    universalBackdrop.addEventListener('click', e => {
        if(e.target === universalBackdrop) closeUniversalModal();
    });
    
    let startX=0, distX=0;
    universalWindow.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX; distX=0;
    });
    universalWindow.addEventListener('touchmove', (e) => {
        distX = e.touches[0].clientX - startX;
    });
    universalWindow.addEventListener('touchend', (e) => {
        if(!currentImages.length) return;
        const threshold=50;
        if(distX > threshold) prevUniversal();
        else if(distX < -threshold) nextUniversal();
    });
}

function openUniversalModal(imagesArr, start=0){
    currentImages = imagesArr;
    currentIndex  = start;
    universalBackdrop.classList.add('show');
    showUniversalImage(currentIndex);
}
function closeUniversalModal(){
    universalBackdrop.classList.remove('show');
    universalImg.src = '';
    exifBlock.textContent = '';
    currentImages = [];
    currentIndex = 0;
}
function showUniversalImage(idx){
    if(idx < 0 || idx >= currentImages.length) return;
    currentIndex = idx;
    universalPrev.style.display = (idx === 0) ? 'none' : 'inline-block';
    universalNext.style.display = (idx === currentImages.length - 1) ? 'none' : 'inline-block';
    
    const obj = currentImages[idx];
    universalImg.src = obj.src || '';
    
    const camera  = obj.camera  || '-';
    const fStop   = obj.fStop   || '-';
    const iso     = obj.iso     || '-';
    const shutter = obj.shutter || '-';
    exifBlock.textContent = `Camera: ${camera}, ${fStop}, ISO ${iso}, ${shutter}`;
}
function prevUniversal(){
    if(currentIndex > 0) showUniversalImage(currentIndex - 1);
}
function nextUniversal(){
    if(currentIndex < currentImages.length - 1) showUniversalImage(currentIndex + 1);
}
