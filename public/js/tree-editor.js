// Enhanced Tree Editor JavaScript with Complete Component Management

let nextTempId = -1;
let operationHistory = [];
let maxHistorySize = 5000;
let unsavedChanges = false;

// Enhanced state management
function markUnsavedChanges() {
    unsavedChanges = true;
    updateSaveButtonState();
}

function markSavedChanges() {
    unsavedChanges = false;
    updateSaveButtonState();
}

function updateSaveButtonState() {
    const saveButton = document.querySelector('button[onclick="saveStatute()"]');
    if (saveButton) {
        if (unsavedChanges) {
            saveButton.textContent = '💾 Save Changes *';
            saveButton.classList.add('btn-warning');
            saveButton.classList.remove('btn-primary');
        } else {
            saveButton.textContent = '💾 Save Changes';
            saveButton.classList.add('btn-primary');
            saveButton.classList.remove('btn-warning');
        }
    }
}

function renderTree() {
    const treeRoot = document.getElementById('tree-root');
    treeRoot.innerHTML = '';
    renderNode(treeData, treeRoot, 0);
}

function renderNode(node, container, level) {
    const nodeElement = document.createElement('div');
    nodeElement.className = 'tree-node';
    nodeElement.setAttribute('data-level', level);
    
    const itemElement = document.createElement('div');
    itemElement.className = 'tree-item';
    itemElement.setAttribute('data-type', node.type);
    itemElement.setAttribute('data-id', node.id);
    
    // Add unsaved indicator for new nodes
    if (node.id < 0) {
        itemElement.classList.add('unsaved');
    }
    
    // Toggle button
    const toggle = document.createElement('span');
    toggle.className = 'tree-toggle';
    if (node.children && node.children.length > 0) {
        toggle.className += ' expanded';
        toggle.onclick = (e) => {
            e.stopPropagation();
            toggleNode(node, nodeElement);
        };
    } else {
        toggle.className += ' empty';
    }
    
    // Icon
    const icon = document.createElement('span');
    icon.className = 'tree-icon';
    
    // Label with smart display
    const label = document.createElement('span');
    label.className = 'tree-label';
    label.textContent = getDisplayName(node);
    
    // Type badge with count
    const typeBadge = document.createElement('span');
    typeBadge.className = 'tree-type';
    typeBadge.textContent = formatTypeName(node.type);
    
    // Add child count if has children
    if (node.children && node.children.length > 0) {
        const countBadge = document.createElement('span');
        countBadge.className = 'child-count';
        countBadge.textContent = node.children.length;
        typeBadge.appendChild(countBadge);
    }
    
    itemElement.appendChild(toggle);
    itemElement.appendChild(icon);
    itemElement.appendChild(label);
    itemElement.appendChild(typeBadge);
    
    // Event listeners
    itemElement.onclick = (e) => {
        e.stopPropagation();
        selectNode(node, itemElement);
    };
    
    itemElement.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectNode(node, itemElement);
        showContextMenu(e, node);
    };
    
    // Enhanced drag and drop
    setupDragAndDrop(itemElement, node);
    
    nodeElement.appendChild(itemElement);
    
    // Children container
    if (node.children && node.children.length > 0) {
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-children';
        
        node.children.forEach(child => {
            renderNode(child, childrenContainer, level + 1);
        });
        
        nodeElement.appendChild(childrenContainer);
    }
    
    container.appendChild(nodeElement);
}

// Enhanced display name generation
function getDisplayName(node) {
    let displayName = node.name || 'Unnamed';
    
    // Add number prefix if available
    const numberFields = {
        'part': 'part_no',
        'sch_part': 'part_no',
        'chapter': 'chapter_no',
        'sch_chapter': 'chapter_no',
        'set': 'set_no',
        'sch_set': 'set_no',
        'section': 'section_no',
        'sch_section': 'section_no',
        'subsection': 'subsection_no',
        'sch_subsection': 'subsection_no'
    };
    
    const numberField = numberFields[node.type];
    if (numberField && node[numberField]) {
        displayName = `${node[numberField]}. ${displayName}`;
    }
    
    return displayName;
}

// Enhanced context menu with comprehensive options
function showContextMenu(event, node) {
    const menu = document.getElementById('contextMenu');
    menu.innerHTML = '';
    menu.contextNode = node;
    
    // Section 1: Add operations
    const canAddChild = getValidChildTypes(node.type).length > 0;
    const canAddSibling = node.type !== 'statute';
    
    if (canAddChild) {
        const childTypes = getValidChildTypes(node.type);
        if (childTypes.length === 1) {
            addContextMenuItem(menu, `➕ Add ${formatTypeName(childTypes[0])}`, () => addChild(childTypes[0]), false);
        } else {
            // Multiple child types possible - create submenu
            childTypes.forEach(childType => {
                addContextMenuItem(menu, `➕ Add ${formatTypeName(childType)}`, () => addChild(childType), false);
            });
        }
    }
    
    if (canAddSibling) {
        addContextMenuItem(menu, '📄 Add Sibling', addSibling, false);
    }
    
    if (canAddChild || canAddSibling) {
        addContextMenuItem(menu, null, null, true); // separator
    }
    
    // Section 2: Edit operations
    addContextMenuItem(menu, '✏️ Edit', editItem, false);
    
    if (canAddSibling) {
        addContextMenuItem(menu, '📋 Duplicate', duplicateItem, false);
    }
    
    addContextMenuItem(menu, null, null, true); // separator
    
    // Section 3: Move operations
    const parent = findParentNode(treeData, node);
    if (parent && parent.children && parent.children.length > 1) {
        const index = parent.children.indexOf(node);
        if (index > 0) {
            addContextMenuItem(menu, '⬆️ Move Up', () => moveItemUp(node), false);
        }
        if (index < parent.children.length - 1) {
            addContextMenuItem(menu, '⬇️ Move Down', () => moveItemDown(node), false);
        }
        addContextMenuItem(menu, null, null, true); // separator
    }
    
    // Section 4: Advanced operations
    if (node.children && node.children.length > 0) {
        addContextMenuItem(menu, '📊 Show Statistics', () => showNodeStats(node), false);
        addContextMenuItem(menu, '🔄 Renumber Children', () => renumberChildren(node), false);
    }
    
    // Section 5: Danger zone
    if (canAddSibling) {
        addContextMenuItem(menu, null, null, true); // separator
        addContextMenuItem(menu, '🗑️ Delete', deleteItem, true);
    }
    
    // Position and show menu
    showMenuAtPosition(menu, event);
}

function showMenuAtPosition(menu, event) {
    menu.style.display = 'block';
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';
    
    // Adjust if menu goes off screen
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        menu.style.left = (event.pageX - rect.width) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
        menu.style.top = (event.pageY - rect.height) + 'px';
    }
    
    // Hide menu when clicking elsewhere
    document.addEventListener('click', hideContextMenu, { once: true });
}

function addContextMenuItem(menu, text, onClick, isDanger) {
    const item = document.createElement('div');
    
    if (text === null) {
        item.className = 'context-item separator';
    } else {
        item.className = 'context-item' + (isDanger ? ' danger' : '');
        item.textContent = text;
        if (onClick) {
            item.onclick = (e) => {
                e.stopPropagation();
                onClick();
                hideContextMenu();
            };
        }
    }
    
    menu.appendChild(item);
}

