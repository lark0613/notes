// 全局变量
let noteIndex = null; // 索引数据
let allNotesFlat = []; // 扁平化笔记列表
let filteredNotes = []; // 搜索过滤后的笔记
let currentSortType = 'name'; // 当前排序类型

// 1. 加载本地索引文件
async function loadNoteIndex() {
  try {
    const response = await fetch('note-index.json');
    if (!response.ok) throw new Error('索引文件加载失败');
    noteIndex = await response.json();
    flattenNoteIndex(noteIndex); // 扁平化索引
    sortNotes(currentSortType); // 初始排序
    renderNoteTree(noteIndex.children); // 渲染目录
    document.getElementById('search-result-tip').textContent = `共${allNotesFlat.length}篇笔记`;
  } catch (error) {
    console.error('索引加载失败：', error.message);
    document.getElementById('note-content').innerHTML = `
      <div style="color: #ef4444; text-align: center; padding: 50px;">
        索引文件加载失败，请检查仓库配置
      </div>
    `;
  }
}

// 2. 扁平化索引（多级转一维）
function flattenNoteIndex(node) {
  if (node.type === 'note') {
    allNotesFlat.push({
      name: node.name,
      path: node.path,
      sortKey: node.sortKey,
      content: null // 内容缓存
    });
    return;
  }
  if (node.children && node.children.length > 0) {
    node.children.forEach(child => flattenNoteIndex(child));
  }
}

// 3. 渲染多级目录（修复子文件夹展开）
function renderNoteTree(children, parentElement = null) {
  const treeContainer = parentElement || document.getElementById('note-tree');
  treeContainer.innerHTML = '';

  children.forEach(node => {
    const li = document.createElement('li');
    li.className = node.type === 'dir' ? 'dir-item' : 'note-item';

    if (node.type === 'dir') {
      li.innerHTML = `
        <div class="dir-header">
          <i class="fa fa-folder dir-icon"></i>
          <span class="dir-name">${node.name}</span>
        </div>
        <ul class="dir-children"></ul>
      `;
      // 递归渲染子目录
      const childContainer = li.querySelector('.dir-children');
      renderNoteTree(node.children, childContainer);
      // 绑定展开/折叠事件
      const dirHeader = li.querySelector('.dir-header');
      dirHeader.addEventListener('click', () => {
        li.classList.toggle('dir-expanded');
      });
    } else {
      const noteLink = document.createElement('a');
      noteLink.className = 'note-link';
      noteLink.innerHTML = `
        <i class="fa fa-file-text-o note-icon"></i>
        <span>${node.name}</span>
      `;
      noteLink.href = `#${node.path}`;
      noteLink.onclick = (e) => {
        e.preventDefault();
        loadNote(node.path, noteLink);
      };
      li.appendChild(noteLink);
    }

    treeContainer.appendChild(li);
  });
}

// 4. 加载笔记（支持内容高亮）
async function loadNote(notePath, noteLink, keyword = '') {
  const contentContainer = document.getElementById('note-content');
  try {
    const note = allNotesFlat.find(n => n.path === notePath);
    let markdownContent;

    if (note && note.content) {
      markdownContent = note.content;
    } else {
      const response = await fetch(`notes/${notePath}`);
      if (!response.ok) throw new Error('笔记不存在');
      markdownContent = await response.text();
      if (note) note.content = markdownContent; // 缓存内容
    }

    // 内容高亮处理
    let htmlContent = marked.parse(markdownContent);
    if (keyword) {
      htmlContent = htmlContent.replace(
        new RegExp(`(${keyword})`, 'gi'),
        '<span class="highlight">$1</span>'
      );
    }

    contentContainer.innerHTML = htmlContent;
    if (noteLink) {
      document.querySelectorAll('.note-link').forEach(link => link.classList.remove('active'));
      noteLink.classList.add('active');
    }
  } catch (error) {
    contentContainer.innerHTML = `<div style="color: #ef4444; text-align: center; padding: 32px;">${error.message}</div>`;
  }
}

