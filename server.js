const express = require('express');
const { Pool } = require('pg');
const nunjucks = require('nunjucks');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config();


const app = express();
const port = process.env.PORT;

const pool = new Pool({
  connectionString: process.env.PG_CONNECTION,
});

// Configure session middleware
app.use(session({
  secret: process.env.SECRET_KEY, // Change this to a secure random string in production
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Configure Nunjucks
nunjucks.configure('views', {
  autoescape: true,
  express: app
});
app.set('view engine', 'html');

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    next();
  } else {
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.redirect('/auth/login');
    }
  }
}

// Logging helper function
async function logUserAction(userId, tableName, recordId, action) {
  try {
    await pool.query(
      'INSERT INTO log (user_id, table_name, record_id, action) VALUES ($1, $2, $3, $4)',
      [userId, tableName, recordId, action]
    );
  } catch (error) {
    console.error('Error logging user action:', error);
  }
}

// Helper function to extract record IDs from tree operations
function extractRecordIds(node, tableName) {
  const ids = [];
  if (node.type === tableName.replace(/"/g, '').replace('sch_', '')) {
    ids.push(node.id);
  }
  if (node.children) {
    node.children.forEach(child => {
      ids.push(...extractRecordIds(child, tableName));
    });
  }
  return ids;
}

// Authentication routes
app.get('/auth/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'login.html')); // You'll need to create this file
});

app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username and password are required' 
      });
    }

    // Check if user exists
    const userQuery = await pool.query(
      'SELECT id, username, password FROM "user" WHERE username = $1',
      [username]
    );

    if (userQuery.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid username or password' 
      });
    }

    const user = userQuery.rows[0];

    // For now, we'll do plain text comparison
    // In production, you should hash passwords with bcrypt
    const isValidPassword = password === user.password;
    
    // If you want to use bcrypt (recommended):
    // const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid username or password' 
      });
    }

    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;

    // Log login action
    await logUserAction(user.id, 'user', user.id, 'LOGIN');

    res.json({ 
      success: true, 
      message: 'Login successful',
      redirect: '/'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login' 
    });
  }
});

app.post('/auth/logout', (req, res) => {
  const userId = req.session.userId;
  
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.status(500).json({ success: false });
    }
    
    // Log logout action
    if (userId) {
      logUserAction(userId, 'user', userId, 'LOGOUT');
    }
    
    res.json({ success: true, redirect: '/auth/login' });
  });
});

// Helper function to build tree structure (unchanged)
async function buildStatuteTree(statuteId) {
  const client = await pool.connect();
  try {
    // Get statute
    const statute = await client.query('SELECT * FROM statute WHERE id = $1', [statuteId]);
    if (statute.rows.length === 0) return null;

    const tree = {
      ...statute.rows[0],
      type: 'statute',
      children: []
    };

    // Get parts (both regular and schedule)
    const parts = await client.query(`
      SELECT id, name, part_no, order_no, 'part' as type FROM part WHERE statute_id = $1
      UNION ALL
      SELECT id, name, part_no, order_no, 'sch_part' as type FROM sch_part WHERE statute_id = $1
      ORDER BY type, order_no
    `, [statuteId]);

    for (const part of parts.rows) {
      const partNode = { ...part, children: [] };
      
      if (part.type === 'part') {
        // Get chapters for regular part
        const chapters = await client.query(
          'SELECT * FROM chapter WHERE part_id = $1 ORDER BY order_no',
          [part.id]
        );
        
        for (const chapter of chapters.rows) {
          const chapterNode = { ...chapter, type: 'chapter', children: [] };
          
          // Get sets
          const sets = await client.query(
            'SELECT * FROM "set" WHERE chapter_id = $1 ORDER BY order_no',
            [chapter.id]
          );
          
          for (const set of sets.rows) {
            const setNode = { ...set, type: 'set', children: [] };
            
            // Get sections
            const sections = await client.query(
              'SELECT * FROM section WHERE set_id = $1 ORDER BY order_no',
              [set.id]
            );
            
            for (const section of sections.rows) {
              const sectionNode = { ...section, type: 'section', children: [] };
              
              // Get subsections
              const subsections = await client.query(
                'SELECT * FROM subsection WHERE section_id = $1 ORDER BY order_no',
                [section.id]
              );
              
              sectionNode.children = subsections.rows.map(sub => ({
                ...sub,
                type: 'subsection'
              }));
              
              setNode.children.push(sectionNode);
            }
            
            chapterNode.children.push(setNode);
          }
          
          partNode.children.push(chapterNode);
        }
      } else {
        // Get schedule chapters
        const schChapters = await client.query(
          'SELECT * FROM sch_chapter WHERE sch_part_id = $1 ORDER BY order_no',
          [part.id]
        );
        
        for (const chapter of schChapters.rows) {
          const chapterNode = { ...chapter, type: 'sch_chapter', children: [] };
          
          // Get schedule sets
          const schSets = await client.query(
            'SELECT * FROM sch_set WHERE sch_chapter_id = $1 ORDER BY order_no',
            [chapter.id]
          );
          
          for (const set of schSets.rows) {
            const setNode = { ...set, type: 'sch_set', children: [] };
            
            // Get schedule sections
            const schSections = await client.query(
              'SELECT * FROM sch_section WHERE sch_set_id = $1 ORDER BY order_no',
              [set.id]
            );
            
            for (const section of schSections.rows) {
              const sectionNode = { ...section, type: 'sch_section', children: [] };
              
              // Get schedule subsections
              const schSubsections = await client.query(
                'SELECT * FROM sch_subsection WHERE sch_section_id = $1 ORDER BY order_no',
                [section.id]
              );
              
              sectionNode.children = schSubsections.rows.map(sub => ({
                ...sub,
                type: 'sch_subsection'
              }));
              
              setNode.children.push(sectionNode);
            }
            
            chapterNode.children.push(setNode);
          }
          
          partNode.children.push(chapterNode);
        }
      }
      
      tree.children.push(partNode);
    }

    return tree;
  } finally {
    client.release();
  }
}

