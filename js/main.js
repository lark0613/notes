// 全局变量
let noteIndex = null;
let allNotesFlat = [];
let filteredNotes = [];
let currentSortType = 'name';
// 缓存目录容器（避免重复获取DOM）
const noteTreeContainer = document.getElementById('note-tree');

// 1. 加载索引文件（增加加载状态提示）
async function loadNoteIndex() {
  try {
    noteTreeContainer.innerHTML = '<li><span style="padding: 8px 20px; color: #64748b;">加载目录中...</span></li>';
    const response = await fetch('note-index.json');
    if (!response.ok) throw new Error(`HTTP错误：${response.status}`);
    noteIndex = await response.json();
    flattenNoteIndex(noteIndex);
    sortNotes(currentSortType);
    // 初始渲染完整目录
    renderFullNoteTree();
    document.getElementById('search-result-tip').textContent = `共${allNotesFlat.length}篇笔记`;
    console.log('✅ 索引加载成功，目录结构：', noteIndex);
  } catch (error) {
    console.error('❌ 索引加载失败：', error.message);
    noteTreeContainer.innerHTML = `<li><span style="padding: 8px 20px; color: #ef4444;">目录加载失败：${error.message}</span></li>`;
  }
}

// 2. 扁平化索引（确保所有笔记被收录）
function flattenNoteIndex(node) {
  if (!node || !node.children) return; // 防止空节点报错
  node.children.forEach(child => {
    if (child.type === 'note') {
      allNotesFlat.push({
        name: child.name,
        path: child.path,
        sortKey: child.sortKey,
        content: null
      });
    } else if (child.type === 'dir') {
      flattenNoteIndex(child); // 递归处理子目录
    }
  });
}

// 3. 渲染完整多级目录（独立函数，确保无搜索时调用）
function renderFullNoteTree() {
  if (!noteIndex || !noteIndex.children) {
    noteTreeContainer.innerHTML = '<li><span style="padding: 8px 20px; color: #ef4444;">无目录数据</span></li>';
    return;
  }

  noteTreeContainer.innerHTML = ''; // 强制清空原有内容
  renderTreeNodes(noteIndex.children, noteTreeContainer);
}

