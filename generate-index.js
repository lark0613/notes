// generate-index.js（本地运行，生成note-index.json）
const fs = require('fs');
const path = require('path');

// 笔记根目录
const NOTES_ROOT = path.join(__dirname, 'notes');
// 输出索引文件路径
const INDEX_OUTPUT = path.join(__dirname, 'note-index.json');

// 扫描文件夹，生成多级索引（递归处理子文件夹）
function scanNotesDir(currentDir, relativeDir = '') {
    const result = {
        type: 'dir', // 目录类型
        name: path.basename(currentDir), // 目录名
        path: relativeDir, // 相对路径（用于侧边栏层级）
        children: [] // 子目录/笔记
    };

    // 读取当前目录下的所有文件/文件夹
    const files = fs.readdirSync(currentDir, { withFileTypes: true });

    // 分离文件夹和笔记文件，文件夹在前，笔记在后
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
            // 处理笔记文件，提取创建时间（从文件名序号或文件属性获取）
            const noteName = file.name.replace('.md', '');
            // 约定：文件名格式如"01-笔记名.md"，序号作为排序依据（无序号则按名称排序）
            const sortKey = noteName.match(/^(\d+)-/) ? parseInt(noteName.match(/^(\d+)-/)[1]) : 999;

            notes.push({
                type: 'note', // 笔记类型
                name: noteName, // 笔记名（无.md后缀）
                path: fileRelativePath, // 笔记相对路径（用于加载）
                sortKey: sortKey // 排序关键字
            });
        }
    });

    // 排序：文件夹按名称排序，笔记按sortKey（序号）排序
    dirs.sort((a, b) => a.name.localeCompare(b.name));
    notes.sort((a, b) => a.sortKey - b.sortKey);

    // 合并子目录和笔记到children
    result.children = [...dirs, ...notes];
    return result;
}

// 生成索引并写入文件
try {
    const noteIndex = scanNotesDir(NOTES_ROOT);
    // 添加生成时间
    noteIndex.generatedAt = new Date().toISOString();
    // 写入JSON文件（格式化输出，方便查看）
    fs.writeFileSync(INDEX_OUTPUT, JSON.stringify(noteIndex, null, 2), 'utf-8');
    console.log(`✅ 索引文件生成成功！路径：${INDEX_OUTPUT}`);
    console.log(`📁 包含目录/笔记总数：${countNodes(noteIndex)}`);
} catch (error) {
    console.error('❌ 索引文件生成失败：', error.message);
}

// 辅助函数：统计目录和笔记总数
function countNodes(node) {
    let count = 1; // 当前节点
    if (node.children && node.children.length > 0) {
        node.children.forEach(child => count += countNodes(child));
    }
    return count;
}