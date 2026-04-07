/**
 * Question Picker for CodeDuel
 * Picks N random questions by category from the database
 */

const db = require('../db');

/**
 * Pick random questions for a match
 * @param {string} category - Question category
 * @param {number} count - Number of questions to pick
 * @returns {Array} Selected questions with order
 */
function pickQuestions(category, count) {
  const questions = db.prepare(
    'SELECT * FROM questions WHERE category = ? ORDER BY RANDOM() LIMIT ?'
  ).all(category.toLowerCase(), count);

  if (questions.length < count) {
    // If not enough in exact category, fill with others
    const remaining = count - questions.length;
    const existingIds = questions.map(q => q.id);
    const placeholders = existingIds.length > 0 ? existingIds.map(() => '?').join(',') : '0';
    const extras = db.prepare(
      `SELECT * FROM questions WHERE id NOT IN (${placeholders}) ORDER BY RANDOM() LIMIT ?`
    ).all(...existingIds, remaining);
    questions.push(...extras);
  }

  return questions.map((q, i) => ({
    ...q,
    questionOrder: i + 1,
  }));
}

/**
 * Get available categories
 */
function getCategories() {
  return db.prepare('SELECT DISTINCT category FROM questions ORDER BY category').all().map(r => r.category);
}

module.exports = { pickQuestions, getCategories };