// Enhanced add child with specific type support
function addChild(childType = null) {
    const menu = document.getElementById('contextMenu');
    console.log(menu);
    const parentNode = menu.contextNode;
    
    if (!parentNode) return;
    
    if (!childType) {
        const validTypes = getValidChildTypes(parentNode.type);
        if (validTypes.length === 0) {
            showMessage(`Cannot add children to ${formatTypeName(parentNode.type)}. This is a leaf node.`, 'error');
            return;
        }
        childType = validTypes[0];
    }
    
    if (!isValidChildType(parentNode.type, childType)) {
        showMessage(`Cannot add ${formatTypeName(childType)} to ${formatTypeName(parentNode.type)}. Invalid hierarchy.`, 'error');
        return;
    }
    
    const newNode = createNewNode(childType, parentNode);
    
    if (!parentNode.children) {
        parentNode.children = [];
    }
    
    parentNode.children.push(newNode);
    
    recordOperation('add_child', {
        parent: parentNode,
        node: newNode,
        index: parentNode.children.length - 1
    });
    
    markUnsavedChanges();
    renderTree();
    selectAndEditNewNode(newNode);
    
    showMessage(`Added ${formatTypeName(childType)} to ${parentNode.name}`, 'success');
}

// Enhanced add sibling
function addSibling() {
    const menu = document.getElementById('contextMenu');
    const referenceNode = menu.contextNode;
    
    if (!referenceNode || referenceNode.type === 'statute') {
        showMessage('Cannot add sibling to root statute.', 'error');
        return;
    }
    
    const parent = findParentNode(treeData, referenceNode);
    if (!parent) {
        showMessage('Cannot find parent node.', 'error');
        return;
    }
    
    const newNode = createNewNode(referenceNode.type, parent);
    const siblingIndex = parent.children.indexOf(referenceNode);
    
    // Insert after the reference node
    parent.children.splice(siblingIndex + 1, 0, newNode);
    
    recordOperation('add_sibling', {
        parent: parent,
        node: newNode,
        index: siblingIndex + 1,
        reference: referenceNode
    });
    
    markUnsavedChanges();
    renderTree();
    selectAndEditNewNode(newNode);
    
    showMessage(`Added ${formatTypeName(newNode.type)} after ${referenceNode.name}`, 'success');
}

// Enhanced node creation with intelligent defaults
function createNewNode(type, parent) {
    const newNode = {
        id: nextTempId--,
        type: type,
        name: generateSmartName(type, parent),
        children: []
    };
    
    // Initialize type-specific fields
    initializeNodeFields(newNode, parent);
    
    return newNode;
}

function generateSmartName(type, parent) {
    const siblingCount = parent.children ? parent.children.filter(c => c.type === type).length : 0;
    const baseNames = {
        'part': 'Pseudo',
        'sch_part': 'Pseudo',
        'chapter': 'Pseudo',
        'sch_chapter': 'Pseudo',
        'set': 'Pseudo',
        'sch_set': 'Pseudo',
        'section': 'Pseudo',
        'sch_section': 'Pseudo',
        'subsection': 'Pseudo',
        'sch_subsection': 'Pseudo'
    };
    
    const baseName = baseNames[type] || formatTypeName(type);
    
    if (siblingCount === 0) {
        return baseName;
    } else {
        return `${baseName} ${siblingCount + 1}`;
    }
}

function initializeNodeFields(node, parent) {
    const siblings = parent.children || [];
    
    if (node.type.includes('part')) {
        node.part_no = generateNextNumber(siblings.filter(s => s.type === node.type), 'part_no');
    } else if (node.type.includes('chapter')) {
        node.chapter_no = generateNextNumber(siblings.filter(s => s.type === node.type), 'chapter_no');
    } else if (node.type.includes('set')) {
        node.set_no = generateNextNumber(siblings.filter(s => s.type === node.type), 'set_no');
    } else if (node.type.includes('section') && !node.type.includes('subsection')) {
        node.section_no = generateNextNumber(siblings.filter(s => s.type === node.type), 'section_no');
    } else if (node.type.includes('subsection')) {
        node.subsection_no = generateNextNumber(siblings.filter(s => s.type === node.type), 'subsection_no');
        node.content = '';
    }
}

function generateNextNumber(siblings, numberField) {
    let maxNumber = 0;
    siblings.forEach(sibling => {
        if (sibling[numberField]) {
            const num = parseInt(sibling[numberField]);
            if (!isNaN(num) && num > maxNumber) {
                maxNumber = num;
            }
        }
    });
    return String(maxNumber + 1);
}

// Enhanced hierarchy management
function getValidChildTypes(parentType) {
    const validChildren = {
        'statute': ['part', 'sch_part'],
        'part': ['chapter'],
        'sch_part': ['sch_chapter'],
        'chapter': ['set'],
        'sch_chapter': ['sch_set'],
        'set': ['section'],
        'sch_set': ['sch_section'],
        'section': ['subsection'],
        'sch_section': ['sch_subsection'],
        'subsection': [],
        'sch_subsection': []
    };
    
    return validChildren[parentType] || [];
}

function isValidChildType(parentType, childType) {
    return getValidChildTypes(parentType).includes(childType);
}

// Enhanced move operations with validation
function moveItemUp(node) {
    const parent = findParentNode(treeData, node);
    if (!parent || !parent.children) return;
    
    const index = parent.children.indexOf(node);
    if (index <= 0) return;
    
    recordOperation('move_up', {
        parent: parent,
        node: node,
        fromIndex: index,
        toIndex: index - 1
    });
    
    // Swap with previous sibling
    [parent.children[index], parent.children[index - 1]] = 
    [parent.children[index - 1], parent.children[index]];
    
    markUnsavedChanges();
    renderTree();
    
    setTimeout(() => {
        const element = document.querySelector(`[data-id="${node.id}"]`);
        if (element) {
            selectNode(node, element);
        }
    }, 100);
    
    showMessage(`Moved ${node.name} up`, 'success');
}

function moveItemDown(node) {
    const parent = findParentNode(treeData, node);
    if (!parent || !parent.children) return;
    
    const index = parent.children.indexOf(node);
    if (index >= parent.children.length - 1) return;
    
    recordOperation('move_down', {
        parent: parent,
        node: node,
        fromIndex: index,
        toIndex: index + 1
    });
    
    [parent.children[index], parent.children[index + 1]] = 
    [parent.children[index + 1], parent.children[index]];
    
    markUnsavedChanges();
    renderTree();
    
    setTimeout(() => {
        const element = document.querySelector(`[data-id="${node.id}"]`);
        if (element) {
            selectNode(node, element);
        }
    }, 100);
    
    showMessage(`Moved ${node.name} down`, 'success');
}

// Enhanced duplicate with conflict resolution
function duplicateItem() {
    const menu = document.getElementById('contextMenu');
    const node = menu.contextNode;
    
    if (!node || node.type === 'statute') {
        showMessage('Cannot duplicate root statute.', 'error');
        return;
    }
    
    const parent = findParentNode(treeData, node);
    if (!parent) {
        showMessage('Cannot find parent node.', 'error');
        return;
    }
    
    const duplicate = deepCloneNode(node);
    assignTempIds(duplicate);
    
    // Smart renaming and renumbering
    duplicate.name = generateDuplicateName(node.name, parent.children);
    updateDuplicateNumbers(duplicate, parent.children);
    
    const index = parent.children.indexOf(node);
    parent.children.splice(index + 1, 0, duplicate);
    
    recordOperation('duplicate', {
        parent: parent,
        node: duplicate,
        index: index + 1,
        original: node
    });
    
    markUnsavedChanges();
    renderTree();
    selectAndEditNewNode(duplicate);
    
    showMessage(`Duplicated ${node.name}`, 'success');
}

