// 全局变量
let noteIndex = null; // 存储note-index.json的索引数据
let allNotesFlat = []; // 扁平化的所有笔记（方便搜索/排序）
let filteredNotes = []; // 搜索过滤后的笔记
let currentSortType = 'name'; // 当前排序类型（name/created）

// 1. 加载本地索引文件（替代GitHub API，大陆无加速器可访问）
async function loadNoteIndex() {
    try {
        const response = await fetch('note-index.json');
        if (!response.ok) throw new Error('索引文件加载失败');
        noteIndex = await response.json();
        // 扁平化索引（将多级目录转为一维数组，方便搜索/排序）
        flattenNoteIndex(noteIndex);
        // 初始排序
        sortNotes(currentSortType);
        // 渲染多级目录
        renderNoteTree(noteIndex.children);
        console.log('✅ 索引文件加载成功，共找到', allNotesFlat.length, '篇笔记');
    } catch (error) {
        console.error('❌ 索引加载失败：', error.message);
        document.getElementById('note-content').innerHTML = `
            <div style="color: red; text-align: center; padding: 50px;">
                索引文件加载失败，请检查：<br>
                1. 是否已生成 note-index.json 文件<br>
                2. 文件是否放在仓库根目录
            </div>
        `;
    }
}

// 2. 扁平化索引（多级目录转一维数组）
function flattenNoteIndex(node) {
    if (node.type === 'note') {
        // 笔记节点：添加到扁平化数组
        allNotesFlat.push({
            name: node.name,
            path: node.path,
            sortKey: node.sortKey,
            // 用于搜索：存储笔记内容（初始为null，加载后缓存）
            content: null
        });
        return;
    }
    // 目录节点：递归处理子节点
    if (node.children && node.children.length > 0) {
        node.children.forEach(child => flattenNoteIndex(child));
    }
}

// 3. 渲染多级目录（递归生成文件夹+笔记结构）
function renderNoteTree(children, parentElement = null) {
    const treeContainer = parentElement || document.getElementById('note-tree');
    treeContainer.innerHTML = '';

    children.forEach(node => {
        const li = document.createElement('li');
        li.className = node.type === 'dir' ? 'dir-item' : 'note-item';

        if (node.type === 'dir') {
            // 目录节点：创建可折叠的文件夹
            li.innerHTML = `
                <div class="dir-header">
                    <i class="fa fa-folder dir-icon"></i>
                    <span>${node.name}</span>
                </div>
                <ul class="dir-children"></ul>
            `;
            // 递归渲染子目录
            const childContainer = li.querySelector('.dir-children');
            renderNoteTree(node.children, childContainer);
            // 文件夹折叠/展开事件
            const dirHeader = li.querySelector('.dir-header');
            dirHeader.addEventListener('click', () => {
                li.classList.toggle('dir-expanded');
            });
        } else {
            // 笔记节点：创建笔记链接
            const noteLink = document.createElement('a');
            noteLink.className = 'note-link';
            noteLink.innerHTML = `
                <i class="fa fa-file-text-o note-icon"></i>
                <span>${node.name}</span>
            `;
            noteLink.href = `#${node.path.replace(/\//g, '-').replace(/\.md$/, '')}`;
            noteLink.onclick = (e) => {
                e.preventDefault();
                loadNote(node.path, noteLink);
                // 高亮当前笔记
                document.querySelectorAll('.note-link').forEach(link => link.classList.remove('active'));
                noteLink.classList.add('active');
            };
            li.appendChild(noteLink);
        }

        treeContainer.appendChild(li);
    });
}

