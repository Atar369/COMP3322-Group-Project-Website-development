const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const db = require('../db');

const MENU_IMAGE_DIR = process.env.MENU_IMAGE_DIR
  || path.join(__dirname, '..', 'public', 'uploads', 'menu-images');

const ALLOWED_CATEGORIES = new Set(['Starter', 'Main', 'Side', 'Dessert', 'Beverage']);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function validateMenuFields({ name, description, category, price }) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) {
    return 'Dish name is required and must be 120 characters or fewer.';
  }
  if (typeof description !== 'string' || description.length > 5000) {
    return 'Description is required and must be 5000 characters or fewer.';
  }
  if (!ALLOWED_CATEGORIES.has(category)) {
    return 'Choose a valid menu category.';
  }
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice) || numericPrice <= 0 || !/^\d+(\.\d{1,2})?$/.test(String(price))) {
    return 'Enter a price greater than zero with up to two decimal places.';
  }
  return null;
}

function validatePng(file) {
  return file
    && file.mimetype === 'image/png'
    && file.originalname.toLowerCase().endsWith('.png')
    && file.buffer.length >= PNG_SIGNATURE.length
    && file.buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
}

async function saveImage(file) {
  if (!validatePng(file)) {
    const error = new Error('Upload a valid PNG image.');
    error.status = 400;
    throw error;
  }
  await fs.mkdir(MENU_IMAGE_DIR, { recursive: true });
  const filename = `${randomUUID()}.png`;
  await fs.writeFile(path.join(MENU_IMAGE_DIR, filename), file.buffer, { flag: 'wx' });
  return { filename, url: `/uploads/menu-images/${filename}` };
}

async function create(request, response) {
  const validationError = validateMenuFields(request.body);
  if (validationError) return response.status(400).json({ error: validationError });
  if (!request.file) return response.status(400).json({ error: 'A PNG food image is required.' });

  let savedImage;
  try {
    savedImage = await saveImage(request.file);
    const [result] = await db.query(
      `INSERT INTO menu_items (name, description, category, price, image_url, is_available)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [
        request.body.name.trim(),
        request.body.description.trim(),
        request.body.category,
        Number(request.body.price),
        savedImage.url,
      ]
    );
    return response.status(201).json({
      item: {
        item_id: result.insertId,
        name: request.body.name.trim(),
        description: request.body.description.trim(),
        category: request.body.category,
        price: Number(request.body.price),
        image_url: savedImage.url,
        is_available: 1,
      },
    });
  } catch (error) {
    if (savedImage) {
      await fs.unlink(path.join(MENU_IMAGE_DIR, savedImage.filename)).catch(cleanupError => {
        console.error('Failed to remove unreferenced menu image:', cleanupError);
      });
    }
    if (error.status) return response.status(error.status).json({ error: error.message });
    console.error('Menu item creation failed:', error);
    return response.status(500).json({ error: 'Could not add the menu item. Please try again.' });
  }
}

async function update(request, response) {
  const { id } = request.params;
  const { price, is_available: isAvailable } = request.body;
  const updates = [];
  const values = [];

  if (price !== undefined) {
    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0 || !/^\d+(\.\d{1,2})?$/.test(String(price))) {
      return response.status(400).json({ error: 'Enter a price greater than zero with up to two decimal places.' });
    }
    updates.push('price = ?');
    values.push(numericPrice);
  }
  if (isAvailable !== undefined) {
    if (isAvailable !== true && isAvailable !== false) {
      return response.status(400).json({ error: 'Availability must be true or false.' });
    }
    updates.push('is_available = ?');
    values.push(isAvailable);
  }
  if (updates.length === 0) return response.status(400).json({ error: 'Provide a price or availability update.' });

  try {
    values.push(id);
    const [result] = await db.query(
      `UPDATE menu_items SET ${updates.join(', ')} WHERE item_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return response.status(404).json({ error: 'Menu item not found.' });
    }

    const [rows] = await db.query(
      `SELECT item_id, name, description, category, price, image_url, is_available
       FROM menu_items WHERE item_id = ?`,
      [id]
    );
    return response.json({ item: rows[0] });

  } catch (error) {
    console.error('Menu item update failed:', error);
    return response.status(500).json({ error: 'Could not update the menu item. Please try again.' });
  }
}

async function remove(request, response) {
  try {
    const [result] = await db.query('DELETE FROM menu_items WHERE item_id = ?', [request.params.id]);
    if (!result.affectedRows) return response.status(404).json({ error: 'Menu item not found.' });
    return response.json({ message: 'Menu item removed.' });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return response.status(409).json({
        error: 'This dish is part of an existing order and cannot be removed. Mark it sold out instead.',
      });
    }
    console.error('Menu item removal failed:', error);
    return response.status(500).json({ error: 'Could not remove the menu item. Please try again.' });
  }
}

module.exports = { create, update, remove, MENU_IMAGE_DIR };