// Protected routes
app.get('/', requireAuth, async (req, res) => {
  try {
    const statutes = await pool.query('SELECT id, name, act_no FROM statute ORDER BY name');
    res.render('index.html', { 
      statutes: statutes.rows,
      user: { username: req.session.username }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Server error');
  }
});

app.get('/statute/:id', requireAuth, async (req, res) => {
  try {
    const statuteId = req.params.id;
    const tree = await buildStatuteTree(statuteId);
    
    if (!tree) {
      return res.status(404).send('Statute not found');
    }
    
    // Log access
    await logUserAction(req.session.userId, 'statute', statuteId, 'ACCESS');
    
    res.render('statute-editor.html', { 
      tree: tree,
      treeJson: JSON.stringify(tree),
      user: { username: req.session.username }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Server error');
  }
});

app.post('/save-statute/:id', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { tree, deletedItems } = req.body;
    const statuteId = req.params.id;
    const userId = req.session.userId;
    
    console.log(`Starting save for statute ${statuteId} by user ${userId}`);
    console.log(`Deleted items: ${deletedItems ? deletedItems.length : 0}`);
    
    // Log the save attempt
    await logUserAction(userId, 'statute', statuteId, 'SAVE_ATTEMPT');
    
    // Delete removed items first and log deletions
    if (deletedItems && deletedItems.length > 0) {
      for (const item of deletedItems) {
        const tableName = getTableName(item.type);
        console.log(`Deleting ${item.type} with id ${item.id}`);
        await client.query(`DELETE FROM ${tableName} WHERE id = $1`, [item.id]);
        
        // Log deletion
        await logUserAction(userId, item.type, item.id, 'DELETE');
      }
    }
    
    // Clear any order change flags before saving
    clearOrderChangeFlags(tree);
    
    // Save tree structure recursively
    await saveTreeNode(client, tree, null, null, 1, userId);
    
    await client.query('COMMIT');
    console.log('Save completed successfully');
    
    // Log successful save
    await logUserAction(userId, 'statute', statuteId, 'SAVE_SUCCESS');
    
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Save error:', error);
    console.error('Stack trace:', error.stack);
    
    // Log save failure
    await logUserAction(req.session.userId, 'statute', req.params.id, 'SAVE_FAILED');
    
    res.status(500).json({ 
      error: error.message,
      details: error.code === '23505' ? 'Order number conflict detected' : error.code
    });
  } finally {
    client.release();
  }
});

// Helper function to clear order change flags
function clearOrderChangeFlags(node) {
  delete node._orderChanged;
  if (node.children) {
    node.children.forEach(clearOrderChangeFlags);
  }
}

function getTableName(type) {
  const tableMap = {
    'statute': 'statute',
    'part': 'part',
    'sch_part': 'sch_part',
    'chapter': 'chapter',
    'sch_chapter': 'sch_chapter',
    'set': '"set"',
    'sch_set': 'sch_set',
    'section': 'section',
    'sch_section': 'sch_section',
    'subsection': 'subsection',
    'sch_subsection': 'sch_subsection'
  };
  return tableMap[type] || type;
}

function getParentIdField(type) {
  const fieldMap = {
    'part': 'statute_id',
    'sch_part': 'statute_id',
    'chapter': 'part_id',
    'sch_chapter': 'sch_part_id',
    'set': 'chapter_id',
    'sch_set': 'sch_chapter_id',
    'section': 'set_id',
    'sch_section': 'sch_set_id',
    'subsection': 'section_id',
    'sch_subsection': 'sch_section_id'
  };
  return fieldMap[type];
}

// Enhanced saveTreeNode function with logging
async function saveTreeNode(client, node, parentId, parentType, orderNo, userId) {
  const tableName = getTableName(node.type);
  let actionType = 'UPDATE';
  
  if (node.type === 'statute') {
    // Update statute - only update fields that exist
    const fields = ['name'];
    const values = [node.name];
    let paramCount = 1;
    
    let query = 'UPDATE statute SET name = $1';
    
    if (node.act_no !== undefined) {
      query += `, act_no = $${++paramCount}`;
      values.push(node.act_no);
    }
    if (node.date !== undefined) {
      query += `, date = $${++paramCount}`;
      values.push(node.date);
    }
    if (node.preface !== undefined) {
      query += `, preface = $${++paramCount}`;
      values.push(node.preface);
    }
    
    query += ` WHERE id = $${++paramCount}`;
    values.push(node.id);
    
    await client.query(query, values);
    
    // Log statute update
    await logUserAction(userId, 'statute', node.id, 'UPDATE');
  } else {
    const parentField = getParentIdField(node.type);
    
    if (node.id && node.id > 0) {
      // For existing nodes, use a more sophisticated update strategy
      await updateExistingNode(client, node, parentId, parentField, orderNo, tableName);
      actionType = 'UPDATE';
    } else {
      // Insert new node
      await insertNewNode(client, node, parentId, parentField, orderNo, tableName);
      actionType = 'CREATE';
    }
    
    // Log the action
    await logUserAction(userId, node.type, node.id, actionType);
  }
  
  // Save children with proper order numbers
  if (node.children && node.children.length > 0) {
    // First pass: collect all children that need order updates
    const childrenNeedingUpdate = [];
    
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const expectedOrder = i + 1;
      
      // Check if this child needs order number update
      if (child.id > 0 && (child._orderChanged || !child.order_no || child.order_no !== expectedOrder)) {
        childrenNeedingUpdate.push({ child, newOrder: expectedOrder });
      }
    }
    
    // If we have order conflicts, resolve them first
    if (childrenNeedingUpdate.length > 0) {
      await resolveOrderConflicts(client, node, childrenNeedingUpdate);
    }
    
    // Now save all children
    for (let i = 0; i < node.children.length; i++) {
      await saveTreeNode(client, node.children[i], node.id, node.type, i + 1, userId);
    }
  }
}

// Helper function to update existing nodes with order conflict resolution
async function updateExistingNode(client, node, parentId, parentField, orderNo, tableName) {
  // Build dynamic update query
  const fields = ['name'];
  const values = [node.name];
  let paramCount = 1;
  
  let query = `UPDATE ${tableName} SET name = $1`;
  
  // Add type-specific fields only if they exist
  if (node.type.includes('section') && !node.type.includes('subsection') && node.section_no !== undefined) {
    query += `, section_no = $${++paramCount}`;
    values.push(node.section_no);
  } else if (node.type.includes('chapter') && node.chapter_no !== undefined) {
    query += `, chapter_no = $${++paramCount}`;
    values.push(node.chapter_no);
  } else if (node.type.includes('part') && node.part_no !== undefined) {
    query += `, part_no = $${++paramCount}`;
    values.push(node.part_no);
  } else if (node.type.includes('set') && node.set_no !== undefined) {
    query += `, set_no = $${++paramCount}`;
    values.push(node.set_no);
  }
  
  if (node.content !== undefined) {
    query += `, content = $${++paramCount}`;
    values.push(node.content);
  }
  
  if (node.subsection_no !== undefined) {
    query += `, subsection_no = $${++paramCount}`;
    values.push(node.subsection_no);
  }
  
  // Always update parent and order
  query += `, ${parentField} = $${++paramCount}, order_no = $${++paramCount} WHERE id = $${++paramCount}`;
  values.push(parentId, orderNo, node.id);
  
  // Handle potential unique constraint violation by using a temporary order number
  try {
    await client.query(query, values);
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      console.log(`Order conflict detected for ${node.name}, using temporary order strategy`);
      await updateWithTemporaryOrder(client, node, parentId, parentField, orderNo, tableName, query, values);
    } else {
      throw error;
    }
  }
}