// 5. 搜索功能（支持内容搜索）
function initSearch() {
  const searchInput = document.getElementById('search-input');
  const resultTip = document.getElementById('search-result-tip');

  // 预加载所有笔记内容（后台执行）
  async function preloadAllNotes() {
    for (const note of allNotesFlat) {
      if (!note.content) {
        try {
          const response = await fetch(`notes/${note.path}`);
          if (response.ok) note.content = await response.text();
        } catch (e) { console.log('预加载失败：', note.path); }
      }
    }
  }
  setTimeout(preloadAllNotes, 1000);

  // 搜索输入事件（带防抖）
  searchInput.addEventListener('input', debounce(async (e) => {
    const keyword = e.target.value.trim().toLowerCase();
    if (!keyword) {
      filteredNotes = [...allNotesFlat];
      sortNotes(currentSortType);
      renderNoteTree(noteIndex.children);
      resultTip.textContent = `共${allNotesFlat.length}篇笔记`;
      return;
    }

    // 搜索匹配（名称+内容）
    filteredNotes = allNotesFlat.filter(note => {
      const nameMatch = note.name.toLowerCase().includes(keyword);
      const contentMatch = note.content ? note.content.toLowerCase().includes(keyword) : false;
      return nameMatch || contentMatch;
    });

    sortNotes(currentSortType);
    resultTip.textContent = `找到${filteredNotes.length}篇匹配笔记`;

    // 渲染搜索结果
    const treeContainer = document.getElementById('note-tree');
    treeContainer.innerHTML = '';
    if (filteredNotes.length === 0) {
      treeContainer.innerHTML = '<li><span style="padding: 8px 20px; display: block; color: #94a3b8;">无匹配笔记</span></li>';
      return;
    }

    filteredNotes.forEach(note => {
      const li = document.createElement('li');
      li.className = 'note-item';
      const noteLink = document.createElement('a');
      noteLink.className = 'note-link';
      // 高亮笔记名关键词
      const highlightedName = note.name.replace(
        new RegExp(`(${keyword})`, 'gi'),
        '<span class="highlight">$1</span>'
      );
      noteLink.innerHTML = `
        <i class="fa fa-file-text-o note-icon"></i>
        <span>${highlightedName}</span>
      `;
      noteLink.href = `#${note.path}`;
      noteLink.onclick = (e) => {
        e.preventDefault();
        loadNote(note.path, noteLink, keyword);
      };
      li.appendChild(noteLink);
      treeContainer.appendChild(li);
    });
  }, 300));
}

// 6. 笔记排序功能
function initSort() {
  const sortSelect = document.getElementById('sort-select');
  sortSelect.value = currentSortType;

  sortSelect.addEventListener('change', (e) => {
    currentSortType = e.target.value;
    const targetNotes = document.getElementById('search-input').value.trim() ? filteredNotes : allNotesFlat;
    sortNotes(currentSortType);
    
    // 重新渲染
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
        noteLink.href = `#${note.path}`;
        noteLink.onclick = (e) => {
          e.preventDefault();
          loadNote(note.path, noteLink, keyword);
        };
        li.appendChild(noteLink);
        treeContainer.appendChild(li);
      });
    } else {
      // 非搜索状态：重新渲染目录
      renderNoteTree(noteIndex.children);
    }
  });
}

// 排序逻辑
function sortNotes(sortType) {
  currentSortType = sortType;
  allNotesFlat.sort((a, b) => {
    if (sortType === 'name') {
      return a.name.localeCompare(b.name); // 按名称排序
    } else {
      return a.sortKey - b.sortKey; // 按序号（创建时间）排序
    }
  });
  filteredNotes = [...allNotesFlat];
}

// 7. 侧边栏收缩功能
function initSidebarToggle() {
  const toggleBtn = document.getElementById('toggle-sidebar');
  const sidebar = document.getElementById('sidebar');
  const content = document.getElementById('content');
  
  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    const icon = toggleBtn.querySelector('i');
    icon.classList.toggle('fa-angle-left');
    icon.classList.toggle('fa-angle-right');
    
    // 调整主内容区宽度
    if (sidebar.classList.contains('collapsed')) {
      sidebar.style.width = '60px';
      content.style.marginLeft = '60px';
      content.style.maxWidth = 'calc(100% - 60px)';
    } else {
      sidebar.style.width = '280px';
      content.style.marginLeft = '280px';
      content.style.maxWidth = 'calc(100% - 280px)';
    }
  });
}

// 8. 明暗模式切换（修复失效）
function initThemeToggle() {
  const toggleBtn = document.getElementById('toggle-theme');
  const body = document.body;

  // 初始化主题（优先本地存储，其次系统偏好）
  function initTheme() {
    const savedTheme = localStorage.getItem('noteTheme');
    const isDark = savedTheme === 'dark' || 
                  (savedTheme === null && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      body.classList.add('dark-mode');
      toggleBtn.innerHTML = '<i class="fa fa-sun-o"></i> 浅色模式';
    } else {
      body.classList.remove('dark-mode');
      toggleBtn.innerHTML = '<i class="fa fa-moon-o"></i> 暗黑模式';
    }
  }
  initTheme();

  // 切换主题
  toggleBtn.addEventListener('click', () => {
    const isDark = body.classList.toggle('dark-mode');
    if (isDark) {
      toggleBtn.innerHTML = '<i class="fa fa-sun-o"></i> 浅色模式';
      localStorage.setItem('noteTheme', 'dark');
    } else {
      toggleBtn.innerHTML = '<i class="fa fa-moon-o"></i> 暗黑模式';
      localStorage.setItem('noteTheme', 'light');
    }
  });
}

// 工具函数：防抖
function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// 初始化所有功能
window.onload = () => {
  loadNoteIndex();
  initSearch();
  initSort();
  initSidebarToggle();
  initThemeToggle();
};