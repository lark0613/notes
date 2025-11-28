// 全局变量
let noteIndex = null;
let allNotesFlat = [];
let filteredNotes = [];
let currentSortType = 'name';

// 1. 加载索引文件
async function loadNoteIndex() {
  try {
    const response = await fetch('note-index.json');
    if (!response.ok) throw new Error('索引文件加载失败');
    noteIndex = await response.json();
    flattenNoteIndex(noteIndex);
    sortNotes(currentSortType);
    renderNoteTree(noteIndex.children);
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

// 2. 扁平化索引
function flattenNoteIndex(node) {
  if (node.type === 'note') {
    allNotesFlat.push({
      name: node.name,
      path: node.path,
      sortKey: node.sortKey,
      content: null
    });
    return;
  }
  if (node.children && node.children.length > 0) {
    node.children.forEach(child => flattenNoteIndex(child));
  }
}

// 3. 渲染多级目录
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
      const childContainer = li.querySelector('.dir-children');
      renderNoteTree(node.children, childContainer);
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

// 4. 加载笔记
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
      if (note) note.content = markdownContent;
    }

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

// 5. 搜索功能（重点修复：搜索时只显示匹配结果）
function initSearch() {
  const searchInput = document.getElementById('search-input');
  const resultTip = document.getElementById('search-result-tip');

  // 预加载笔记内容
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

  // 搜索输入事件
  searchInput.addEventListener('input', debounce(async (e) => {
    const keyword = e.target.value.trim().toLowerCase();
    
    if (!keyword) {
      // 无搜索词：显示完整目录
      renderNoteTree(noteIndex.children);
      resultTip.textContent = `共${allNotesFlat.length}篇笔记`;
      return;
    }

    // 有搜索词：只显示匹配结果
    filteredNotes = allNotesFlat.filter(note => {
      const nameMatch = note.name.toLowerCase().includes(keyword);
      const contentMatch = note.content ? note.content.toLowerCase().includes(keyword) : false;
      return nameMatch || contentMatch;
    });

    sortNotes(currentSortType);
    resultTip.textContent = `找到${filteredNotes.length}篇匹配笔记`;

    // 渲染搜索结果（替换原有目录）
    const treeContainer = document.getElementById('note-tree');
    treeContainer.innerHTML = '';
    
    if (filteredNotes.length === 0) {
      treeContainer.innerHTML = '<li><span style="padding: 8px 20px; display: block; color: #94a3b8;">无匹配笔记</span></li>';
      return;
    }

    // 只显示匹配的笔记
    filteredNotes.forEach(note => {
      const li = document.createElement('li');
      li.className = 'note-item';
      const noteLink = document.createElement('a');
      noteLink.className = 'note-link';
      
      // 高亮笔记名中的关键词
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

// 6. 排序功能
function initSort() {
  const sortSelect = document.getElementById('sort-select');
  sortSelect.value = currentSortType;

  sortSelect.addEventListener('change', (e) => {
    currentSortType = e.target.value;
    const keyword = document.getElementById('search-input').value.trim();
    
    if (keyword) {
      // 搜索状态：排序搜索结果
      filteredNotes.sort((a, b) => {
        return currentSortType === 'name' 
          ? a.name.localeCompare(b.name) 
          : a.sortKey - b.sortKey;
      });
      // 重新渲染搜索结果
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
      // 非搜索状态：排序目录
      sortNotes(currentSortType);
      renderNoteTree(noteIndex.children);
    }
  });
}

// 排序逻辑
function sortNotes(sortType) {
  currentSortType = sortType;
  allNotesFlat.sort((a, b) => {
    return sortType === 'name' 
      ? a.name.localeCompare(b.name) 
      : a.sortKey - b.sortKey;
  });
  filteredNotes = [...allNotesFlat];
}

// 7. 侧边栏收缩功能
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

// 8. 明暗模式切换
function initThemeToggle() {
  const toggleBtn = document.getElementById('toggle-theme');
  const body = document.body;

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

// 防抖工具函数
function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// 初始化
window.onload = () => {
  loadNoteIndex();
  initSearch();
  initSort();
  initSidebarToggle();
  initThemeToggle();
};