// Helper function to handle order conflicts using temporary order numbers
async function updateWithTemporaryOrder(client, node, parentId, parentField, orderNo, tableName, originalQuery, originalValues) {
  // Step 1: Set a temporary very high order number
  const tempOrder = 999999 + node.id;
  const tempValues = [...originalValues];
  tempValues[tempValues.length - 2] = tempOrder; // Replace order_no with temp value
  
  await client.query(originalQuery, tempValues);
  
  // Step 2: Update with the actual order number
  const finalQuery = `UPDATE ${tableName} SET order_no = $1 WHERE id = $2`;
  await client.query(finalQuery, [orderNo, node.id]);
}

// Helper function to insert new nodes
async function insertNewNode(client, node, parentId, parentField, orderNo, tableName) {
  let fields = ['name', 'order_no', parentField];
  let values = [node.name, orderNo, parentId];
  let placeholders = ['$1', '$2', '$3'];
  let paramCount = 3;
  
  // Add type-specific fields
  if (node.type.includes('section') && !node.type.includes('subsection')) {
    fields.push('section_no');
    values.push(node.section_no || '');
    placeholders.push(`$${++paramCount}`);
  } else if (node.type.includes('chapter')) {
    fields.push('chapter_no');
    values.push(node.chapter_no || '');
    placeholders.push(`$${++paramCount}`);
  } else if (node.type.includes('part')) {
    fields.push('part_no');
    values.push(node.part_no || '');
    placeholders.push(`$${++paramCount}`);
  } else if (node.type.includes('set')) {
    fields.push('set_no');
    values.push(node.set_no || '');
    placeholders.push(`$${++paramCount}`);
  }
  
  if (node.content !== undefined) {
    fields.push('content');
    values.push(node.content);
    placeholders.push(`$${++paramCount}`);
  }
  
  if (node.subsection_no !== undefined) {
    fields.push('subsection_no');
    values.push(node.subsection_no);
    placeholders.push(`$${++paramCount}`);
  }
  
  const query = `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`;
  const result = await client.query(query, values);
  node.id = result.rows[0].id;
}