function deepCloneNode(node) {
    return JSON.parse(JSON.stringify(node));
}

function generateDuplicateName(originalName, siblings) {
    let baseName = originalName;
    let counter = 1;
    
    // Remove existing copy suffix
    const copyMatch = originalName.match(/^(.*?) \(Copy(?: (\d+))?\)$/);
    if (copyMatch) {
        baseName = copyMatch[1];
        counter = copyMatch[2] ? parseInt(copyMatch[2]) + 1 : 2;
    }
    
    let newName = counter === 1 ? `${baseName} (Copy)` : `${baseName} (Copy ${counter})`;
    
    // Ensure uniqueness
    while (siblings.some(sibling => sibling.name === newName)) {
        counter++;
        newName = `${baseName} (Copy ${counter})`;
    }
    
    return newName;
}

function updateDuplicateNumbers(node, siblings) {
    const numberFields = ['part_no', 'chapter_no', 'set_no', 'section_no', 'subsection_no'];
    
    numberFields.forEach(field => {
        if (node[field] !== undefined) {
            node[field] = generateNextNumber(siblings.filter(s => s.type === node.type), field);
        }
    });
    
    // Recursively update children
    if (node.children) {
        node.children.forEach(child => {
            updateDuplicateNumbers(child, []);
        });
    }
}

// Enhanced delete with cascade confirmation
function deleteItem() {
    const menu = document.getElementById('contextMenu');
    const node = menu.contextNode;
    
    if (!node) return;
    
    if (node.type === 'statute') {
        showMessage('Cannot delete the statute root.', 'error');
        return;
    }
    
    const parent = findParentNode(treeData, node);
    if (!parent) {
        showMessage('Cannot find parent node.', 'error');
        return;
    }
    
    const stats = calculateNodeStats(node);
    let confirmMessage = `Delete "${node.name}"?`;
    
    if (stats.totalChildren > 0) {
        confirmMessage += `\n\nThis will permanently delete:\n`;
        confirmMessage += `• ${stats.totalChildren} child items\n`;
        if (stats.totalContent > 0) {
            confirmMessage += `• ${stats.totalContent} items with content\n`;
        }
        confirmMessage += `\nThis action cannot be undone.`;
    }
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    const index = parent.children.indexOf(node);
    
    recordOperation('delete', {
        parent: parent,
        node: deepCloneNode(node),
        index: index
    });
    
    // Add to deleted items if it has a real ID
    if (node.id > 0) {
        addToDeletedItems(node);
    }
    
    parent.children.splice(index, 1);
    
    markUnsavedChanges();
    renderTree();
    
    if (currentNode === node) {
        currentNode = null;
        renderEditor(null);
    }
    
    const deletedCount = stats.totalChildren + 1;
    showMessage(`Deleted ${node.name}${deletedCount > 1 ? ` and ${deletedCount - 1} children` : ''}`, 'success');
}

function calculateNodeStats(node) {
    let stats = {
        totalChildren: 0,
        totalContent: 0,
        byType: {}
    };
    
    if (node.content && node.content.trim()) {
        stats.totalContent = 1;
    }
    
    if (node.children) {
        stats.totalChildren = node.children.length;
        node.children.forEach(child => {
            const childStats = calculateNodeStats(child);
            stats.totalChildren += childStats.totalChildren;
            stats.totalContent += childStats.totalContent;
        });
    }
    
    return stats;
}

// Advanced features
function renumberChildren(parent) {
    if (!parent.children || parent.children.length === 0) {
        showMessage('No children to renumber.', 'info');
        return;
    }
    
    const numberFields = {
        'part': 'part_no',
        'sch_part': 'part_no',
        'chapter': 'chapter_no',
        'sch_chapter': 'chapter_no',
        'set': 'set_no',
        'sch_set': 'set_no',
        'section': 'section_no',
        'sch_section': 'section_no',
        'subsection': 'subsection_no',
        'sch_subsection': 'subsection_no'
    };
    
    let changed = 0;
    parent.children.forEach((child, index) => {
        const field = numberFields[child.type];
        if (field) {
            const newNumber = String(index + 1);
            if (child[field] !== newNumber) {
                child[field] = newNumber;
                changed++;
            }
        }
    });
    
    if (changed > 0) {
        markUnsavedChanges();
        renderTree();
        showMessage(`Renumbered ${changed} items in ${parent.name}`, 'success');
    } else {
        showMessage('All items were already correctly numbered.', 'info');
    }
}

function showNodeStats(node) {
    const stats = calculateNodeStats(node);
    
    const message = `Statistics for "${node.name}":
    
Direct Children: ${node.children ? node.children.length : 0}
Total Descendants: ${stats.totalChildren}
Items with Content: ${stats.totalContent}
Node Type: ${formatTypeName(node.type)}
Node ID: ${node.id}
Status: ${node.id < 0 ? 'New (Unsaved)' : 'Saved'}`;
    
    alert(message);
}

// Utility functions
function formatTypeName(type) {
    return type.replace('_', ' ')
              .replace(/\b\w/g, l => l.toUpperCase())
              .replace('Sch ', 'Schedule ');
}

function findParentNode(root, targetNode) {
    if (root.children) {
        for (let child of root.children) {
            if (child === targetNode) {
                return root;
            }
            const found = findParentNode(child, targetNode);
            if (found) return found;
        }
    }
    return null;
}

function assignTempIds(node) {
    node.id = nextTempId--;
    if (node.children) {
        node.children.forEach(assignTempIds);
    }
}

function addToDeletedItems(node) {
    if (node.id > 0) {
        deletedItems.push({ id: node.id, type: node.type });
    }
    
    if (node.children) {
        node.children.forEach(child => {
            addToDeletedItems(child);
        });
    }
}

function recordOperation(type, data) {
    operationHistory.push({
        type: type,
        data: data,
        timestamp: Date.now()
    });
    
    if (operationHistory.length > maxHistorySize) {
        operationHistory.shift();
    }
}

