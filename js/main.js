// 全局变量
let noteIndex = null;
let allNotesFlat = [];
let filteredNotes = [];
let currentSortType = 'name';
const noteTreeContainer = document.getElementById('note-tree');

// 1. 加载索引文件
async function loadNoteIndex() {
  try {
    noteTreeContainer.innerHTML = '<li><span style="padding: 8px 20px; color: #64748b;">加载目录中...</span></li>';
    const response = await fetch('note-index.json');
    if (!response.ok) throw new Error(`HTTP错误：${response.status}`);
    noteIndex = await response.json();
    flattenNoteIndex(noteIndex);
    sortNotes(currentSortType);
    renderFullNoteTree();
    document.getElementById('search-result-tip').textContent = `共${allNotesFlat.length}篇笔记`;
  } catch (error) {
    console.error('索引加载失败：', error.message);
    noteTreeContainer.innerHTML = `<li><span style="padding: 8px 20px; color: #ef4444;">目录加载失败：${error.message}</span></li>`;
  }
}

// 2. 扁平化索引
function flattenNoteIndex(node) {
  if (!node || !node.children) return;
  node.children.forEach(child => {
    if (child.type === 'note') {
      allNotesFlat.push({
        name: child.name,
        path: child.path,
        sortKey: child.sortKey,
        content: null
      });
    } else if (child.type === 'dir') {
      flattenNoteIndex(child);
    }
  });
}

// 3. 渲染完整多级目录
function renderFullNoteTree() {
  if (!noteIndex || !noteIndex.children) {
    noteTreeContainer.innerHTML = '<li><span style="padding: 8px 20px; color: #ef4444;">无目录数据</span></li>';
    return;
  }

  noteTreeContainer.innerHTML = '';
  renderTreeNodes(noteIndex.children, noteTreeContainer);
}

