import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import DishRatingSummary from '../components/DishRatingSummary';
import DishCustomerReviews from '../components/DishCustomerReviews';

export default function BillDishReviews() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const orderIds = searchParams.get('order_ids') || '';
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingItemId, setSavingItemId] = useState(null);
  const [saveErrors, setSaveErrors] = useState({});
  const [savedItemIds, setSavedItemIds] = useState([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.get(`/orders/history/${user.user_id}/review-dishes`, { params: { order_ids: orderIds } })
      .then(response => {
        if (active) {
          setDishes(response.data.map(dish => ({
            ...dish,
            rating: Number(dish.my_rating) || 0,
            comment: dish.my_comment || '',
            reviews: dish.reviews || [],
          })));
        }
      })
      .catch(requestError => {
        if (active) {
          setDishes([]);
          setError(requestError.response?.data?.error || 'Could not load dishes from this paid bill. Please try again.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [orderIds, user.user_id]);

  function updateDish(itemId, field, value) {
    setDishes(previous => previous.map(dish => (
      dish.item_id === itemId ? { ...dish, [field]: value } : dish
    )));
  }

  async function submitReview(event, dish) {
    event.preventDefault();
    if (!dish.rating || savingItemId != null) return;
    setSavingItemId(dish.item_id);
    setSaveErrors(previous => ({ ...previous, [dish.item_id]: '' }));
    try {
      const response = await api.post(`/menu/${dish.item_id}/reviews`, {
        rating: dish.rating,
        comment: dish.comment,
      });
      setDishes(previous => previous.map(current => (
        current.item_id === dish.item_id
          ? {
            ...current,
            average_rating: response.data.average_rating,
            review_count: response.data.review_count,
            my_rating: response.data.review.rating,
            my_comment: response.data.review.comment,
            reviews: [
              response.data.review,
              ...(current.reviews || []).filter(review => review.review_id !== response.data.review.review_id),
            ].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)),
          }
          : current
      )));
      setSavedItemIds(previous => previous.includes(dish.item_id) ? previous : [...previous, dish.item_id]);
    } catch (requestError) {
      setSaveErrors(previous => ({
        ...previous,
        [dish.item_id]: requestError.response?.data?.error || 'Could not save your review. Please try again.',
      }));
    } finally {
      setSavingItemId(null);
    }
  }

  return (
    <div className="page bill-review-page">
      <Link className="bill-review-back" to="/order-history">← Back to Order History</Link>
      <span className="section-label">YOUR PAID BILL</span>
      <h1>Rate dishes you ordered</h1>
      <p className="bill-review-intro">Only dishes in this paid bill are shown here. Share a rating and an optional comment for each one.</p>

      {loading && <p className="dish-reviews-state">Loading your paid bill…</p>}
      {!loading && error && <p className="error-text" role="alert">{error}</p>}
      {!loading && !error && dishes.length === 0 && (
        <p className="dish-reviews-state">No dishes from this paid bill are available to review.</p>
      )}
      {!loading && !error && dishes.length > 0 && (
        <div className="bill-review-dishes">
          {dishes.map(dish => (
            <article className="bill-review-dish" key={dish.item_id}>
              <span className="menu-food-type">{dish.category}</span>
              <h2>{dish.name}</h2>
              {dish.description && <p className="bill-review-description">{dish.description}</p>}
              <DishRatingSummary item={dish} />
              <form className="dish-review-form" onSubmit={event => submitReview(event, dish)}>
                <h3>{dish.my_rating ? 'Update your rating and comment' : 'Your rating and comment'}</h3>
                <div className="dish-review-star-picker" role="radiogroup" aria-label={`Your rating for ${dish.name}`}>
                  {[1, 2, 3, 4, 5].map(value => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={dish.rating === value}
                      aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`}
                      className={value <= dish.rating ? 'is-selected' : ''}
                      onClick={() => updateDish(dish.item_id, 'rating', value)}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <label>
                  Comment (optional)
                  <textarea
                    value={dish.comment}
                    onChange={event => updateDish(dish.item_id, 'comment', event.target.value)}
                    maxLength={1000}
                    rows={3}
                    placeholder={`What did you think of ${dish.name}?`}
                  />
                </label>
                <div className="dish-review-form-footer">
                  <span>{dish.comment.length}/1000</span>
                  <button type="submit" className="btn" disabled={!dish.rating || savingItemId != null}>
                    {savingItemId === dish.item_id ? 'Saving…' : dish.my_rating ? 'Update review' : 'Submit review'}
                  </button>
                </div>
                {savedItemIds.includes(dish.item_id) && (
                  <p className="dish-review-success" role="status">Your review has been saved.</p>
                )}
                {saveErrors[dish.item_id] && <p className="error-text" role="alert">{saveErrors[dish.item_id]}</p>}
              </form>
              <DishCustomerReviews reviews={dish.reviews} reviewCount={dish.review_count} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