// Enhanced editor with change tracking
function saveCurrentNode() {
    if (!currentNode) return;
    
    const originalData = deepCloneNode(currentNode);
    
    // Get all form values
    const updates = {};
    const nameEl = document.getElementById('edit-name');
    if (nameEl && nameEl.value !== currentNode.name) {
        updates.name = nameEl.value;
        currentNode.name = nameEl.value;
    }
    
    const actNoEl = document.getElementById('edit-act_no');
    if (actNoEl && actNoEl.value !== currentNode.act_no) {
        updates.act_no = actNoEl.value;
        currentNode.act_no = actNoEl.value;
    }
    
    const dateEl = document.getElementById('edit-date');
    if (dateEl && dateEl.value !== currentNode.date) {
        updates.date = dateEl.value;
        currentNode.date = dateEl.value;
    }
    
    const prefaceEl = document.getElementById('edit-preface');
    if (prefaceEl && prefaceEl.value !== currentNode.preface) {
        updates.preface = prefaceEl.value;
        currentNode.preface = prefaceEl.value;
    }
    
    const partNoEl = document.getElementById('edit-part_no');
    if (partNoEl && partNoEl.value !== currentNode.part_no) {
        updates.part_no = partNoEl.value;
        currentNode.part_no = partNoEl.value;
    }
    
    const chapterNoEl = document.getElementById('edit-chapter_no');
    if (chapterNoEl && chapterNoEl.value !== currentNode.chapter_no) {
        updates.chapter_no = chapterNoEl.value;
        currentNode.chapter_no = chapterNoEl.value;
    }
    
    const setNoEl = document.getElementById('edit-set_no');
    if (setNoEl && setNoEl.value !== currentNode.set_no) {
        updates.set_no = setNoEl.value;
        currentNode.set_no = setNoEl.value;
    }
    
    const sectionNoEl = document.getElementById('edit-section_no');
    if (sectionNoEl && sectionNoEl.value !== currentNode.section_no) {
        updates.section_no = sectionNoEl.value;
        currentNode.section_no = sectionNoEl.value;
    }
    
    const subsectionNoEl = document.getElementById('edit-subsection_no');
    if (subsectionNoEl && subsectionNoEl.value !== currentNode.subsection_no) {
        updates.subsection_no = subsectionNoEl.value;
        currentNode.subsection_no = subsectionNoEl.value;
    }
    
    const contentEl = document.getElementById('edit-content');
    if (contentEl && contentEl.value !== currentNode.content) {
        updates.content = contentEl.value;
        currentNode.content = contentEl.value;
    }
    
    // Check if any changes were made
    const hasChanges = Object.keys(updates).length > 0;
    if (hasChanges) {
        recordOperation('edit', {
            node: currentNode,
            original: originalData,
            updates: updates
        });
        
        markUnsavedChanges();
        renderTree();
        
        // Re-select the current node
        setTimeout(() => {
            const element = document.querySelector(`[data-id="${currentNode.id}"]`);
            if (element) {
                selectNode(currentNode, element);
            }
        }, 100);
        
        showMessage('Saved Locally. Hit Save Changes at top to put to DB', 'success');
    } else {
        showMessage('No changes detected.', 'info');
    }
}

// Initialize enhanced features
document.addEventListener('DOMContentLoaded', function() {
    renderTree();
    initializeAutoSave();
    
    // Warn about unsaved changes
    window.addEventListener('beforeunload', function(e) {
        if (unsavedChanges) {
            e.preventDefault();
            e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        }
    });
});

function initializeAutoSave() {
    // Auto-save draft every 30 seconds
    setInterval(() => {
        if (unsavedChanges) {
            localStorage.setItem(`statute_draft_${treeData.id}`, JSON.stringify({
                tree: treeData,
                deletedItems: deletedItems,
                timestamp: Date.now()
            }));
        }
    }, 30000);
    
    // Check for existing draft on load
    const draftKey = `statute_draft_${treeData.id}`;
    const draft = localStorage.getItem(draftKey);
    if (draft) {
        try {
            const draftData = JSON.parse(draft);
            const timeDiff = Date.now() - draftData.timestamp;
            
            // Only restore if draft is less than 24 hours old
            if (timeDiff < 24 * 60 * 60 * 1000) {
                if (confirm('A draft with unsaved changes was found. Would you like to restore it?')) {
                    treeData = draftData.tree;
                    deletedItems = draftData.deletedItems || [];
                    markUnsavedChanges();
                    renderTree();
                    showMessage('Draft restored successfully.', 'success');
                }
            } else {
                localStorage.removeItem(draftKey);
            }
        } catch (e) {
            console.error('Error restoring draft:', e);
            localStorage.removeItem(draftKey);
        }
    }
}

function deleteSelectedNode() {
    if (!currentNode || currentNode.type === 'statute') return;
    
    const parent = findParentNode(treeData, currentNode);
    if (!parent) return;
    
    const stats = calculateNodeStats(currentNode);
    let confirmMessage = `Delete "${currentNode.name}"?`;
    
    if (stats.totalChildren > 0) {
        confirmMessage += `\n\nThis will also delete ${stats.totalChildren} child items.`;
    }
    
    if (!confirm(confirmMessage)) return;
    
    const index = parent.children.indexOf(currentNode);
    
    recordOperation('delete', {
        parent: parent,
        node: deepCloneNode(currentNode),
        index: index
    });
    
    if (currentNode.id > 0) {
        addToDeletedItems(currentNode);
    }
    
    parent.children.splice(index, 1);
    
    markUnsavedChanges();
    renderTree();
    currentNode = null;
    renderEditor(null);
    
    showMessage('Node deleted', 'success');
}

function duplicateSelectedNode() {
    if (!currentNode || currentNode.type === 'statute') return;
    
    const parent = findParentNode(treeData, currentNode);
    if (!parent) return;
    
    const duplicate = deepCloneNode(currentNode);
    assignTempIds(duplicate);
    duplicate.name = generateDuplicateName(currentNode.name, parent.children);
    updateDuplicateNumbers(duplicate, parent.children);
    
    const index = parent.children.indexOf(currentNode);
    parent.children.splice(index + 1, 0, duplicate);
    
    recordOperation('duplicate', {
        parent: parent,
        node: duplicate,
        index: index + 1,
        original: currentNode
    });
    
    markUnsavedChanges();
    renderTree();
    selectAndEditNewNode(duplicate);
    
    showMessage(`Duplicated ${currentNode.name}`, 'success');
}

function expandSelectedNode() {
    if (!currentNode) return;
    
    const element = document.querySelector(`[data-id="${currentNode.id}"]`);
    if (element) {
        const toggle = element.querySelector('.tree-toggle');
        if (toggle && toggle.classList.contains('collapsed')) {
            toggle.click();
        }
    }
}

function collapseSelectedNode() {
    if (!currentNode) return;
    
    const element = document.querySelector(`[data-id="${currentNode.id}"]`);
    if (element) {
        const toggle = element.querySelector('.tree-toggle');
        if (toggle && toggle.classList.contains('expanded')) {
            toggle.click();
        }
    }
}

function navigateTree(direction) {
    if (!currentNode) return;
    
    // Get all visible tree items in order
    const allItems = Array.from(document.querySelectorAll('.tree-item')).filter(item => {
        return item.offsetParent !== null; // Only visible items
    });
    
    const currentIndex = allItems.findIndex(item => item.dataset.id == currentNode.id);
    if (currentIndex === -1) return;
    
    let targetIndex = currentIndex;
    if (direction === 'up' && currentIndex > 0) {
        targetIndex = currentIndex - 1;
    } else if (direction === 'down' && currentIndex < allItems.length - 1) {
        targetIndex = currentIndex + 1;
    }
    
    if (targetIndex !== currentIndex) {
        const targetElement = allItems[targetIndex];
        const targetId = targetElement.dataset.id;
        const targetNode = findNodeById(treeData, parseInt(targetId));
        
        if (targetNode) {
            selectNode(targetNode, targetElement);
        }
    }
}

function findNodeById(root, targetId) {
    if (root.id === targetId) {
        return root;
    }
    
    if (root.children) {
        for (let child of root.children) {
            const found = findNodeById(child, targetId);
            if (found) return found;
        }
    }
    
    return null;
}