// 4. 递归渲染目录节点（修复所有层级文件夹折叠）
function renderTreeNodes(children, parentElement) {
  children.forEach(node => {
    const li = document.createElement('li');
    li.className = node.type === 'dir' ? 'dir-item' : 'note-item';

    if (node.type === 'dir') {
      // 文件夹节点（强制绑定点击事件）
      li.innerHTML = `
        <div class="dir-header" data-dir-name="${node.name}">
          <i class="fa fa-folder dir-icon"></i>
          <span class="dir-name">${node.name}</span>
        </div>
        <ul class="dir-children" style="display: none;"></ul>
      `;
      
      // 递归渲染子节点
      const childContainer = li.querySelector('.dir-children');
      if (node.children && node.children.length > 0) {
        renderTreeNodes(node.children, childContainer);
      }
      
      // 绑定折叠/展开事件（所有层级通用）
      const dirHeader = li.querySelector('.dir-header');
      dirHeader.addEventListener('click', () => {
        const childContainer = li.querySelector('.dir-children');
        const isExpanded = childContainer.style.display === 'block';
        // 切换显示状态
        childContainer.style.display = isExpanded ? 'none' : 'block';
        // 切换图标旋转
        const dirIcon = dirHeader.querySelector('.dir-icon');
        dirIcon.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(90deg)';
      });
    } else {
      // 笔记节点
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

    parentElement.appendChild(li);
  });
}

// 5. 加载笔记
async function loadNote(notePath, noteLink, keyword = '') {
  const contentContainer = document.getElementById('note-content');
  try {
    const note = allNotesFlat.find(n => n.path === notePath);
    if (!note) throw new Error('笔记不存在于索引中');

    let markdownContent = note.content || await (await fetch(`notes/${notePath}`)).text();
    note.content = markdownContent;

    let htmlContent = marked.parse(markdownContent);
    if (keyword) {
      htmlContent = htmlContent.replace(new RegExp(`(${keyword})`, 'gi'), '<span class="highlight">$1</span>');
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

// 6. 搜索功能
function initSearch() {
  const searchInput = document.getElementById('search-input');
  const resultTip = document.getElementById('search-result-tip');

  async function preloadAllNotes() {
    for (const note of allNotesFlat) {
      if (!note.content) {
        try {
          note.content = await (await fetch(`notes/${note.path}`)).text();
        } catch (e) {
          console.log('预加载失败：', note.path);
        }
      }
    }
  }
  setTimeout(preloadAllNotes, 1000);

  searchInput.addEventListener('input', debounce(async (e) => {
    const keyword = e.target.value.trim().toLowerCase();

    if (!keyword) {
      renderFullNoteTree();
      resultTip.textContent = `共${allNotesFlat.length}篇笔记`;
      return;
    }

    filteredNotes = allNotesFlat.filter(note => {
      const nameMatch = note.name.toLowerCase().includes(keyword);
      const contentMatch = note.content ? note.content.toLowerCase().includes(keyword) : false;
      return nameMatch || contentMatch;
    });

    sortNotes(currentSortType);
    resultTip.textContent = `找到${filteredNotes.length}篇匹配笔记`;

    noteTreeContainer.innerHTML = '';
    if (filteredNotes.length === 0) {
      noteTreeContainer.innerHTML = '<li><span style="padding: 8px 20px; color: #94a3b8;">无匹配笔记</span></li>';
      return;
    }

    filteredNotes.forEach(note => {
      const li = document.createElement('li');
      li.className = 'note-item';
      const noteLink = document.createElement('a');
      noteLink.className = 'note-link';
      
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
      noteTreeContainer.appendChild(li);
    });
  }, 300));
}

// 7. 排序功能
function initSort() {
  const sortSelect = document.getElementById('sort-select');
  sortSelect.value = currentSortType;

  sortSelect.addEventListener('change', (e) => {
    currentSortType = e.target.value;
    const keyword = document.getElementById('search-input').value.trim();

    if (keyword) {
      filteredNotes.sort((a, b) => {
        return currentSortType === 'name' 
          ? a.name.localeCompare(b.name) 
          : a.sortKey - b.sortKey;
      });
      noteTreeContainer.innerHTML = '';
      filteredNotes.forEach(note => {
        const li = document.createElement('li');
        li.className = 'note-item';
        const noteLink = document.createElement('a');
        noteLink.className = 'note-link';
        noteLink.innerHTML = `
          <i class="fa fa-file-text-o note-icon"></i>
          <span>${note.name}</span>
        `;
        noteLink.onclick = (e) => {
          e.preventDefault();
          loadNote(note.path, noteLink, keyword);
        };
        li.appendChild(noteLink);
        noteTreeContainer.appendChild(li);
      });
    } else {
      sortNotes(currentSortType);
      renderFullNoteTree();
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

// 8. 侧边栏收缩功能
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

// 9. 明暗模式切换
function initThemeToggle() {
  const toggleBtn = document.getElementById('toggle-theme');
  const body = document.body;

  function initTheme() {
    const savedTheme = localStorage.getItem('noteTheme');
    const isDark = savedTheme === 'dark' || (savedTheme === null && window.matchMedia('(prefers-color-scheme: dark)').matches);
    body.classList.toggle('dark-mode', isDark);
    toggleBtn.innerHTML = isDark 
      ? '<i class="fa fa-sun-o"></i> 浅色模式' 
      : '<i class="fa fa-moon-o"></i> 暗黑模式';
  }
  initTheme();

  toggleBtn.addEventListener('click', () => {
    const isDark = body.classList.toggle('dark-mode');
    localStorage.setItem('noteTheme', isDark ? 'dark' : 'light');
    toggleBtn.innerHTML = isDark 
      ? '<i class="fa fa-sun-o"></i> 浅色模式' 
      : '<i class="fa fa-moon-o"></i> 暗黑模式';
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
document.addEventListener('DOMContentLoaded', () => {
  loadNoteIndex();
  initSearch();
  initSort();
  initSidebarToggle();
  initThemeToggle();
});