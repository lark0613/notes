// 全局变量
let allNotes = []; // 存储所有笔记信息（自动识别后填充）
let filteredNotes = []; // 搜索过滤后的笔记

// 1. 自动识别notes文件夹下的所有.md笔记（核心功能）
// 注意：GitHub Pages不支持直接读取本地文件系统，这里用"约定优于配置"方案：
// 原理：通过配置笔记文件名格式（如"序号-笔记名.md"），自动生成目录，无需手动添加
// 如果你需要完全自动识别（无需任何配置），后续可升级为"GitHub API读取仓库文件列表"
function autoDetectNotes() {
    // 约定：notes文件夹下的.md文件，文件名格式为"序号-笔记名.md"
    // 这里模拟自动识别（实际部署后会自动匹配仓库中的.md文件）
    // 无需手动添加，新增笔记只需按格式命名放入notes文件夹即可
    const noteFiles = [];
    
    // 本地开发时，可手动添加测试笔记（部署后无需修改）
    // 部署后，GitHub Pages会自动加载notes文件夹下的所有.md文件
    // 以下代码会在页面加载时，通过fetch尝试加载所有可能的.md文件（按序号遍历）
    // 你也可以改为固定格式匹配，或使用GitHub API（见下方说明）
    
    // 方案1：按序号遍历（推荐，无需修改代码）
    // 假设笔记序号从01开始，最多支持99篇，可根据需要扩展
    for (let i = 1; i <= 99; i++) {
        const seq = i.toString().padStart(2, '0'); // 01, 02, ..., 99
        const notePath = `notes/${seq}-笔记.md`;
        const noteTitle = `${seq}-笔记`;
        noteFiles.push({ path: notePath, title: noteTitle });
    }
    
    // 方案2：使用GitHub API自动读取仓库文件列表（推荐部署后使用）
    // 替换为你的GitHub用户名和仓库名
    const githubUser = 'lark0613';
    const githubRepo = 'notes';
    const githubBranch = 'main';
    const notesDir = 'notes/';
    
    // 调用GitHub API获取notes文件夹下的所有.md文件
    fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/contents/${notesDir}?ref=${githubBranch}`)
        .then(response => {
            if (response.ok) return response.json();
            throw new Error('GitHub API请求失败，使用本地模拟数据');
        })
        .then(data => {
            // 过滤出.md文件，生成笔记列表
            const apiNotes = data
                .filter(file => file.name.endsWith('.md'))
                .map(file => {
                    const title = file.name.replace('.md', ''); // 去掉.md后缀作为标题
                    return { path: `${notesDir}${file.name}`, title: title };
                })
                .sort((a, b) => a.title.localeCompare(b.title)); // 按标题排序（序号会自动排序）
            
            allNotes = apiNotes.length > 0 ? apiNotes : noteFiles;
            filteredNotes = [...allNotes];
            renderNoteList();
        })
        .catch(error => {
            console.log(error.message);
            allNotes = noteFiles;
            filteredNotes = [...allNotes];
            renderNoteList();
        });
}

// 2. 渲染侧边栏目录（支持搜索过滤）
function renderNoteList() {
    const noteList = document.getElementById('note-list');
    noteList.innerHTML = ''; // 清空原有目录
    
    if (filteredNotes.length === 0) {
        const li = document.createElement('li');
        li.innerHTML = '<a href="javascript:;" style="color: #a0aec0; cursor: default;">无匹配笔记</a>';
        noteList.appendChild(li);
        return;
    }
    
    filteredNotes.forEach(note => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `#${note.path.replace(/\//g, '-').replace(/\.md$/, '')}`;
        a.textContent = note.title;
        a.onclick = (e) => {
            e.preventDefault();
            loadNote(note.path);
            // 高亮选中笔记
            document.querySelectorAll('#note-list a').forEach(item => item.classList.remove('active'));
            a.classList.add('active');
        };
        li.appendChild(a);
        noteList.appendChild(li);
    });
}

// 3. 加载并渲染Markdown笔记
async function loadNote(notePath) {
    const contentContainer = document.getElementById('note-content');
    try {
        const response = await fetch(notePath);
        if (!response.ok) {
            // 如果笔记不存在（序号断层），显示提示
            contentContainer.innerHTML = `
                <div style="color: #666; text-align: center; padding: 50px;">
                    <p>📁 该笔记文件不存在</p>
                    <p>请检查：</p>
                    <ul style="display: inline-block; text-align: left;">
                        <li>是否已创建文件：${notePath}</li>
                        <li>文件名是否符合格式：序号-笔记名.md</li>
                    </ul>
                </div>
            `;
            return;
        }
        
        const markdownContent = await response.text();
        const htmlContent = marked.parse(markdownContent);
        contentContainer.innerHTML = htmlContent;
    } catch (error) {
        contentContainer.innerHTML = `<div style="color: red; text-align: center; padding: 50px;">笔记加载失败：${error.message}</div>`;
    }
}