// 4. 加载并渲染笔记（新增内容缓存，用于搜索）
async function loadNote(notePath, noteLink) {
    const contentContainer = document.getElementById('note-content');
    try {
        // 先查找缓存的笔记内容
        const note = allNotesFlat.find(n => n.path === notePath);
        if (note && note.content) {
            // 有缓存：直接渲染
            contentContainer.innerHTML = marked.parse(note.content);
            return;
        }

        // 无缓存：加载笔记文件
        const response = await fetch(`notes/${notePath}`);
        if (!response.ok) throw new Error('笔记文件不存在');
        const markdownContent = await response.text();
        
        // 缓存笔记内容（用于后续搜索）
        if (note) note.content = markdownContent;
        
        // 渲染笔记（支持高亮搜索关键词）
        const keyword = document.getElementById('search-input').value.trim().toLowerCase();
        let htmlContent = marked.parse(markdownContent);
        if (keyword) {
            htmlContent = highlightSearchResult(htmlContent, keyword);
        }
        
        contentContainer.innerHTML = htmlContent;
    } catch (error) {
        contentContainer.innerHTML = `<div style="color: red; text-align: center; padding: 50px;">笔记加载失败：${error.message}</div>`;
        if (noteLink) noteLink.classList.remove('active');
    }
}

// 5. 搜索功能（匹配笔记名+内容）
function initSearch() {
    const searchInput = document.getElementById('search-input');
    const resultTip = document.getElementById('search-result-tip');

    searchInput.addEventListener('input', debounce(async (e) => {
        const keyword = e.target.value.trim().toLowerCase();
        if (!keyword) {
            // 无关键词：显示所有笔记，恢复目录
            filteredNotes = [...allNotesFlat];
            sortNotes(currentSortType);
            renderNoteTree(noteIndex.children);
            resultTip.textContent = `共${allNotesFlat.length}篇笔记`;
            return;
        }

        // 有关键词：搜索笔记名+内容
        filteredNotes = allNotesFlat.filter(note => {
            // 匹配笔记名
            const nameMatch = note.name.toLowerCase().includes(keyword);
            // 匹配笔记内容（已加载过的笔记才有内容缓存）
            const contentMatch = note.content ? note.content.toLowerCase().includes(keyword) : false;
            return nameMatch || contentMatch;
        });

        // 搜索结果排序
        sortNotes(currentSortType);

        // 显示搜索结果提示
        resultTip.textContent = `找到${filteredNotes.length}篇匹配笔记`;

        // 渲染搜索结果（替换原有目录为搜索结果列表）
        const treeContainer = document.getElementById('note-tree');
        treeContainer.innerHTML = '';
        if (filteredNotes.length === 0) {
            treeContainer.innerHTML = '<li><span style="color: #a0aec0; padding: 8px 12px; display: block;">无匹配笔记</span></li>';
            return;
        }

        // 渲染匹配的笔记列表
        filteredNotes.forEach(note => {
            const li = document.createElement('li');
            li.className = 'note-item';
            const noteLink = document.createElement('a');
            noteLink.className = 'note-link';
            // 高亮笔记名中的关键词
            const highlightedName = highlightSearchResult(note.name, keyword);
            noteLink.innerHTML = `
                <i class="fa fa-file-text-o note-icon"></i>
                <span>${highlightedName}</span>
            `;
            noteLink.href = `#${note.path.replace(/\//g, '-').replace(/\.md$/, '')}`;
            noteLink.onclick = (e) => {
                e.preventDefault();
                loadNote(note.path, noteLink);
                document.querySelectorAll('.note-link').forEach(link => link.classList.remove('active'));
                noteLink.classList.add('active');
            };
            li.appendChild(noteLink);
            treeContainer.appendChild(li);
        });
    }, 300)); // 防抖：300ms内只执行一次，避免频繁搜索
}