// 4. 递归渲染目录节点（修复二级文件夹折叠）
function renderTreeNodes(children, parentElement) {
  children.forEach(node => {
    const li = document.createElement('li');
    li.className = node.type === 'dir' ? 'dir-item' : 'note-item';

    if (node.type === 'dir') {
      // 文件夹节点（所有层级都添加折叠逻辑）
      li.innerHTML = `
        <div class="dir-header">
          <i class="fa fa-folder dir-icon"></i>
          <span class="dir-name">${node.name}</span>
        </div>
        <ul class="dir-children"></ul>
      `;
      const childContainer = li.querySelector('.dir-children');
      // 递归渲染子节点（包含二级/多级文件夹）
      if (node.children && node.children.length > 0) {
        renderTreeNodes(node.children, childContainer);
      }
      // 给所有层级文件夹绑定折叠/展开事件
      const dirHeader = li.querySelector('.dir-header');
      dirHeader.addEventListener('click', () => {
        li.classList.toggle('dir-expanded');
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

// 5. 加载笔记（不变）
async function loadNote(notePath, noteLink, keyword = '') {
  const contentContainer = document.getElementById('note-content');
  try {
    const note = allNotesFlat.find(n => n.path === notePath);
    if (!note) throw new Error('笔记不存在于索引中');

    let markdownContent = note.content || await (await fetch(`notes/${notePath}`)).text();
    note.content = markdownContent; // 缓存

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

// 6. 搜索功能（核心修复：强制替换目录，增加日志）
function initSearch() {
  const searchInput = document.getElementById('search-input');
  const resultTip = document.getElementById('search-result-tip');

  // 预加载笔记内容（后台执行）
  async function preloadAllNotes() {
    console.log('📥 开始预加载笔记内容');
    for (const note of allNotesFlat) {
      if (!note.content) {
        try {
          note.content = await (await fetch(`notes/${note.path}`)).text();
        } catch (e) {
          console.log('⚠️  预加载失败：', note.path);
        }
      }
    }
  }
  setTimeout(preloadAllNotes, 1000);

  // 搜索输入事件（防抖+强制渲染）
  searchInput.addEventListener('input', debounce(async (e) => {
    const keyword = e.target.value.trim().toLowerCase();
    console.log('🔍 搜索关键词：', keyword);

    if (!keyword) {
      // 无关键词：恢复完整目录
      console.log('📂 清空搜索，显示完整目录');
      renderFullNoteTree();
      resultTip.textContent = `共${allNotesFlat.length}篇笔记`;
      return;
    }

    // 有关键词：筛选匹配笔记
    filteredNotes = allNotesFlat.filter(note => {
      const nameMatch = note.name.toLowerCase().includes(keyword);
      const contentMatch = note.content ? note.content.toLowerCase().includes(keyword) : false;
      const isMatch = nameMatch || contentMatch;
      if (isMatch) console.log('✅ 匹配笔记：', note.name);
      return isMatch;
    });

    sortNotes(currentSortType);
    resultTip.textContent = `找到${filteredNotes.length}篇匹配笔记`;

    // 强制清空目录，渲染搜索结果
    noteTreeContainer.innerHTML = '';
    if (filteredNotes.length === 0) {
      noteTreeContainer.innerHTML = '<li><span style="padding: 8px 20px; color: #94a3b8;">无匹配笔记</span></li>';
      console.log('❌ 无匹配笔记');
      return;
    }

    // 渲染匹配结果（只显示笔记，不显示文件夹）
    filteredNotes.forEach(note => {
      const li = document.createElement('li');
      li.className = 'note-item';
      const noteLink = document.createElement('a');
      noteLink.className = 'note-link';
      
      // 关键词高亮
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
    console.log('📋 渲染搜索结果：', filteredNotes.length, '篇');
  }, 300));
}

// 7. 排序功能（优化搜索状态下的渲染）
function initSort() {
  const sortSelect = document.getElementById('sort-select');
  sortSelect.value = currentSortType;

  sortSelect.addEventListener('change', (e) => {
    currentSortType = e.target.value;
    const keyword = document.getElementById('search-input').value.trim();
    console.log('🔀 排序类型：', currentSortType, '，搜索状态：', !!keyword);

    if (keyword) {
      // 搜索状态：排序并重新渲染搜索结果
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
      // 非搜索状态：排序完整目录
      sortNotes(currentSortType);
      renderFullNoteTree();
    }
  });
}

// 排序逻辑（独立函数）
function sortNotes(sortType) {
  currentSortType = sortType;
  allNotesFlat.sort((a, b) => {
    return sortType === 'name' 
      ? a.name.localeCompare(b.name) 
      : a.sortKey - b.sortKey;
  });
  filteredNotes = [...allNotesFlat];
}

// 8. 侧边栏收缩功能（优化样式切换）
function initSidebarToggle() {
  const toggleBtn = document.getElementById('toggle-sidebar');
  const sidebar = document.getElementById('sidebar');
  
  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    const icon = toggleBtn.querySelector('i');
    icon.classList.toggle('fa-angle-left');
    icon.classList.toggle('fa-angle-right');
    // 收缩/展开后重新渲染目录（避免样式错位）
    const keyword = document.getElementById('search-input').value.trim();
    if (keyword) {
      // 搜索状态：重新渲染搜索结果
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
      // 非搜索状态：重新渲染完整目录
      renderFullNoteTree();
    }
  });
}

// 9. 明暗模式切换（保持不变）
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

// 初始化（确保DOM加载完成后执行）
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 初始化网站功能');
  loadNoteIndex();
  initSearch();
  initSort();
  initSidebarToggle();
  initThemeToggle();
});