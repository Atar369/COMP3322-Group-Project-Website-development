import { useEffect, useState } from 'react';
import api from '../services/api';
import DishRatingSummary from './DishRatingSummary';
import DishCustomerReviews from './DishCustomerReviews';

export default function DishReviewsDialog({ item, onClose, onSaved }) {
  const [details, setDetails] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    api.get(`/menu/${item.item_id}/reviews`)
      .then(response => {
        if (!active) return;
        const data = response.data;
        setDetails(data);
        setRating(data.my_review?.rating || 0);
        setComment(data.my_review?.comment || '');
      })
      .catch(requestError => {
        if (active) setError(requestError.response?.data?.error || 'Could not load dish reviews. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [item.item_id]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !saving) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, saving]);

  async function submitReview(event) {
    event.preventDefault();
    if (!rating || saving) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await api.post(`/menu/${item.item_id}/reviews`, { rating, comment });
      setMessage(response.data.updated ? 'Your review has been updated.' : 'Thank you for sharing your review.');
      onSaved({
        item_id: item.item_id,
        average_rating: response.data.average_rating,
        review_count: response.data.review_count,
      });
      const savedReview = response.data.review;
      setDetails(previous => ({
        ...previous,
        average_rating: response.data.average_rating,
        review_count: response.data.review_count,
        my_review: savedReview,
        reviews: [
          savedReview,
          ...(previous?.reviews || []).filter(review => review.review_id !== savedReview.review_id),
        ].slice(0, 50),
      }));
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not save your review. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dish-reviews-overlay" onMouseDown={event => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <section
        className="dish-reviews-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dish-reviews-title"
      >
        <button type="button" className="dish-reviews-close" onClick={onClose} disabled={saving} aria-label="Close reviews">×</button>
        <span className="section-label">FROM OUR DINING TABLES</span>
        <h2 id="dish-reviews-title">{item.name}</h2>
        <p className="dish-reviews-description">{item.description}</p>
        <DishRatingSummary item={details || item} />

        {loading ? (
          <p className="dish-reviews-state">Loading reviews…</p>
        ) : error && !details ? (
          <p className="error-text" role="alert">{error}</p>
        ) : (
          <>
            {details?.can_review ? (
              <form className="dish-review-form" onSubmit={submitReview}>
                <h3>{details.my_review ? 'Update your review' : 'Had this dish? Share your review'}</h3>
                <p>Reviews are available after this dish has been paid for.</p>
                <div className="dish-review-star-picker" role="radiogroup" aria-label="Your rating">
                  {[1, 2, 3, 4, 5].map(value => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={rating === value}
                      aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`}
                      className={value <= rating ? 'is-selected' : ''}
                      onClick={() => setRating(value)}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <label>
                  Comment (optional)
                  <textarea
                    value={comment}
                    onChange={event => setComment(event.target.value)}
                    maxLength={1000}
                    rows={3}
                    placeholder="What did you think of this dish?"
                  />
                </label>
                <div className="dish-review-form-footer">
                  <span>{comment.length}/1000</span>
                  <button type="submit" className="btn" disabled={!rating || saving}>
                    {saving ? 'Saving…' : details.my_review ? 'Update review' : 'Submit review'}
                  </button>
                </div>
              </form>
            ) : (
              <p className="dish-review-eligibility">
                You can rate and review this dish after it appears in an order that has been paid.
              </p>
            )}

            {message && <p className="dish-review-success" role="status">{message}</p>}
            {error && <p className="error-text" role="alert">{error}</p>}

            <DishCustomerReviews reviews={details?.reviews} reviewCount={details?.review_count} />
          </>
        )}
      </section>
    </div>
  );
}