// 6. 搜索结果高亮（替换关键词为带高亮样式的标签）
function highlightSearchResult(text, keyword) {
    if (!keyword) return text;
    const regex = new RegExp(`(${keyword})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}

// 7. 笔记排序功能
function initSort() {
    const sortSelect = document.getElementById('sort-select');
    sortSelect.value = currentSortType;

    sortSelect.addEventListener('change', (e) => {
        currentSortType = e.target.value;
        // 对当前显示的笔记排序（全部/搜索过滤后）
        const targetNotes = document.getElementById('search-input').value.trim() ? filteredNotes : allNotesFlat;
        targetNotes.sort((a, b) => {
            if (currentSortType === 'name') {
                // 按名称排序（字母顺序）
                return a.name.localeCompare(b.name);
            } else {
                // 按创建时间排序（基于序号sortKey）
                return a.sortKey - b.sortKey;
            }
        });

        // 重新渲染目录
        const keyword = document.getElementById('search-input').value.trim();
        if (keyword) {
            // 搜索状态：重新渲染搜索结果
            const treeContainer = document.getElementById('note-tree');
            treeContainer.innerHTML = '';
            filteredNotes.forEach(note => {
                const li = document.createElement('li');
                li.className = 'note-item';
                const noteLink = document.createElement('a');
                noteLink.className = 'note-link';
                noteLink.innerHTML = `
                    <i class="fa fa-file-text-o note-icon"></i>
                    <span>${note.name}</span>
                `;
                noteLink.href = `#${note.path.replace(/\//g, '-').replace(/\.md$/, '')}`;
                noteLink.onclick = (e) => {
                    e.preventDefault();
                    loadNote(note.path, noteLink);
                    document.querySelectorAll('.note-link').forEach(link => link.classList.remove('active'));
                    noteLink.classList.add('active');
                };
                li.appendChild(noteLink);
                treeContainer.appendChild(li);
            });
        } else {
            // 非搜索状态：重新渲染多级目录
            renderNoteTree(noteIndex.children);
        }
    });
}

// 8. 排序辅助函数
function sortNotes(sortType) {
    currentSortType = sortType;
    allNotesFlat.sort((a, b) => {
        if (sortType === 'name') {
            return a.name.localeCompare(b.name);
        } else {
            return a.sortKey - b.sortKey;
        }
    });
    filteredNotes = [...allNotesFlat];
}

// 9. 工具函数：防抖（避免搜索输入时频繁触发）
function debounce(fn, delay) {
    let timer = null;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// 保留原有功能：侧边栏收缩、明暗切换
function initSidebarToggle() {
    const toggleBtn = document.getElementById('toggle-sidebar');
    const sidebar = document.getElementById('sidebar');
    
    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        const icon = toggleBtn.querySelector('i');
        icon.classList.toggle('fa-angle-left');
        icon.classList.toggle('fa-angle-right');
    });
}

function initThemeToggle() {
    const toggleBtn = document.getElementById('toggle-theme');
    const body = document.body;
    const icon = toggleBtn.querySelector('i');
    
    // 读取本地存储的主题
    const savedTheme = localStorage.getItem('noteTheme');
    if (savedTheme === 'dark') {
        body.classList.add('dark-mode');
        icon.classList.replace('fa-moon-o', 'fa-sun-o');
        toggleBtn.textContent = ' 浅色模式';
        toggleBtn.prepend(icon);
    }
    
    toggleBtn.addEventListener('click', () => {
        if (body.classList.contains('dark-mode')) {
            body.classList.remove('dark-mode');
            icon.classList.replace('fa-sun-o', 'fa-moon-o');
            toggleBtn.textContent = ' 暗黑模式';
            localStorage.setItem('noteTheme', 'light');
        } else {
            body.classList.add('dark-mode');
            icon.classList.replace('fa-moon-o', 'fa-sun-o');
            toggleBtn.textContent = ' 浅色模式';
            localStorage.setItem('noteTheme', 'dark');
        }
        toggleBtn.prepend(icon);
    });
}

// 页面加载初始化所有功能
window.onload = () => {
    loadNoteIndex(); // 加载本地索引（核心）
    initSearch(); // 初始化搜索（支持内容搜索）
    initSort(); // 初始化排序
    initSidebarToggle(); // 侧边栏收缩
    initThemeToggle(); // 明暗切换
};