// Helper function to resolve order conflicts for a batch of children
async function resolveOrderConflicts(client, parentNode, childrenNeedingUpdate) {
  const parentField = getParentIdField(childrenNeedingUpdate[0].child.type);
  const tableName = getTableName(childrenNeedingUpdate[0].child.type);
  
  console.log(`Resolving order conflicts for ${childrenNeedingUpdate.length} children of ${parentNode.name}`);
  
  // Step 1: Set all conflicting children to temporary order numbers
  for (let i = 0; i < childrenNeedingUpdate.length; i++) {
    const { child } = childrenNeedingUpdate[i];
    const tempOrder = 900000 + child.id; // Very high temporary number
    
    const tempQuery = `UPDATE ${tableName} SET order_no = $1 WHERE id = $2`;
    await client.query(tempQuery, [tempOrder, child.id]);
  }
  
  // Step 2: Update all children to their final order numbers
  for (const { child, newOrder } of childrenNeedingUpdate) {
    const finalQuery = `UPDATE ${tableName} SET order_no = $1 WHERE id = $2`;
    await client.query(finalQuery, [newOrder, child.id]);
  }
  
  console.log(`Successfully resolved order conflicts`);
}

// Add this helper function to clean up order numbers after major operations
async function normalizeOrderNumbers(client, parentId, childType) {
  const tableName = getTableName(childType);
  const parentField = getParentIdField(childType);
  
  // Get all children ordered by current order_no
  const children = await client.query(
    `SELECT id FROM ${tableName} WHERE ${parentField} = $1 ORDER BY order_no, id`,
    [parentId]
  );
  
  // Update each child with sequential order numbers
  for (let i = 0; i < children.rows.length; i++) {
    const child = children.rows[i];
    const newOrder = i + 1;
    
    await client.query(
      `UPDATE ${tableName} SET order_no = $1 WHERE id = $2`,
      [newOrder, child.id]
    );
  }
  
  console.log(`Normalized order numbers for ${children.rows.length} ${childType} items`);
}