// Basic undo functionality
function undoLastOperation() {
    if (operationHistory.length === 0) {
        showMessage('Nothing to undo.', 'info');
        return;
    }
    
    const lastOperation = operationHistory.pop();
    
    try {
        switch (lastOperation.type) {
            case 'add_child':
            case 'add_sibling':
                undoAddOperation(lastOperation.data);
                break;
            case 'delete':
                undoDeleteOperation(lastOperation.data);
                break;
            case 'move_up':
            case 'move_down':
                undoMoveOperation(lastOperation.data);
                break;
            case 'duplicate':
                undoDuplicateOperation(lastOperation.data);
                break;
            case 'edit':
                undoEditOperation(lastOperation.data);
                break;
            default:
                showMessage('Cannot undo this operation type.', 'error');
                operationHistory.push(lastOperation); // Put it back
                return;
        }
        
        markUnsavedChanges();
        renderTree();
        showMessage(`Undid ${lastOperation.type.replace('_', ' ')}`, 'success');
        
    } catch (error) {
        console.error('Undo failed:', error);
        showMessage('Undo failed. Operation may have been partially completed.', 'error');
        operationHistory.push(lastOperation); // Put it back
    }
}

function undoAddOperation(data) {
    const index = data.parent.children.indexOf(data.node);
    if (index > -1) {
        data.parent.children.splice(index, 1);
    }
}

function undoDeleteOperation(data) {
    data.parent.children.splice(data.index, 0, data.node);
    
    // Remove from deleted items if it was a real node
    if (data.node.id > 0) {
        deletedItems = deletedItems.filter(item => item.id !== data.node.id);
    }
}

function undoMoveOperation(data) {
    // Swap back
    const fromIndex = data.toIndex;
    const toIndex = data.fromIndex;
    [data.parent.children[fromIndex], data.parent.children[toIndex]] = 
    [data.parent.children[toIndex], data.parent.children[fromIndex]];
}

function undoDuplicateOperation(data) {
    const index = data.parent.children.indexOf(data.node);
    if (index > -1) {
        data.parent.children.splice(index, 1);
    }
}

function undoEditOperation(data) {
    // Restore original values
    Object.keys(data.updates).forEach(key => {
        data.node[key] = data.original[key];
    });
}

// Enhanced drag and drop with better visual feedback
function setupDragAndDrop(element, node) {
    element.draggable = true;
    
    element.ondragstart = (e) => {
        draggedNode = node;
        element.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        
        // Set drag image
        e.dataTransfer.setData('text/plain', node.name);
    };
    
    element.ondragend = (e) => {
        element.classList.remove('dragging');
        document.querySelectorAll('.drag-over, .drag-invalid').forEach(el => {
            el.classList.remove('drag-over', 'drag-invalid');
        });
        draggedNode = null;
    };
    
    element.ondragover = (e) => {
        e.preventDefault();
        
        if (draggedNode && canDropHere(draggedNode, node)) {
            e.dataTransfer.dropEffect = 'move';
            element.classList.add('drag-over');
            element.classList.remove('drag-invalid');
        } else {
            e.dataTransfer.dropEffect = 'none';
            element.classList.add('drag-invalid');
            element.classList.remove('drag-over');
        }
    };
    
    element.ondragleave = (e) => {
        if (!element.contains(e.relatedTarget)) {
            element.classList.remove('drag-over', 'drag-invalid');
        }
    };
    
    element.ondrop = (e) => {
        e.preventDefault();
        element.classList.remove('drag-over', 'drag-invalid');
        
        if (draggedNode && canDropHere(draggedNode, node)) {
            moveNodeToParent(draggedNode, node);
        }
    };
}

function canDropHere(draggedNode, targetNode) {
    if (draggedNode === targetNode) return false;
    if (isDescendant(draggedNode, targetNode)) return false;
    if (draggedNode.type === 'statute') return false;
    
    const expectedParentType = getExpectedParentType(draggedNode.type);
    return expectedParentType === targetNode.type;
}

function getExpectedParentType(childType) {
    const parentMap = {
        'part': 'statute',
        'sch_part': 'statute',
        'chapter': 'part',
        'sch_chapter': 'sch_part',
        'set': 'chapter',
        'sch_set': 'sch_chapter',
        'section': 'set',
        'sch_section': 'sch_set',
        'subsection': 'section',
        'sch_subsection': 'sch_section'
    };
    return parentMap[childType];
}

function isDescendant(ancestor, node) {
    if (!ancestor.children) return false;
    
    for (let child of ancestor.children) {
        if (child === node || isDescendant(child, node)) {
            return true;
        }
    }
    return false;
}

function moveNodeToParent(sourceNode, targetNode) {
    if (!canDropHere(sourceNode, targetNode)) {
        showMessage('Invalid drop target.', 'error');
        return;
    }
    
    const oldParent = findParentNode(treeData, sourceNode);
    if (!oldParent) return;
    
    const oldIndex = oldParent.children.indexOf(sourceNode);
    
    recordOperation('move_to_parent', {
        node: sourceNode,
        oldParent: oldParent,
        newParent: targetNode,
        oldIndex: oldIndex,
        newIndex: targetNode.children ? targetNode.children.length : 0
    });
    
    // Remove from old parent
    oldParent.children.splice(oldIndex, 1);
    
    // Add to new parent
    if (!targetNode.children) {
        targetNode.children = [];
    }
    targetNode.children.push(sourceNode);
    
    markUnsavedChanges();
    renderTree();
    
    setTimeout(() => {
        const element = document.querySelector(`[data-id="${sourceNode.id}"]`);
        if (element) {
            selectNode(sourceNode, element);
        }
    }, 100);
    
    showMessage(`Moved "${sourceNode.name}" to "${targetNode.name}"`, 'success');
}

// Enhanced utility functions
function selectAndEditNewNode(node) {
    setTimeout(() => {
        const element = document.querySelector(`[data-id="${node.id}"]`);
        if (element) {
            selectNode(node, element);
            
            // Auto-focus name field for editing
            setTimeout(() => {
                const nameInput = document.getElementById('edit-name');
                if (nameInput) {
                    nameInput.select();
                    nameInput.focus();
                }
            }, 100);
        }
    }, 100);
}

function hideContextMenu() {
    const menu = document.getElementById('contextMenu');
    if (menu) {
        menu.style.display = 'none';
        menu.contextNode = null;
    }
}

function editItem() {
    const menu = document.getElementById('contextMenu');
    const node = menu.contextNode;
    
    if (!node) return;
    
    const element = document.querySelector(`[data-id="${node.id}"]`);
    if (element) {
        selectNode(node, element);
        
        setTimeout(() => {
            const nameInput = document.getElementById('edit-name');
            if (nameInput) {
                nameInput.focus();
                nameInput.select();
            }
        }, 100);
    }
    
    hideContextMenu();
}

function toggleNode(node, nodeElement) {
    const toggle = nodeElement.querySelector('.tree-toggle');
    const children = nodeElement.querySelector('.tree-children');
    
    if (children) {
        if (toggle.classList.contains('expanded')) {
            toggle.classList.remove('expanded');
            toggle.classList.add('collapsed');
            children.classList.add('collapsed');
        } else {
            toggle.classList.remove('collapsed');
            toggle.classList.add('expanded');
            children.classList.remove('collapsed');
        }
    }
}

function expandAll() {
    document.querySelectorAll('.tree-toggle.collapsed').forEach(toggle => {
        toggle.click();
    });
}

function collapseAll() {
    document.querySelectorAll('.tree-toggle.expanded').forEach(toggle => {
        toggle.click();
    });
}

