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

// GET /api/menu — protected (customer + manager can read)
async function list(request, response) {
  try {
    const [rows] = await db.query(
      `SELECT m.item_id, m.name, m.description, m.category, m.price, m.image_url, m.is_available,
              COALESCE(ratings.average_rating, 0) AS average_rating,
              COALESCE(ratings.review_count, 0) AS review_count
       FROM menu_items m
       LEFT JOIN (
         SELECT item_id, AVG(rating) AS average_rating, COUNT(*) AS review_count
         FROM dish_reviews
         GROUP BY item_id
       ) ratings ON ratings.item_id = m.item_id
       ORDER BY m.category ASC, m.name ASC, m.item_id ASC`
    );
    return response.json(rows);
  } catch (error) {
    console.error('Menu list failed:', error);
    return response.status(500).json({ error: 'Could not load the menu. Please try again.' });
  }
}

async function listReviews(request, response) {
  const { id } = request.params;
  if (!/^\d+$/.test(id) || Number(id) <= 0) {
    return response.status(400).json({ error: 'Invalid dish ID.' });
  }

  try {
    const [items] = await db.query('SELECT item_id FROM menu_items WHERE item_id = ?', [id]);
    if (!items.length) return response.status(404).json({ error: 'Dish not found.' });

    const [reviews] = await db.query(
      `SELECT r.review_id, r.rating, r.comment, r.updated_at,
              u.name AS reviewer_name
       FROM dish_reviews r
       JOIN users u ON u.user_id = r.user_id
       WHERE r.item_id = ?
       ORDER BY r.updated_at DESC, r.review_id DESC
       LIMIT 50`,
      [id]
    );
    const [summaryRows] = await db.query(
      `SELECT AVG(rating) AS average_rating, COUNT(*) AS review_count
       FROM dish_reviews
       WHERE item_id = ?`,
      [id]
    );
    const [eligibilityRows] = await db.query(
      `SELECT EXISTS (
         SELECT 1
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.order_id
         WHERE o.user_id = ? AND oi.item_id = ?
           AND o.payment_status = 'paid'
       ) AS can_review`,
      [request.user.user_id, id]
    );
    const [myReviews] = await db.query(
      `SELECT review_id, rating, comment, updated_at
       FROM dish_reviews
       WHERE item_id = ? AND user_id = ?`,
      [id, request.user.user_id]
    );
    const summary = summaryRows[0];
    return response.json({
      reviews,
      average_rating: Number(summary.average_rating) || 0,
      review_count: Number(summary.review_count),
      can_review: Boolean(eligibilityRows[0].can_review),
      my_review: myReviews[0] || null,
    });
  } catch (error) {
    console.error('Dish reviews list failed:', error);
    return response.status(500).json({ error: 'Could not load dish reviews. Please try again.' });
  }
}

async function saveReview(request, response) {
  const { id } = request.params;
  const { rating, comment = '' } = request.body;
  const numericRating = Number(rating);
  if (!/^\d+$/.test(id) || Number(id) <= 0) {
    return response.status(400).json({ error: 'Invalid dish ID.' });
  }
  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    return response.status(400).json({ error: 'Choose a rating from 1 to 5 stars.' });
  }
  if (typeof comment !== 'string' || comment.trim().length > 1000) {
    return response.status(400).json({ error: 'Comments must be 1,000 characters or fewer.' });
  }

  try {
    const [eligibilityRows] = await db.query(
      `SELECT EXISTS (
         SELECT 1
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.order_id
         WHERE o.user_id = ? AND oi.item_id = ?
           AND o.payment_status = 'paid'
       ) AS can_review`,
      [request.user.user_id, id]
    );
    if (!eligibilityRows[0].can_review) {
      return response.status(403).json({ error: 'You can review this dish after it has been paid for.' });
    }

    const [result] = await db.query(
      `INSERT INTO dish_reviews (item_id, user_id, rating, comment)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         rating = VALUES(rating),
         comment = VALUES(comment),
         updated_at = UTC_TIMESTAMP()`,
      [id, request.user.user_id, numericRating, comment.trim()]
    );
    const [savedReviews] = await db.query(
      `SELECT r.review_id, r.rating, r.comment, r.updated_at, u.name AS reviewer_name
       FROM dish_reviews r
       JOIN users u ON u.user_id = r.user_id
       WHERE r.item_id = ? AND r.user_id = ?`,
      [id, request.user.user_id]
    );
    const [summaryRows] = await db.query(
      `SELECT AVG(rating) AS average_rating, COUNT(*) AS review_count
       FROM dish_reviews
       WHERE item_id = ?`,
      [id]
    );
    return response.json({
      review: savedReviews[0],
      average_rating: Number(summaryRows[0].average_rating) || 0,
      review_count: Number(summaryRows[0].review_count),
      updated: result.affectedRows === 2,
    });
  } catch (error) {
    console.error('Dish review save failed:', error);
    return response.status(500).json({ error: 'Could not save your review. Please try again.' });
  }
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

// PATCH /api/menu/:id — manager: only price + is_available
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
  if (updates.length === 0) {
    return response.status(400).json({ error: 'Provide a price or availability update.' });
  }

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
    const [rows] = await db.query(
      'SELECT image_url FROM menu_items WHERE item_id = ?',
      [request.params.id]
    );
    if (!rows.length) return response.status(404).json({ error: 'Menu item not found.' });

    const [result] = await db.query('DELETE FROM menu_items WHERE item_id = ?', [request.params.id]);
    if (!result.affectedRows) return response.status(404).json({ error: 'Menu item not found.' });

    const imageUrl = rows[0].image_url;
    if (imageUrl && imageUrl.startsWith('/uploads/menu-images/')) {
      const filename = imageUrl.split('/').pop();
      await fs.unlink(path.join(MENU_IMAGE_DIR, filename)).catch(() => {});
    }

    return response.json({ message: 'Menu item removed.' });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return response.status(409).json({
        error: 'This dish has existing order or review history and cannot be removed. Mark it sold out instead.',
      });
    }
    console.error('Menu item removal failed:', error);
    return response.status(500).json({ error: 'Could not remove the menu item. Please try again.' });
  }
}

module.exports = { list, listReviews, saveReview, create, update, remove, MENU_IMAGE_DIR };