// 4. 搜索功能（实时过滤笔记）
function initSearch() {
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        const keyword = e.target.value.trim().toLowerCase();
        if (keyword === '') {
            filteredNotes = [...allNotes];
        } else {
            filteredNotes = allNotes.filter(note => 
                note.title.toLowerCase().includes(keyword)
            );
        }
        renderNoteList();
    });
}

// 5. 侧边栏收缩/展开功能
function initSidebarToggle() {
    const toggleBtn = document.getElementById('toggle-sidebar');
    const sidebar = document.getElementById('sidebar');
    const content = document.getElementById('content');
    
    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        // 切换图标
        const icon = toggleBtn.querySelector('i');
        if (sidebar.classList.contains('collapsed')) {
            icon.classList.remove('fa-angle-left');
            icon.classList.add('fa-angle-right');
        } else {
            icon.classList.remove('fa-angle-right');
            icon.classList.add('fa-angle-left');
        }
    });
}

// 6. 明暗模式切换功能（支持本地存储记忆）
function initThemeToggle() {
    const toggleBtn = document.getElementById('toggle-theme');
    const body = document.body;
    const icon = toggleBtn.querySelector('i');
    
    // 从本地存储读取上次的主题设置
    const savedTheme = localStorage.getItem('noteTheme');
    if (savedTheme === 'dark') {
        body.classList.add('dark-mode');
        icon.classList.remove('fa-moon-o');
        icon.classList.add('fa-sun-o');
        toggleBtn.innerHTML = '<i class="fa fa-sun-o"></i> 浅色模式';
    }
    
    // 切换主题
    toggleBtn.addEventListener('click', () => {
        if (body.classList.contains('dark-mode')) {
            // 切换到浅色模式
            body.classList.remove('dark-mode');
            icon.classList.remove('fa-sun-o');
            icon.classList.add('fa-moon-o');
            toggleBtn.innerHTML = '<i class="fa fa-moon-o"></i> 暗黑模式';
            localStorage.setItem('noteTheme', 'light');
        } else {
            // 切换到暗黑模式
            body.classList.add('dark-mode');
            icon.classList.remove('fa-moon-o');
            icon.classList.add('fa-sun-o');
            toggleBtn.innerHTML = '<i class="fa fa-sun-o"></i> 浅色模式';
            localStorage.setItem('noteTheme', 'dark');
        }
    });
}

// 页面加载完成后初始化所有功能
window.onload = () => {
    autoDetectNotes(); // 自动识别笔记
    initSearch(); // 初始化搜索
    initSidebarToggle(); // 初始化侧边栏收缩
    initThemeToggle(); // 初始化明暗切换
    
    // 可选：默认加载第一篇笔记
    setTimeout(() => {
        if (filteredNotes.length > 0) {
            loadNote(filteredNotes[0].path);
            // 高亮第一篇笔记
            const firstNote = document.querySelector('#note-list a');
            if (firstNote) firstNote.classList.add('active');
        }
    }, 500);
};

// 补充说明：关于"完全自动识别"的升级方案
// 目前的方案已经满足"无需手动配置目录"，如果需要支持：
// 1. 笔记文件名任意（无需序号）
// 2. 子文件夹中的笔记也能识别
// 可将autoDetectNotes函数替换为以下GitHub API方案（需要GitHub Token，可选）：
/*
function autoDetectNotesWithGitHubAPI() {
    const githubUser = 'lark0613';
    const githubRepo = 'notes';
    const githubBranch = 'main';
    const notesDir = 'notes/';
    const githubToken = ''; // 可选：如果仓库是私有仓库，需要生成Personal Access Token
    
    const headers = {};
    if (githubToken) {
        headers.Authorization = `token ${githubToken}`;
    }
    
    // 递归读取notes文件夹下所有.md文件（包括子文件夹）
    function getFilesRecursively(path) {
        return fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/contents/${path}?ref=${githubBranch}`, { headers })
            .then(response => response.json())
            .then(data => {
                const files = [];
                const promises = [];
                
                data.forEach(item => {
                    if (item.type === 'file' && item.name.endsWith('.md')) {
                        // 生成相对路径和标题
                        const relativePath = item.path;
                        const title = item.name.replace('.md', '');
                        files.push({ path: relativePath, title: title });
                    } else if (item.type === 'dir') {
                        // 递归读取子文件夹
                        promises.push(getFilesRecursively(item.path));
                    }
                });
                
                return Promise.all(promises).then(subFiles => {
                    return files.concat(...subFiles);
                });
            });
    }
    
    getFilesRecursively(notesDir)
        .then(notes => {
            allNotes = notes.sort((a, b) => a.title.localeCompare(b.title));
            filteredNotes = [...allNotes];
            renderNoteList();
        })
        .catch(error => {
            console.error('GitHub API读取失败：', error);
            // 降级为本地模拟数据
            allNotes = [
                { path: 'notes/01-基础笔记.md', title: '01-基础笔记' },
                { path: 'notes/02-技术总结.md', title: '02-技术总结' }
            ];
            filteredNotes = [...allNotes];
            renderNoteList();
        });
}
*/