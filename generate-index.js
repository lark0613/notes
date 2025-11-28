const fs = require('fs');
const path = require('path');

// 笔记根目录（确保和你的 notes 文件夹路径一致）
const NOTES_ROOT = path.join(__dirname, 'notes');
// 输出索引文件路径（仓库根目录）
const INDEX_OUTPUT = path.join(__dirname, 'note-index.json');

// 扫描文件夹，生成多级索引
function scanNotesDir(currentDir, relativeDir = '') {
    const result = {
        type: 'dir',
        name: path.basename(currentDir),
        path: relativeDir,
        children: []
    };

    try {
        // 读取当前目录下的所有文件/文件夹
        const files = fs.readdirSync(currentDir, { withFileTypes: true });
        const dirs = [];
        const notes = [];

        files.forEach(file => {
            const filePath = path.join(currentDir, file.name);
            const fileRelativePath = relativeDir ? `${relativeDir}/${file.name}` : file.name;

            if (file.isDirectory()) {
                // 递归扫描子文件夹
                const subDir = scanNotesDir(filePath, fileRelativePath);
                dirs.push(subDir);
            } else if (file.isFile() && file.name.endsWith('.md')) {
                // 处理笔记文件
                const noteName = file.name.replace('.md', '');
                // 从文件名提取排序序号（如 "01-笔记.md" → 1）
                const sortKey = noteName.match(/^(\d+)-/) ? parseInt(noteName.match(/^(\d+)-/)[1]) : 999;

                notes.push({
                    type: 'note',
                    name: noteName,
                    path: fileRelativePath,
                    sortKey: sortKey
                });
            }
        });

        // 排序：文件夹按名称，笔记按序号
        dirs.sort((a, b) => a.name.localeCompare(b.name));
        notes.sort((a, b) => a.sortKey - b.sortKey);

        result.children = [...dirs, ...notes];
    } catch (error) {
        console.error('扫描目录失败：', currentDir, '→', error.message);
    }

    return result;
}

// 生成索引文件
try {
    // 检查 notes 目录是否存在，不存在则创建
    if (!fs.existsSync(NOTES_ROOT)) {
        fs.mkdirSync(NOTES_ROOT, { recursive: true });
        console.log('✅ 已创建 notes 目录（用于存放笔记）');
    }

    // 扫描并生成索引
    const noteIndex = scanNotesDir(NOTES_ROOT);
    noteIndex.generatedAt = new Date().toISOString();

    // 写入索引文件
    fs.writeFileSync(INDEX_OUTPUT, JSON.stringify(noteIndex, null, 2), 'utf-8');
    console.log('✅ 索引文件生成成功！');
    console.log('📁 索引文件路径：', INDEX_OUTPUT);
    console.log('📊 目录结构预览：', JSON.stringify(noteIndex, null, 2));
} catch (error) {
    console.error('❌ 索引生成失败：', error.message);
    process.exit(1);
}