// API endpoint to get user activity logs (for admin purposes)
app.get('/api/logs', requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    
    const logs = await pool.query(`
      SELECT 
        l.id,
        l.table_name,
        l.record_id,
        l.action,
        l.timestamp,
        u.username
      FROM log l
      LEFT JOIN "user" u ON l.user_id = u.id
      ORDER BY l.timestamp DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    const totalCount = await pool.query('SELECT COUNT(*) FROM log');
    
    res.json({
      logs: logs.rows,
      pagination: {
        page,
        limit,
        total: parseInt(totalCount.rows[0].count),
        totalPages: Math.ceil(parseInt(totalCount.rows[0].count) / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// API endpoint to get current user info
app.get('/api/user', requireAuth, (req, res) => {
  res.json({
    id: req.session.userId,
    username: req.session.username
  });
});

// Add this API endpoint to your server.js file, after the existing API endpoints

// API endpoint to create a new statute
app.post('/api/statute', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { name, act_no, date, preface } = req.body;
    const userId = req.session.userId;
    
    // Validate required fields
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Statute name is required'
      });
    }
    
    // Check if statute name already exists
    const existingStatute = await client.query(
      'SELECT id FROM statute WHERE name = $1',
      [name.trim()]
    );
    
    if (existingStatute.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A statute with this name already exists'
      });
    }
    
    // Check if act_no already exists (if provided)
    if (act_no && act_no.trim().length > 0) {
      const existingActNo = await client.query(
        'SELECT id FROM statute WHERE act_no = $1',
        [act_no.trim()]
      );
      
      if (existingActNo.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'A statute with this act number already exists'
        });
      }
    }
    
    // Prepare values for insertion
    const statuteName = name.trim();
    const statuteActNo = act_no && act_no.trim().length > 0 ? act_no.trim() : null;
    const statuteDate = date && date.trim().length > 0 ? date : null;
    const statutePreface = preface && preface.trim().length > 0 ? preface.trim() : null;
    
    // Insert new statute
    const insertQuery = `
      INSERT INTO statute (name, act_no, date, preface, created_at, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, name, act_no, date, preface
    `;
    
    const result = await client.query(insertQuery, [
      statuteName,
      statuteActNo,
      statuteDate,
      statutePreface
    ]);
    
    const newStatute = result.rows[0];
    
    await client.query('COMMIT');
    
    // Log the creation
    await logUserAction(userId, 'statute', newStatute.id, 'CREATE');
    
    console.log(`New statute created: ID ${newStatute.id}, Name: "${newStatute.name}" by user ${userId}`);
    
    res.json({
      success: true,
      message: 'Statute created successfully',
      statute: newStatute
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating statute:', error);
    
    // Handle specific database errors
    let errorMessage = 'Failed to create statute';
    
    if (error.code === '23505') { // Unique constraint violation
      if (error.constraint === 'statute_name_key') {
        errorMessage = 'A statute with this name already exists';
      } else if (error.constraint === 'statute_act_no_key') {
        errorMessage = 'A statute with this act number already exists';
      } else {
        errorMessage = 'Duplicate value detected';
      }
    } else if (error.code === '23514') { // Check constraint violation
      errorMessage = 'Invalid data provided';
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage
    });
  } finally {
    client.release();
  }
});

// API endpoint to validate statute data before creation (optional)
app.post('/api/statute/validate', requireAuth, async (req, res) => {
  try {
    const { name, act_no } = req.body;
    const errors = [];
    
    if (!name || name.trim().length === 0) {
      errors.push('Statute name is required');
    } else if (name.trim().length > 255) {
      errors.push('Statute name is too long (maximum 255 characters)');
    }
    
    if (act_no && act_no.trim().length > 100) {
      errors.push('Act number is too long (maximum 100 characters)');
    }
    
    // Check for duplicates
    if (name && name.trim().length > 0) {
      const existingName = await pool.query(
        'SELECT id FROM statute WHERE name = $1',
        [name.trim()]
      );
      
      if (existingName.rows.length > 0) {
        errors.push('A statute with this name already exists');
      }
    }
    
    if (act_no && act_no.trim().length > 0) {
      const existingActNo = await pool.query(
        'SELECT id FROM statute WHERE act_no = $1',
        [act_no.trim()]
      );
      
      if (existingActNo.rows.length > 0) {
        errors.push('A statute with this act number already exists');
      }
    }
    
    res.json({
      valid: errors.length === 0,
      errors: errors
    });
    
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      valid: false,
      errors: ['Validation failed due to server error']
    });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log('Authentication enabled - users must log in to access the application');
});