// Enhanced save function with better error handling
async function saveStatute() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const saveButton = document.querySelector('button[onclick="saveStatute()"]');
    
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = '💾 Saving...';
    }
    
    loadingOverlay.style.display = 'flex';
    
    try {
        // Validate before saving
        const errors = validateNodeHierarchy(treeData);
        if (errors.length > 0) {
            throw new Error(`Validation failed: ${errors[0]}`);
        }
        
        console.log('Starting save...', {
            treeDataId: treeData.id,
            deletedItemsCount: deletedItems.length,
            totalNodes: calculateTreeStats(treeData).totalNodes
        });
        
        const response = await fetch(`/save-statute/${treeData.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tree: treeData,
                deletedItems: deletedItems
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const text = await response.text(); // read raw response first
        console.log('Raw response:', text);

        let result;
        try {
            result = JSON.parse(text);
        } catch (e) {
            throw new Error(`Server did not return JSON. Status: ${response.status}. Response: ${text.slice(0,200)}...`);
        }
        
        if (result.success) {
            showMessage('✅ Statute saved successfully!', 'success');
            deletedItems = [];
            markSavedChanges();
            
            // Clear draft
            localStorage.removeItem(`statute_draft_${treeData.id}`);
            
            // Refresh to get updated IDs from database
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } else {
            throw new Error(result.error || 'Save failed - unknown error');
        }
    } catch (error) {
        console.error('Save error:', error);
        showMessage(`❌ Error saving statute: ${error.message}`, 'error');
    } finally {
        loadingOverlay.style.display = 'none';
        
        if (saveButton) {
            saveButton.disabled = false;
            updateSaveButtonState();
        }
    }
}

// Validation function
function validateNodeHierarchy(node, parent = null) {
    const errors = [];
    
    // Check if node type is valid for parent
    if (parent) {
        const validChildTypes = getValidChildTypes(parent.type);
        if (!validChildTypes.includes(node.type)) {
            errors.push(`Invalid child type ${node.type} for parent ${parent.type} in "${node.name}"`);
        }
    }
    
    // Recursively check children
    if (node.children) {
        node.children.forEach(child => {
            errors.push(...validateNodeHierarchy(child, node));
        });
    }
    
    return errors;
}

// Enhanced message display
function showMessage(message, type = 'info') {
    document.querySelectorAll('.toast-message').forEach(el => el.remove());
    
    const messageEl = document.createElement('div');
    messageEl.className = 'toast-message';
    messageEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 6px;
        color: white;
        font-weight: 500;
        z-index: 1001;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideInRight 0.3s ease;
        cursor: pointer;
        font-size: 14px;
        line-height: 1.4;
    `;
    
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8'
    };
    
    messageEl.style.background = colors[type] || colors.info;
    messageEl.textContent = message;
    messageEl.onclick = () => messageEl.remove();
    
    document.body.appendChild(messageEl);
    
    const delay = type === 'error' ? 8000 : 4000;
    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => messageEl.remove(), 300);
        }
    }, delay);
}

function calculateTreeStats(node) {
    let stats = {
        totalNodes: 1,
        maxDepth: 0,
        unsavedNodes: node.id < 0 ? 1 : 0,
        nodesWithContent: 0
    };
    
    if (node.content && node.content.trim()) {
        stats.nodesWithContent = 1;
    }
    
    if (node.children && node.children.length > 0) {
        let maxChildDepth = 0;
        node.children.forEach(child => {
            const childStats = calculateTreeStats(child);
            stats.totalNodes += childStats.totalNodes;
            stats.unsavedNodes += childStats.unsavedNodes;
            stats.nodesWithContent += childStats.nodesWithContent;
            maxChildDepth = Math.max(maxChildDepth, childStats.maxDepth + 1);
        });
        stats.maxDepth = maxChildDepth;
    }
    
    return stats;
}

// Enhanced Add Dialog
function showAddDialog() {
    const dialog = createAddDialog();
    document.body.appendChild(dialog);
    dialog.style.display = 'flex';
    
    // Focus first input
    const firstInput = dialog.querySelector('input, select');
    if (firstInput) firstInput.focus();
}

function createAddDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'modal-overlay';
    dialog.onclick = (e) => {
        if (e.target === dialog) closeAddDialog();
    };
    
    const targetNode = currentNode || treeData;
    const validTypes = getValidChildTypes(targetNode.type);
    
    dialog.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Add New Component</h3>
                <button class="modal-close" onclick="closeAddDialog()">×</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Add To:</label>
                    <div class="target-info">
                        <span class="target-icon">${getTypeIcon(targetNode.type)}</span>
                        <span class="target-name">${targetNode.name || 'Root'}</span>
                        <span class="target-type">${formatTypeName(targetNode.type)}</span>
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="component-type">Component Type:</label>
                    <select class="form-select" id="component-type" onchange="updateAddForm()">
                        ${validTypes.length === 0 ? 
                            '<option value="">No valid child types</option>' :
                            validTypes.map(type => 
                                `<option value="${type}">${formatTypeName(type)}</option>`
                            ).join('')
                        }
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="component-name">Name:</label>
                    <input type="text" class="form-input" id="component-name" placeholder="Enter component name">
                </div>
                
                <div class="form-group" id="number-field" style="display: none;">
                    <label class="form-label" id="number-label">Number:</label>
                    <input type="text" class="form-input" id="component-number" placeholder="Auto-generated">
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="quantity">Quantity:</label>
                    <input type="number" class="form-input" id="quantity" value="1" min="1" max="20">
                    <small class="form-help">Create multiple components at once</small>
                </div>
                
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="auto-edit" checked>
                        Automatically edit first new component
                    </label>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeAddDialog()">Cancel</button>
                <button class="btn btn-primary" onclick="executeAdd()" ${validTypes.length === 0 ? 'disabled' : ''}>
                    Create Component${validTypes.length === 0 ? ' (No valid types)' : ''}
                </button>
            </div>
        </div>
    `;
    
    // Initialize form
    setTimeout(() => updateAddForm(), 0);
    
    return dialog;
}

function updateAddForm() {
    const typeSelect = document.getElementById('component-type');
    const nameInput = document.getElementById('component-name');
    const numberField = document.getElementById('number-field');
    const numberLabel = document.getElementById('number-label');
    const numberInput = document.getElementById('component-number');
    
    if (!typeSelect) return;
    
    const selectedType = typeSelect.value;
    if (!selectedType) return;
    
    // Update default name
    if (!nameInput.value || nameInput.value === nameInput.placeholder) {
        const targetNode = currentNode || treeData;
        nameInput.value = generateSmartName(selectedType, targetNode);
    }
    
    // Show/hide number field based on type
    const numberFields = {
        'part': 'Part Number:',
        'sch_part': 'Part Number:',
        'chapter': 'Chapter Number:',
        'sch_chapter': 'Chapter Number:',
        'set': 'Set Number:',
        'sch_set': 'Set Number:',
        'section': 'Section Number:',
        'sch_section': 'Section Number:',
        'subsection': 'Subsection Number:',
        'sch_subsection': 'Subsection Number:'
    };
    
    if (numberFields[selectedType]) {
        numberField.style.display = 'block';
        numberLabel.textContent = numberFields[selectedType];
        
        // Auto-generate number
        const targetNode = currentNode || treeData;
        const siblings = targetNode.children || [];
        const numberFieldName = getNumberFieldName(selectedType);
        if (numberFieldName) {
            const nextNumber = generateNextNumber(siblings.filter(s => s.type === selectedType), numberFieldName);
            numberInput.value = nextNumber;
        }
    } else {
        numberField.style.display = 'none';
    }
}

function getNumberFieldName(type) {
    const fieldMap = {
        'part': 'part_no',
        'sch_part': 'part_no',
        'chapter': 'chapter_no',
        'sch_chapter': 'chapter_no',
        'set': 'set_no',
        'sch_set': 'set_no',
        'section': 'section_no',
        'sch_section': 'section_no',
        'subsection': 'subsection_no',
        'sch_subsection': 'subsection_no'
    };
    return fieldMap[type];
}

function executeAdd() {
    const typeSelect = document.getElementById('component-type');
    const nameInput = document.getElementById('component-name');
    const numberInput = document.getElementById('component-number');
    const quantityInput = document.getElementById('quantity');
    const autoEditCheck = document.getElementById('auto-edit');
    
    if (!typeSelect.value) {
        showMessage('Please select a component type.', 'error');
        return;
    }
    
    if (!nameInput.value.trim()) {
        showMessage('Please enter a component name.', 'error');
        nameInput.focus();
        return;
    }
    
    const targetNode = currentNode || treeData;
    const componentType = typeSelect.value;
    const baseName = nameInput.value.trim();
    const quantity = parseInt(quantityInput.value) || 1;
    const autoEdit = autoEditCheck.checked;
    
    const createdNodes = [];
    
    // Create components
    for (let i = 0; i < quantity; i++) {
        const newNode = createNewNode(componentType, targetNode);
        
        // Set name
        if (quantity === 1) {
            newNode.name = baseName;
        } else {
            newNode.name = `${baseName} ${i + 1}`;
        }
        
        // Set number if provided
        const numberFieldName = getNumberFieldName(componentType);
        if (numberFieldName && numberInput.value) {
            const baseNumber = parseInt(numberInput.value) || 1;
            newNode[numberFieldName] = String(baseNumber + i);
        }
        
        // Add to parent
        if (!targetNode.children) {
            targetNode.children = [];
        }
        targetNode.children.push(newNode);
        
        createdNodes.push(newNode);
        
        // Record operation
        recordOperation('add_child', {
            parent: targetNode,
            node: newNode,
            index: targetNode.children.length - 1
        });
    }
    
    markUnsavedChanges();
    renderTree();
    closeAddDialog();
    
    // Auto-edit first node if requested
    if (autoEdit && createdNodes.length > 0) {
        selectAndEditNewNode(createdNodes[0]);
    } else if (createdNodes.length > 0) {
        // Just select the first node
        setTimeout(() => {
            const element = document.querySelector(`[data-id="${createdNodes[0].id}"]`);
            if (element) {
                selectNode(createdNodes[0], element);
            }
        }, 100);
    }
    
    const message = quantity === 1 ? 
        `Created ${formatTypeName(componentType)}: ${baseName}` :
        `Created ${quantity} ${formatTypeName(componentType)} components`;
    showMessage(message, 'success');
}

function closeAddDialog() {
    const dialog = document.querySelector('.modal-overlay');
    if (dialog) {
        dialog.remove();
    }
}

function getStructureTemplates() {
    const targetNode = currentNode || treeData;
    const validChildTypes = getValidChildTypes(targetNode.type);
    
    const templates = [];
    
    // Basic Part Structure
    if (validChildTypes.includes('part')) {
        templates.push({
            id: 'basic_part',
            name: 'Basic Part',
            icon: '📁',
            description: 'Part with definitions and general provisions',
            preview: ['Part → Chapter → Set → Section'],
            structure: {
                type: 'part',
                children: [
                    { type: 'chapter', name: 'Definitions', children: [
                        { type: 'set', name: 'General', children: [
                            { type: 'section', name: 'Interpretation' }
                        ]}
                    ]},
                    { type: 'chapter', name: 'General Provisions', children: [
                        { type: 'set', name: 'Application', children: [
                            { type: 'section', name: 'Scope of Application' }
                        ]}
                    ]}
                ]
            }
        });
    }
    
    // Schedule Part Structure
    if (validChildTypes.includes('sch_part')) {
        templates.push({
            id: 'schedule_part',
            name: 'Schedule Part',
            icon: '📋',
            description: 'Schedule with forms and procedures',
            preview: ['Schedule Part → Schedule Chapter → Schedule Set'],
            structure: {
                type: 'sch_part',
                children: [
                    { type: 'sch_chapter', name: 'Forms', children: [
                        { type: 'sch_set', name: 'Application Forms' }
                    ]},
                    { type: 'sch_chapter', name: 'Procedures', children: [
                        { type: 'sch_set', name: 'Filing Procedures' }
                    ]}
                ]
            }
        });
    }
    
    // Chapter with multiple sets
    if (validChildTypes.includes('chapter')) {
        templates.push({
            id: 'multi_set_chapter',
            name: 'Multi-Set Chapter',
            icon: '📖',
            description: 'Chapter with multiple thematic sets',
            preview: ['Chapter → 3 Sets with sections'],
            structure: {
                type: 'chapter',
                children: [
                    { type: 'set', name: 'Preliminary Provisions', children: [
                        { type: 'section', name: 'Definitions' },
                        { type: 'section', name: 'Application' }
                    ]},
                    { type: 'set', name: 'Main Provisions', children: [
                        { type: 'section', name: 'Powers and Duties' },
                        { type: 'section', name: 'Procedures' }
                    ]},
                    { type: 'set', name: 'Final Provisions', children: [
                        { type: 'section', name: 'Penalties' },
                        { type: 'section', name: 'Commencement' }
                    ]}
                ]
            }
        });
    }
    
    return templates;
}

function selectTemplate(templateId) {
    const templates = getStructureTemplates();
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    
    const targetNode = currentNode || treeData;
    
    // Confirm creation
    if (!confirm(`Create "${template.name}" structure in ${targetNode.name}?\n\nThis will create multiple components at once.`)) {
        return;
    }
    
    // Create the structure
    const rootNode = createStructureFromTemplate(template.structure, targetNode);
    
    if (!targetNode.children) {
        targetNode.children = [];
    }
    targetNode.children.push(rootNode);
    
    recordOperation('add_template', {
        parent: targetNode,
        node: rootNode,
        template: template.id
    });
    
    markUnsavedChanges();
    renderTree();
    closeStructureWizard();
    
    // Auto-select the created structure
    setTimeout(() => {
        const element = document.querySelector(`[data-id="${rootNode.id}"]`);
        if (element) {
            selectNode(rootNode, element);
            expandNodeRecursively(rootNode);
        }
    }, 100);
    
    showMessage(`Created ${template.name} structure successfully!`, 'success');
}

function createStructureFromTemplate(templateNode, parent) {
    const newNode = createNewNode(templateNode.type, parent);
    newNode.name = templateNode.name || generateSmartName(templateNode.type, parent);
    
    if (templateNode.children) {
        newNode.children = templateNode.children.map(child => 
            createStructureFromTemplate(child, newNode)
        );
    }
    
    return newNode;
}

function expandNodeRecursively(node) {
    const element = document.querySelector(`[data-id="${node.id}"]`);
    if (element) {
        const toggle = element.querySelector('.tree-toggle.collapsed');
        if (toggle) {
            toggle.click();
        }
        
        // Expand children after a brief delay
        setTimeout(() => {
            if (node.children) {
                node.children.forEach(child => expandNodeRecursively(child));
            }
        }, 100);
    }
}

function closeStructureWizard() {
    const dialog = document.querySelector('.wizard-modal');
    if (dialog && dialog.parentNode) {
        dialog.parentNode.remove();
    }
}

// Enhanced visual feedback for new items
function highlightNewItems() {
    document.querySelectorAll('.tree-item[data-id]').forEach(item => {
        const id = parseInt(item.dataset.id);
        if (id < 0) {
            item.classList.add('new-item');
            if (!item.querySelector('.new-badge')) {
                const badge = document.createElement('span');
                badge.className = 'new-badge';
                badge.textContent = 'NEW';
                badge.title = 'This item will be created when you save';
                item.appendChild(badge);
            }
        }
    });
}

// Utility functions
function getTypeIcon(type) {
    const icons = {
        'statute': '📜',
        'part': '📁',
        'sch_part': '📋',
        'chapter': '📖',
        'sch_chapter': '📓',
        'set': '📚',
        'sch_set': '📘',
        'section': '📄',
        'sch_section': '📝',
        'subsection': '📋',
        'sch_subsection': '📌'
    };
    return icons[type] || '📄';
}

// Enhanced validation with detailed messages
function validateAddOperation(parentNode, childType) {
    const errors = [];
    
    if (!parentNode) {
        errors.push('No parent node selected.');
        return errors;
    }
    
    const validTypes = getValidChildTypes(parentNode.type);
    if (validTypes.length === 0) {
        errors.push(`${formatTypeName(parentNode.type)} cannot have child components.`);
        return errors;
    }
    
    if (!validTypes.includes(childType)) {
        errors.push(`Cannot add ${formatTypeName(childType)} to ${formatTypeName(parentNode.type)}.`);
        errors.push(`Valid child types are: ${validTypes.map(formatTypeName).join(', ')}`);
        return errors;
    }
    
    return errors;
}

// Batch operations
function createBatchComponents(parentNode, specs) {
    const createdNodes = [];
    
    specs.forEach((spec, index) => {
        const newNode = createNewNode(spec.type, parentNode);
        newNode.name = spec.name || generateSmartName(spec.type, parentNode);
        
        // Apply any additional properties
        if (spec.properties) {
            Object.assign(newNode, spec.properties);
        }
        
        if (!parentNode.children) {
            parentNode.children = [];
        }
        parentNode.children.push(newNode);
        createdNodes.push(newNode);
        
        recordOperation('batch_add', {
            parent: parentNode,
            node: newNode,
            index: parentNode.children.length - 1,
            batchIndex: index
        });
    });
    
    return createdNodes;
}

// Update the renderTree function to call highlightNewItems
const originalRenderTree = renderTree;
renderTree = function() {
    originalRenderTree();
    highlightNewItems();
};

const originalSelectNode = selectNode;
selectNode = function(node, element) {
    originalSelectNode(node, element);
};

// Add this to the end of tree-editor.js or replace the existing renderEditor function

function renderEditor(node) {
    const editor = document.getElementById('editor');
    
    if (!node) {
        editor.innerHTML = `
            <div class="no-selection">
                <div style="text-align: center; padding: 40px;">
                    <div style="font-size: 48px; margin-bottom: 20px;">📝</div>
                    <h3>Select an item to edit</h3>
                    <p style="color: #666; margin-top: 10px;">
                        Choose any component from the structure tree on the left to start editing its properties.
                    </p>
                </div>
            </div>
        `;
        return;
    }

    function escapeHtml(unsafe) {
        return unsafe ? unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;") : '';
    }

    let html = `
        <div class="form-group">
            <label class="form-label">Name *</label>
            <input type="text" class="form-input" id="edit-name" value="${escapeHtml(node.name || '')}" placeholder="Enter name">
        </div>
    `;
    
    // Type-specific fields
    if (node.type === 'statute') {
        html += `
            <div class="form-group">
                <label class="form-label">Act Number</label>
                <input type="text" class="form-input" id="edit-act_no" value="${escapeHtml(node.act_no || '')}" placeholder="Enter act number">
            </div>
            <div class="form-group">
                <label class="form-label">Date</label>
                <input type="date" class="form-input" id="edit-date" value="${node.date || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">Preface</label>
                <textarea class="form-textarea" id="edit-preface" placeholder="Enter preface">${escapeHtml(node.preface || '')}</textarea>
            </div>
        `;
    } else if (node.type.includes('part')) {
        html += `
            <div class="form-group">
                <label class="form-label">Part Number</label>
                <input type="text" class="form-input" id="edit-part_no" value="${escapeHtml(node.part_no || '')}" placeholder="Enter part number">
            </div>
        `;
    } else if (node.type.includes('chapter')) {
        html += `
            <div class="form-group">
                <label class="form-label">Chapter Number</label>
                <input type="text" class="form-input" id="edit-chapter_no" value="${escapeHtml(node.chapter_no || '')}" placeholder="Enter chapter number">
            </div>
        `;
    } else if (node.type.includes('set')) {
        html += `
            <div class="form-group">
                <label class="form-label">Set Number</label>
                <input type="text" class="form-input" id="edit-set_no" value="${escapeHtml(node.set_no || '')}" placeholder="Enter set number">
            </div>
        `;
    } else if (node.type.includes('section') && !node.type.includes('subsection')) {
        html += `
            <div class="form-group">
                <label class="form-label">Section Number</label>
                <input type="text" class="form-input" id="edit-section_no" value="${escapeHtml(node.section_no || '')}" placeholder="Enter section number">
            </div>
        `;
    } else if (node.type.includes('subsection')) {
        html += `
            <div class="form-group">
                <label class="form-label">Subsection Number</label>
                <input type="text" class="form-input" id="edit-subsection_no" value="${escapeHtml(node.subsection_no || '')}" placeholder="Enter subsection number">
            </div>
            <div class="form-group">
                <label class="form-label">Content</label>
                <textarea class="form-textarea" id="edit-content" placeholder="Enter content">${escapeHtml(node.content || '')}</textarea>
            </div>
        `;
    }
    
    html += `
        <div class="form-group">
            <button class="btn btn-primary" onclick="saveCurrentNode()">💾 Save Changes</button>
            <button class="btn btn-secondary" onclick="cancelEdit()">Cancel</button>
        </div>
        <div class="form-group">
            <small style="color: #666;">
                Type: <strong>${formatTypeName(node.type)}</strong> | 
                ID: <strong>${node.id}</strong> | 
                Status: <strong>${node.id < 0 ? 'New' : 'Saved'}</strong>
            </small>
        </div>
    `;
    
    editor.innerHTML = html;
    
    // Add event listeners for real-time updates
    setTimeout(() => {
        editor.querySelectorAll('input, textarea').forEach(input => {
            input.addEventListener('input', function() {
                if (input.id === 'edit-name') {
                    updateTreeNodeLabel(node, input.value);
                }
            });
        });
    }, 0);
}

// Helper function to update tree label in real-time
function updateTreeNodeLabel(node, newName) {
    const treeItem = document.querySelector(`[data-id="${node.id}"] .tree-label`);
    if (treeItem) {
        treeItem.textContent = newName || 'Unnamed';
    }
}

// Add cancel edit function
function cancelEdit() {
    if (currentNode) {
        renderEditor(currentNode);
    }
}

// Make sure selectNode calls renderEditor
function selectNode(node, element) {
    // Remove previous selection
    document.querySelectorAll('.tree-item.selected').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Add selection to current element
    if (element) {
        element.classList.add('selected');
    }
    
    currentNode = node;
    renderEditor(node); // This is the key line
    
    // Scroll element into view if needed
    if (element) {
        element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest',
            inline: 'nearest' 
        });
    }
}